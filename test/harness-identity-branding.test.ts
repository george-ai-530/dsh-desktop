import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { composeEntries, loadOverlayPatches } from '@deepseek-ai/dsh-app-boot'
import { Context } from '@deepseek-ai/cordis'
import { createScope } from '@deepseek-ai/dsh-scope'
import { PERSONA_PREFIX_SECTION, SystemPrompt, renderPrompt } from '@deepseek-ai/dsh-system-prompt'
import { expect, it } from 'vitest'
import { writeDesktopProductPatch } from '../src/main/shell/product-patch'

const root = process.cwd()

// The exact system-prompt config the desktop product patch composes. The
// composition test in settings-account-launcher.test.js pins the composed rows
// against this value; the behavior tests here feed the same value into the
// real SystemPrompt service so both halves of the seam stay checked.
const PRODUCT_SYSTEM_PROMPT_CONFIG = {
  includeHarnessIdentity: false,
  personaPrefix: 'You are a coding agent running on COWIN Harness, powered by the {{model}} model.'
}

/** Compose base + web + shell layers exactly like a real desktop launch. */
async function composedSystemPromptConfig(): Promise<unknown> {
  const home = await mkdtemp(join(tmpdir(), 'dsh-branding-'))
  try {
    const patch = await writeDesktopProductPatch(home)
    const base = loadOverlayPatches('test', join(root, 'node_modules/@deepseek-ai/dsh-base/cordis.patch.yml'))
    const web = loadOverlayPatches('test', join(root, 'node_modules/@deepseek-ai/dsh-web-app/cordis.patch.yml'))
    const shell = loadOverlayPatches('test', patch)
    return composeEntries([base, web, shell]).find((entry) => entry.id === 'system-prompt')?.config
  } finally {
    await rm(home, { recursive: true, force: true })
  }
}

it('the desktop composition configures the COWIN Harness persona without the harness identity', async () => {
  expect(await composedSystemPromptConfig()).toEqual(PRODUCT_SYSTEM_PROMPT_CONFIG)
})

it('renders the product persona and never the upstream harness identity', async () => {
  const ctx = new Context()
  const prompt = ctx.plugin(SystemPrompt, PRODUCT_SYSTEM_PROMPT_CONFIG)
  await prompt
  ctx.systemPrompt.variable('model', () => 'test-model')
  const assembly = await ctx.systemPrompt.assemble()
  expect(assembly.sections.map((section) => section.name)).not.toContain('harness:identity')
  const rendered = renderPrompt(assembly)
  expect(rendered).toContain('COWIN Harness')
  expect(rendered).toContain('test-model')
  expect(rendered).not.toContain('DeepSeek Harness')
  await prompt.dispose()
})

it('an agent-scoped persona still shadows the deployment prefix', async () => {
  const ctx = new Context()
  const prompt = ctx.plugin(SystemPrompt, PRODUCT_SYSTEM_PROMPT_CONFIG)
  await prompt
  ctx.systemPrompt.variable('model', () => 'test-model')
  const instance = { id: 'branding-preset-agent' }
  const scope = createScope(ctx, instance)
  await scope.ctx.plugin({
    inject: ['systemPrompt'],
    apply(pluginCtx) {
      pluginCtx.systemPrompt.section({ name: PERSONA_PREFIX_SECTION, order: 0, text: 'My custom preset.' })
    }
  })
  const rendered = renderPrompt(await ctx.systemPrompt.assemble({ scope: instance }))
  expect(rendered).toBe('My custom preset.')
  await scope.dispose()
  await prompt.dispose()
})
