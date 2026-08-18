import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import clearBackup from '../../helper/clear-backup.js'

let dir

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'deployer-backup-'))
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

const day = 1000 * 60 * 60 * 24

describe('clearBackup', () => {
  it('删除超过默认 7 天的备份文件', () => {
    const file = `${Date.now() - 8 * day}-bak.tgz`
    fs.writeFileSync(path.join(dir, file), 'x')

    clearBackup(dir, undefined)

    expect(fs.existsSync(path.join(dir, file))).toBe(false)
  })

  it('保留未过期的备份文件', () => {
    const file = `${Date.now()}-bak.tgz`
    fs.writeFileSync(path.join(dir, file), 'x')

    clearBackup(dir, undefined)

    expect(fs.existsSync(path.join(dir, file))).toBe(true)
  })

  it('尊重自定义 expires 天数', () => {
    const old = `${Date.now() - 2 * day}-bak.tgz`
    const recent = `${Date.now()}-bak.tgz`
    fs.writeFileSync(path.join(dir, old), 'x')
    fs.writeFileSync(path.join(dir, recent), 'x')

    clearBackup(dir, 1)

    expect(fs.existsSync(path.join(dir, old))).toBe(false)
    expect(fs.existsSync(path.join(dir, recent))).toBe(true)
  })

  it('忽略无法解析为时间戳的文件', () => {
    fs.writeFileSync(path.join(dir, 'not-a-timestamp.tgz'), 'x')

    expect(() => clearBackup(dir, undefined)).not.toThrow()
    expect(fs.existsSync(path.join(dir, 'not-a-timestamp.tgz'))).toBe(true)
  })

  it('目录不存在时不抛错', () => {
    expect(() => clearBackup(path.join(dir, 'nope'), undefined)).not.toThrow()
  })
})
