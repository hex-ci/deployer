import { describe, it, expect, vi, beforeEach } from 'vitest'
import shell from 'shelljs'
import echo from '../../helper/echo.js'
import baseData from '../../helper/read-data.js'
import * as rollback from '../../lib/rollback.js'
import fs from 'fs'

vi.mock('fs', () => ({ default: { existsSync: vi.fn() } }))
vi.mock('shelljs', () => ({
  default: { cd: vi.fn(), mkdir: vi.fn(), rm: vi.fn(), cp: vi.fn(), exec: vi.fn() },
}))
vi.mock('../../helper/echo.js', () => ({ default: { info: vi.fn(), error: vi.fn(), warning: vi.fn() } }))
vi.mock('../../helper/exclude-include.js', () => ({
  default: { get: vi.fn(() => ({ include: '--include="x"', exclude: '--exclude="y"' })) },
}))
vi.mock('../../helper/banner.js', () => ({ default: vi.fn() }))
vi.mock('../../helper/read-data.js', () => ({ default: { projects: {} } }))
vi.mock('../../config.js', () => ({ default: { projectPath: 'projects', sshUser: 'tester', env: {} } }))

beforeEach(() => {
  vi.clearAllMocks()
  shell.exec.mockReturnValue({ code: 0 })
  baseData.projects = {
    proj: {
      name: 'proj',
      testServers: ['1.2.3.4'],
      testDeployPath: '/tmp/deploy',
      onlineServers: [],
      isFullSync: false,
    },
  }
})

describe('rollback', () => {
  it('项目不存在时告警', () => {
    rollback.handler({ project: 'nope', versionId: '123' })

    expect(echo.warning).toHaveBeenCalledWith('项目 nope 不存在！')
  })

  it('回滚文件不存在时报错', () => {
    fs.existsSync.mockReturnValue(false)

    rollback.handler({ project: 'proj', versionId: '123' })

    expect(echo.error).toHaveBeenCalledWith('错误：回滚文件无效')
    expect(shell.exec).not.toHaveBeenCalled()
  })

  it('成功回滚：解压备份并 rsync 到回归机', () => {
    fs.existsSync.mockReturnValue(true)

    rollback.handler({ project: 'proj', versionId: '123' })

    expect(shell.rm).toHaveBeenCalledWith('-rf', './destination/*')

    const cmds = shell.exec.mock.calls.map(c => c[0])
    expect(cmds[0]).toContain('tar xfz ./history/123-bak.tgz')
    expect(cmds[1]).toContain('rsync')
    expect(cmds[1]).toContain('1.2.3.4')
  })

  it('解压失败时报错', () => {
    fs.existsSync.mockReturnValue(true)
    shell.exec.mockReturnValueOnce({ code: 1 })

    rollback.handler({ project: 'proj', versionId: '123' })

    expect(echo.error).toHaveBeenCalledWith('文件解压缩失败！')
  })

  it('testServers 为空时发布到本地', () => {
    fs.existsSync.mockReturnValue(true)
    baseData.projects.proj.testServers = []

    rollback.handler({ project: 'proj', versionId: '123' })

    const rsync = shell.exec.mock.calls.find(c => c[0].includes('rsync'))[0]
    expect(rsync).toContain('/tmp/deploy/')
    expect(rsync).not.toContain('tester@')
  })

  it('isFullSync 时 rsync 加 --delete', () => {
    fs.existsSync.mockReturnValue(true)
    baseData.projects.proj.isFullSync = true

    rollback.handler({ project: 'proj', versionId: '123' })

    expect(shell.exec.mock.calls.find(c => c[0].includes('rsync'))[0]).toContain('--delete')
  })
})

describe('rollback docker 模式', () => {
  beforeEach(() => {
    baseData.projects.proj = {
      name: 'proj',
      deployType: 'docker',
      imageName: 'demo',
      registry: 'harbor.example.com',
      composeFile: 'docker-compose.yml',
      testServers: ['1.2.3.4'],
      testDeployPath: '/srv/test',
    }
    fs.existsSync.mockReturnValue(false)
  })

  it('用指定版本 tag 回滚到回归机', () => {
    rollback.handler({ project: 'proj', versionId: '999' })

    const cmds = shell.exec.mock.calls.map(c => c[0])
    expect(cmds.some(c => c === 'rsync -azh ./repository/docker-compose.yml tester@1.2.3.4:/srv/test/')).toBe(true)
    expect(cmds.some(c => c.startsWith(`ssh tester@1.2.3.4 'docker pull harbor.example.com/demo:999`))).toBe(true)
  })

  it('testServers 为空时本地回滚', () => {
    baseData.projects.proj.testServers = []

    rollback.handler({ project: 'proj', versionId: '999' })

    const cmds = shell.exec.mock.calls.map(c => c[0])
    expect(cmds.some(c => c === 'rsync -azh ./repository/docker-compose.yml /srv/test/')).toBe(true)
    expect(cmds.some(c => c.includes('docker compose -f docker-compose.yml up -d') && !c.startsWith('ssh '))).toBe(true)
  })

  it('存在 docker-compose.test.yml 时优先用环境变体', () => {
    fs.existsSync.mockImplementation(p => p === './repository/docker-compose.test.yml')

    rollback.handler({ project: 'proj', versionId: '999' })

    expect(shell.exec.mock.calls.some(c => c[0] === 'rsync -azh ./repository/docker-compose.test.yml tester@1.2.3.4:/srv/test/')).toBe(true)
  })

  it('composeFile 未配置时用默认值', () => {
    baseData.projects.proj.composeFile = undefined

    rollback.handler({ project: 'proj', versionId: '999' })

    expect(shell.exec.mock.calls.some(c => c[0] === 'rsync -azh ./repository/docker-compose.yml tester@1.2.3.4:/srv/test/')).toBe(true)
  })
})
