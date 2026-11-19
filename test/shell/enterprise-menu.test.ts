import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { aboutUsesPage, buildDarwinDesktopMenu, buildWindowsApplicationMenu, externalUrlToOpen, standardMenuLabels } from '../../src/main/shell/enterprise-menu'

// COWIN rebrand contract: the product-site ("了解企业版") entry is gone from
// the macOS menu and the in-page settings footer — no dshdesktop.com links
// remain in user-visible chrome. Both platforms keep the same trimmed command
// set (About, Restart, Quit plus the platform-standard groups); Check for
// Updates, Safe Mode, the Harness log and the file menu have no menu item
// anywhere.
describe('application menu', () => {
  it('routes the about dialog and external links', () => {
    expect(aboutUsesPage('dsh-app://app/', 'dsh-app')).toBe(true)
    expect(aboutUsesPage('dsh-app://app/index.html', 'dsh-app')).toBe(true)
    expect(aboutUsesPage('file:///tmp/splash.html', 'dsh-app')).toBe(false)
    expect(externalUrlToOpen('https://example.com/page')).toBe('https://example.com/page')
    expect(externalUrlToOpen('javascript:alert(1)')).toBeUndefined()
    expect(externalUrlToOpen('not a url')).toBeUndefined()
  })

  it.each(['zh-CN', 'en-US'])('keeps about, restart and the platform hide group in the %s app menu', locale => {
    const zh = locale.startsWith('zh')
    const appName = 'COWIN Harness Desktop Shell'
    const showAbout = vi.fn()
    const restart = vi.fn()
    const hide = vi.fn()
    const hideOthers = vi.fn()
    const unhideAll = vi.fn()
    const quit = vi.fn()
    const menu = buildDarwinDesktopMenu({
      locale,
      appName,
      showAbout,
      restart,
      hide,
      hideOthers,
      unhideAll,
      quit
    })
    const submenu = menu[0]?.submenu ?? []
    expect(submenu[0]?.label).toBe(zh ? '关于 COWIN Harness Desktop' : 'About COWIN Harness Desktop')
    expect(submenu[1]?.label).toBe(zh ? '重启' : 'Restart')
    expect(submenu[1]?.accelerator).toBe('CmdOrCtrl+Shift+R')
    expect(submenu[3]?.label).toBe(zh ? `隐藏 ${appName}` : `Hide ${appName}`)
    expect(submenu[3]?.accelerator).toBe('Command+H')
    expect(submenu[4]?.label).toBe(zh ? '隐藏其他' : 'Hide Others')
    expect(submenu[5]?.label).toBe(zh ? '全部显示' : 'Show All')
    expect(submenu[7]?.label).toBe(zh ? `退出 ${appName}` : `Quit ${appName}`)
    expect(submenu[7]?.accelerator).toBe('Command+Q')
    // 检查更新、安全模式重启、Harness 日志与文件菜单在所有平台都没有菜单项。
    expect(submenu.some(item => item.label === '了解企业版' || item.label === 'Explore Enterprise')).toBe(false)
    const labels = submenu.map(item => item.label)
    for (const removed of [
      '检查更新…', 'Check for Updates…',
      '以安全模式重启…', 'Restart as Safe Mode…',
      '显示 Harness 日志', 'Show Harness Log',
      '文件', 'File', '关闭页面或窗口', 'Close Page or Window'
    ]) {
      expect(labels).not.toContain(removed)
    }
    const accelerators = submenu.map(item => item.accelerator)
    expect(accelerators).not.toContain('CmdOrCtrl+U')
    submenu[0]?.click?.()
    submenu[1]?.click?.()
    submenu[3]?.click?.()
    submenu[4]?.click?.()
    submenu[5]?.click?.()
    submenu[7]?.click?.()
    expect(showAbout).toHaveBeenCalledOnce()
    expect(restart).toHaveBeenCalledOnce()
    expect(hide).toHaveBeenCalledOnce()
    expect(hideOthers).toHaveBeenCalledOnce()
    expect(unhideAll).toHaveBeenCalledOnce()
    expect(quit).toHaveBeenCalledOnce()
    const standard = standardMenuLabels(locale)
    expect(menu.map(item => item.label)).toEqual([appName, standard.edit, standard.window])
    expect(menu[1]?.submenu?.[0]).toMatchObject({ role: 'undo', label: standard.undo })
    expect(menu[1]?.submenu?.[6]).toMatchObject({ role: 'selectAll', label: standard.selectAll })
    expect(menu[2]?.submenu?.[0]).toMatchObject({ role: 'minimize', label: standard.minimize })
    expect(menu[2]?.submenu?.[1]).toMatchObject({ role: 'close', label: standard.close })
  })

  it('collapses the app menu to about and the hide group when restart is unavailable', () => {
    const menu = buildDarwinDesktopMenu({
      locale: 'zh-CN',
      appName: 'DSH',
      showAbout: () => {},
      hide: () => {},
      hideOthers: () => {},
      unhideAll: () => {},
      quit: () => {}
    })
    const submenu = menu[0]?.submenu ?? []
    expect(submenu[1]?.type).toBe('separator')
    expect(submenu[2]?.label).toBe('隐藏 DSH')
    expect(submenu.map(item => item.label)).not.toContain('重启')
  })

  it('keeps only Restart and Quit on the hidden Windows application menu', () => {
    const calls: string[] = []
    const menu = buildWindowsApplicationMenu({
      locale: 'zh-CN',
      restart: () => { calls.push('restart') },
      quit: () => { calls.push('quit') }
    })
    const application = menu[0]?.submenu ?? []
    expect(menu[0]?.label).toBe('应用')
    expect(application[0]).toMatchObject({ label: '重启', accelerator: 'CmdOrCtrl+Shift+R' })
    expect(application[application.length - 1]).toMatchObject({ role: 'quit', label: '退出' })
    // 连接手机、安全模式、Harness 日志和检查更新已从隐藏菜单移除。
    const labels = application.map(child => child.label)
    expect(labels).not.toContain('连接手机…')
    expect(labels).not.toContain('以安全模式重启…')
    expect(labels).not.toContain('显示 Harness 日志')
    expect(labels).not.toContain('检查更新…')
    const accelerators = application.map(child => child.accelerator)
    expect(accelerators).toEqual(expect.arrayContaining(['CmdOrCtrl+Shift+R']))
    expect(accelerators).not.toContain('CmdOrCtrl+Shift+M')
    expect(accelerators).not.toContain('CmdOrCtrl+U')
    // 编辑/视图/窗口的 role 集合保持不变，开发者工具不再注册。
    const roles = menu.flatMap(item => (item.submenu ?? []).map(child => child.role))
    expect(roles).toEqual(expect.arrayContaining(['undo', 'copy', 'reload', 'zoomIn', 'togglefullscreen', 'quit']))
    expect(roles).not.toContain('toggleDevTools')
    menu.map(item => item.label).forEach(label => expect(['应用', '编辑', '视图', '窗口']).toContain(label))
    application[0]?.click?.()
    expect(calls).toEqual(['restart'])
    const english = buildWindowsApplicationMenu({ locale: 'en', restart: () => {}, quit: () => {} })
    expect(english[0]?.label).toBe('Application')
    expect((english[0]?.submenu ?? []).some(item => item.label === 'Restart as Safe Mode…')).toBe(false)
  })

  it('installs the menu from the new shell', async () => {
    const source = await readFile(join(import.meta.dirname, '../../src/main/shell/app.ts'), 'utf8')
    expect(source.includes('buildDarwinDesktopMenu(')).toBe(true)
    expect(source.includes('locale: menuLocale')).toBe(true)
    expect(source.includes('savedDesktopMenuLocale(')).toBe(true)
    expect(source.includes('menuLocale = resolved')).toBe(true)
    // The enterprise page link was removed with the COWIN rebrand.
    expect(source.includes('ENTERPRISE_URL')).toBe(false)
    expect(source.includes('explore-enterprise')).toBe(false)
    expect(source.includes('externalUrlToOpen(')).toBe(true)
    expect(source.includes('registerUpdateHandlers(')).toBe(true)
    expect(source.includes('startUpdateManager(')).toBe(true)
    expect(source.includes('if (app.isPackaged && !desktopDevelopmentBuild()) initializeDesktopUpdateService()')).toBe(true)
    expect(source.includes('initializeDesktopService(')).toBe(false)
    expect(source.includes('checkForUpdates(true)')).toBe(true)
    expect(source.includes('desktop:show-about')).toBe(true)
    expect(source.includes('presentAbout(target, menuLocale)')).toBe(true)
    expect(source.includes('locale: () => menuLocale')).toBe(true)
    expect(source.includes('desktop:ui-locale')).toBe(true)
    expect(source.includes('void restartDesktop()')).toBe(true)
    expect(source.includes('restartInSafeMode()')).toBe(true)
    expect(source.includes('shouldStartInSafeMode(process.argv)')).toBe(true)
    // 文件菜单已随两平台命令集对齐移除，页面快捷键走通用键盘分发。
    expect(source.includes('insertFileMenu')).toBe(false)
    expect(source.includes('shortcutFileMenuLabels')).toBe(false)
    expect(source.includes('fileMenu(')).toBe(false)
    expect(source.includes('bundledHarnessVersion(')).toBe(true)
    expect(source.includes("app.setPath('userData', join(app.getPath('appData'), 'dsh-desktop'))")).toBe(true)
    expect(source.includes('configureDesktopIdentity()')).toBe(true)
    expect(source.includes('mandatory-update')).toBe(false)
    expect(source.includes('autoDownload = true')).toBe(false)
  })
})
