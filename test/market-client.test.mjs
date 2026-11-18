import { readFileSync, existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// 设置导航精简：「插件市场」导航与「内置插件」区的生图工具/管理 tab 随
// dsh-desktop-market-installer 的客户端 UI 一并移除；安装服务仍在宿主侧。
describe('plugin market client removal', () => {
  it('removes the market installer client surface', () => {
    expect(existsSync(new URL('../packages/dsh-desktop-market-installer/client.js', import.meta.url))).toBe(false)
    const manifest = JSON.parse(readFileSync(new URL('../packages/dsh-desktop-market-installer/package.json', import.meta.url), 'utf8'))
    expect(manifest.exports['./client']).toBeUndefined()
    expect(manifest.dsh?.client).toBeUndefined()
  })

  it('disables the plugins settings section and its occupants in the desktop overlay', async () => {
    const patch = await readFileSync(new URL('../build/dsh-desktop.patch.yml', import.meta.url), 'utf8')
    for (const id of ['ui-settings-plugins', 'ui-settings-plugin-inventory', 'ui-settings-shell', 'ui-settings-agent-loop', 'ui-settings-subagent', 'ui-settings-web-search']) {
      expect(patch, `${id} must stay disabled`).toMatch(new RegExp(`- id: ${id}\\r?\\n  disabled: true`))
    }
  })
})
