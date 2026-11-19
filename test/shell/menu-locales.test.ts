import { describe, expect, it, vi } from 'vitest'
import { menuMessages, desktopMenuMessages } from '../../src/main/shell/menu-messages'
import { buildDarwinDesktopMenu, buildWindowsApplicationMenu } from '../../src/main/shell/enterprise-menu'
import { windowsMenuTemplate } from '../../src/main/windows-menu'

const languages = ['zh', 'en', 'ja', 'es', 'fr', 'de', 'ru', 'pt'] as const

describe('eight-language desktop menus', () => {
  it('keeps all keys and interpolation tokens complete', () => {
    for (const locale of languages) {
      const messages = menuMessages[locale]
      expect(Object.keys(messages).sort()).toEqual(Object.keys(menuMessages.en).sort())
      for (const key of Object.keys(menuMessages.en) as Array<keyof typeof menuMessages.en>) {
        expect(messages[key].trim()).not.toBe('')
        expect(messages[key].match(/\{\w+\}/g) ?? []).toEqual(menuMessages.en[key].match(/\{\w+\}/g) ?? [])
      }
    }
    expect(desktopMenuMessages('fr-FR')).toBe(menuMessages.fr)
    expect(desktopMenuMessages('unknown')).toBe(menuMessages.en)
  })

  it.each(languages)('preserves menu commands, roles and accelerators in %s', locale => {
    const text = menuMessages[locale]
    // 两平台命令集对齐后，检查更新、安全模式、日志与文件菜单词条已随菜单项删除。
    for (const removed of ['update', 'safeMode', 'log', 'fileMenu', 'closePage'] as const) {
      expect(removed in text).toBe(false)
    }
    const action = vi.fn()
    const darwin = buildDarwinDesktopMenu({ locale, appName: 'DSH', showAbout: action, restart: action, hide: action, hideOthers: action, unhideAll: action, quit: action })
    expect(darwin[0]?.submenu?.[0]?.label).toBe(text.about)
    expect(darwin[0]?.submenu?.[1]?.label).toBe(text.restart)
    expect(darwin[0]?.submenu?.[3]?.label).toBe(text.hide.replace('{app}', 'DSH'))
    expect(darwin[1]?.submenu?.[0]).toMatchObject({ role: 'undo', label: text.undo })
    darwin[0]?.submenu?.[1]?.click?.()
    expect(action).toHaveBeenCalledOnce()
    const windows = buildWindowsApplicationMenu({ locale, restart: action, quit: action })
    expect(windows[0]?.label).toBe(text.application)
    const windowsApplication = windows[0]?.submenu ?? []
    // 隐藏菜单只剩重启和退出，加速器随项收缩。
    expect(windowsApplication[0]).toMatchObject({ label: text.restart, accelerator: 'CmdOrCtrl+Shift+R' })
    const run = vi.fn()
    const edit = vi.fn()
    const application = windowsMenuTemplate('application', locale, 1.25, { run, sendEditingKey: edit })
    // 可见应用菜单从重启开始，视图子菜单跟随其后。
    expect(application[0]).toMatchObject({ label: text.restart, accelerator: 'Ctrl+Shift+R', registerAccelerator: false })
    application[0]?.click?.({} as never, {} as never, {} as never)
    expect(run).toHaveBeenCalledWith('restart-harness')
    const view = application[2]?.submenu
    // 视图子菜单无开发者工具（文案键已随项删除）；重新加载后缩放项在索引 4。
    expect('devtools' in text).toBe(false)
    expect(Array.isArray(view) && view[4]?.label).toContain('125%')
    const editing = windowsMenuTemplate('edit', locale, 1, { run, sendEditingKey: edit })
    expect(editing[0]?.label).toBe(text.undo)
    editing[0]?.click?.({} as never, {} as never, {} as never)
    expect(edit).toHaveBeenCalledWith({ keyCode: 'Z', modifiers: ['control'] })
  })
})
