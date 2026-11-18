import { desktopMenuMessages } from './menu-messages'

export interface DesktopMenuItem {
  id?: string
  label?: string
  type?: 'separator'
  role?: string
  enabled?: boolean
  accelerator?: string
  submenu?: DesktopMenuItem[]
  click?: () => void
}

export function updateMenuLabel(locale: string): string {
  return desktopMenuMessages(locale).update
}

export function aboutMenuLabel(locale: string): string {
  return desktopMenuMessages(locale).about
}

export function safeModeMenuLabel(locale: string): string {
  return desktopMenuMessages(locale).safeMode
}

export function restartMenuLabel(locale: string): string {
  return desktopMenuMessages(locale).restart
}

export function shortcutFileMenuLabels(locale: string): { fileMenu: string, closePage: string } {
  const { fileMenu, closePage } = desktopMenuMessages(locale)
  return { fileMenu, closePage }
}

/** Role actions remain native; their labels follow the Desktop language. */
export function standardMenuLabels(locale: string) {
  const { edit, undo, redo, cut, copy, paste, selectAll, window, minimize, close } = desktopMenuMessages(locale)
  return { edit, undo, redo, cut, copy, paste, selectAll, window, minimize, close }
}

/** Keep About first. The file menu follows the application menu when shortcuts are installed. */
export function insertFileMenu(items: readonly DesktopMenuItem[], fileMenu: DesktopMenuItem | undefined): DesktopMenuItem[] {
  if (fileMenu === undefined) return [...items]
  const [application, ...rest] = items
  if (application === undefined) return [fileMenu]
  return [application, fileMenu, ...rest]
}

/** The in-app about dialog is mounted only on the application document. */
export function aboutUsesPage(url: string, scheme: string): boolean {
  try {
    const destination = new URL(url)
    return destination.protocol === `${scheme}:` && destination.hostname === 'app'
  } catch {
    return false
  }
}

/** Open http(s) outside the app window. Any other URL stays closed. */
export function externalUrlToOpen(url: string): string | undefined {
  try {
    const destination = new URL(url)
    if (destination.protocol !== 'https:' && destination.protocol !== 'http:') return undefined
    return destination.href
  } catch {
    return undefined
  }
}

/**
 * macOS application menu. About opens the product dialog.
 * The next item checks for an update. Download starts only after consent.
 * Restart starts the current Host again. Safe Mode relaunches into the core profile when that action is supplied.
 * The next item reveals harness.log. It stays after Restart when Safe Mode is already active.
 * Phone pairing stays out of this menu.
 * Windows no longer mirrors this command set: its hidden application menu
 * carries only Restart and Quit.
 */
export function buildDarwinDesktopMenu(options: {
  locale: string
  appName: string
  showAbout: () => void
  checkForUpdates: () => void
  restart?: () => void
  restartSafeMode?: () => void
  showHarnessLog: () => void
  hide: () => void
  hideOthers: () => void
  unhideAll: () => void
  quit: () => void
}): DesktopMenuItem[] {
  const text = desktopMenuMessages(options.locale)
  const standard = standardMenuLabels(options.locale)
  return [
    {
      label: options.appName,
      submenu: [
        { label: aboutMenuLabel(options.locale), click: options.showAbout },
        { label: updateMenuLabel(options.locale), accelerator: 'CmdOrCtrl+U', click: options.checkForUpdates },
        ...(options.restart === undefined
          ? []
          : [{ label: restartMenuLabel(options.locale), accelerator: 'CmdOrCtrl+Shift+R', click: options.restart }]),
        ...(options.restartSafeMode === undefined
          ? []
          : [{ label: safeModeMenuLabel(options.locale), click: options.restartSafeMode }]),
        { label: text.log, click: options.showHarnessLog },
        { type: 'separator' },
        {
          label: text.hide.replace('{app}', options.appName),
          accelerator: 'Command+H',
          click: options.hide
        },
        { label: text.hideOthers, accelerator: 'Command+Alt+H', click: options.hideOthers },
        { label: text.showAll, click: options.unhideAll },
        { type: 'separator' },
        {
          label: text.quitApp.replace('{app}', options.appName),
          accelerator: 'Command+Q',
          click: options.quit
        }
      ]
    },
    {
      label: standard.edit,
      submenu: [
        { role: 'undo', label: standard.undo },
        { role: 'redo', label: standard.redo },
        { type: 'separator' },
        { role: 'cut', label: standard.cut },
        { role: 'copy', label: standard.copy },
        { role: 'paste', label: standard.paste },
        { role: 'selectAll', label: standard.selectAll }
      ]
    },
    {
      label: standard.window,
      submenu: [
        { role: 'minimize', label: standard.minimize },
        { role: 'close', label: standard.close }
      ]
    }
  ]
}

/**
 * Hidden Windows application menu. The bar stays invisible; roles and the
 * remaining Harness accelerator (Restart) stay registered. The visible caption
 * menu is the trimmed 应用 dropdown; 编辑/视图/窗口 keep their roles and labels.
 */
export function buildWindowsApplicationMenu(options: {
  locale: string
  restart: () => void
  quit: () => void
}): DesktopMenuItem[] {
  const text = desktopMenuMessages(options.locale)
  const standard = standardMenuLabels(options.locale)
  return [
    {
      label: text.application,
      submenu: [
        {
          label: restartMenuLabel(options.locale),
          accelerator: 'CmdOrCtrl+Shift+R',
          click: options.restart
        },
        { type: 'separator' },
        { role: 'quit', label: text.exit, click: options.quit }
      ]
    },
    {
      label: standard.edit,
      submenu: [
        { role: 'undo', label: standard.undo },
        { role: 'redo', label: standard.redo },
        { type: 'separator' },
        { role: 'cut', label: standard.cut },
        { role: 'copy', label: standard.copy },
        { role: 'paste', label: standard.paste },
        { role: 'selectAll', label: standard.selectAll }
      ]
    },
    {
      label: text.view,
      submenu: [
        { role: 'reload', label: text.reload },
        { type: 'separator' },
        { role: 'resetZoom', label: text.actualSize },
        { role: 'zoomIn', label: text.zoomIn },
        { role: 'zoomOut', label: text.zoomOut },
        { type: 'separator' },
        { role: 'togglefullscreen', label: text.fullscreen }
      ]
    },
    {
      label: standard.window,
      submenu: [
        { role: 'minimize', label: standard.minimize },
        { role: 'close', label: standard.close }
      ]
    }
  ]
}
