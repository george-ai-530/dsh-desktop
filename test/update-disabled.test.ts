import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

// This fork ships UPDATES_DISABLED=true so a feed release can never replace
// the customized product. The manager must keep every update path offline:
// no scheduled checks, no manual feed access, no downloads, history installs
// or rollback. `DSH_DESKTOP_UPDATES=on` stays the only way back in.
const mocks = vi.hoisted(() => ({ root: '', netFetch: vi.fn(), policy: vi.fn(),
  updater: { setFeedURL: vi.fn(), checkForUpdates: vi.fn(), downloadUpdate: vi.fn(), quitAndInstall: vi.fn(), on: vi.fn() } }))
vi.mock('electron', () => ({ app: { isPackaged: true, getVersion: () => '0.13.0', getPath: () => mocks.root, isReady: () => true },
  BrowserWindow: { getAllWindows: () => [] }, powerMonitor: { on: vi.fn(), removeListener: vi.fn() }, ipcMain: { handle: vi.fn() },
  net: { fetch: mocks.netFetch } }))
vi.mock('electron-updater', () => ({ default: { autoUpdater: mocks.updater } }))
vi.mock('../src/main/desktop-service', () => ({ checkDesktopUpdate: mocks.policy }))

let manager: typeof import('../src/main/update/update-manager')
beforeEach(async () => {
  vi.resetModules()
  vi.clearAllMocks()
  mocks.root = await mkdtemp(join(tmpdir(), 'dsh-update-disabled-'))
  manager = await import('../src/main/update/update-manager')
})

afterEach(async () => {
  manager.stopUpdateManager()
  await rm(mocks.root, { recursive: true, force: true })
})

it('keeps every update path offline while the build has updates disabled', async () => {
  manager.startUpdateManager({ prepareToInstall: async () => {} })
  const status = manager.getUpdateStatus()
  expect(status.phase).toBe('unsupported')
  expect(status.message).toBe('Updates are disabled in this build.')

  // A manual check reports the disabled state instead of touching the feed.
  const checked = await manager.checkForUpdates(true)
  expect(checked.phase).toBe('unsupported')
  expect(checked.message).toBe('Updates are disabled in this build.')
  expect(mocks.updater.checkForUpdates).not.toHaveBeenCalled()
  expect(mocks.netFetch).not.toHaveBeenCalled()

  // Downloads, history installs and rollback stay closed as well.
  expect((await manager.downloadAvailableUpdate()).phase).toBe('unsupported')
  expect((await manager.installSpecificVersion('0.11.2')).phase).toBe('unsupported')
  await expect(manager.rollbackApplication()).rejects.toThrow('updates-disabled')
  expect(mocks.updater.downloadUpdate).not.toHaveBeenCalled()
  expect(mocks.updater.setFeedURL).not.toHaveBeenCalled()
})
