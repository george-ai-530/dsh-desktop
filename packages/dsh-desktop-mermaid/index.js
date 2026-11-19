/**
 * Host half of the desktop mermaid fence renderer.
 *
 * The capability lives entirely in the client bundle (`./client`): it occupies
 * the per-language fence-renderer seam in the patched Markdown primitives and
 * renders `mermaid` fenced code blocks as diagrams. This entry only makes the
 * package a valid Harness Loader entry so the client module system serves its
 * chunk; there is no server-side state to own, and removing the plugin
 * restores the upstream code-fence rendering everywhere.
 */
export function apply() {}
