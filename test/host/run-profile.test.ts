import { lstat, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { ensureSafeModeProfile, SAFE_MODE_PROFILE } from '../../src/main/recovery/safe-mode-profile'
import { DesktopHostProcess } from '../../src/main/shell/backend/host-process'
import { writeDesktopProductPatch } from '../../src/main/shell/product-patch'
import { ensureHostBundle, hostBundle } from './host-bundle-helper'

const require = createRequire(import.meta.url)
const electron = require('electron') as string
const root = resolve(import.meta.dirname, '../..')
const temporary: string[] = []

afterEach(async () => {
  await Promise.all(temporary.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

it('boots runProfile on a temporary home and redirects the authenticated document', async () => {
  await ensureHostBundle()
  const home = await mkdtemp(join(tmpdir(), 'dsh-shell-profile-'))
  temporary.push(home)
  const profile = join(home, 'profiles', 'desktop')
  await mkdir(profile, { recursive: true })
  await writeFile(join(profile, 'package.json'), JSON.stringify({
    name: 'dsh-profile-desktop',
    private: true,
    dependencies: {},
    dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app'] } }
  }))
  await writeFile(join(profile, 'cordis.yml'), '[]\n')
  await writeFile(join(profile, 'cordis.patch.yml'), '[]\n')
  const host = new DesktopHostProcess({
    node: electron,
    entry: hostBundle,
    runtimeDir: root,
    projectDir: profile,
    dshHome: home,
    profile: 'desktop',
    environment: { DSH_DESKTOP_PATCH_FILE: await writeDesktopProductPatch(home) },
    primaryRuntime: join(home, 'unused-runtime')
  })
  try {
    const ready = await host.start()
    const url = new URL(ready.url)
    expect(url.protocol).toBe('http:')
    expect(url.hostname).toBe('127.0.0.1')
    expect(url.port).not.toBe('')
    const response = await fetch(ready.url, { redirect: 'manual' })
    expect(response.status).toBe(303)
    expect(response.headers.has('set-cookie')).toBe(true)
    const injections = JSON.stringify(ready.injections)
    expect(injections).toContain('dsh-desktop-office')
    expect(injections).toContain('dsh-ppt-composer')
  } finally {
    await host.stop()
  }
}, 120_000)

/**
 * The mermaid fence renderer rides the product patch on the normal profile.
 * Beyond boot composition, this pins the serving half of the chunk protocol:
 * the boot graph must name the plugin with its inject resolution, and the
 * authenticated /plugins routes must serve both its bundle and its lazy
 * `client.mermaid.js` sibling — the same exact routes a browser page pulls
 * when a mermaid fence first renders.
 */
it('serves the mermaid fence renderer bundle and its lazy chunk on the desktop profile', async () => {
  await ensureHostBundle()
  const home = await mkdtemp(join(tmpdir(), 'dsh-shell-mermaid-'))
  temporary.push(home)
  const profile = join(home, 'profiles', 'desktop')
  await mkdir(profile, { recursive: true })
  await writeFile(join(profile, 'package.json'), JSON.stringify({
    name: 'dsh-profile-desktop',
    private: true,
    dependencies: {},
    dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app'] } }
  }))
  await writeFile(join(profile, 'cordis.yml'), '[]\n')
  await writeFile(join(profile, 'cordis.patch.yml'), '[]\n')
  const host = new DesktopHostProcess({
    node: electron,
    entry: hostBundle,
    runtimeDir: root,
    projectDir: profile,
    dshHome: home,
    profile: 'desktop',
    environment: { DSH_DESKTOP_PATCH_FILE: await writeDesktopProductPatch(home) },
    primaryRuntime: join(home, 'unused-runtime')
  })
  try {
    const ready = await host.start()
    const bootRow = (ready.injections ?? []).find(row =>
      typeof row === 'object' && row !== null &&
      (row as { kind?: unknown }).kind === 'global' &&
      (row as { name?: unknown }).name === '__DSH_BOOT__'
    ) as { value?: { entries?: Array<{ id: string; url: string; rev: string; inject?: string[] }> } } | undefined
    const entry = bootRow?.value?.entries?.find(candidate => candidate.id === 'dsh-desktop-mermaid')
    expect(entry, 'boot graph names the mermaid plugin').toBeDefined()
    expect(entry?.inject).toContain('@deepseek-ai/dsh-client-ui-primitives')

    const first = await fetch(ready.url, { redirect: 'manual' })
    expect(first.status).toBe(303)
    const cookie = first.headers.getSetCookie().join('; ')
    const headers = cookie === '' ? undefined : { cookie }

    const bundle = await fetch(new URL(entry!.url, ready.url), { headers })
    expect(bundle.status).toBe(200)
    const bundleText = await bundle.text()
    expect(bundleText).toContain("id: 'dsh-desktop-mermaid'")
    expect(bundleText).toContain("require.async('./client.mermaid.js')")

    // The chunk route mirrors the entry route with the sibling chunk name and
    // the entry's own revision, per the client-modules serving contract.
    const chunkUrl = new URL(
      `plugins/dsh-desktop-mermaid/client.mermaid.js?rev=${encodeURIComponent(entry!.rev)}`,
      ready.url
    )
    const chunk = await fetch(chunkUrl, { headers })
    expect(chunk.status).toBe(200)
    const chunkText = await chunk.text()
    expect(chunkText).toContain("chunk: 'client.mermaid.js'")
    expect(chunkText).toContain('MermaidDiagram')
  } finally {
    await host.stop()
  }
}, 240_000)

it('boots safe mode without creating the shared profile modules directory', async () => {
  await ensureHostBundle()
  const home = await mkdtemp(join(tmpdir(), 'dsh-shell-safe-'))
  temporary.push(home)
  const profile = await ensureSafeModeProfile(home, 'desktop')
  const host = new DesktopHostProcess({
    node: electron,
    entry: hostBundle,
    runtimeDir: root,
    projectDir: profile,
    dshHome: home,
    profile: SAFE_MODE_PROFILE,
    environment: { DSH_DESKTOP_PATCH_FILE: await writeDesktopProductPatch(home, 'safe') },
    primaryRuntime: join(home, 'unused-runtime')
  })
  try {
    const ready = await host.start()
    expect(new URL(ready.url).hostname).toBe('127.0.0.1')
    const manifest: unknown = JSON.parse(await readFile(join(profile, 'package.json'), 'utf8'))
    expect(manifest).toMatchObject({ dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app'] } } })
    await expect(lstat(join(home, 'profiles', 'node_modules'))).rejects.toMatchObject({ code: 'ENOENT' })
    const injections = JSON.stringify(ready.injections)
    expect(injections).not.toContain('dsh-desktop-office')
    expect(injections).not.toContain('dsh-ppt-composer')
  } finally {
    await host.stop()
  }
}, 120_000)
