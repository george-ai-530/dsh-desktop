import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const source = path.join(projectRoot, 'build', 'icon.png')
const lightSource = path.join(projectRoot, 'build', 'logo-light.png')
const darkSource = path.join(projectRoot, 'build', 'logo-dark.png')
const destinationDirectory = path.join(
  projectRoot,
  'node_modules',
  '@deepseek-ai',
  'dsh-web-frontend',
  'dist'
)
const destination = path.join(destinationDirectory, 'dsh-desktop-logo.png')
const lightDestination = path.join(destinationDirectory, 'dsh-desktop-logo-light.png')
const darkDestination = path.join(destinationDirectory, 'dsh-desktop-logo-dark.png')
const indexPath = path.join(destinationDirectory, 'index.html')
const manifestPath = path.join(destinationDirectory, 'manifest.webmanifest')
const appleTouchIconPath = path.join(destinationDirectory, 'apple-touch-icon.png')

/**
 * Swap the Harness favicon link for the desktop's own.
 *
 * The href is matched rather than pinned: 0.1.2-alpha.1 moved it from
 * `/favicon.svg` to `./favicon.svg`. Harness 0.1.7-rc.1 declares separate
 * light and dark favicon links; Desktop uses the same PNG for both themes.
 * @param contents - index.html source.
 * @param file - path shown in the failure message.
 * @returns index.html with the desktop icon link.
 */
function replaceIconLink(contents, file) {
  const desktop = '<link rel="icon" type="image/png" href="/dsh-desktop-logo.png" />'
  if (contents.includes(desktop)) return contents
  const matches = contents.match(/<link rel="icon"[^>]*>/gu) ?? []
  const themedLinks = matches.length === 2
    && matches.some((link) => link.includes('media="(prefers-color-scheme: dark)"'))
    && matches.some((link) => link.includes('media="(prefers-color-scheme: light)"'))
  if (matches.length !== 1 && !themedLinks) {
    throw new Error(
      `Could not update COWIN Harness Desktop branding in ${file}: expected one icon link or a light/dark pair, found ${String(matches.length)}`
    )
  }
  return themedLinks
    ? contents.replace(matches[0], desktop).replace(matches[1], '')
    : contents.replace(matches[0], desktop)
}

/**
 * Rewrites the remaining upstream identity inside index.html: the document
 * title, the inert apple-mobile-web-app-title, and the apple-touch-icon link.
 * The OS window title is pinned by the shell, but `document.title` and the
 * touch icon are still reachable, so they carry the COWIN identity too.
 * @param contents - index.html source.
 * @param file - path shown in the failure message.
 * @returns index.html with the COWIN identity.
 */
function replaceIndexIdentity(contents, file) {
  let next = contents
  const swaps = [
    // The second alternative migrates installs that already ran the previous
    // "COWIN Desktop" branding; fresh upstream has "DeepSeek Harness".
    [/<title>(?:DeepSeek Harness|COWIN Desktop)<\/title>/u, '<title>COWIN Harness Desktop</title>'],
    [/apple-mobile-web-app-title" content="DSH"/u, 'apple-mobile-web-app-title" content="COWIN"'],
    [/<link rel="apple-touch-icon" href="\.?\/apple-touch-icon\.png" \/>/u, '<link rel="apple-touch-icon" href="/dsh-desktop-logo.png" />']
  ]
  for (const [pattern, replacement] of swaps) {
    if (next.includes(replacement)) continue
    if (!pattern.test(next)) {
      throw new Error(`Could not update COWIN Harness Desktop branding in ${file}: expected ${String(pattern)} upstream markup`)
    }
    next = next.replace(pattern, replacement)
  }
  return next
}

/**
 * Point the web manifest's icon at the desktop logo and carry the COWIN
 * product identity.
 *
 * Edited as JSON rather than as text: upstream added `"purpose": "any"` to the
 * entry in 0.1.2-alpha.1, which a pinned multi-line string could not survive,
 * and key order is not a contract. 0.2.2 uses sized PNG and maskable entries;
 * replace the known upstream set with one ordinary Desktop icon. The logo is
 * not authored for maskable safe areas, so do not advertise that capability.
 * @param contents - manifest source.
 * @param file - path shown in the failure message.
 * @returns manifest JSON with the desktop icon and identity.
 */
function replaceManifestIcon(contents, file) {
  const manifest = JSON.parse(contents)
  const icons = Array.isArray(manifest.icons) ? manifest.icons : []
  const isBrandIcon = (icon) => typeof icon?.src === 'string'
    && (icon.src === '/dsh-desktop-logo.png'
      || /^(?:\.\/|\/)?(?:favicon\.svg|icon-(?:192|512|maskable-512)\.png)$/u.test(icon.src))
  const first = icons.findIndex(isBrandIcon)
  if (first === -1) {
    throw new Error(`Could not update COWIN Harness Desktop branding in ${file}: no icon entry to replace`)
  }
  manifest.icons = icons.flatMap((icon, index) => {
    if (!isBrandIcon(icon)) return [icon]
    if (index !== first) return []
    return [{ ...icon, src: '/dsh-desktop-logo.png', sizes: '1254x1254', type: 'image/png', purpose: 'any' }]
  })
  manifest.name = 'COWIN Harness Desktop'
  manifest.short_name = 'COWIN'
  return `${JSON.stringify(manifest, null, 2)}\n`
}

/**
 * Replace standalone brand tokens inside vendor client bundles.
 *
 * "Standalone" means the character before the token is not an identifier
 * character, so code identifiers such as `isDSHRemoteError` or
 * `__DSH_DOCUMENT_PREVIEW_CONFIG_` survive while every visible locale string
 * ("重启 DSH", "signed out of DeepSeek", …) is rebranded. Counts are pinned to
 * the installed upstream release on purpose: an upstream upgrade that changes
 * any count fails here loudly and becomes a migration checkpoint, instead of
 * silently shipping mixed branding.
 *
 * Model/service identifiers written in lowercase ("deepseek-chat",
 * "api.deepseek.com") never match these camel-case tokens and stay factual.
 */
const vendorBrandRewrites = [
  {
    file: 'node_modules/@deepseek-ai/dsh-client-ui-chat/lib/client.js',
    tokens: [
      { token: 'DeepSeek Harness', replacement: 'COWIN Harness Desktop', expected: 0 },
      { token: 'DeepSeek', replacement: 'COWIN', expected: 17 },
      { token: 'DSH', replacement: 'COWIN Harness Desktop', expected: 17 },
      // Desktop wording for the streaming placeholder: the zh keys
      // chat.deepDiving / chat.deepDivingFor both start with this phrase
      // ("深度求索中" / "深度求索中，用时 {duration} ···"); keep the elapsed
      // part and the trailing ellipsis upstream wrote.
      { token: '深度求索中', replacement: '深度思考中', expected: 2 },
      // Migration: installs that already ran the previous branding carry the
      // old product name in these bundles. Fresh installs match zero.
      { token: 'COWIN Desktop', replacement: 'COWIN Harness Desktop', expected: 17 }
    ]
  },
  {
    file: 'node_modules/@deepseek-ai/dsh-client-ui-plugin-manager/lib/client.js',
    tokens: [
      { token: 'DeepSeek Harness', replacement: 'COWIN Harness Desktop', expected: 8 },
      { token: 'DSH', replacement: 'COWIN Harness Desktop', expected: 156 },
      { token: 'COWIN Desktop', replacement: 'COWIN Harness Desktop', expected: 164 }
    ]
  },
  {
    file: 'node_modules/@deepseek-ai/dsh-client-ui-sidebar-documentpreview/lib/client.js',
    tokens: [
      { token: 'DeepSeek Harness', replacement: 'COWIN Harness Desktop', expected: 8 },
      { token: 'DSH', replacement: 'COWIN Harness Desktop', expected: 0 },
      { token: 'COWIN Desktop', replacement: 'COWIN Harness Desktop', expected: 8 }
    ]
  },
  {
    file: 'node_modules/@deepseek-ai/dsh-client-ui-settings-session-log/lib/client.js',
    tokens: [
      { token: 'DeepSeek Harness', replacement: 'COWIN Harness Desktop', expected: 0 },
      { token: 'DeepSeek', replacement: 'COWIN Harness Desktop', expected: 8 },
      { token: 'COWIN Desktop', replacement: 'COWIN Harness Desktop', expected: 8 }
    ]
  },
  {
    file: 'node_modules/@deepseek-ai/dsh-client-ui-layout/lib/client.js',
    tokens: [
      { token: 'DeepSeek Harness', replacement: 'COWIN Harness Desktop', expected: 1 },
      { token: 'DSH', replacement: 'COWIN Harness Desktop', expected: 0 },
      { token: 'COWIN Desktop', replacement: 'COWIN Harness Desktop', expected: 1 }
    ]
  }
]

function isIdentifierChar(char) {
  return char != null && /[A-Za-z0-9_$]/u.test(char)
}

async function rewriteVendorBrandStrings() {
  for (const target of vendorBrandRewrites) {
    const absolute = path.join(projectRoot, target.file)
    let contents = await readFile(absolute, 'utf8')
    for (const step of target.tokens) {
      let replaced = 0
      let index = contents.indexOf(step.token)
      while (index !== -1) {
        // Token at position 0 has no preceding character; it is standalone.
        const previous = index > 0 ? contents[index - 1] : ''
        if (!isIdentifierChar(previous)) {
          contents = contents.slice(0, index) + step.replacement + contents.slice(index + step.token.length)
          replaced += 1
          index += step.replacement.length
        } else {
          index += step.token.length
        }
        index = contents.indexOf(step.token, index)
      }
      // Idempotence: a rerun finds only the already-rebranded text, so zero
      // replacements are expected on the second pass.
      if (replaced !== step.expected && replaced !== 0) {
        throw new Error(
          `Could not update COWIN Harness Desktop branding in ${target.file}: token ${JSON.stringify(step.token)} matched ${String(replaced)} times, expected ${String(step.expected)}`
        )
      }
    }
    await writeFile(absolute, contents)
  }
}

/**
 * The upstream "model is thinking" shimmer is masked by a whale bitmap. Swap
 * the asset for a loading ring at the same dimensions so the streaming
 * indicator reads as a spinner while keeping the upstream shimmer sweep. The
 * file is part of the pinned upstream closure; on upgrade the hashed
 * filename or size may change and this step must be re-checked.
 */
async function replaceRunningWhaleMask() {
  const maskPath = path.join(
    projectRoot,
    'node_modules',
    '@deepseek-ai',
    'dsh-client-ui-chat',
    'lib',
    'assets',
    'running-whale@2x-06738fa29b2f.png'
  )
  let original
  try {
    const sharpProbe = require('sharp')
    original = await sharpProbe(maskPath).metadata()
  } catch {
    // The asset is optional in minimal installs; nothing to rebrand then.
    return
  }
  const sharp = require('sharp')
  // A 270° arc with round caps inside the original canvas: the gap and the
  // shimmer sweep together read as the usual loading spinner.
  const size = Math.min(original.width, original.height)
  const center = size / 2
  const radius = size / 2 - 4
  const top = `${center} ${center - radius}`
  const left = `${center - radius} ${center}`
  const ring = `<svg xmlns="http://www.w3.org/2000/svg" width="${String(original.width)}" height="${String(original.height)}" viewBox="0 0 ${String(original.width)} ${String(original.height)}"><path d="M ${top} A ${radius} ${radius} 0 1 1 ${left}" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/></svg>`
  const png = await sharp(Buffer.from(ring)).png().toBuffer()
  await writeFile(maskPath, png)
}

await mkdir(destinationDirectory, { recursive: true })
await copyFile(source, destination)
await copyFile(lightSource, lightDestination)
await copyFile(darkSource, darkDestination)
await copyFile(source, appleTouchIconPath)

const index = await readFile(indexPath, 'utf8')
await writeFile(indexPath, replaceIconLink(replaceIndexIdentity(index, path.relative(projectRoot, indexPath)), path.relative(projectRoot, indexPath)))

const manifest = await readFile(manifestPath, 'utf8')
await writeFile(
  manifestPath,
  replaceManifestIcon(manifest, path.relative(projectRoot, manifestPath))
)

await rewriteVendorBrandStrings()
await replaceRunningWhaleMask()

console.log(`Installed COWIN Harness Desktop brand assets: ${[
  destination,
  lightDestination,
  darkDestination
].map((file) => path.relative(projectRoot, file)).join(', ')}; vendor copy rewritten`)
