import { readFile, stat } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const projectRoot = path.resolve(import.meta.dirname, '..')
const packageDirectory = path.join(projectRoot, 'packages', 'dsh-desktop-mermaid')
const chunkPath = path.join(packageDirectory, 'client.mermaid.js')

/** The module-system baseline modules the chunk's externals may resolve. */
const BASELINE_REQUESTS = new Set([
  'react',
  'react/jsx-runtime',
  '@deepseek-ai/dsh-client-ui-primitives'
])

/** Pull one `const name = { ... }` literal out of a source string. */
function extractObjectLiteral(source, name) {
  const start = source.indexOf(`const ${name} = {`)
  if (start < 0) return undefined
  const open = source.indexOf('{', start)
  let depth = 0
  for (let index = open; index < source.length; index += 1) {
    const char = source[index]
    if (char === '{') depth += 1
    else if (char === '}') {
      depth -= 1
      if (depth === 0) return source.slice(start + `const ${name} = `.length, index + 1)
    }
  }
  return undefined
}

describe('dsh-desktop-mermaid package contract', () => {
  it('declares a client-only plugin injected after the markdown primitives', async () => {
    const manifest = JSON.parse(await readFile(path.join(packageDirectory, 'package.json'), 'utf8'))
    expect(manifest.name).toBe('dsh-desktop-mermaid')
    expect(manifest.version).toBe('0.1.0')
    expect(manifest.exports['./client']).toBe('./client.js')
    expect(manifest.dsh.client.platform).toBe('web')
    expect(manifest.dsh.client.inject).toContain('@deepseek-ai/dsh-client-ui-primitives')
    // No runtime dependencies: the mermaid library is bundled into the
    // generated chunk, react resolves through the shared baseline.
    expect(manifest.dependencies).toBeUndefined()
    for (const file of ['index.js', 'client.js', 'src/mermaid-chunk.js', 'src/mermaid-shared.js']) {
      await expect(stat(path.join(packageDirectory, file))).resolves.toBeDefined()
    }
  })

  it('registers a mermaid fence renderer with locale, styles, and a chunk fallback', async () => {
    const client = await readFile(path.join(packageDirectory, 'client.js'), 'utf8')
    expect(client).toContain("id: 'dsh-desktop-mermaid'")
    expect(client).toContain("require.async('./client.mermaid.js')")
    expect(client).toContain("registry.set('mermaid', MermaidFence)")
    expect(client).toContain("registry.delete('mermaid')")
    expect(client).toContain('ctx.locale.register(NS, { zh, en })')
    expect(client).toContain("style.dataset.pluginCss = 'dsh-desktop-mermaid'")
    // Load or render failures fall back to the upstream code fence, not a blank card.
    expect(client).toContain('CodeBlock')

    const zhSource = extractObjectLiteral(client, 'zh')
    const enSource = extractObjectLiteral(client, 'en')
    expect(zhSource).toBeDefined()
    expect(enSource).toBeDefined()
    const zh = new Function(`return ${zhSource}`)()
    const en = new Function(`return ${enSource}`)()
    expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort())
    for (const key of ['diagramLabel', 'viewDiagram', 'viewCode', 'errorTitle', 'retry']) {
      expect(zh[key], `zh ${key}`).toBeTruthy()
      expect(en[key], `en ${key}`).toBeTruthy()
    }
  })

  it('builds a self-contained chunk in the upstream client.<name>.js protocol', async () => {
    const chunk = await readFile(chunkPath, 'utf8')
    expect(chunk).toContain("id: 'dsh-desktop-mermaid'")
    expect(chunk).toContain("chunk: 'client.mermaid.js'")
    expect(chunk).toContain('return module.exports;')
    expect(chunk).toContain('MermaidDiagram')
    expect(chunk).toMatch(/securityLevel:\s*["']strict["']/)
    // Static bare requires resolve only against the baseline; property-access
    // probes (`.require("util")` inside bundled lodash feature detection) are
    // inert — the chunk factory's module object carries no `require` property.
    const requests = [...chunk.matchAll(/(?<![.\w])require\(\s*(['"])([^'"]+)\1\s*\)/g)]
      .map((match) => match[2])
    const foreign = [...new Set(requests)].filter((request) => !BASELINE_REQUESTS.has(request))
    expect(foreign, 'non-baseline bare requires').toEqual([])
    // Self-contained: no deferred sibling chunks the Host would not serve.
    expect(chunk).not.toContain('require.async')
    expect(chunk).not.toMatch(/\bimport\s*\(/)
  })

  it('keeps the generated chunk out of Git', () => {
    const ignored = execFileSync('git', ['check-ignore', 'packages/dsh-desktop-mermaid/client.mermaid.js'], {
      cwd: projectRoot,
      encoding: 'utf8'
    })
    expect(ignored.trim()).toBe('packages/dsh-desktop-mermaid/client.mermaid.js')
    const tracked = execFileSync('git', ['ls-files', 'packages/dsh-desktop-mermaid'], {
      cwd: projectRoot,
      encoding: 'utf8'
    })
      .split('\n')
      .filter((line) => line.trim() !== '')
    expect(tracked).not.toContain('packages/dsh-desktop-mermaid/client.mermaid.js')
  })

  it('pure helpers: ids, reason truncation, and theme mapping', async () => {
    const shared = await import(path.join(packageDirectory, 'src', 'mermaid-shared.js'))
    const first = shared.nextDiagramId()
    const second = shared.nextDiagramId()
    expect(first).toMatch(/^dsh-mermaid-\d+$/)
    expect(Number(second.slice('dsh-mermaid-'.length)))
      .toBeGreaterThan(Number(first.slice('dsh-mermaid-'.length)))

    const long = 'x'.repeat(shared.MAX_REASON_LENGTH + 50)
    expect(shared.truncateReason(new Error(`  ${long} `))).toHaveLength(shared.MAX_REASON_LENGTH + 1)
    expect(shared.truncateReason(new Error(long)).endsWith('…')).toBe(true)
    expect(shared.truncateReason(new Error('  boom '))).toBe('boom')
    expect(shared.truncateReason('raw')).toBe('raw')

    const variables = shared.diagramThemeVariables({
      getPropertyValue: token => token === '--dsw-alias-label-primary' ? ' #111 ' : ''
    })
    expect(variables.background).toBe('transparent')
    expect(variables.primaryTextColor).toBe('#111')
    expect(variables.primaryColor).toBeUndefined()
    const full = shared.diagramThemeVariables({
      getPropertyValue: () => 'rgb(1, 2, 3)'
    })
    expect(full.primaryColor).toBe('rgb(1, 2, 3)')
    expect(full.lineColor).toBe('rgb(1, 2, 3)')
    expect(full.errorTextColor).toBe('rgb(1, 2, 3)')
  })

  it('removes mermaid rendering scaffolding by id', async () => {
    const shared = await import(path.join(packageDirectory, 'src', 'mermaid-shared.js'))
    const removed = []
    const previousDocument = globalThis.document
    globalThis.document = {
      getElementById: id => (removed.includes(id) ? null : { remove: () => removed.push(id) })
    }
    try {
      shared.removeDiagramScaffolding('dsh-mermaid-1')
      expect(removed.sort()).toEqual(['dsh-mermaid-1', 'dsh-mermaid-1d'])
      // Already-removed ids stay quiet.
      shared.removeDiagramScaffolding('dsh-mermaid-1')
      expect(removed.sort()).toEqual(['dsh-mermaid-1', 'dsh-mermaid-1d'])
    } finally {
      globalThis.document = previousDocument
    }
  })
})
