window.__ModuleLoader__.load({
  id: 'dsh-desktop-onboarding',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    const React = require('react')
    const { useCallback, useEffect, useRef, useState } = React
    const { Button, Modal } = require('@deepseek-ai/dsh-client-ui-primitives')

    const NS = 'desktop-onboarding'
    // Settings section the "configure a model" action opens.
    const MODELS_SECTION_ID = 'models'

    // COWIN orbital mark (same artwork as the sidebar brand seat), drawn
    // in currentColor so it follows the header text color in both themes.
    const BRAND_MARK_VIEWBOX = { x: 173.05, y: 200, width: 654.74, height: 548.17 }
    const BRAND_MARK_PATH = "M 201.14 526.15 A 300 300 0 0 1 672.07 254.25 L 637.66 303.4 A 240 240 0 0 0 260.91 520.92 Z M 708.75 279.1 a 20 20 0 1 0 40 0 a 20 20 0 1 0 -40 0 Z M 758.4 341 a 17 17 0 1 0 34 0 a 17 17 0 1 0 -34 0 Z M 790.1 407.03 a 14 14 0 1 0 28 0 a 14 14 0 1 0 -28 0 Z M 805.79 472.28 a 11 11 0 1 0 22 0 a 11 11 0 1 0 -22 0 Z M 456.24 748.17 A 252 252 0 0 1 266.35 594.4 L 307.15 577.92 A 208 208 0 0 0 463.88 704.84 Z M 180.9 592.97 a 15 15 0 1 0 30 0 a 15 15 0 1 0 -30 0 Z M 173.09 544.26 a 12 12 0 1 0 24 0 a 12 12 0 1 0 -24 0 Z M 173.05 494.45 a 9 9 0 1 0 18 0 a 9 9 0 1 0 -18 0 Z M 460 500 a 40 40 0 1 0 80 0 a 40 40 0 1 0 -80 0 Z"

    // GitHub mark (Octicons mark-github, 16px grid), drawn in currentColor.
    const GITHUB_MARK_PATH = 'M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z'

    const STYLE_ID = 'dsh-desktop-onboarding-style'
    // Same dialog chrome as the stock welcome notice it replaces: a bounded
    // card whose body scrolls while the brand row and actions stay put.
    const STYLE = `
      .dshDeskOnbDialog{width:min(600px,100%);padding:0}
      .dshDeskOnbContent{box-sizing:border-box;display:flex;flex-direction:column;max-height:calc(100vh - 48px);padding:24px 28px}
      .dshDeskOnbHeader{flex:none;display:flex;align-items:center;gap:10px}
      .dshDeskOnbBrandMark{display:inline-flex;align-items:center;color:var(--dsw-alias-label-primary)}
      .dshDeskOnbBrandName{font-size:15px;font-weight:600;color:var(--dsw-alias-label-primary);line-height:22px}
      .dshDeskOnbHeading{flex:none;color:var(--dsw-alias-label-primary);outline:none;margin:16px 0 0;font-size:20px;font-weight:500;line-height:28px}
      .dshDeskOnbBody{flex:1;min-height:0;margin-top:12px;overflow-y:auto}
      .dshDeskOnbParagraph{margin:0 0 10px;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary)}
      .dshDeskOnbSubheading{margin:14px 0 6px;font-size:14px;font-weight:600;color:var(--dsw-alias-label-primary);line-height:20px}
      .dshDeskOnbLinkList{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0 12px}
      .dshDeskOnbLinkChip{display:inline-flex;align-items:center;gap:6px;padding:5px 12px 5px 10px;border:1px solid var(--dsw-alias-border-secondary);border-radius:999px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-size:13px;line-height:18px;text-decoration:none;transition:background .15s ease,border-color .15s ease}
      .dshDeskOnbLinkChip:hover{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-primary,var(--dsw-alias-border-secondary))}
      .dshDeskOnbLinkChip:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
      .dshDeskOnbLinkIcon{flex:none;display:inline-flex;color:var(--dsw-alias-label-secondary)}
      @media (prefers-reduced-motion:reduce){.dshDeskOnbLinkChip{transition:none}}
      .dshDeskOnbHint{color:var(--dsw-alias-label-tertiary);margin:0;font-size:12px;line-height:18px}
      .dshDeskOnbActions{flex:none;display:flex;justify-content:flex-end;gap:10px;margin-top:20px}
      @media (width<=560px){.dshDeskOnbContent{padding:20px}}
    `

    function installStyles() {
      if (document.getElementById(STYLE_ID)) return
      const style = document.createElement('style')
      style.id = STYLE_ID
      style.dataset.plugin = 'dsh-desktop-onboarding'
      style.textContent = STYLE
      document.head.appendChild(style)
    }

    // ---------- locale dictionaries ----------

    const en = {
      brandName: 'COWIN Harness Desktop',
      step0Title: 'Internal Testing Notice',
      declarationBody: "This COWIN Harness Desktop build is under active development and some capabilities are still evolving quickly. Feedback from everyday use is welcome and helps shape what ships next.\n\nCOWIN Harness Desktop is a local-first desktop Agent workspace: your sessions and files stay on your machine. Explore freely and tell us what works and what does not.",
      desktopIntroTitle: "关于 COWIN Harness Desktop",
      desktopIntroBody: "COWIN Harness Desktop is a local-first, cross-platform desktop Agent workspace built on an open runtime.",
      desktopIntroFeedback: "Found a bug or have a suggestion? Open an issue on GitHub.",
      configureModel: 'Configure a model',
      later: 'Maybe later',
      saveFailed: 'Could not save your acknowledgment. Please try again.'
    }

    const zh = {
      brandName: 'COWIN Harness Desktop',
      step0Title: '内测声明',
      declarationBody: "当前 COWIN Harness Desktop 版本仍在持续开发中，部分能力还在快速演进。欢迎把日常使用中的体验和建议告诉我们，它们会直接影响接下来的迭代方向。\n\nCOWIN Harness Desktop 是本地优先的桌面 Agent 工作台：会话与文件都保留在你自己的电脑上。放心探索，也欢迎告诉我们哪里好用、哪里还不够。",
      desktopIntroTitle: '关于 COWIN Harness Desktop',
      desktopIntroBody: "COWIN Harness Desktop 是本地优先、跨平台的桌面 Agent 工作台，基于开放运行时构建。",
      desktopIntroFeedback: "遇到问题或有功能建议？欢迎在 GitHub 提交 Issue。",
      configureModel: '去配置模型',
      later: '稍后再说',
      saveFailed: '未能保存确认，请重试。'
    }

    // ---------- components ----------

    function BrandHeader({ t }) {
      const height = 18
      return React.createElement(
        'div',
        { className: 'dshDeskOnbHeader' },
        React.createElement(
          'span',
          { className: 'dshDeskOnbBrandMark', 'aria-hidden': 'true' },
          React.createElement(
            'svg',
            {
              width: height * BRAND_MARK_VIEWBOX.width / BRAND_MARK_VIEWBOX.height,
              height,
              viewBox: BRAND_MARK_VIEWBOX.x + ' ' + BRAND_MARK_VIEWBOX.y + ' ' + BRAND_MARK_VIEWBOX.width + ' ' + BRAND_MARK_VIEWBOX.height,
              fill: 'none'
            },
            React.createElement('path', { d: BRAND_MARK_PATH, fill: 'currentColor' })
          )
        ),
        React.createElement('span', { className: 'dshDeskOnbBrandName' }, t('brandName'))
      )
    }

    function GitHubMark({ size = 14 }) {
      return React.createElement(
        'svg',
        { width: size, height: size, viewBox: '0 0 16 16', fill: 'none' },
        React.createElement('path', { d: GITHUB_MARK_PATH, fill: 'currentColor' })
      )
    }

    // The first-run notice together with the project's public repository link.
    // External links open in the system browser via the main process's
    // window-open handler.
    function NoticeBody({ t }) {
      const paragraphs = t('declarationBody').split('\n\n')
      const links = [
        { label: 'GitHub', href: 'https://github.com/dataelement/dsh-desktop', icon: GitHubMark },
      ]
      return React.createElement(
        'div',
        { className: 'dshDeskOnbBody' },
        paragraphs.map((paragraph, idx) =>
          React.createElement('p', { key: idx, className: 'dshDeskOnbParagraph' }, paragraph)
        ),
        React.createElement('h3', { className: 'dshDeskOnbSubheading' }, t('desktopIntroTitle')),
        React.createElement('p', { className: 'dshDeskOnbParagraph' }, t('desktopIntroBody')),
        React.createElement(
          'div',
          { className: 'dshDeskOnbLinkList' },
          links.map((link) =>
            React.createElement(
              'a',
              { key: link.href, className: 'dshDeskOnbLinkChip', href: link.href, target: '_blank', rel: 'noreferrer' },
              React.createElement(
                'span',
                { className: 'dshDeskOnbLinkIcon', 'aria-hidden': 'true' },
                React.createElement(link.icon, { size: 14 })
              ),
              React.createElement('span', null, link.label)
            )
          )
        ),
        React.createElement('p', { className: 'dshDeskOnbHint' }, t('desktopIntroFeedback'))
      )
    }

    // The notice is blocking: implicit dismissal (Escape, backdrop) is ignored
    // so the user leaves through one of the two explicit actions.
    const ignoreImplicitDismiss = () => {}

    function onboardingDecision(value) {
      const acknowledged = typeof value?.wizardVersion === 'string' && value.wizardVersion.length > 0
      return value?.eligible === true && !acknowledged ? 'show' : 'complete'
    }

    // ---------- the first-run notice ----------

    function DesktopOnboardingNotice(props) {
      const { complete, openSection, t } = props
      const wizardScope = props.controller.scope
      const [decision, setDecision] = useState('loading')
      const [saving, setSaving] = useState(false)
      const [saveError, setSaveError] = useState(false)
      const titleRef = useRef(null)
      const finishedRef = useRef(false)

      // Persist the acknowledgement, then hand the onboarding slot back. The
      // optional follow-up runs after the slot is released (e.g. opening the
      // models settings section).
      const finish = useCallback(async (followUp) => {
        if (finishedRef.current) return
        finishedRef.current = true
        setSaving(true)
        setSaveError(false)
        try {
          const response = await fetch('/api/desktop-onboarding/acknowledge', { method: 'POST', credentials: 'same-origin', cache: 'no-store' })
          if (!response.ok || (await response.json()).acknowledged !== true) throw new Error('Acknowledgment was not saved')
          complete()
          if (followUp) followUp()
        } catch {
          finishedRef.current = false
          setSaving(false)
          setSaveError(true)
        }
      }, [complete])

      useEffect(() => {
        const read = () => {
          const snap = wizardScope.getSnapshot()
          // Wait for the Host section so returning users never see a flash.
          if (snap.mode !== 'memory' && snap.status === 'loading') return
          const value = snap.value ?? {}
          setDecision(onboardingDecision(value))
        }
        let unsubscribe
        try {
          unsubscribe = wizardScope.subscribe(read)
          read()
        } catch {
          // Scope errors are non-fatal: a failing scope must not block boot.
        }
        return () => { if (unsubscribe) unsubscribe() }
      }, [wizardScope])

      // Ineligible installs and every prior acknowledgement skip straight on.
      useEffect(() => {
        if (decision === 'complete' && !finishedRef.current) {
          finishedRef.current = true
          complete()
        }
      }, [decision, complete])

      const visible = decision === 'show'

      // Keep the application behind the dialog inert, like the stock notice.
      useEffect(() => {
        if (!visible) return
        const appRoot = document.getElementById('root')
        if (appRoot === null) return
        const previous = appRoot.inert
        appRoot.inert = true
        return () => { appRoot.inert = previous }
      }, [visible])

      useEffect(() => {
        if (visible) titleRef.current?.focus()
      }, [visible])

      if (!visible) return null

      return React.createElement(
        Modal,
        {
          open: true,
          title: t('step0Title'),
          onClose: ignoreImplicitDismiss,
          headless: true,
          className: 'dshDeskOnbDialog'
        },
        React.createElement(
          'div',
          { className: 'dshDeskOnbContent' },
          React.createElement(BrandHeader, { t }),
          React.createElement(
            'h2',
            { ref: titleRef, className: 'dshDeskOnbHeading', tabIndex: -1 },
            t('step0Title')
          ),
          React.createElement(NoticeBody, { t }),
          saveError ? React.createElement('p', { role: 'alert', className: 'dshDeskOnbHint' }, t('saveFailed')) : null,
          React.createElement(
            'div',
            { className: 'dshDeskOnbActions' },
            React.createElement(
              Button,
              { variant: 'outline', disabled: saving, onClick: () => finish() },
              t('later')
            ),
            React.createElement(
              Button,
              {
                variant: 'primary',
                disabled: saving,
                onClick: () => finish(() => {
                  if (typeof openSection === 'function') openSection(MODELS_SECTION_ID)
                })
              },
              t('configureModel')
            )
          )
        )
      )
    }

    // ---------- composition ----------

    function apply(ctx) {
      ctx.inject(['slots', 'locale', 'configForms'], (scope) => {
        installStyles()
        const t = scope.locale.bind(NS)

        const wizardScope = scope.configForms.get('dsh-desktop-onboarding')

        scope.locale.register(NS, { zh, en })

        const controller = { scope: wizardScope }

        // The stock welcome-notice / official-DeepSeek onboarding entries are
        // removed upstream by the settings-models patch (the desktop notice owns
        // first-run), so this notice registers under its own id — no shadowing.
        scope.slots.inject('settings.onboarding', () => scope.slots.register({
          name: 'settings.onboarding',
          id: 'dsh-desktop-onboarding',
          order: 0,
          inject: () => ({ controller, t })
        }, DesktopOnboardingNotice))
      })
    }

    const inject = []

    exports.apply = apply
    exports.inject = inject
    exports.onboardingDecision = onboardingDecision
    return module.exports
  }
})
