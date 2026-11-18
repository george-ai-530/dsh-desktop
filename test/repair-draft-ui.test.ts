// @vitest-environment jsdom
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import { resolve } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

async function load(bridge: unknown) {
  const registrations = new Map<string, (props: unknown) => unknown>()
  const effects: Array<() => unknown> = []
  document.head.replaceChildren()
  const dom = { window }
  let definition: { factory: (require: (name: string) => unknown) => { apply: (ctx: unknown) => void } } | undefined
  vm.runInNewContext(await readFile(resolve('packages/dsh-desktop-client-ui/client.js'), 'utf8'), {
    window: { dshDesktop: bridge, __ModuleLoader__: { load: (value: typeof definition) => { definition = value } } },
    document: dom.window.document, console
  })
  const plugin = definition!.factory(name => name === 'react' ? {
    createElement: (type: unknown, props: unknown, ...children: unknown[]) => ({ type, props, children }),
    useEffect: (effect: () => unknown) => { effects.push(effect) },
    useState: (initial: unknown) => [initial, vi.fn()], useRef: (current: unknown) => ({ current })
  } : { Tooltip: 'Tooltip' })
  plugin.apply({
    slots: {
      inject: (_name: string, callback: () => unknown) => {
        const result = callback()
        if (result && typeof result === 'object' && Symbol.iterator in result) Array.from(result as Iterable<unknown>)
      },
      register: (config: { id?: string }, component: (props: unknown) => unknown) => { if (config.id) registrations.set(config.id, component) }
    },
    locale: { register: () => undefined, bind: () => (key: string) => key }, effect: (callback: () => unknown) => callback()
  })
  return { registrations, effects, dom }
}

describe('repair draft admission', () => {
  it('removes the settings-row utility icons but keeps the repair draft seam', async () => {
    const { registrations } = await load({ getRepairDraft: vi.fn(async () => undefined), openRepairAgent: vi.fn(), openMobilePairing: vi.fn() })
    // 设置旁的维修/手机快捷图标随产品精简移除；会话输入框的维修草稿接缝保留。
    expect(registrations.has('desktop-utilities')).toBe(false)
    expect(registrations.has('desktop-repair-draft')).toBe(true)
  })
  it('no longer injects the settings action row styles', async () => {
    const { dom } = await load({ openRepairAgent: vi.fn(), openMobilePairing: vi.fn() })
    const style = dom.window.document.querySelector('style#dsh-desktop-preset-toolbar-style')
    expect(style?.textContent).toBeDefined()
    expect(style?.textContent).not.toContain('data-dsh-desktop-utilities')
    expect(style?.textContent).not.toContain('[data-dsh-sidebar-settings]:has(')
  })

  it.each([['empty', '', [], true], ['existing text', 'my question', [], false], ['attachment', '', ['file'], false]] as const)(
    'prefills only an untouched empty composer (%s)', async (_name, text, attachments, shouldInsert) => {
      const bridge = { getRepairDraft: vi.fn(async () => ({ text: 'Please diagnose this issue.', token: 't' })), acknowledgeRepairDraft: vi.fn(async () => ({ ok: true })) }
      const { registrations, effects } = await load(bridge)
      const span = { start: 0, end: 0, draftRev: 0 }
      const actions = { captureInsertion: vi.fn(() => span), insertText: vi.fn(() => true), persistDraft: vi.fn(), submit: vi.fn() }
      registrations.get('desktop-repair-draft')!({ session: { sessionId: 's' }, input: { draft: text, attachmentIds: attachments, phase: 'plain' }, inputActions: actions })
      effects[0]!()
      await vi.waitFor(() => expect(bridge.acknowledgeRepairDraft).toHaveBeenCalledWith('s', 't'))
      expect(actions.insertText).toHaveBeenCalledTimes(shouldInsert ? 1 : 0)
      if (shouldInsert) expect(actions.insertText).toHaveBeenCalledWith('Please diagnose this issue.', span)
      expect(actions.submit).not.toHaveBeenCalled()
    }
  )
  it('rejects a draft whose editor revision changed while IPC was pending', async () => {
    const bridge = { getRepairDraft: vi.fn(async () => ({ text: 'repair', token: 't' })), acknowledgeRepairDraft: vi.fn(async () => ({ ok: true })) }
    const { registrations, effects } = await load(bridge)
    const actions = { captureInsertion: () => ({ draftRev: 0 }), insertText: vi.fn(() => false), persistDraft: vi.fn(), submit: vi.fn() }
    registrations.get('desktop-repair-draft')!({ session: { sessionId: 's' }, input: { draft: '', attachmentIds: [], phase: 'plain' }, inputActions: actions })
    effects[0]!()
    await vi.waitFor(() => expect(bridge.acknowledgeRepairDraft).toHaveBeenCalled())
    expect(actions.insertText).toHaveBeenCalledOnce()
    expect(actions.persistDraft).not.toHaveBeenCalled()
    expect(actions.submit).not.toHaveBeenCalled()
  })
  it('keeps the repair draft resident without a header utility registration', async () => {
    const bridge = { getRepairDraft: vi.fn(async () => ({ text: 'repair', token: 't' })), acknowledgeRepairDraft: vi.fn(async () => ({ ok: true })) }
    const { registrations, effects } = await load(bridge)
    expect(registrations.has('desktop-utilities')).toBe(false)
    const actions = { captureInsertion: () => ({ draftRev: 0 }), insertText: vi.fn(() => true), persistDraft: vi.fn(), submit: vi.fn() }
    registrations.get('desktop-repair-draft')!({ session: { sessionId: 's' }, input: { draft: '', attachmentIds: [], phase: 'plain' }, inputActions: actions })
    effects[0]!()
    await vi.waitFor(() => expect(bridge.acknowledgeRepairDraft).toHaveBeenCalled())
    expect(actions.insertText).toHaveBeenCalledOnce()
  })
  it('does not persist a rejected revision or apply a draft after unmount', async () => {
    let finish: (value: { text: string; token: string }) => void = () => undefined
    const bridge = { getRepairDraft: () => new Promise(resolve => { finish = resolve }), acknowledgeRepairDraft: vi.fn() }
    const { registrations, effects } = await load(bridge)
    const actions = { captureInsertion: () => ({ draftRev: 0 }), insertText: vi.fn(() => false), persistDraft: vi.fn() }
    registrations.get('desktop-repair-draft')!({ session: { sessionId: 's' }, input: { draft: '', attachmentIds: [], phase: 'plain' }, inputActions: actions })
    const dispose = effects[0]!() as () => void
    dispose()
    finish({ text: 'repair', token: 't' })
    await Promise.resolve()
    expect(actions.insertText).not.toHaveBeenCalled()
    expect(bridge.acknowledgeRepairDraft).not.toHaveBeenCalled()
  })
})
