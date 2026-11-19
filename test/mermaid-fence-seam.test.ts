import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { patchPath } from './patch-path'

/**
 * The primitives patch must keep the desktop fence-renderer seam in
 * `renderCode`: a settled (non-streaming) fence consults the registry before
 * falling back to `CodeBlock`, so `dsh-desktop-mermaid` can occupy the
 * `mermaid` language and an absent registry keeps upstream behavior. These
 * assertions pin order and wiring against accidental drift during upstream
 * upgrades; behavior of the seam body is evaluated below from the patch's
 * added lines, because `node_modules` may hold a different Harness build than
 * the one the patch targets (same rationale as `local-path-links.test.ts`).
 */
async function loadSeamSource(): Promise<string> {
  const patch = await readFile(
    patchPath('@deepseek-ai/dsh-client-ui-primitives'),
    'utf8'
  )
  // The seam hunk is the one adding `fenceRenderer`; pick it by content so
  // other hunks and future line-number drift stay irrelevant.
  const seam = patch
    .split(/\n(?=@@ -)/)
    .find((hunk) => hunk.includes('function fenceRenderer(language) {'))
  expect(seam, 'fence-renderer hunk present').toBeDefined()
  return (seam ?? '')
    .split('\n')
    .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
    .map((line) => line.slice(1))
    .join('\n')
}

/** Pull one `function name(...) { ... }` out of the patch's added source. */
function extractFunction(source: string, name: string): string | undefined {
  const start = source.indexOf(`function ${name}(`)
  if (start < 0) return undefined
  const open = source.indexOf('{', start)
  let depth = 0
  for (let index = open; index < source.length; index += 1) {
    const char = source[index]
    if (char === '{') depth += 1
    else if (char === '}') {
      depth -= 1
      if (depth === 0) return source.slice(start, index + 1)
    }
  }
  return undefined
}

describe('mermaid fence-renderer seam', () => {
  it('consults the registry after math and before the CodeBlock fallback in settled renders', async () => {
    const patch = await readFile(
      patchPath('@deepseek-ai/dsh-client-ui-primitives'),
      'utf8'
    )
    const seam = 'if (!context.streaming && lang !== void 0) {'
    const math = 'if (!context.streaming && lang === "math") return jsx(Fragment$1'
    const fallback = 'return jsx(CodeBlock, {'
    const mathAt = patch.indexOf(math)
    const seamAt = patch.indexOf(seam)
    const fallbackAt = patch.indexOf(fallback, seamAt)
    expect(mathAt, 'upstream math arm still present').toBeGreaterThan(0)
    expect(seamAt, 'seam present').toBeGreaterThan(mathAt)
    expect(fallbackAt, 'upstream CodeBlock fallback still present').toBeGreaterThan(seamAt)
    expect(patch).toContain('function fenceRenderer(language) {')
    expect(patch).toContain('__DSH_FENCE_RENDERERS__')
    expect(patch).toContain('registry instanceof Map')
    // The seam hands the fence the same code shape and label contract the
    // CodeBlock arm receives.
    expect(patch).toContain('code: `${node.value}\\n`')
    expect(patch).toContain('labels: context.labels.code')
  })

  it('seats the same seam in the packaged web-frontend bundle, where the renderer actually runs', async () => {
    // The packaged UI renders Markdown through the copy compiled INTO
    // `dsh-web-frontend/dist` (the frontend seeds it as the platform module),
    // so the node_modules primitives seam never executes there. The
    // frontend-bundle patch carries the live seam in minified form.
    const patch = await readFile(
      patchPath('@deepseek-ai/dsh-web-frontend'),
      'utf8'
    )
    expect(patch).toContain('__DSH_FENCE_RENDERERS__')
    expect(patch).toContain('instanceof Map')
    expect(patch).toContain('!r.streaming&&n!==void 0')
    expect(patch).toContain('labels:r.labels.code')
    // The seam rides an added line of the bundle diff, not a stray string.
    const seamLine = patch
      .split('\n')
      .find((line) => line.startsWith('+') && line.includes('__DSH_FENCE_RENDERERS__'))
    expect(seamLine, 'seam is an added line of the bundle diff').toBeDefined()
    // Brand assets stay out of the patch: install-brand-assets.mjs rewrites
    // them after patch-package on every postinstall, so swept-in logo or
    // html hunks would mean the patch was regenerated from a branded tree.
    expect(patch).not.toContain('GIT binary patch')
    expect(patch).not.toContain('dsh-desktop-logo')
    expect(patch).not.toContain('diff --git a/node_modules/@deepseek-ai/dsh-web-frontend/dist/index.html')
  })

  it('evaluated seam logic: registry lookups', async () => {
    const source = await loadSeamSource()
    const fenceRenderer = extractFunction(source, 'fenceRenderer')
    expect(fenceRenderer).toBeDefined()
    const evaluate = new Function(`${fenceRenderer}\nreturn fenceRenderer`)() as (
      language: string
    ) => unknown

    // No registry: upstream behavior (undefined), including on broken values.
    expect(evaluate('mermaid')).toBeUndefined()
    ;(globalThis as Record<string, unknown>).__DSH_FENCE_RENDERERS__ = 'not-a-map'
    expect(evaluate('mermaid')).toBeUndefined()
    ;(globalThis as Record<string, unknown>).__DSH_FENCE_RENDERERS__ = { get: () => 'poisoned' }
    expect(evaluate('mermaid')).toBeUndefined()
    const component = { render: () => null }
    const registry = new Map([['mermaid', component], ['flowchart', component]])
    ;(globalThis as Record<string, unknown>).__DSH_FENCE_RENDERERS__ = registry
    try {
      expect(evaluate('mermaid')).toBe(component)
      expect(evaluate('flowchart')).toBe(component)
      expect(evaluate(' Mermaid')).toBeUndefined()
      expect(evaluate('__proto__')).toBeUndefined()
      expect(evaluate('constructor')).toBeUndefined()
    } finally {
      delete (globalThis as Record<string, unknown>).__DSH_FENCE_RENDERERS__
    }
  })
})
