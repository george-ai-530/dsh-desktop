import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// 设置导航精简后，插件设置区及其 tab 槽不再由上游 ui-settings-plugins 声明，
// dsh-desktop-market-installer 的客户端卡片已整体移除（见 market-client.test.mjs）。
describe('Desktop host plugin control in Plugins settings', () => {
  it('keeps the removed client out of the product surface', () => {
    const manifest = JSON.parse(readFileSync(new URL('../packages/dsh-desktop-market-installer/package.json', import.meta.url), 'utf8'))
    expect(manifest.exports['./client']).toBeUndefined()
    expect(manifest.dsh?.client).toBeUndefined()
    // 生图设置卡片同样不再注册到插件设置区。
    const imageClient = readFileSync(new URL('../packages/dsh-image-generation/client.js', import.meta.url), 'utf8')
    expect(imageClient).not.toContain('settings.plugins.tab')
    expect(imageClient).toContain('conversation.chat.node')
  })
})
