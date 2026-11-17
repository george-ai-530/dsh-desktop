import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

const source = readFileSync('node_modules/@deepseek-ai/dsh-client-ui-agent-preset/lib/client.js', 'utf8')

// The agent-preset patch (patches/@deepseek-ai+dsh-client-ui-agent-preset+…) rewrites
// this page's brand copy at dictionary level: a loop after the locale tables replaces
// the DSH token with the product runtime name in the keys this page renders. Execute
// the shipped statements instead of restating them, so the test fails when either
// half drifts. The region holds only plain dictionary literals followed by the brand
// loop, so the extracted span evaluates standalone; the returned tables are the
// post-loop values the locale service registers under settings.agentPreset.
function brandTables() {
  const regionStart = source.indexOf('//#region lib/types/client/guide-locales.js')
  const loopStart = source.indexOf('for (const dictionary of [en, zh, ja, es, fr, de, ru, pt]) {')
  const regionEnd = source.indexOf('//#endregion', loopStart)
  expect(regionStart).toBeGreaterThan(-1)
  expect(loopStart).toBeGreaterThan(regionStart)
  expect(regionEnd).toBeGreaterThan(loopStart)
  // The span's last line is a //#region comment, so the appended return must start
  // on its own line to stay out of that comment.
  const evaluate = new Function(`${source.slice(regionStart, regionEnd + '//#endregion'.length)}\n; return { en, zh, ja, es, fr, de, ru, pt };`)
  return evaluate()
}

it('rebrands the preset page copy in every shipped locale', () => {
  const tables = brandTables()
  const locales = ['en', 'zh', 'ja', 'es', 'fr', 'de', 'ru', 'pt']
  expect(Object.keys(tables).sort()).toEqual([...locales].sort())
  for (const locale of locales) {
    const table = tables[locale]
    for (const key of ['sectionIntro', 'presetCordisDescription', 'createPluginDescription', 'guideCordisExplanation', 'guideCordisUsage']) {
      expect(table[key], `${locale}.${key}`).toBeTruthy()
      expect(table[key], `${locale}.${key}`).toContain('COWIN Harness')
      expect(table[key], `${locale}.${key}`).not.toContain('DSH')
    }
  }
})

it('leaves the DSH token alone outside the rebranded copy keys', () => {
  const { en, zh } = brandTables()
  expect(zh.seatHint).not.toContain('COWIN Harness')
  expect(en.nav).not.toContain('COWIN Harness')
})
