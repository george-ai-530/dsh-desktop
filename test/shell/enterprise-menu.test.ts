import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { aboutMenuLabel, aboutUsesPage, buildDarwinDesktopMenu, buildWindowsApplicationMenu, externalUrlToOpen, insertFileMenu, safeModeMenuLabel, shortcutFileMenuLabels, standardMenuLabels, updateMenuLabel } from '../../src/main/shell/enterprise-menu'

// COWIN rebrand contract: the product-site ("了解企业版") entry is gone from
// the macOS menu and the in-page settings footer — no dshdesktop.com links
// remain in user-visible chrome. About/Update ordering and the rest of the
// command set are unchanged.
describe('application menu', () => {
  it('uses the product labels for both languages', () => {
    expect(updateMenuLabel('zh-CN')).toBe('检查更新…')
    expect(updateMenuLabel('en-US')).toBe('Check for Updates…')
    expect(aboutMenuLabel('zh-CN')).toBe('关于 COWIN Harness Desktop')
    expect(aboutMenuLabel('en-US')).toBe('About COWIN Harness Desktop')
    expect(safeModeMenuLabel('zh-CN')).toBe('以安全模式重启…')
    expect(safeModeMenuLabel('en-US')).toBe('Restart as Safe Mode…')
    expect(aboutUsesPage('dsh-app://app/', 'dsh-app')).toBe(true)
    expect(aboutUsesPage('dsh-app://app/index.html', 'dsh-app')).toBe(true)
    expect(aboutUsesPage('file:///tmp/splash.html', 'dsh-app')).toBe(false)
    expect(externalUrlToOpen('https://example.com/page')).toBe('https://example.com/page')
    expect(externalUrlToOpen('javascript:alert(1)')).toBeUndefined()
    expect(externalUrlToOpen('not a url')).toBeUndefined()
  })

  it.each(['zh-CN', 'en-US'])('orders about, updates, then restart in the %s app menu with no enterprise item', locale => {
    const showAbout = vi.fn()
    const checkForUpdates = vi.fn()
    const restart = vi.fn()
    const restartSafeMode = vi.fn()
    const showHarnessLog = vi.fn()
    const hide = vi.fn()
    const hideOthers = vi.fn()
    const unhideAll = vi.fn()
    const quit = vi.fn()
    const menu = buildDarwinDesktopMenu({
      locale,
      appName: 'COWIN Harness Desktop Shell',
      showAbout,
      checkForUpdates,
      restart,
      restartSafeMode,
      showHarnessLog,
      hide,
      hideOthers,
      unhideAll,
      quit
    })
    const submenu = menu[0]?.submenu ?? []
    expect(submenu[0]?.label).toBe(locale.startsWith('zh') ? '关于 COWIN Harness Desktop' : 'About COWIN Harness Desktop')
    expect(submenu[1]?.label).toBe(locale.startsWith('zh') ? '检查更新…' : 'Check for Updates…')
    expect(submenu[1]?.accelerator).toBe('CmdOrCtrl+U')
    expect(submenu[2]?.label).toBe(locale.startsWith('zh') ? '重启' : 'Restart')
    expect(submenu[2]?.accelerator).toBe('CmdOrCtrl+Shift+R')
    expect(submenu[3]?.label).toBe(locale.startsWith('zh') ? '以安全模式重启…' : 'Restart as Safe Mode…')
    expect(submenu[4]?.label).toBe(locale.startsWith('zh') ? '显示 Harness 日志' : 'Show Harness Log')
    expect(submenu.some(item => item.label === '了解企业版' || item.label === 'Explore Enterprise')).toBe(false)
    submenu[0]?.click?.()
    submenu[1]?.click?.()
    submenu[2]?.click?.()
    submenu[3]?.click?.()
    submenu[4]?.click?.()
    expect(showAbout).toHaveBeenCalledOnce()
    expect(checkForUpdates).toHaveBeenCalledOnce()
    expect(restart).toHaveBeenCalledOnce()
    expect(restartSafeMode).toHaveBeenCalledOnce()
    expect(showHarnessLog).toHaveBeenCalledOnce()
    submenu[6]?.click?.()
    submenu[7]?.click?.()
    submenu[8]?.click?.()
    submenu[10]?.click?.()
    expect(hide).toHaveBeenCalledOnce()
    expect(hideOthers).toHaveBeenCalledOnce()
    expect(unhideAll).toHaveBeenCalledOnce()
    expect(quit).toHaveBeenCalledOnce()
    const standard = standardMenuLabels(locale)
    expect(menu.map(item => item.label)).toEqual(['COWIN Harness Desktop Shell', standard.edit, standard.window])
    expect(menu[1]?.submenu?.[0]).toMatchObject({ role: 'undo', label: standard.undo })
    expect(menu[1]?.submenu?.[6]).toMatchObject({ role: 'selectAll', label: standard.selectAll })
    expect(menu[2]?.submenu?.[0]).toMatchObject({ role: 'minimize', label: standard.minimize })
    expect(menu[2]?.submenu?.[1]).toMatchObject({ role: 'close', label: standard.close })
    const withoutSafeMode = buildDarwinDesktopMenu({
      locale,
      appName: 'COWIN Harness Desktop Shell',
      showAbout,
      checkForUpdates,
      restart,
      showHarnessLog,
      hide,
      hideOthers,
      unhideAll,
      quit
    })
    const safeModeOmitted = withoutSafeMode[0]?.submenu ?? []
    expect(safeModeOmitted.some(item => item.label === safeModeMenuLabel(locale))).toBe(false)
    expect(safeModeOmitted[2]?.label).toBe(locale.startsWith('zh') ? '重启' : 'Restart')
    expect(safeModeOmitted[3]?.label).toBe(locale.startsWith('zh') ? '显示 Harness 日志' : 'Show Harness Log')
  })

  it('places the file menu after the application menu', () => {
    const labels = shortcutFileMenuLabels('zh-CN')
    const menu = insertFileMenu([
      { label: 'COWIN Harness Desktop Shell', submenu: [{ label: '关于 COWIN Harness Desktop' }] },
      { label: 'Edit' }
    ], { label: labels.fileMenu, submenu: [{ label: labels.closePage }] })
    expect(menu[0]?.submenu?.[0]?.label).toBe('关于 COWIN Harness Desktop')
    expect(menu[1]?.label).toBe('文件')
    expect(menu[1]?.submenu?.[0]?.label).toBe('关闭页面或窗口')
    expect(menu[2]?.label).toBe('Edit')
    expect(shortcutFileMenuLabels('en-US').closePage).toBe('Close Page or Window')
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
    expect(labels).not.toContain(safeModeMenuLabel('zh-CN'))
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
    expect((english[0]?.submenu ?? []).some(item => item.label === safeModeMenuLabel('en'))).toBe(false)
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
    expect(source.includes('bundledHarnessVersion(')).toBe(true)
    expect(source.includes("app.setPath('userData', join(app.getPath('appData'), 'dsh-desktop'))")).toBe(true)
    expect(source.includes('configureDesktopIdentity()')).toBe(true)
    expect(source.includes('mandatory-update')).toBe(false)
    expect(source.includes('autoDownload = true')).toBe(false)
  })
})
