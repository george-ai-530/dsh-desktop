import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

// Propagate the authoritative brand artwork in build/brand/ into the inline
// constants embedded in the first-party client plugins, so replacing the
// official SVGs never requires hand-editing duplicated path data:
//
//   build/brand/brand-mark.svg     -> BRAND_MARK_PATH / BRAND_MARK_VIEWBOX in
//                                     packages/dsh-desktop-client-ui/client.js and
//                                     packages/dsh-desktop-onboarding/client.js
//   build/brand/logo-wordmark.svg  -> BRAND_WORDMARK_PATH / BRAND_WORDMARK_VIEWBOX in
//                                     packages/dsh-desktop-client-ui/client.js
//                                     (latin "COWIN" group only, merged into one
//                                      path, bounds measured via a sharp render)
//
// Every rewrite is anchored: when the expected constant shape is missing the
// script fails loudly instead of leaving a stale copy behind. Run via
// `npm run brand:sync`. sharp arrives via the upstream dependency closure,
// same access pattern as generate-loader-gifs.mjs.

const require = createRequire(import.meta.url)
const sharp = require('sharp')

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const brandDirectory = path.join(projectRoot, 'build', 'brand')
const clientUiTarget = path.join(projectRoot, 'packages', 'dsh-desktop-client-ui', 'client.js')
const onboardingTarget = path.join(projectRoot, 'packages', 'dsh-desktop-onboarding', 'client.js')

// --- brand mark -----------------------------------------------------------

const markSvg = await readFile(path.join(brandDirectory, 'brand-mark.svg'), 'utf8')
const markPath = /<path[^>]*\sd="([^"]+)"/.exec(markSvg)?.[1]
if (!markPath) throw new Error('brand-mark.svg: no path data found')
// Tight bounds live in the header comment; the consumers need them for the
// cropped viewBox. Keep the documented `x … y … w … h …` wording.
const bounds = /x\s+([\d.]+)\s+y\s+([\d.]+)\s+w\s+([\d.]+)\s+h\s+([\d.]+)/.exec(markSvg)
if (!bounds) throw new Error('brand-mark.svg: tight-bounds comment (x … y … w … h …) missing')
const markViewbox = { x: bounds[1], y: bounds[2], width: bounds[3], height: bounds[4] }

const MARK_VIEWBOX_RE = /const BRAND_MARK_VIEWBOX = \{[^}]+\}/
const MARK_PATH_RE = /const BRAND_MARK_PATH = "(?:[^"\\]|\\.)*"/
const markViewboxLiteral = `const BRAND_MARK_VIEWBOX = { x: ${markViewbox.x}, y: ${markViewbox.y}, width: ${markViewbox.width}, height: ${markViewbox.height} }`
const markPathLiteral = `const BRAND_MARK_PATH = ${JSON.stringify(markPath)}`

for (const target of [clientUiTarget, onboardingTarget]) {
  let source = await readFile(target, 'utf8')
  if (!MARK_VIEWBOX_RE.test(source) || !MARK_PATH_RE.test(source)) {
    throw new Error(`${path.relative(projectRoot, target)}: BRAND_MARK_VIEWBOX/BRAND_MARK_PATH constants not found`)
  }
  source = source.replace(MARK_VIEWBOX_RE, markViewboxLiteral)
  source = source.replace(MARK_PATH_RE, markPathLiteral)
  await writeFile(target, source)
  console.log(`synced brand mark -> ${path.relative(projectRoot, target)}`)
}

// --- latin wordmark -------------------------------------------------------

// The wordmark SVG groups the latin lockup under the brand-blue fill; the
// sidebar renders it in currentColor, so only that group's path data moves.
const wordmarkSvg = await readFile(path.join(brandDirectory, 'logo-wordmark.svg'), 'utf8')
const latinGroup = /<g fill="#0052D9">([\s\S]*?)<\/g>/.exec(wordmarkSvg)?.[1]
if (!latinGroup) throw new Error('logo-wordmark.svg: no <g fill="#0052D9"> latin group found')
const latinPaths = [...latinGroup.matchAll(/d="([^"]+)"/g)].map((match) => match[1])
if (latinPaths.length === 0) throw new Error('logo-wordmark.svg: latin group has no path data')
const latinMerged = latinPaths.join(' ')

// Measure the latin ink bounds by rendering the group on the wordmark canvas
// and scanning the alpha channel, so any path geometry works.
const CANVAS_WIDTH = 560
const CANVAS_HEIGHT = 160
const groupSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" viewBox="0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}"><g fill="#000">${latinGroup.replaceAll('#0052D9', '#000')}</g></svg>`
const { data, info } = await sharp(Buffer.from(groupSvg)).raw().toBuffer({ resolveWithObject: true })
let minX = info.width, minY = info.height, maxX = -1, maxY = -1
for (let y = 0; y < info.height; y += 1) {
  for (let x = 0; x < info.width; x += 1) {
    if (data[(y * info.width + x) * info.channels + 3] > 8) {
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
}
if (maxX < 0) throw new Error('logo-wordmark.svg: latin group rendered empty')
const wordmarkViewbox = {
  x: (minX / info.width * CANVAS_WIDTH).toFixed(2),
  y: (minY / info.height * CANVAS_HEIGHT).toFixed(2),
  width: ((maxX - minX + 1) / info.width * CANVAS_WIDTH).toFixed(2),
  height: ((maxY - minY + 1) / info.height * CANVAS_HEIGHT).toFixed(2)
}

let clientUi = await readFile(clientUiTarget, 'utf8')
const WORDMARK_VIEWBOX_RE = /const BRAND_WORDMARK_VIEWBOX = \{[^}]+\}/
const WORDMARK_PATH_RE = /const BRAND_WORDMARK_PATH = "(?:[^"\\]|\\.)*"/
if (!WORDMARK_VIEWBOX_RE.test(clientUi) || !WORDMARK_PATH_RE.test(clientUi)) {
  throw new Error('client.js: BRAND_WORDMARK_VIEWBOX/BRAND_WORDMARK_PATH constants not found')
}
clientUi = clientUi.replace(WORDMARK_VIEWBOX_RE, `const BRAND_WORDMARK_VIEWBOX = { x: ${wordmarkViewbox.x}, y: ${wordmarkViewbox.y}, width: ${wordmarkViewbox.width}, height: ${wordmarkViewbox.height} }`)
clientUi = clientUi.replace(WORDMARK_PATH_RE, `const BRAND_WORDMARK_PATH = ${JSON.stringify(latinMerged)}`)
console.log(`synced latin wordmark -> ${path.relative(projectRoot, clientUiTarget)}`)

// --- hero mark ------------------------------------------------------------

// The new-conversation hero shows the official lockup as embedded bitmaps
// (build/brand/hero-light.png / hero-dark.png, rendered by
// render-official-logo-assets.mjs). Two variants exist because the artwork's
// brand blue is tuned for white backgrounds; the plugin style block swaps
// them on upstream's own dark-theme marker.
const heroLightData = `data:image/png;base64,${(await readFile(path.join(brandDirectory, 'hero-light.png'))).toString('base64')}`
const heroDarkData = `data:image/png;base64,${(await readFile(path.join(brandDirectory, 'hero-dark.png'))).toString('base64')}`
const HERO_LIGHT_DATA_RE = /const HERO_MARK_LIGHT_DATA = "(?:[^"\\]|\\.)*"/
const HERO_DARK_DATA_RE = /const HERO_MARK_DARK_DATA = "(?:[^"\\]|\\.)*"/
if (!HERO_LIGHT_DATA_RE.test(clientUi) || !HERO_DARK_DATA_RE.test(clientUi)) {
  throw new Error('client.js: HERO_MARK_LIGHT_DATA/HERO_MARK_DARK_DATA constants not found')
}
clientUi = clientUi.replace(HERO_LIGHT_DATA_RE, `const HERO_MARK_LIGHT_DATA = ${JSON.stringify(heroLightData)}`)
clientUi = clientUi.replace(HERO_DARK_DATA_RE, `const HERO_MARK_DARK_DATA = ${JSON.stringify(heroDarkData)}`)
console.log(`synced hero marks -> ${path.relative(projectRoot, clientUiTarget)}`)

await writeFile(clientUiTarget, clientUi)
console.log('brand sync complete')
