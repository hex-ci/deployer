import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import json from '../../helper/json.js'
import echo from '../../helper/echo.js'
import snapshot from '../../helper/snapshot.js'
import clearBackup from '../../helper/clear-backup.js'
import config from '../../config.js'
import baseData from '../../helper/read-data.js'
import * as build from '../../lib/build.js'

const mocks = vi.hoisted(() => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  cd: vi.fn(),
  mkdir: vi.fn(),
  rm: vi.fn(),
  cp: vi.fn(),
  exec: vi.fn(),
  spawnSync: vi.fn(),
}))

vi.mock('fs', () => ({
  default: { existsSync: mocks.existsSync, readFileSync: mocks.readFileSync, writeFileSync: mocks.writeFileSync },
}))
vi.mock('shelljs', () => ({
  default: { cd: mocks.cd, mkdir: mocks.mkdir, rm: mocks.rm, cp: mocks.cp, exec: mocks.exec },
}))
vi.mock('child_process', () => ({ spawnSync: mocks.spawnSync }))
vi.mock('../../helper/json.js', () => ({ default: { read: vi.fn(), write: vi.fn() } }))
vi.mock('../../helper/echo.js', () => ({ default: { info: vi.fn(), error: vi.fn(), warning: vi.fn() } }))
vi.mock('../../helper/snapshot.js', () => ({ default: { make: vi.fn(), check: vi.fn() } }))
vi.mock('../../helper/exclude-include.js', () => ({
  default: { get: vi.fn(() => ({ include: '', exclude: '' })) },
}))
vi.mock('../../helper/banner.js', () => ({ default: vi.fn() }))
vi.mock('../../helper/clear-backup.js', () => ({ default: vi.fn() }))
vi.mock('../../helper/read-data.js', () => ({ default: { projects: {} } }))
vi.mock('../../config.js', () => ({ default: { projectPath: 'projects', sshUser: 'tester', env: {} } }))

const execOk = () => {
  mocks.exec.mockImplementation(() => ({ code: 0, stdout: '', stderr: '' }))
  mocks.spawnSync.mockImplementation(() => ({ status: 0 }))
}

const setExists = (map) => {
  mocks.existsSync.mockImplementation(p => p in map ? map[p] : false)
}

beforeEach(() => {
  vi.clearAllMocks()
  execOk()
  setExists({ './repository/build.sh': true, './repository/dist': true })
  config.projectPath = 'projects'
  config.sshUser = 'tester'
  config.env = {}
  baseData.projects = {
    proj: {
      name: 'proj',
      repositoryType: 'git',
      distPath: 'dist',
      exclude: [],
      include: [],
      testServers: ['1.2.3.4'],
      testDeployPath: '/tmp/deploy',
      onlineServers: [],
      onlineDeployPath: '',
      isFullSync: false,
    },
  }
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('build', () => {
  it('项目不存在时告警', async () => {
    await build.handler({ project: 'nope', user: 'tester' })

    expect(echo.warning).toHaveBeenCalledWith('项目 nope 不存在！')
    expect(mocks.exec).not.toHaveBeenCalled()
  })

  it('主成功路径（git，全分支存在）：锁、读历史、build.sh、打包、rsync', async () => {
    setExists({
      './data/history.json': true,
      './data/lock': true,
      './data/snapshot.json': true,
      './repository/build.sh': true,
      './repository/dist': true,
    })
    mocks.readFileSync.mockReturnValue('tester')
    json.read.mockImplementation(p => (p === './data/history.json' ? [] : {}))
    snapshot.check.mockReturnValue({})
    snapshot.make.mockReturnValue({})
    baseData.projects.proj.rollbackCommandTips = 'rollback {{project}} {{versionId}}'
    baseData.projects.proj.buildCommandTips = 'deploy {{project}}'

    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await build.handler({ project: 'proj', user: 'tester', params: 'foo bar' })

    // 写 lock、git pull、build.sh、打包/备份/解压、快照、历史
    expect(mocks.writeFileSync).toHaveBeenCalledWith('./data/lock', 'tester')
    expect(mocks.exec).toHaveBeenCalledWith(expect.stringContaining('git pull'))
    expect(mocks.spawnSync).toHaveBeenCalledWith('bash', ['build.sh', 'foo', 'bar'], expect.any(Object))

    const execCmds = mocks.exec.mock.calls.map(c => c[0])
    expect(execCmds.some(c => c.includes('tar czf ./temp/source.'))).toBe(true)
    expect(execCmds.some(c => c.includes('tar czf ./history/'))).toBe(true)
    expect(execCmds.some(c => c.includes('tar xzf ./history/'))).toBe(true)
    expect(execCmds.some(c => c.includes('rsync'))).toBe(true)

    expect(json.write).toHaveBeenCalledWith('./data/history.json', expect.any(Array))
    expect(json.write).toHaveBeenCalledWith('./data/snapshot.json', {})
    expect(clearBackup).toHaveBeenCalledTimes(1)

    const infoMsgs = echo.info.mock.calls.map(c => c[0])
    expect(infoMsgs.some(m => m.includes('=== 更新代码 ==='))).toBe(true)
    expect(infoMsgs.some(m => m.includes('=== 执行 build.sh ==='))).toBe(true)
    expect(infoMsgs.some(m => m.includes('=== 发布到回归机 ==='))).toBe(true)
    // tips 模板替换
    expect(infoMsgs.some(m => m.includes('rollback proj'))).toBe(true)
    expect(infoMsgs.some(m => m.includes('deploy proj'))).toBe(true)

    spy.mockRestore()
  })

  it('lock 被他人占用时拒绝构建', async () => {
    setExists({ './data/lock': true })
    mocks.readFileSync.mockReturnValue('someoneelse')

    await build.handler({ project: 'proj', user: 'tester' })

    expect(echo.warning).toHaveBeenCalledWith(expect.stringContaining('someoneelse'))
    expect(mocks.exec).not.toHaveBeenCalled()
  })

  it('git pull 失败时报错', async () => {
    mocks.exec.mockImplementation(cmd => (cmd.includes('git pull') ? { code: 1 } : { code: 0 }))

    await build.handler({ project: 'proj', user: 'tester' })

    expect(echo.error).toHaveBeenCalledWith('git 执行出错！')
  })

  it('svn 项目走 svn up 与 svn export', async () => {
    baseData.projects.proj.repositoryType = 'svn'

    await build.handler({ project: 'proj', user: 'tester' })

    const execCmds = mocks.exec.mock.calls.map(c => c[0])
    expect(execCmds.some(c => c.includes('svn up'))).toBe(true)
    expect(execCmds.some(c => c.includes('svn export'))).toBe(true)
  })

  it('svn up 失败时报错', async () => {
    baseData.projects.proj.repositoryType = 'svn'
    mocks.exec.mockImplementation(cmd => (cmd.includes('svn up') ? { code: 1 } : { code: 0 }))

    await build.handler({ project: 'proj', user: 'tester' })

    expect(echo.error).toHaveBeenCalledWith('svn 执行出错！')
  })

  it('build.sh 不存在时跳过构建步骤，继续打包', async () => {
    setExists({ './repository/dist': true })

    await build.handler({ project: 'proj', user: 'tester' })

    expect(mocks.spawnSync).not.toHaveBeenCalled()
    expect(mocks.exec.mock.calls.some(c => c[0].includes('tar czf'))).toBe(true)
  })

  it('build.sh 执行失败时报错', async () => {
    mocks.spawnSync.mockReturnValue({ status: 1 })

    await build.handler({ project: 'proj', user: 'tester' })

    expect(echo.error).toHaveBeenCalledWith('执行 build.sh 脚本失败！')
  })

  it('dist 目录不存在时报错', async () => {
    setExists({ './repository/build.sh': true })

    await build.handler({ project: 'proj', user: 'tester' })

    expect(echo.error).toHaveBeenCalledWith('目标目录 dist 不存在！')
  })

  it('源文件打包失败时报错', async () => {
    mocks.exec.mockImplementation(cmd => (cmd.includes('tar czf ./temp/source.') ? { code: 1 } : { code: 0 }))

    await build.handler({ project: 'proj', user: 'tester' })

    expect(echo.error).toHaveBeenCalledWith('文件打包失败！')
  })

  it('备份失败时报错', async () => {
    mocks.exec.mockImplementation(cmd => (cmd.includes('tar czf ./history/') ? { code: 1 } : { code: 0 }))

    await build.handler({ project: 'proj', user: 'tester' })

    expect(echo.error).toHaveBeenCalledWith('备份文件失败！')
  })

  it('发布解压失败时报错', async () => {
    mocks.exec.mockImplementation(cmd => (cmd.includes('tar xzf') ? { code: 1 } : { code: 0 }))

    await build.handler({ project: 'proj', user: 'tester' })

    expect(echo.error).toHaveBeenCalledWith('发布文件失败！')
  })

  it('config.env 数组项拼接 PATH、普通项直接注入', async () => {
    config.env = { path: ['/a', '/b'], node_env: 'production' }

    await build.handler({ project: 'proj', user: 'tester' })

    const env = mocks.spawnSync.mock.calls[0][2].env
    expect(env.NODE_ENV).toBe('production')
    expect(env.PATH).toContain('/a')
    expect(env.PATH).toContain('/b')
    expect(env.FORCE_COLOR).toBe(1)
  })

  it('testServers 为空时发布到本地目录', async () => {
    baseData.projects.proj.testServers = []

    await build.handler({ project: 'proj', user: 'tester' })

    const rsync = mocks.exec.mock.calls.find(c => c[0].includes('rsync'))[0]
    expect(rsync).toContain('/tmp/deploy/')
    expect(rsync).not.toContain('tester@')
  })

  it('isFullSync 时 rsync 加 --delete', async () => {
    baseData.projects.proj.isFullSync = true

    await build.handler({ project: 'proj', user: 'tester' })

    expect(mocks.exec.mock.calls.find(c => c[0].includes('rsync'))[0]).toContain('--delete')
  })

  it('snapshot 有差异时打印差异文件列表', async () => {
    setExists({ './data/snapshot.json': true, './repository/build.sh': true, './repository/dist': true })
    json.read.mockReturnValue({})
    snapshot.check.mockReturnValue({ '/a.txt': 'md5', '/b.txt': 'md5' })
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await build.handler({ project: 'proj', user: 'tester' })

    expect(spy).toHaveBeenCalledWith('./a.txt')
    expect(spy).toHaveBeenCalledWith('./b.txt')
    spy.mockRestore()
  })

  it('未传 user 时回退到当前登录用户', async () => {
    setExists({ './repository/build.sh': true })

    await build.handler({ project: 'proj' })

    expect(mocks.writeFileSync).toHaveBeenCalledWith('./data/lock', process.env.USER)
  })

  it('数组 env 项且对应环境变量不存在时不追加旧值', async () => {
    const key = 'DEPLOYER_NO_SUCH_ENV_VAR'
    const saved = process.env[key]
    delete process.env[key]
    config.env = { deployer_no_such_env_var: ['/x'] }

    try {
      await build.handler({ project: 'proj', user: 'tester' })

      const env = mocks.spawnSync.mock.calls[0][2].env
      expect(env.DEPLOYER_NO_SUCH_ENV_VAR).toBe('/x')
    }
    finally {
      if (saved !== undefined) {
        process.env[key] = saved
      }
    }
  })

  it('非 linux 平台 tar 不带 --exclude-vcs', async () => {
    const desc = Object.getOwnPropertyDescriptor(process, 'platform')

    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })

    try {
      await build.handler({ project: 'proj', user: 'tester' })

      const tarCmd = mocks.exec.mock.calls.find(c => c[0].includes('tar czf ./temp/source.'))[0]
      expect(tarCmd).not.toContain('--exclude-vcs')
    }
    finally {
      Object.defineProperty(process, 'platform', desc)
    }
  })

  it('SIGINT 中断时释放锁并退出', async () => {
    const originalOn = process.on.bind(process)
    let sigintHandler
    const onSpy = vi.spyOn(process, 'on').mockImplementation((event, handler) => {
      if (event === 'SIGINT') {
        sigintHandler = handler

        return process
      }

      return originalOn(event, handler)
    })
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {})

    try {
      await build.handler({ project: 'proj', user: 'tester' })

      sigintHandler()

      expect(echo.warning).toHaveBeenCalledWith('构建已中断，已释放项目锁')
      expect(mocks.rm).toHaveBeenCalledWith('-rf', './data/lock')
      expect(mocks.rm).toHaveBeenCalledWith('-rf', './temp/*')
      expect(exitSpy).toHaveBeenCalledWith(130)
    }
    finally {
      onSpy.mockRestore()
      exitSpy.mockRestore()
    }
  })
})

describe('build docker 模式', () => {
  beforeEach(() => {
    baseData.projects.proj = {
      name: 'proj',
      repositoryType: 'git',
      deployType: 'docker',
      imageName: 'demo',
      registry: 'harbor.example.com',
      dockerfile: 'Dockerfile',
      composeFile: 'docker-compose.yml',
      testServers: ['1.2.3.4'],
      testDeployPath: '/srv/test',
      onlineServers: [],
      onlineDeployPath: '',
    }
    setExists({})
  })

  it('无 build.sh：docker build + push + 部署回归机', async () => {
    await build.handler({ project: 'proj', user: 'tester' })

    const cmds = mocks.exec.mock.calls.map(c => c[0])

    expect(cmds.some(c => c.startsWith('docker build -t harbor.example.com/demo:') && c.includes(' -f Dockerfile .'))).toBe(true)
    expect(cmds.some(c => c.startsWith('docker push harbor.example.com/demo:'))).toBe(true)
    expect(cmds.some(c => c === 'rsync -azh ./repository/docker-compose.yml tester@1.2.3.4:/srv/test/')).toBe(true)
    expect(cmds.some(c => c.startsWith(`ssh tester@1.2.3.4 'docker pull harbor.example.com/demo:`))).toBe(true)
    expect(cmds.some(c => c.includes('docker image prune -f'))).toBe(true)
    expect(json.write.mock.calls.some(c => c[0] === './data/history.json')).toBe(true)
  })

  it('有 build.sh：注入 IMAGE/TAG 并执行', async () => {
    setExists({ './repository/build.sh': true })

    await build.handler({ project: 'proj', user: 'tester' })

    const call = mocks.spawnSync.mock.calls[0]
    expect(call).toBeTruthy()
    expect(call[2].env.IMAGE).toBe('harbor.example.com/demo')
    expect(call[2].env.TAG).toMatch(/^\d+$/)
  })

  it('docker build 失败时报错', async () => {
    mocks.exec.mockImplementation(cmd => (cmd.includes('docker build') ? { code: 1 } : { code: 0 }))

    await build.handler({ project: 'proj', user: 'tester' })

    expect(echo.error).toHaveBeenCalledWith('构建镜像失败！')
  })

  it('docker push 失败时报错', async () => {
    mocks.exec.mockImplementation(cmd => (cmd.includes('docker push') ? { code: 1 } : { code: 0 }))

    await build.handler({ project: 'proj', user: 'tester' })

    expect(echo.error).toHaveBeenCalledWith('推送镜像失败！')
  })

  it('build.sh 执行失败时报错', async () => {
    setExists({ './repository/build.sh': true })
    mocks.spawnSync.mockReturnValue({ status: 1 })

    await build.handler({ project: 'proj', user: 'tester' })

    expect(echo.error).toHaveBeenCalledWith('执行 build.sh 脚本失败！')
  })

  it('存在 docker-compose.test.yml 时优先用环境变体', async () => {
    setExists({ './repository/docker-compose.test.yml': true })

    await build.handler({ project: 'proj', user: 'tester' })

    expect(mocks.exec.mock.calls.some(c => c[0] === 'rsync -azh ./repository/docker-compose.test.yml tester@1.2.3.4:/srv/test/')).toBe(true)
  })

  it('testServers 为空时本地部署', async () => {
    baseData.projects.proj.testServers = []

    await build.handler({ project: 'proj', user: 'tester' })

    const cmds = mocks.exec.mock.calls.map(c => c[0])
    expect(cmds.some(c => c === 'rsync -azh ./repository/docker-compose.yml /srv/test/')).toBe(true)
    expect(cmds.some(c => c.includes('docker compose -f docker-compose.yml up -d') && !c.startsWith('ssh '))).toBe(true)
  })

  it('build.sh 模式 config.env 注入额外变量', async () => {
    setExists({ './repository/build.sh': true })
    config.env = { path: ['/a', '/b'], node_env: 'production' }

    await build.handler({ project: 'proj', user: 'tester' })

    const env = mocks.spawnSync.mock.calls[0][2].env
    expect(env.PATH).toContain('/a')
    expect(env.NODE_ENV).toBe('production')
    expect(env.IMAGE).toBe('harbor.example.com/demo')
  })

  it('设置了 tips 模板时做替换', async () => {
    baseData.projects.proj.rollbackCommandTips = 'rollback {{project}} {{versionId}}'
    baseData.projects.proj.buildCommandTips = 'deploy {{project}}'

    await build.handler({ project: 'proj', user: 'tester' })

    const msgs = echo.info.mock.calls.map(c => c[0])
    expect(msgs.some(m => m.includes('rollback proj'))).toBe(true)
    expect(msgs.some(m => m.includes('deploy proj'))).toBe(true)
  })

  it('dockerfile 未配置时用默认 Dockerfile', async () => {
    baseData.projects.proj.dockerfile = undefined

    await build.handler({ project: 'proj', user: 'tester' })

    expect(mocks.exec.mock.calls.some(c => c[0].includes(' -f Dockerfile .'))).toBe(true)
  })

  it('composeFile 未配置时用默认 docker-compose.yml', async () => {
    baseData.projects.proj.composeFile = undefined

    await build.handler({ project: 'proj', user: 'tester' })

    expect(mocks.exec.mock.calls.some(c => c[0] === 'rsync -azh ./repository/docker-compose.yml tester@1.2.3.4:/srv/test/')).toBe(true)
  })

  it('数组 env 项且对应环境变量不存在时不追加旧值', async () => {
    setExists({ './repository/build.sh': true })
    const key = 'DEPLOYER_NO_SUCH_VAR'
    const saved = process.env[key]
    delete process.env[key]
    config.env = { deployer_no_such_var: ['/x'] }

    try {
      await build.handler({ project: 'proj', user: 'tester' })

      expect(mocks.spawnSync.mock.calls[0][2].env.DEPLOYER_NO_SUCH_VAR).toBe('/x')
    }
    finally {
      if (saved !== undefined) {
        process.env[key] = saved
      }
    }
  })
})
