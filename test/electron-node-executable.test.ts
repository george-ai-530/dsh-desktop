import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { electronNodeExecutable } from '../src/main/shell/backend/electron-node-executable'

describe('electronNodeExecutable', () => {
  it('uses the app Helper on macOS', () => {
    expect(electronNodeExecutable('/Applications/COWIN Harness Desktop.app/Contents/MacOS/COWIN Harness Desktop', 'darwin'))
      .toBe('/Applications/COWIN Harness Desktop.app/Contents/Frameworks/COWIN Harness Desktop Helper.app/Contents/MacOS/COWIN Harness Desktop Helper')
  })

  it('uses the main executable elsewhere', () => {
    expect(electronNodeExecutable('C:\\COWIN Harness Desktop\\COWIN Harness Desktop.exe', 'win32')).toBe('C:\\COWIN Harness Desktop\\COWIN Harness Desktop.exe')
    expect(electronNodeExecutable('/opt/dsh/dsh-desktop', 'linux')).toBe('/opt/dsh/dsh-desktop')
  })

  it('resolves an existing binary for the Electron build in use', () => {
    const electron = createRequire(import.meta.url)('electron') as string
    expect(existsSync(electronNodeExecutable(electron))).toBe(true)
  })
})
