// @vitest-environment jsdom
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { expect, it } from 'vitest'

// 设置导航精简：插件设置区停用后，生图设置卡片不再注册 settings.plugins.tab；
// 会话内的生成图片视图保留。
it('keeps the generated-image chat node without the plugins settings tab', async () => {
  const source = await readFile(resolve('packages/dsh-image-generation/client.js'), 'utf8')
  expect(source).not.toContain('settings.plugins.tab')
  expect(source).not.toContain('function ImageCard(')
  expect(source).toContain('conversation.chat.node')
  expect(source).toContain('dsh-image-generation')
})
