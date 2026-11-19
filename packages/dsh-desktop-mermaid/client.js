window.__ModuleLoader__.load({
  id: 'dsh-desktop-mermaid',
  factory: require => {
    const React = require('react')
    const { CodeBlock } = require('@deepseek-ai/dsh-client-ui-primitives')
    const h = React.createElement
    const NS = 'desktop.mermaid'
    const zh = {
      diagramLabel: '流程图',
      viewDiagram: '图表',
      viewCode: '代码',
      errorTitle: '流程图渲染失败',
      retry: '重试'
    }
    const en = {
      diagramLabel: 'Flowchart',
      viewDiagram: 'Diagram',
      viewCode: 'Code',
      errorTitle: 'Diagram rendering failed',
      retry: 'Retry'
    }
    const css = `
      .dshMermaid{margin:8px 0;border:.5px solid var(--dsw-alias-border-l3);border-radius:16px;background:transparent;overflow:hidden}
      .dshMermaidBar{display:flex;align-items:center;justify-content:flex-end;padding:8px 10px 0}
      .dshMermaidTabs{display:flex;gap:2px}
      .dshMermaidTab{appearance:none;font:inherit;font-size:12px;line-height:1.5;padding:2px 10px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}
      .dshMermaidTabActive{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
      .dshMermaidTab:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
      /* The diagram scales to the card and stays centered; tall diagrams grow
         the card instead of scrolling inside it. */
      .dshMermaidBody{display:flex;justify-content:center;padding:4px 16px 16px;overflow:visible}
      .dshMermaidBody svg{max-width:100%;height:auto}
      .dshMermaidBody .dshMermaidError{max-width:100%}
      .dshMermaidCodeHost{width:100%;min-width:0}
      .dshMermaidError{display:flex;flex-direction:column;gap:8px;padding:12px}
      .dshMermaidErrorText{margin:0;font-size:12px;line-height:1.5;color:var(--dsw-alias-state-error-primary);word-break:break-word}
      .dshMermaidRetry{appearance:none;align-self:flex-start;font:inherit;font-size:12px;line-height:1.5;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:4px 12px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}
      .dshMermaidRetry:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
    `

    // Chunk loader state shared by every mounted fence: the mermaid library
    // is fetched once per factory instance and survives across re-renders.
    let chunkState = 'idle'
    let chunkTask = null
    let chunkError = null
    let MermaidDiagramComponent = null
    const chunkListeners = new Set()

    function publishChunkState() {
      for (const listener of chunkListeners) listener()
    }

    function loadMermaidChunk() {
      if (chunkTask !== null) return chunkTask
      chunkState = 'loading'
      publishChunkState()
      chunkTask = require.async('./client.mermaid.js').then(module => {
        const diagram = module?.MermaidDiagram
        if (typeof diagram !== 'function') throw new Error('mermaid chunk did not export MermaidDiagram')
        MermaidDiagramComponent = diagram
        chunkState = 'ready'
        publishChunkState()
      }, cause => {
        // Drop the task so an explicit retry (button or next mount) can
        // fetch the chunk again instead of latching onto the rejection.
        chunkError = cause instanceof Error ? cause : new Error(String(cause))
        chunkState = 'failed'
        chunkTask = null
        publishChunkState()
      })
      return chunkTask
    }

    function useChunkState() {
      const [state, setState] = React.useState(() => chunkState)
      React.useEffect(() => {
        const listener = () => setState(chunkState)
        chunkListeners.add(listener)
        listener()
        return () => { chunkListeners.delete(listener) }
      }, [])
      return state
    }

    function MermaidFence({ code, language, labels }) {
      const t = useLocaleText()
      const [view, setView] = React.useState('diagram')
      const [attempt, setAttempt] = React.useState(0)
      const state = useChunkState()
      React.useEffect(() => {
        // First mount drives the fetch; a retry bumps `attempt` to re-run it.
        if (chunkState === 'idle' || (chunkState === 'failed' && attempt > 0)) loadMermaidChunk()
      }, [attempt])
      if (state === 'ready' && MermaidDiagramComponent !== null) {
        // The tab bar stays mounted in both views — switching to code must
        // keep the way back to the diagram visible.
        return h('figure', { className: 'dshMermaid' },
          h('div', { className: 'dshMermaidBar' },
            h('div', { className: 'dshMermaidTabs' },
              tabButton('diagram', t('viewDiagram'), view, setView),
              tabButton('code', t('viewCode'), view, setView))),
          h('div', { className: 'dshMermaidBody' },
            view === 'diagram'
              ? h(MermaidDiagramComponent, {
                  code,
                  labels: { errorTitle: t('errorTitle'), retry: t('retry'), onRetry: () => setAttempt(value => value + 1), diagramLabel: t('diagramLabel') }
                })
              : h('div', { className: 'dshMermaidCodeHost' },
                  h(CodeBlock, {
                    code,
                    lang: language,
                    copyLabel: labels?.copyLabel,
                    copiedLabel: labels?.copiedLabel,
                    toolbarLabels: labels?.toolbarLabels
                  }))))
      }
      // Loading and chunk-load failures keep the plain code fence visible —
      // the upstream rendering is the fallback, never a blank card.
      return h('div', { className: 'dshMermaid dshMermaidCode' },
        state === 'failed' && h('div', { className: 'dshMermaidError' },
          h('p', { className: 'dshMermaidErrorText', role: 'status' },
            `${t('errorTitle')}${chunkError?.message === undefined ? '' : `: ${shortenReason(chunkError.message)}`}`),
          h('button', { type: 'button', className: 'dshMermaidRetry', onClick: () => setAttempt(value => value + 1) }, t('retry'))),
        h(CodeBlock, {
          code,
          lang: language,
          copyLabel: labels?.copyLabel,
          copiedLabel: labels?.copiedLabel,
          toolbarLabels: labels?.toolbarLabels
        }))
    }

    function tabButton(key, label, view, setView) {
      const active = view === key
      return h('button', {
        type: 'button',
        className: active ? 'dshMermaidTab dshMermaidTabActive' : 'dshMermaidTab',
        'aria-pressed': active,
        onClick: () => setView(key)
      }, label)
    }

    function shortenReason(message) {
      const text = String(message).trim()
      return text.length <= 200 ? text : `${text.slice(0, 200)}…`
    }

    let translate = null
    let subscribeLocale = null
    let getLocaleSnapshot = null
    function useLocaleText() {
      if (translate === null) throw new Error('dsh-desktop-mermaid: locale not bound; the plugin has not applied')
      // Re-render on locale switches; `translate` reads the active language at call time.
      React.useSyncExternalStore(subscribeLocale, getLocaleSnapshot, getLocaleSnapshot)
      return translate
    }

    return {
      inject: ['locale'],
      apply(ctx) {
        translate = ctx.locale.bind(NS)
        subscribeLocale = listener => ctx.locale.subscribe(listener)
        getLocaleSnapshot = () => ctx.locale.getSnapshot()
        const registry = globalThis.__DSH_FENCE_RENDERERS__ ?? (globalThis.__DSH_FENCE_RENDERERS__ = new Map())
        // Register before anything else so a fence rendered during boot sees
        // the seam occupied; the disposer restores upstream code rendering.
        ctx.effect(() => {
          registry.set('mermaid', MermaidFence)
          return () => { registry.delete('mermaid') }
        }, 'mermaid fence renderer')
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'mermaid locale')
        ctx.effect(() => {
          const style = document.createElement('style')
          style.dataset.pluginCss = 'dsh-desktop-mermaid'
          style.textContent = css
          document.head.appendChild(style)
          return () => style.remove()
        }, 'mermaid styles')
      }
    }
  }
})
