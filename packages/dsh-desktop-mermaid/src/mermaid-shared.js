/**
 * Pure helpers shared by the mermaid fence chunk and its tests.
 *
 * Kept dependency-free so `test/desktop-mermaid-plugin.test.mjs` can import
 * this file directly while the esbuild chunk bundles the same functions.
 */

/**Mermaid themeVariables key → `--dsw-alias-*` token that feeds it. Only
 * semantic tokens are used; values the page does not define stay unset so the
 * mermaid defaults keep working in surfaces without the theme bundle. Nodes
 * take the brand-tinted fill with accent strokes to match the product's
 * diagram look; lines share the accent so edges read as part of the graph. */
const ALIAS_THEME_VARIABLES = [
  ['primaryColor', '--dsw-alias-state-business-tertiary'],
  ['secondaryColor', '--dsw-alias-state-business-tertiary'],
  ['tertiaryColor', '--dsw-alias-bg-layer-2'],
  ['primaryTextColor', '--dsw-alias-label-primary'],
  ['secondaryTextColor', '--dsw-alias-label-secondary'],
  ['primaryBorderColor', '--dsw-alias-state-business-primary'],
  ['lineColor', '--dsw-alias-state-business-primary'],
  ['edgeLabelBackground', '--dsw-alias-bg-layer-2'],
  ['clusterBkg', '--dsw-alias-bg-layer-2'],
  ['clusterBorder', '--dsw-alias-border-l3'],
  ['errorBkgColor', '--dsw-alias-state-error-secondary'],
  ['errorTextColor', '--dsw-alias-state-error-primary']
]

/** Longest error reason shown on the diagram card, in characters. */
export const MAX_REASON_LENGTH = 200

let lastDiagramId = 0

/**
 * Next unique SVG id for `mermaid.render`. Mermaid requires one id per render
 * (it parks a temporary element under that id in the document), and two
 * fences rendering in parallel must not collide.
 * @returns an id unique within the page, such as `dsh-mermaid-17`.
 */
export function nextDiagramId() {
  lastDiagramId += 1
  return `dsh-mermaid-${lastDiagramId}`
}

/**
 * Drop the temporary elements mermaid parks in `document.body` while (or
 * after) rendering one diagram id. `mermaid.render` usually removes them
 * itself; the failure paths can leave them behind.
 * @param id - id returned by {@link nextDiagramId} for that render.
 */
export function removeDiagramScaffolding(id) {
  for (const suffix of ['', 'd']) {
    const node = document.getElementById(`${id}${suffix}`)
    node?.remove()
  }
}

/**
 * Truncate one thrown value into a card-sized reason string. Mermaid parse
 * errors quote the offending source line, so the cap keeps the card readable
 * without losing the leading diagnostic.
 * @param cause - thrown value from a render attempt.
 * @returns the message (or String form), capped at {@link MAX_REASON_LENGTH}.
 */
export function truncateReason(cause) {
  const raw = cause instanceof Error ? cause.message : String(cause)
  const text = raw.trim()
  if (text.length <= MAX_REASON_LENGTH) return text
  return `${text.slice(0, MAX_REASON_LENGTH)}…`
}

/**
 * Map the page's semantic tokens onto mermaid's `themeVariables` for the
 * `base` theme. SVG fills bake colors in at render time, so the chunk re-runs
 * this (and re-renders) when the theme attribute flips.
 * @param styles - a `CSSStyleDeclaration`-like value reading custom properties.
 * @returns a `themeVariables` object; unset tokens are omitted entirely.
 */
export function diagramThemeVariables(styles) {
  const variables = { background: 'transparent' }
  for (const [key, token] of ALIAS_THEME_VARIABLES) {
    const value = styles.getPropertyValue(token).trim()
    if (value !== '') variables[key] = value
  }
  return variables
}
