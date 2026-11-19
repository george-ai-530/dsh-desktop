# dsh-desktop-mermaid

Renders ` ```mermaid ` fenced code blocks as diagrams inside Markdown surfaces
(document preview, deliverable review tabs, and chat messages) instead of
plain code cards.

## How it works

- A patch on `@deepseek-ai/dsh-client-ui-primitives` adds a per-language
  fence-renderer seam in `renderCode`: before falling back to `CodeBlock`, a
  settled (non-streaming) fence consults `globalThis.__DSH_FENCE_RENDERERS__`
  — a `Map` of language → component. The seam keeps upstream behavior when
  the registry is absent, emptied, or damaged.
- The packaged UI renders Markdown through the copy of the primitives
  compiled INTO `@deepseek-ai/dsh-web-frontend/dist` (the frontend seeds that
  copy as the platform module), so the same seam is also patched into the
  frontend bundle — that copy is the one the packaged renderer actually
  executes. When regenerating the frontend patch, start from a pristine
  (pre-brand-assets) `dist`; never sweep the `install-brand-assets.mjs`
  output into the patch.
- This package's client bundle occupies the seam with `mermaid` at apply time
  and clears it on dispose, so disabling the plugin restores the upstream code
  fence everywhere without a reload of the page shell.
- The mermaid library lives in a lazy chunk, `client.mermaid.js`, built by
  `scripts/mermaid/build-mermaid-plugin.mjs` from `src/mermaid-chunk.js`.
  The chunk follows the upstream `client.<name>.js` protocol (loaded via
  `require.async`), so the library only reaches the page when a mermaid fence
  actually renders. `react` and `@deepseek-ai/dsh-client-ui-primitives` stay
  external and resolve through the module system's shared baseline.
- While a message streams, fences keep the plain code rendering (the seam is
  settled-only, mirroring the upstream TeX behavior); the diagram appears when
  the render settles. Syntax errors render an error card with mermaid's parse
  message and a retry button; chunk-load failures fall back to the code fence.
- Diagram colors map the page's `--dsw-alias-*` tokens onto mermaid's `base`
  theme at render time. SVG fills bake colors in, so a `data-ds-dark-theme`
  flip on `<body>` triggers a re-render.

## Source of the mermaid library

`mermaid` is a devDependency of the repository root; it is bundled into the
generated chunk and is not shipped as a runtime dependency. The chunk is a
build output and stays out of Git (see the package `.gitignore`).

Security: the chunk initializes mermaid with `securityLevel: 'strict'`
(mermaid's built-in sanitizer; no scripts, no click handlers from fence
source). Fence source never touches `innerHTML` directly — only the SVG that
`mermaid.render` returns under that mode.

## Removal conditions

Remove the seam patch and this package together once upstream ships a
per-language fence extension point in the Markdown renderer. Until then,
upgrades of `@deepseek-ai/dsh-client-ui-primitives` must re-check the
`renderCode` hunk against the new bundle.
