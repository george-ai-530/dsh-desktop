import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const sharp = require('sharp')

const vendorPackages = [
  'dsh-client-ui-chat',
  'dsh-client-ui-plugin-manager',
  'dsh-client-ui-sidebar-documentpreview',
  'dsh-client-ui-settings-session-log',
  'dsh-client-ui-layout'
]

// Vendor bundle fixtures mirror the pinned upstream 0.2.2-rc.1 token counts.
// Tokens are space-padded so every occurrence is standalone, mirroring how
// they appear inside the real locale dictionaries. The chat fixture carries
// the zh streaming placeholder in both its locale keys, mirroring
// chat.deepDiving / chat.deepDivingFor upstream.
const vendorFixtures = {
  'dsh-client-ui-chat': { deepSeekHarness: 0, deepSeek: 17, dsh: 17 },
  'dsh-client-ui-plugin-manager': { deepSeekHarness: 8, deepSeek: 0, dsh: 156 },
  'dsh-client-ui-sidebar-documentpreview': { deepSeekHarness: 8, deepSeek: 0, dsh: 0 },
  'dsh-client-ui-settings-session-log': { deepSeekHarness: 0, deepSeek: 8, dsh: 0 },
  'dsh-client-ui-layout': { deepSeekHarness: 1, deepSeek: 0, dsh: 0 }
}

const runningWhaleMaskName = 'running-whale@2x-06738fa29b2f.png'

async function writeSolidPng(file, width, height) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="#000"/></svg>`
  await writeFile(file, await sharp(Buffer.from(svg)).png().toBuffer())
}

async function fixture(icons, run) {
  const root = await mkdtemp(path.join(tmpdir(), 'dsh-brand-assets-'))
  try {
    const dist = path.join(root, 'node_modules/@deepseek-ai/dsh-web-frontend/dist')
    await Promise.all(['scripts/release', 'build', path.relative(root, dist)].map(dir => mkdir(path.join(root, dir), { recursive: true })))
    const script = path.join(root, 'scripts/release/install-brand-assets.mjs')
    await writeFile(script, await readFile(new URL('../scripts/release/install-brand-assets.mjs', import.meta.url)))
    // The copied release script resolves sharp from the fixture tree like a
    // standalone install would. Link the repo's sharp so the running-whale
    // mask replacement (and its silent minimal-install skip) is exercised;
    // the junction is removed before the fixture teardown.
    const repoNodeModules = path.join(import.meta.dirname, '..', 'node_modules')
    await symlink(path.join(repoNodeModules, 'sharp'), path.join(root, 'node_modules', 'sharp'), 'junction')
    for (const name of ['icon.png', 'logo-light.png', 'logo-dark.png']) await writeFile(path.join(root, 'build', name), 'test-icon')
    await writeFile(
      path.join(dist, 'index.html'),
      '<title>DeepSeek Harness</title><meta name="apple-mobile-web-app-title" content="DSH" />'
      + '<link rel="apple-touch-icon" href="./apple-touch-icon.png" />'
      + '<link rel="icon" href="./favicon.svg" />'
    )
    await writeFile(
      path.join(dist, 'manifest.webmanifest'),
      JSON.stringify({ name: 'DeepSeek Harness', short_name: 'DSH', icons })
    )
    const chatAssets = path.join(root, 'node_modules/@deepseek-ai/dsh-client-ui-chat/lib/assets')
    await mkdir(chatAssets, { recursive: true })
    await writeSolidPng(path.join(chatAssets, runningWhaleMaskName), 28, 28)
    for (const [pkg, counts] of Object.entries(vendorFixtures)) {
      const dir = path.join(root, 'node_modules/@deepseek-ai', pkg, 'lib')
      await mkdir(dir, { recursive: true })
      let source = ''
      if (counts.deepSeekHarness > 0) source += 'DeepSeek Harness '.repeat(counts.deepSeekHarness)
      if (counts.deepSeek > 0) source += 'DeepSeek '.repeat(counts.deepSeek)
      if (counts.dsh > 0) source += 'restart DSH now. '.repeat(counts.dsh)
      if (pkg === 'dsh-client-ui-chat') source += '"chat.deepDiving": "深度求索中", "chat.deepDivingFor": "深度求索中，用时 {duration} ···",'
      if (pkg === 'dsh-client-ui-sidebar-documentpreview') source += 'const isDSHRemoteError = true; const cfg = "__DSH_DOCUMENT_PREVIEW_CONFIG_"'
      await writeFile(path.join(dir, 'client.js'), source)
    }
    await run({ root, dist, execute: () => execFileSync(process.execPath, [script], { encoding: 'utf8', stdio: 'pipe' }) })
  } finally {
    // Remove the sharp junction as a link first so the fixture teardown can
    // never traverse into the repo's real node_modules.
    await rm(path.join(root, 'node_modules', 'sharp'), { force: true }).catch(() => {})
    await rm(root, { recursive: true, force: true })
  }
}

describe('brand assets installation across Harness versions', () => {
  it.each([
    [{ src: './favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
    [
      { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ]
  ].map(icons => ({ icons })))('replaces the known icon set and remains idempotent: $icons', async ({ icons }) => {
    const custom = { src: 'custom.png', sizes: '32x32', type: 'image/png' }
    await fixture([...icons, custom], async ({ root, dist, execute }) => {
      execute()
      const file = path.join(dist, 'manifest.webmanifest')
      const first = await readFile(file, 'utf8')
      const manifest = JSON.parse(first)
      expect(manifest.icons).toEqual([
        { src: '/dsh-desktop-logo.png', sizes: '1254x1254', type: 'image/png', purpose: 'any' }, custom
      ])
      expect(manifest.name).toBe('COWIN Harness Desktop')
      expect(manifest.short_name).toBe('COWIN')
      expect(await readFile(path.join(dist, 'dsh-desktop-logo.png'), 'utf8')).toBe('test-icon')
      execute()
      expect(await readFile(file, 'utf8')).toBe(first)
    })
  })

  it('rejects unrecognized upstream icons rather than silently leaving mixed branding', async () => {
    await fixture([{ src: 'unknown.svg' }], async ({ execute }) => {
      expect(execute).toThrow('no icon entry to replace')
    })
  })

  it('rewrites the upstream index identity and vendor copy, then stays idempotent', async () => {
    await fixture([{ src: './favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }], async ({ root, dist, execute }) => {
      execute()
      const html = await readFile(path.join(dist, 'index.html'), 'utf8')
      expect(html).toContain('<title>COWIN Harness Desktop</title>')
      expect(html).toContain('apple-mobile-web-app-title" content="COWIN"')
      expect(html).toContain('<link rel="apple-touch-icon" href="/dsh-desktop-logo.png" />')
      expect(html).not.toContain('DeepSeek Harness')
      expect(await readFile(path.join(dist, 'apple-touch-icon.png'), 'utf8')).toBe('test-icon')
      for (const [pkg, counts] of Object.entries(vendorFixtures)) {
        const source = await readFile(path.join(root, `node_modules/@deepseek-ai/${pkg}/lib/client.js`), 'utf8')
        expect(source).not.toContain('DeepSeek')
        expect(source).not.toContain('DeepSeek Harness')
        // The zh streaming placeholder takes the desktop wording while the
        // elapsed-time suffix stays upstream.
        if (pkg === 'dsh-client-ui-chat') {
          expect(source).toContain('深度思考中')
          expect(source).toContain('深度思考中，用时 {duration} ···')
          expect(source).not.toContain('深度求索中')
        }
        // The documentpreview fixture keeps identifier-embedded DSH tokens to
        // prove the standalone-only rule leaves code identifiers untouched.
        const identifierKept = pkg === 'dsh-client-ui-sidebar-documentpreview'
        if (identifierKept) {
          expect(source).toContain('isDSHRemoteError')
          expect(source).toContain('__DSH_DOCUMENT_PREVIEW_CONFIG_')
        } else if (counts.dsh > 0 || counts.deepSeekHarness > 0) {
          expect(source).not.toMatch(/DSH/)
        }
      }
      execute()
      const htmlSecond = await readFile(path.join(dist, 'index.html'), 'utf8')
      expect(htmlSecond).toBe(html)
    })
  })

  it('replaces the running-whale mask with a loading ring at the original size', async () => {
    await fixture([{ src: './favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }], async ({ root, execute }) => {
      execute()
      const maskPath = path.join(root, 'node_modules/@deepseek-ai/dsh-client-ui-chat/lib/assets', runningWhaleMaskName)
      const meta = await sharp(maskPath).metadata()
      expect(meta.width).toBe(28)
      expect(meta.height).toBe(28)
      const { data, info } = await sharp(maskPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
      const alphaAt = (x, y) => data[(y * info.width + x) * info.channels + 3]
      // The arc body is opaque (top start point), the center stays open, and
      // the top-left quadrant is the spinner gap.
      expect(alphaAt(14, 4)).toBeGreaterThan(0)
      expect(alphaAt(14, 14)).toBe(0)
      expect(alphaAt(7, 7)).toBe(0)
      // Idempotent: rerunning leaves the same ring bytes behind.
      const first = await readFile(maskPath)
      execute()
      expect(await readFile(maskPath)).toEqual(first)
    })
  })

  it('migrates an install that still carries the previous product name', async () => {
    await fixture([{ src: './favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }], async ({ root, dist, execute }) => {
      // Mirror an install that already ran the previous "COWIN Desktop"
      // branding: the vendor copy and the document title carry the old name.
      const chat = path.join(root, 'node_modules/@deepseek-ai/dsh-client-ui-chat/lib/client.js')
      await writeFile(chat, 'COWIN Desktop '.repeat(17))
      await writeFile(
        path.join(dist, 'index.html'),
        '<title>COWIN Desktop</title><meta name="apple-mobile-web-app-title" content="COWIN" />'
        + '<link rel="apple-touch-icon" href="/dsh-desktop-logo.png" />'
        + '<link rel="icon" type="image/png" href="/dsh-desktop-logo.png" />'
      )
      execute()
      const source = await readFile(chat, 'utf8')
      expect((source.match(/COWIN Harness Desktop/g) || []).length).toBe(17)
      expect(source).not.toContain('COWIN Desktop')
      const html = await readFile(path.join(dist, 'index.html'), 'utf8')
      expect(html).toContain('<title>COWIN Harness Desktop</title>')
      expect(html).not.toContain('<title>COWIN Desktop</title>')
      // Idempotent: the migrated install matches zero migration tokens.
      execute()
      expect((await readFile(chat, 'utf8')).match(/COWIN Harness Desktop/g) || []).toHaveLength(17)
    })
  })
})
