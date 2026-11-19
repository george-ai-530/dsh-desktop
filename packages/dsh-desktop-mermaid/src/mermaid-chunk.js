/**
 * Lazy chunk bundled to `client.mermaid.js` by
 * `scripts/mermaid/build-mermaid-plugin.mjs` (esbuild, CJS wrapper matching
 * the upstream `client.<name>.js` chunk protocol).
 *
 * Holds the whole mermaid library plus the diagram component so the plugin's
 * registration bundle stays small and the library only reaches the page once a
 * mermaid fence actually renders. `react` and the UI primitives stay external:
 * they resolve through the module system's shared baseline, so the chunk never
 * carries a second React copy.
 */
import { createElement, useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'
import {
  diagramThemeVariables,
  nextDiagramId,
  removeDiagramScaffolding,
  truncateReason
} from './mermaid-shared.js'

/**
 * Render one mermaid source into the container. SVG colors are baked in at
 * render time, so the caller re-runs this after a theme switch.
 * @param code - fence source (mermaid graph definition).
 * @returns the SVG markup produced for the source.
 */
async function renderSvg(code) {
  const id = nextDiagramId()
  try {
    mermaid.initialize({
      startOnLoad: false,
      // Mermaid's built-in sanitizer; user-authored fence source must not
      // execute scripts or wire click handlers into the page.
      securityLevel: 'strict',
      theme: 'base',
      // v12's `neo` look paints gradient strokes; the classic look keeps the
      // flat solid borders the product diagrams use.
      look: 'classic',
      themeVariables: diagramThemeVariables(getComputedStyle(document.body))
    })
    const { svg } = await mermaid.render(id, code)
    return svg
  } catch (cause) {
    removeDiagramScaffolding(id)
    throw cause
  }
}

/**
 * One fence's diagram body. Re-renders on source or theme changes; renders
 * are serialized per instance through an attempt counter so a stale async
 * result never paints over a newer source.
 * @param {object} props - fence source plus localized card labels.
 * @param {string} props.code - fence source (mermaid graph definition).
 * @param {{ errorTitle: string, retry: string, onRetry: () => void, diagramLabel: string }} props.labels
 * @returns {unknown} the diagram body element.
 */
export function MermaidDiagram({ code, labels }) {
  const containerRef = useRef(null)
  const attemptRef = useRef(0)
  const [error, setError] = useState(null)
  const [themeGeneration, setThemeGeneration] = useState(0)

  // The theme bundle flips `data-ds-dark-theme` on `<body>`; SVG colors are
  // baked at render time, so a flip must re-render with the new tokens.
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setThemeGeneration(value => value + 1)
    })
    const options = { attributes: true, attributeFilter: ['data-ds-dark-theme'] }
    observer.observe(document.documentElement, options)
    observer.observe(document.body, options)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const attempt = ++attemptRef.current
    let cancelled = false
    setError(null)
    const container = containerRef.current
    if (container !== null) container.innerHTML = ''
    const render = async () => {
      try {
        const svg = await renderSvg(code)
        if (cancelled || attempt !== attemptRef.current) return
        const target = containerRef.current
        if (target === null) return
        target.innerHTML = svg
      } catch (cause) {
        if (!cancelled && attempt === attemptRef.current) setError(truncateReason(cause))
      }
    }
    void render()
    return () => {
      cancelled = true
    }
  }, [code, themeGeneration])

  if (error !== null) {
    return createElement('div', { className: 'dshMermaidError' },
      createElement('p', { className: 'dshMermaidErrorText', role: 'status' }, `${labels.errorTitle}: ${error}`),
      createElement('button', { type: 'button', className: 'dshMermaidRetry', onClick: labels.onRetry }, labels.retry))
  }
  return createElement('div', {
    className: 'dshMermaidFigure',
    role: 'img',
    'aria-label': labels.diagramLabel,
    ref: containerRef
  })
}
