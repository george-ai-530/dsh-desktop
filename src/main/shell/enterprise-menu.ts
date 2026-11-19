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

function aboutMenuLabel(locale: string): string {
  return desktopMenuMessages(locale).about
}

export function restartMenuLabel(locale: string): string {
  return desktopMenuMessages(locale).restart
}

/** Role actions remain native; their labels follow the Desktop language. */
export function standardMenuLabels(locale: string) {
  const { edit, undo, redo, cut, copy, paste, selectAll, window, minimize, close } = desktopMenuMessages(locale)
  return { edit, undo, redo, cut, copy, paste, selectAll, window, minimize, close }
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
 * macOS application menu, trimmed to the command set the Windows menus keep:
 * About, Restart, the platform-standard Hide group and Quit. About opens the
 * product dialog; Restart starts the current Host again.
 * Deliberately absent on every platform, with the surviving way in:
 * - Check for Updates: packaged auto-checks plus the About dialog button in
 *   system dialogs (update/update-manager policy).
 * - Restart as Safe Mode: the fatal-error dialog button and --safe-mode.
 * - Show harness.log: no shell entry.
 * - Close Page or Window: the product page receives the page.close shortcut
 *   through the generic keyboard dispatch (shell/keyboard.ts), not a menu.
 * Phone pairing stays out of this menu.
 */
export function buildDarwinDesktopMenu(options: {
  locale: string
  appName: string
  showAbout: () => void
  restart?: () => void
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
        ...(options.restart === undefined
          ? []
          : [{ label: restartMenuLabel(options.locale), accelerator: 'CmdOrCtrl+Shift+R', click: options.restart }]),
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
