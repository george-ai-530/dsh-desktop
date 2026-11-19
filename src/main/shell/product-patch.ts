import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

function hasEnterprisePlugin(): boolean {
  try {
    require.resolve('dsh-desktop-enterprise/package.json')
    return true
  } catch {
    return false
  }
}

/**
 * Desktop profile overlay. Analytics and the official account page stay off.
 * The official sidebar brand is replaced by the product client UI.
 * The prompt identity names the product runtime (COWIN Harness) instead of the
 * upstream harness, and the upstream dev-context prompt sections stay off.
 * The upstream entry-customization plugin drives the sidebar「更多」menu and the
 * conversation tab-row「…」menu; both are removed from the product surface.
 * The Session-log upload switch row goes away with its setting, and the
 * session-log-deepseek bundle is forced off (its upstream default is on).
 * The plugins settings section and its occupants (Built-in plugins nav, the
 * plugin market nav from dsh-desktop-market-installer, and the companion
 * settings pages) are removed together; every occupant of the slots the
 * section declares must be disabled with it.
 * The normal profile also mounts workbenches, the plugin market installer,
 * Office, and PPT. Safe Mode keeps the account and brand overlay only, plus
 * the mermaid fence renderer so repair sessions can still read flowchart
 * documents (disabling the plugin degrades fences back to code blocks).
 */
const DESKTOP_PRODUCT_PATCH_BASE = `- id: desktop-product-telemetry
  disabled: true
- id: product-analytics
  disabled: true
- id: ui-settings-account
  disabled: true
- id: ui-brand-official
  disabled: true
- id: entry-customization
  disabled: true
- id: ui-settings-session-log
  disabled: true
- id: session-log-deepseek
  config:
    enabled: false
- id: ui-settings-plugins
  disabled: true
- id: ui-settings-plugin-inventory
  disabled: true
- id: ui-settings-shell
  disabled: true
- id: ui-settings-agent-loop
  disabled: true
- id: ui-settings-subagent
  disabled: true
- id: ui-settings-web-search
  disabled: true
- id: deepseek-account
  config:
    desktopPlatform: null
# A patch replaces the row's whole config, so the upstream personaPrefix from
# the web layer is restated with the product name; includeHarnessIdentity off
# keeps the upstream "powered by DeepSeek Harness" section out of every scope.
- id: system-prompt
  config:
    includeHarnessIdentity: false
    personaPrefix: >-
      You are a coding agent running on COWIN Harness, powered by the
      {{model}} model.
# Dev-context prompt sections name the DeepSeek Harness checkout and Web GUI;
# the product build has no use for them and they leak the upstream brand.
- id: harness-dev-context
  disabled: true
- insert:
    - id: dsh-desktop-client-ui
      name: dsh-desktop-client-ui

    # Renders "mermaid" fenced code blocks as diagrams in Markdown previews
    # and chat. Its capability is client-only and degrades to the upstream
    # code fence when the plugin is disabled or its lazy chunk fails.
    - id: dsh-desktop-mermaid
      name: dsh-desktop-mermaid
`

const DESKTOP_ENTERPRISE_ROW = `    - id: dsh-desktop-enterprise
      name: dsh-desktop-enterprise
`

const DESKTOP_WORKBENCH_ROW = `    - id: dsh-desktop-workbenches
      name: dsh-desktop-workbenches
      config:
        root: !!js dshHomePath('desktop-workbenches')
`

const DESKTOP_MARKET_ROW = `    - id: dsh-desktop-market-installer
      name: dsh-desktop-market-installer
`

const DESKTOP_OFFICE_ROW = `    - id: dsh-desktop-office
      name: dsh-desktop-office
      config:
        resources: !!js process.env.DSH_DESKTOP_OFFICE_RESOURCES
        cli: !!js process.env.DSH_DESKTOP_OFFICE_CLI
`

// Keep the existing kimi-ppt directory so projects created by the previous shell still open.
const DESKTOP_PPT_ROW = `    - id: dsh-ppt-composer
      name: dsh-ppt-composer
      config:
        root: !!js dshHomePath('kimi-ppt')
`

export const DESKTOP_SAFE_PRODUCT_PATCH = DESKTOP_PRODUCT_PATCH_BASE

export function buildDesktopProductPatch(): string {
  const enterprise = hasEnterprisePlugin() ? DESKTOP_ENTERPRISE_ROW : ''
  return `${DESKTOP_PRODUCT_PATCH_BASE}${enterprise}${DESKTOP_WORKBENCH_ROW}${DESKTOP_MARKET_ROW}${DESKTOP_OFFICE_ROW}${DESKTOP_PPT_ROW}`
}

export const DESKTOP_PRODUCT_PATCH = buildDesktopProductPatch()

// Windows development only. The packaged overlay never includes this row.
const WINDOWS_DEV_HMR_DISABLE = `# @deepseek-ai/dsh-hmr waits forever for a watcher ready event on Windows.
- id: hmr
  disabled: true
`

export type DesktopProductPatchMode = 'desktop' | 'safe'

export async function writeDesktopProductPatch(
  dshHome: string,
  mode: DesktopProductPatchMode = 'desktop',
  options?: { skipBlockingHmr?: boolean }
): Promise<string> {
  await mkdir(dshHome, { recursive: true })
  const path = join(dshHome, 'desktop-product.patch.yml')
  const base = mode === 'safe' ? DESKTOP_SAFE_PRODUCT_PATCH : buildDesktopProductPatch()
  const text = options?.skipBlockingHmr === true ? `${base}${WINDOWS_DEV_HMR_DISABLE}` : base
  await writeFile(path, text)
  return path
}
