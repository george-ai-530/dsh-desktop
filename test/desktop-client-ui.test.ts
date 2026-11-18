import { readFile } from 'node:fs/promises'
import path from 'node:path'
import vm from 'node:vm'
import { describe, expect, it, vi } from 'vitest'

const projectRoot = path.resolve(import.meta.dirname, '..')

interface Registration {
  config: { name: string; id?: string; order?: number }
  component: (props: Record<string, unknown>) => unknown
}

describe('COWIN Harness Desktop client slot occupants', () => {
  it('registers one occupant per brand seat with the COWIN mark and wordmark', async () => {
    const source = await readFile(
      path.join(projectRoot, 'packages', 'dsh-desktop-client-ui', 'client.js'),
      'utf8'
    )
    let definition: {
      factory: (require: (id: string) => unknown) => {
        apply: (ctx: unknown) => void
        inject: string[]
      }
    } | undefined
    const appended: Array<{ textContent?: string }> = []
    const removeStyle = vi.fn()
    let disposeStyle: (() => void) | undefined
    const document = {
      getElementById: vi.fn(() => null),
      createElement: vi.fn(() => ({ id: '', dataset: {}, textContent: '', remove: removeStyle })),
      head: { appendChild: (node: { textContent?: string }) => appended.push(node) }
    }
    vm.runInNewContext(source, {
      document,
      navigator: { language: 'en-US' },
      window: {
        dshDesktop: { getRepairDraft: vi.fn(), openRepairAgent: vi.fn() },
        __ModuleLoader__: {
          load: (value: typeof definition) => {
            definition = value
          }
        }
      }
    })

    expect(definition).toBeDefined()
    const createElement = (
      type: unknown,
      props: Record<string, unknown> | null,
      ...children: unknown[]
    ): { type: unknown; props: Record<string, unknown> } => ({
      type,
      props: { ...props, children }
    })
    const plugin = definition!.factory((id) => {
      if (id === 'react') {
        return {
          createElement,
          useEffect: (effect: () => void | (() => void)) => effect(),
          useState: (initial: unknown) => [initial, vi.fn()]
        }
      }
      if (id === '@deepseek-ai/dsh-client-ui-primitives') {
        return { MenuItemButton: vi.fn(), Tooltip: vi.fn() }
      }
      throw new Error(`Unexpected client dependency: ${id}`)
    })

    const registrations: Registration[] = []
    const slots = {
      inject: (_name: string, callback: () => unknown): unknown => {
        const result = callback()
        if (result && typeof result === 'object' && Symbol.iterator in result) {
          for (const _entry of result as Iterable<unknown>) void _entry
        }
        return result
      },
      register: (
        config: Registration['config'],
        component: Registration['component']
      ): (() => void) => {
        registrations.push({ config, component })
        return () => undefined
      }
    }
    plugin.apply({ slots, locale: { register: () => () => undefined, bind: () => (key: string) => key }, effect: (setup: () => (() => void) | undefined) => { disposeStyle = setup() } })

    expect(plugin.inject).toEqual(['locale', 'slots', 'remote.session', 'sessions', 'uiWorkspace'])
    expect(registrations.map(({ config }) => config.name)).toEqual([
      'conversation.input.dock',
      'sidebar.brand.mark',
      'sidebar.brand.name',
      'conversation.hero.brand.mark',
      'conversation.hero.brand.title',
      'sidebar.right.tab.document.unpreviewable',
      'sidebar.workspaces.session.menu.item',
      'sidebar.workspaces.session.menu.item',
      'sidebar.workspaces.session.menu.item'
    ])
    // 设置旁的两个快捷图标（维修/连接手机）已按产品要求移除：不再占用
    // sidebar.settings.action，也不注入桌面工具按钮样式。
    expect(registrations.some(({ config }) => config.name === 'sidebar.settings.action')).toBe(false)
    expect(appended[0]?.textContent).not.toContain('data-dsh-desktop-utilities')
    // The enterprise footer entry was removed with the COWIN rebrand: no
    // dshdesktop.com links remain in user-visible chrome.
    expect(registrations.some(({ config }) => config.id === 'desktop-enterprise-entry')).toBe(false)
    // Desktop toolbar styles have an owned lifetime; the sidebar brand stays
    // in currentColor.
    expect(appended).toHaveLength(1)
    expect(appended[0]?.textContent).toContain("[data-dsh-preset-search]")
    expect(appended[0]?.textContent).toContain("[data-dsh-market-nav-icon] span[class*=\"navIcon\"]")
    expect(appended[0]?.textContent).toContain("[data-dsh-better-sidebar-settings-nav] span[class*=\"navIcon\"]")
    // The hero bitmap variants swap on the upstream dark-theme marker; the
    // plugin never branches its colors on it (tokens do that).
    expect(appended[0]?.textContent).toContain('[data-dsh-desktop-hero-mark="light"]')
    expect(appended[0]?.textContent).toContain('body[data-ds-dark-theme] [data-dsh-desktop-hero-mark="dark"]')
    // The COWIN accent family rides in the same id-guarded style block; both
    // theme variants are defined statically (the upstream dark block selects
    // the -dark variables, so this plugin never branches on the theme marker).
    for (const variable of ['--dsh-desktop-accent-400', '--dsh-desktop-accent-450', '--dsh-desktop-accent-500', '--dsh-desktop-accent-400-dark', '--dsh-desktop-accent-450-dark', '--dsh-desktop-accent-500-dark']) {
      expect(appended[0]?.textContent).toContain(variable)
    }
    disposeStyle?.()
    expect(removeStyle).toHaveBeenCalledOnce()

    const sidebarName = registrations.find(
      ({ config }) => config.name === 'sidebar.brand.name'
    )!.component({}) as { type: unknown; props: Record<string, unknown> }
    expect(sidebarName.type).toBe('svg')
    // The outlined COWIN wordmark replaces the upstream BrandWordmark text.
    const [namePath] = sidebarName.props.children as Array<{ type: unknown; props: Record<string, unknown> }>
    expect(namePath?.type).toBe('path')
    expect(String(namePath?.props.d)).toContain('Q')

    const sidebarMark = registrations.find(
      ({ config }) => config.name === 'sidebar.brand.mark'
    )!.component({ size: 24 }) as { type: unknown; props: Record<string, unknown> }
    expect(sidebarMark.type).toBe('svg')
    expect(sidebarMark.props.height).toBe(17)
    const [markPath] = sidebarMark.props.children as Array<{ type: unknown; props: Record<string, unknown> }>
    if (!markPath) throw new Error('Expected the sidebar brand SVG path')
    expect(markPath.type).toBe('path')
    expect(markPath.props.fill).toBe('currentColor')

    // The hero carries the official bitmap lockup: light and dark variants
    // (embedded by `npm run brand:sync`) swap via the plugin style block.
    const heroMark = registrations.find(
      ({ config }) => config.name === 'conversation.hero.brand.mark'
    )!.component({ size: 48 }) as { type: unknown; props: { children: unknown } }
    const heroVariants = (Array.isArray(heroMark.props.children)
      ? heroMark.props.children
      : [heroMark.props.children]) as Array<{ type: unknown; props: Record<string, unknown> }>
    expect(heroVariants).toHaveLength(2)
    expect(heroVariants.map(variant => variant.props['data-dsh-desktop-hero-mark'])).toEqual(['light', 'dark'])
    for (const variant of heroVariants) {
      expect(variant.type).toBe('img')
      expect(String(variant.props.src)).toMatch(/^data:image\/png;base64,/u)
      expect(variant.props.height).toBe(48)
    }

    const heroTitle = registrations.find(
      ({ config }) => config.name === 'conversation.hero.brand.title'
    )!.component({ t: (key: string) => key }) as unknown
    // The COWIN tagline replaces the upstream 探索未至之境 fallback text.
    expect(heroTitle).toBe('heroTitle')
    const heroConfig = registrations.find(
      ({ config }) => config.name === 'conversation.hero.brand.title'
    )!.config
    expect(heroConfig.id).toBe('desktop-hero-title')
  })
})
