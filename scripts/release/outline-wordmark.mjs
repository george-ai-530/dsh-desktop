import { createRequire } from 'node:module'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Emits build/logo-wordmark.svg, the outlined COWIN 珂阳 wordmark used to
// render build/logo-light.png / logo-dark.png (render-brand-assets.mjs).
// Glyphs are converted to filled paths with all transforms baked into the
// coordinates, so rendering never depends on installed fonts (sharp's SVG
// text support is not deterministic on Windows) and consumers can embed the
// paths without reproducing the layout math. Re-run after changing the text,
// fonts, or spacing:
//
//   node scripts/release/outline-wordmark.mjs
//
// Font sources: the latin part uses Arial Bold and the Chinese part uses
// Microsoft YaHei Bold. Defaults point at the standard Windows font
// directory; override with COWIN_FONT_LATIN / COWIN_FONT_CJK when
// regenerating on another platform. The committed SVG is the authoritative
// input for renders, so these fonts are only needed when re-outlining.
// fontkit arrives transitively with the upstream dependency closure; it is
// accessed with createRequire like sharp in generate-loader-gifs.mjs.

const require = createRequire(import.meta.url)
const fontkit = require('fontkit')

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const target = path.join(projectRoot, 'build', 'brand', 'logo-wordmark.svg')

const LATIN_TEXT = 'COWIN'
const CJK_TEXT = '珂阳'
const LATIN_COLOR = '#0052D9'
const CJK_COLOR = '#E37318'
const CANVAS_WIDTH = 560
const CANVAS_HEIGHT = 160
const MARGIN = 8
// 珂阳 sits slightly smaller than the latin caps, matching the reference
// lockup where the Chinese mark reads as a companion to COWIN.
const LATIN_SIZE = 118
const CJK_SIZE = 100
const GAP = 14
// TrueType collections need the member postscript name to open a usable font.
const CJK_POSTSCRIPT_NAME = 'MicrosoftYaHei-Bold'

function outline(fontSource, text, size, postscriptName, runOffsetX) {
  const font = fontkit.openSync(fontSource, postscriptName)
  const run = font.layout(text)
  const scale = size / font.unitsPerEm
  const glyphPaths = []
  let x = 0
  for (let index = 0; index < run.glyphs.length; index += 1) {
    const glyph = run.glyphs[index]
    const position = run.positions[index]
    const dx = x + position.xOffset * scale
    // Undefined/whitespace glyphs carry no outline; keep their advance so
    // spacing stays true to the font.
    if (glyph.path) {
      // Font Y points up; canvas Y points down, so flip around the baseline,
      // then shift the whole run to its lockup position.
      const placed = glyph.path
        .transform(scale, 0, 0, -scale, dx, BASELINE)
        .translate(runOffsetX, 0)
      glyphPaths.push({ path: placed, d: placed.toSVG() })
    }
    x += position.xAdvance * scale
  }
  return { glyphPaths, advance: x }
}

const BASELINE = 118
const latinFontPath = process.env.COWIN_FONT_LATIN ?? 'C:/Windows/Fonts/arialbd.ttf'
const cjkFontPath = process.env.COWIN_FONT_CJK ?? 'C:/Windows/Fonts/msyhbd.ttc'
const latin = outline(latinFontPath, LATIN_TEXT, LATIN_SIZE, undefined, 0)
const cjk = outline(cjkFontPath, CJK_TEXT, CJK_SIZE, CJK_POSTSCRIPT_NAME, latin.advance + GAP)

// Ink bounds in lockup coordinates from the placed path bboxes.
function inkBounds(outlineResult, offsetX) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const glyph of outlineResult.glyphPaths) {
    const bbox = glyph.path.bbox
    if (!bbox || bbox.width === 0) continue
    minX = Math.min(minX, offsetX + bbox.minX)
    maxX = Math.max(maxX, offsetX + bbox.maxX)
    minY = Math.min(minY, bbox.minY)
    maxY = Math.max(maxY, bbox.maxY)
  }
  return { minX, minY, maxX, maxY }
}

const latinBounds = inkBounds(latin, 0)
const cjkBounds = inkBounds(cjk, 0)
const inkMinX = Math.min(latinBounds.minX, cjkBounds.minX)
const inkMaxX = Math.max(latinBounds.maxX, cjkBounds.maxX)
const inkMinY = Math.min(latinBounds.minY, cjkBounds.minY)
const inkMaxY = Math.max(latinBounds.maxY, cjkBounds.maxY)

// Fit the ink into the canvas with even margins, preserving aspect.
const inkWidth = inkMaxX - inkMinX
const inkHeight = inkMaxY - inkMinY
const fitScale = Math.min(
  (CANVAS_WIDTH - MARGIN * 2) / inkWidth,
  (CANVAS_HEIGHT - MARGIN * 2) / inkHeight
)
const offsetX = (CANVAS_WIDTH - inkWidth * fitScale) / 2 - inkMinX * fitScale
const offsetY = (CANVAS_HEIGHT - inkHeight * fitScale) / 2 - inkMinY * fitScale

// Bake the fit transform into final canvas coordinates and emit a flat SVG
// (no transforms) so every consumer can take the `d` values as-is.
function groupPaths(outlineResult, fitScale, fitOffsetX, fitOffsetY) {
  return outlineResult.glyphPaths
    .map((glyph) => {
      const fitted = glyph.path.transform(fitScale, 0, 0, fitScale, fitOffsetX, fitOffsetY)
      return `<path d="${fitted.toSVG()}"/>`
    })
    .join('')
}

const latinGroup = groupPaths(latin, fitScale, offsetX, offsetY)
const cjkGroup = groupPaths(cjk, fitScale, offsetX, offsetY)

const svg = `<svg width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" viewBox="0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}" fill="none" xmlns="http://www.w3.org/2000/svg">
<!-- COWIN 珂阳 wordmark, outlined from Arial Bold + Microsoft YaHei Bold by
     scripts/release/outline-wordmark.mjs. All glyph transforms are baked in;
     this file is the authoritative source and build/logo-light.png /
     logo-dark.png are rendered from it by scripts/release/render-brand-assets.mjs. -->
<g fill="${LATIN_COLOR}">${latinGroup}</g>
<g fill="${CJK_COLOR}">${cjkGroup}</g>
</svg>
`

await writeFile(target, svg)
console.log(`Outlined ${LATIN_TEXT}+${CJK_TEXT} -> ${path.relative(projectRoot, target)} (ink ${Math.round(inkWidth)}x${Math.round(inkHeight)}, fit ${fitScale.toFixed(3)})`)
