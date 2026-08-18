import { describe, it, expect, vi, beforeEach } from 'vitest'
import shell from 'shelljs'
import echo from '../../helper/echo.js'
import excludeInclude from '../../helper/exclude-include.js'
import banner from '../../helper/banner.js'
import baseData from '../../helper/read-data.js'
import * as deploy from '../../lib/deploy.js'

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
      onlineServers: ['1.2.3.4', '5.6.7.8'],
      onlineDeployPath: '/var/www/app',
      isFullSync: false,
    },
  }
})

describe('deploy', () => {
  it('项目不存在时告警', () => {
    deploy.handler({ project: 'nope' })

    expect(echo.warning).toHaveBeenCalledWith('项目 nope 不存在！')
    expect(shell.exec).not.toHaveBeenCalled()
  })

  it('逐个服务器执行 rsync 到生产', () => {
    deploy.handler({ project: 'proj' })

    expect(banner).toHaveBeenCalledTimes(1)
    expect(excludeInclude.get).toHaveBeenCalledWith(baseData.projects.proj)
    expect(shell.exec).toHaveBeenCalledTimes(2)

    const cmds = shell.exec.mock.calls.map(c => c[0])
    expect(cmds[0]).toContain('1.2.3.4')
    expect(cmds[1]).toContain('5.6.7.8')
    cmds.forEach((cmd) => {
      expect(cmd).toContain('rsync')
      expect(cmd).toContain('--include="x"')
      expect(cmd).toContain('--exclude="y"')
      expect(cmd).toContain('tester@')
      expect(cmd).toContain('/var/www/app')
    })
  })

  it('isFullSync 时 rsync 加 --delete', () => {
    baseData.projects.proj.isFullSync = true

    deploy.handler({ project: 'proj' })

    expect(shell.exec.mock.calls[0][0]).toContain('--delete')
  })

  it('未开启全同步时不带 --delete', () => {
    deploy.handler({ project: 'proj' })

    expect(shell.exec.mock.calls[0][0]).not.toContain('--delete')
  })
})
