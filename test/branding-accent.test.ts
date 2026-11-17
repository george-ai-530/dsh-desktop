import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const projectRoot = path.resolve(import.meta.dirname, '..')

// Regression test for the COWIN accent seam.
//
// Contract: the replayable patch on @deepseek-ai/dsh-client-ui-theme wraps
// the upstream brand-hue scale steps (--dsw-static-deepseek-400/450/500) in
// both the light (body{}) and dark (body[data-ds-dark-theme]{}) definition
// blocks so each reads a Desktop-owned override variable and falls back to
// the original upstream value when the plugin is absent. The actual COWIN
// colors live in packages/dsh-desktop-client-ui/client.js, never in the
// patch (patch-plugin-contract §4: the patch only opens the variable seam).
// Removal condition: upstream exposes an official theme-override seam or
// ships the COWIN palette itself.
describe('COWIN accent seam', () => {
  it('wraps both theme blocks of the brand-hue scale in override variables', async () => {
    const patch = await readFile(
      path.join(projectRoot, 'patches', '@deepseek-ai+dsh-client-ui-theme+0.2.2-rc.1.patch'),
      'utf8'
    )
    for (const step of ['400', '450', '500']) {
      // Light block reads the base override with the upstream value as fallback.
      expect(patch).toContain(`--dsw-static-deepseek-${step}:var(--dsh-desktop-accent-${step},`)
      // Dark block prefers the dark override and still falls back to the
      // light override, then the upstream value, so uninstalling the plugin
      // restores upstream defaults.
      expect(patch).toContain(
        `--dsw-static-deepseek-${step}:var(--dsh-desktop-accent-${step}-dark,var(--dsh-desktop-accent-${step},`
      )
    }
    // The patch must not carry the COWIN colors themselves.
    expect(patch).not.toContain('#0052D9')
    expect(patch).not.toContain('#366EF4')
  })

  it('defines both theme variants of the accent family in the client plugin', async () => {
    const client = await readFile(
      path.join(projectRoot, 'packages', 'dsh-desktop-client-ui', 'client.js'),
      'utf8'
    )
    const lightValues: Record<string, string> = {
      '--dsh-desktop-accent-400': '#366EF4',
      '--dsh-desktop-accent-450': '#2B62DE',
      '--dsh-desktop-accent-500': '#0052D9'
    }
    const darkValues: Record<string, string> = {
      '--dsh-desktop-accent-400-dark': '#4C86F7',
      '--dsh-desktop-accent-450-dark': '#3E74EB',
      '--dsh-desktop-accent-500-dark': '#2F66DF'
    }
    for (const [variable, value] of [...Object.entries(lightValues), ...Object.entries(darkValues)]) {
      expect(client).toContain(`${variable}: ${value};`)
    }
  })
})
