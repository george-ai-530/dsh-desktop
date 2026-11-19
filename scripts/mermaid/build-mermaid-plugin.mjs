/** Bundle the mermaid fence chunk for `packages/dsh-desktop-mermaid`.
 *
 * Output: `packages/dsh-desktop-mermaid/client.mermaid.js` — a CJS body in the
 * upstream `client.<name>.js` chunk protocol (`window.__ModuleLoader__.load`
 * with `chunk`, factory returning `module.exports`). `react` and the UI
 * primitives stay external so the shared baseline keeps one React copy; the
 * mermaid library is inlined so the chunk is self-contained (the Host serves
 * sibling chunks on demand but never scans further imports).
 *
 * Run before anything consumes the package client: dev, build, test, and
 * package entry points chain this script (`npm run mermaid:build`).
 */
import { build } from 'esbuild'
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDirectory, '../..')
const source = path.join(projectRoot, 'packages/dsh-desktop-mermaid/src/mermaid-chunk.js')
const output = path.join(projectRoot, 'packages/dsh-desktop-mermaid/client.mermaid.js')

const result = await build({
  entryPoints: [source],
  bundle: true,
  write: false,
  platform: 'browser',
  format: 'cjs',
  target: 'chrome120',
  minify: true,
  sourcemap: false,
  logLevel: 'warning',
  legalComments: 'inline',
  external: ['react', 'react/jsx-runtime', '@deepseek-ai/dsh-client-ui-primitives']
})

const body = result.outputFiles[0].text
// Same wrapper shape as the upstream documentpreview chunks
// (`client.excel.js`): the factory owns the `module`/`exports` pair the CJS
// body assigns to, and returns them as the chunk's exports.
const wrapped = `window.__ModuleLoader__.load({
	id: 'dsh-desktop-mermaid',
	chunk: 'client.mermaid.js',
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
${body}
		return module.exports;
	}
});
`
await writeFile(output, wrapped)
console.log(`mermaid chunk built: ${path.relative(projectRoot, output)} (${(wrapped.length / 1024 / 1024).toFixed(2)} MB)`)
