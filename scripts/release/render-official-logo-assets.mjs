import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

// Render the official COWIN 珂阳 bitmap into the tracked brand assets
// (route B in build/brand/README.zh.md — the authoritative input is the
// JPEG in build/brand/source/, not an SVG):
//
//   build/brand/source/cowin-logo.jpg -> build/app-icon.png (1024x1024)
//                                     -> build/icon.png     (1254x1254, the
//                                        favicon/manifest contract dimension)
//                                     -> build/logo-light.png / logo-dark.png (336x192)
//                                     -> build/startup-brand.svg (PNG embedded,
//                                        tight bounds, splash + boot cover)
//
// The JPEG has an opaque white background, so every bitmap output derives
// alpha from the white matte (alpha = 255 - min(r,g,b), denoised) and
// un-matts the ink color, keeping anti-aliased edges clean on any
// background. The dark wordmark variant lightens the measured brand blue
// to #366EF4 the same way render-brand-assets.mjs does for SVG sources;
// orange and the red dot are unchanged. Regenerating build/icon.ico from
// the new app-icon.png stays with `npm run icons:generate`; do not run
// `npm run brand:render` afterwards, it would overwrite these PNGs from
// the SVG sources.

const require = createRequire(import.meta.url)
const sharp = require('sharp')

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const buildDirectory = path.join(projectRoot, 'build')
const sourceJpg = path.join(buildDirectory, 'brand', 'source', 'cowin-logo.jpg')

const ALPHA_DENoise_FLOOR = 24
const ALPHA_TRIM_THRESHOLD = 10
// Measured from the artwork; the dark variant shifts this blue the way the
// SVG pipeline swaps #0052D9 -> #366EF4.
const DARK_BLUE_LIGHTNESS_SHIFT = 0.23
const DARK_BLUE_HUE_SHIFT = 16

const APP_ICON_SIZE = 1024
const ICON_SIZE = 1254
const TILE_MARGIN_RATIO = 89 / 1024
const TILE_RADIUS_RATIO = 200 / 1024
const WORDMARK_WIDTH = 336
const WORDMARK_HEIGHT = 192

/** Convert the opaque JPEG into RGBA with the white matte turned into alpha. */
async function loadUnmattedSource() {
  // Median(3) first: 4:2:0 chroma subsampling leaves isolated color outliers
  // on the white field that the matte removal would amplify into saturated
  // speckles; a 3px median removes them without softening the artwork edges.
  const { data, info } = await sharp(sourceJpg).median(3).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const channels = info.channels
  const out = Buffer.alloc(info.width * info.height * 4)
  for (let pixel = 0; pixel < info.width * info.height; pixel += 1) {
    const i = pixel * channels
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const alpha = Math.max(0, 255 - Math.min(r, g, b))
    if (alpha < ALPHA_DENoise_FLOOR) {
      // JPEG noise around the artwork must not become a faint halo.
      out[pixel * 4 + 3] = 0
      continue
    }
    const coverage = alpha / 255
    // observed = coverage * ink + (1 - coverage) * 255  =>  solve for ink.
    const ink = (value) => Math.max(0, Math.min(255, Math.round((value - (255 - alpha)) / coverage)))
    out[pixel * 4] = ink(r)
    out[pixel * 4 + 1] = ink(g)
    out[pixel * 4 + 2] = ink(b)
    out[pixel * 4 + 3] = alpha
  }
  return { data: out, width: info.width, height: info.height }
}

/** Crop to the tight ink bounds so downstream composition does not guess. */
function trimToInk(image) {
  let minX = image.width
  let minY = image.height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      if (image.data[(y * image.width + x) * 4 + 3] > ALPHA_TRIM_THRESHOLD) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) throw new Error('cowin-logo.jpg: no ink found after matte removal')
  const width = maxX - minX + 1
  const height = maxY - minY + 1
  const data = Buffer.alloc(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    const sourceStart = ((minY + y) * image.width + minX) * 4
    image.data.copy(data, y * width * 4, sourceStart, sourceStart + width * 4)
  }
  return { data, width, height }
}

function rgbToHsl(r, g, b) {
  const rf = r / 255
  const gf = g / 255
  const bf = b / 255
  const max = Math.max(rf, gf, bf)
  const min = Math.min(rf, gf, bf)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h
  if (max === rf) h = ((gf - bf) / d + (gf < bf ? 6 : 0))
  else if (max === gf) h = (bf - rf) / d + 2
  else h = (rf - gf) / d + 4
  return { h: h * 60, s, l }
}

function hueToRgb(p, q, t) {
  let tt = t
  if (tt < 0) tt += 1
  if (tt > 1) tt -= 1
  if (tt < 1 / 6) return p + (q - p) * 6 * tt
  if (tt < 1 / 2) return q
  if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6
  return p
}

function hslToRgb(h, s, l) {
  if (s === 0) {
    const v = Math.round(l * 255)
    return [v, v, v]
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const hue = h / 360
  return [
    Math.round(hueToRgb(p, q, hue + 1 / 3) * 255),
    Math.round(hueToRgb(p, q, hue) * 255),
    Math.round(hueToRgb(p, q, hue - 1 / 3) * 255)
  ]
}

/**
 * Lighten the artwork's brand blue for dark backgrounds. Hue and lightness
 * move toward #366EF4 while coverage alpha and the other artwork colors stay
 * untouched, mirroring the SVG pipeline's constant swap.
 */
function lightenBrandBlue(image) {
  const out = Buffer.from(image.data)
  for (let pixel = 0; pixel < image.width * image.height; pixel += 1) {
    const i = pixel * 4
    const r = out[i]
    const g = out[i + 1]
    const b = out[i + 2]
    if (out[i + 3] === 0 || b <= r + 30 || b < 60) continue
    const hsl = rgbToHsl(r, g, b)
    const [nr, ng, nb] = hslToRgb(
      (hsl.h + DARK_BLUE_HUE_SHIFT + 360) % 360,
      hsl.s,
      Math.min(1, hsl.l + DARK_BLUE_LIGHTNESS_SHIFT)
    )
    out[i] = nr
    out[i + 1] = ng
    out[i + 2] = nb
  }
  return { data: out, width: image.width, height: image.height }
}

async function writeRawPng(image, destination) {
  await sharp(image.data, { raw: { width: image.width, height: image.height, channels: 4 } })
    .png()
    .toFile(destination)
}

/**
 * The app icon carries the full official lockup on the white rounded tile
 * (canvas contract from build/brand/app-icon.svg: transparent margin plus an
 * 846px tile at 1024, scaled proportionally for the 1254 favicon render).
 */
async function renderAppIcon(image, size, destination) {
  const tileSpan = Math.round(size * (1 - TILE_MARGIN_RATIO * 2))
  const margin = Math.round(size * TILE_MARGIN_RATIO)
  const lockupWidth = tileSpan
  const lockupHeight = Math.max(1, Math.round(tileSpan * image.height / image.width))
  const lockup = await sharp(image.data, { raw: { width: image.width, height: image.height, channels: 4 } })
    .resize(lockupWidth, lockupHeight)
    .raw()
    .toBuffer()
  const tileRadius = Math.round(size * TILE_RADIUS_RATIO)
  const tile = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
    `<rect x="${margin}" y="${margin}" width="${tileSpan}" height="${tileSpan}" rx="${tileRadius}" fill="#FFFFFF"/>` +
    `</svg>`
  )
  await sharp(tile)
    .composite([{
      input: lockup,
      raw: { width: lockupWidth, height: lockupHeight, channels: 4 },
      left: margin,
      top: margin + Math.round((tileSpan - lockupHeight) / 2)
    }])
    .png()
    .toFile(destination)
}

async function renderWordmark(image, destination) {
  await sharp(image.data, { raw: { width: image.width, height: image.height, channels: 4 } })
    .resize(WORDMARK_WIDTH, WORDMARK_HEIGHT, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toFile(destination)
}

async function renderStartupSvg(image, destination) {
  const png = await sharp(image.data, { raw: { width: image.width, height: image.height, channels: 4 } })
    .png()
    .toBuffer()
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${image.width}" height="${image.height}" viewBox="0 0 ${image.width} ${image.height}">
<!-- Rendered by scripts/release/render-official-logo-assets.mjs from the
     official COWIN bitmap in build/brand/source/ (see
     build/brand/README.zh.md). Contains the lockup as an embedded PNG so the
     splash page and boot cover keep loading one startup-brand.svg file. -->
<image width="${image.width}" height="${image.height}" xlink:href="data:image/png;base64,${png.toString('base64')}"/>
</svg>
`
  await (await import('node:fs/promises')).writeFile(destination, svg)
}

// The new-conversation hero carries the official lockup as two embedded
// bitmaps (light and dark brand blue). Rendered at twice the 48px display
// height so the retina render stays crisp; `npm run brand:sync` embeds these
// files into packages/dsh-desktop-client-ui/client.js.
const HERO_MARK_HEIGHT = 96

async function renderHeroMark(image, destination) {
  const height = HERO_MARK_HEIGHT
  const width = Math.max(1, Math.round(image.width * height / image.height))
  await sharp(image.data, { raw: { width: image.width, height: image.height, channels: 4 } })
    .resize(width, height)
    .png()
    .toFile(destination)
}

const trimmed = trimToInk(await loadUnmattedSource())
console.log(`Trimmed official lockup: ${trimmed.width}x${trimmed.height}`)

await renderAppIcon(trimmed, APP_ICON_SIZE, path.join(buildDirectory, 'app-icon.png'))
await renderAppIcon(trimmed, ICON_SIZE, path.join(buildDirectory, 'icon.png'))
await renderWordmark(trimmed, path.join(buildDirectory, 'logo-light.png'))
await renderWordmark(lightenBrandBlue(trimmed), path.join(buildDirectory, 'logo-dark.png'))
await renderStartupSvg(trimmed, path.join(buildDirectory, 'startup-brand.svg'))
await renderHeroMark(trimmed, path.join(buildDirectory, 'brand', 'hero-light.png'))
await renderHeroMark(lightenBrandBlue(trimmed), path.join(buildDirectory, 'brand', 'hero-dark.png'))

console.log('Rendered build/app-icon.png, build/icon.png, build/logo-light.png, build/logo-dark.png, build/startup-brand.svg, build/brand/hero-light.png, build/brand/hero-dark.png')
