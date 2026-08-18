import { describe, it, expect, vi, beforeEach } from 'vitest'

const m = vi.hoisted(() => {
  const chain = {
    usage: vi.fn(),
    command: vi.fn(),
    option: vi.fn(),
    demandCommand: vi.fn(),
    help: vi.fn(),
    alias: vi.fn(),
    version: vi.fn(),
    example: vi.fn(),
    strict: vi.fn(),
    locale: vi.fn(),
    parse: vi.fn(),
  }
  Object.values(chain).forEach(fn => fn.mockReturnThis())

  return {
    chain,
    yargs: vi.fn(() => chain),
    hideBin: vi.fn(args => args.slice(2)),
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    mkdir: vi.fn(),
  }
})

vi.mock('yargs', () => ({ default: m.yargs }))
vi.mock('yargs/helpers', () => ({ hideBin: m.hideBin }))
vi.mock('shelljs', () => ({ default: { mkdir: m.mkdir } }))
vi.mock('fs', () => ({ default: { existsSync: m.existsSync, readFileSync: m.readFileSync } }))
vi.mock('../config.js', () => ({ default: { projectPath: 'projects' } }))
vi.mock('../lib/create.js', () => ({ command: 'create', describe: '创建项目', builder: {}, handler: vi.fn() }))
vi.mock('../lib/build.js', () => ({ command: 'build <project> [params]', describe: '构建项目', builder: {}, handler: vi.fn() }))
vi.mock('../lib/deploy.js', () => ({ command: 'deploy <project>', describe: '部署项目', builder: {}, handler: vi.fn() }))
vi.mock('../lib/rollback.js', () => ({ command: 'rollback <project> <versionId>', describe: '回滚项目', builder: {}, handler: vi.fn() }))

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  Object.values(m.chain).forEach(fn => fn.mockReturnThis())
  m.yargs.mockImplementation(() => m.chain)
  m.readFileSync.mockReturnValue(JSON.stringify({ version: '9.9.9' }))
  m.existsSync.mockReturnValue(true)
})

const loadIndex = () => import('../index.js')

describe('index 入口', () => {
  it('注册全部 4 个子命令', async () => {
    await loadIndex()

    expect(m.chain.command).toHaveBeenCalledTimes(4)
    const commands = m.chain.command.mock.calls.map(c => c[0].command)
    expect(commands).toContain('create')
    expect(commands).toContain('build <project> [params]')
    expect(commands).toContain('deploy <project>')
    expect(commands).toContain('rollback <project> <versionId>')
  })

  it('版本号取自 package.json', async () => {
    await loadIndex()

    expect(m.chain.version).toHaveBeenCalledWith('version', '显示版本信息', '9.9.9')
  })

  it('配置全局 user 参数、中文 locale、strict 与 demandCommand', async () => {
    await loadIndex()

    expect(m.chain.option).toHaveBeenCalledWith('user', expect.objectContaining({ alias: 'u' }))
    expect(m.chain.locale).toHaveBeenCalledWith('zh_CN')
    expect(m.chain.strict).toHaveBeenCalled()
    expect(m.chain.demandCommand).toHaveBeenCalledWith(1, '请输入有效的命令')
    expect(m.chain.help).toHaveBeenCalledWith('help')
    expect(m.chain.example).toHaveBeenCalledWith('$0 build demo_project', '构建项目')
    expect(m.chain.parse).toHaveBeenCalled()
  })

  it('projects 目录不存在时创建', async () => {
    m.existsSync.mockReturnValue(false)

    await loadIndex()

    expect(m.mkdir).toHaveBeenCalled()
  })

  it('projects 目录存在时跳过创建', async () => {
    m.existsSync.mockReturnValue(true)

    await loadIndex()

    expect(m.mkdir).not.toHaveBeenCalled()
  })
})
