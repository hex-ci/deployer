import { describe, it, expect, vi, beforeEach } from 'vitest'
import inquirer from 'inquirer'
import shell from 'shelljs'
import json from '../../helper/json.js'
import echo from '../../helper/echo.js'
import banner from '../../helper/banner.js'
import baseData from '../../helper/read-data.js'
import * as create from '../../lib/create.js'

vi.mock('inquirer', () => ({ default: { prompt: vi.fn() } }))
vi.mock('shelljs', () => ({
  default: { cd: vi.fn(), mkdir: vi.fn(), rm: vi.fn(), cp: vi.fn(), exec: vi.fn() },
}))
vi.mock('../../helper/json.js', () => ({ default: { write: vi.fn() } }))
vi.mock('../../helper/echo.js', () => ({ default: { info: vi.fn(), error: vi.fn(), warning: vi.fn() } }))
vi.mock('../../helper/banner.js', () => ({ default: vi.fn() }))
vi.mock('../../helper/read-data.js', () => ({ default: { projects: {} } }))
vi.mock('../../config.js', () => ({ default: { projectPath: 'projects', sshUser: 'tester', env: {} } }))

const defaultAnswers = {
  projectName: 'myproj',
  repositoryType: 'git',
  distPath: 'dist',
  exclude: '',
  include: '',
  testServers: '',
  testDeployPath: '/tmp/deploy',
  onlineServers: '1.2.3.4',
  onlineDeployPath: '/var/www/app',
  isFullSync: false,
}

beforeEach(() => {
  vi.clearAllMocks()
  baseData.projects = { existing: { name: 'existing' } }
})

describe('create.handler 创建项目', () => {
  it('git 项目：mkdir、写 data.json、输出 git 提示', async () => {
    inquirer.prompt.mockResolvedValue(defaultAnswers)

    await create.handler()

    expect(banner).toHaveBeenCalledTimes(1)
    expect(shell.mkdir).toHaveBeenCalledWith('myproj')
    expect(shell.mkdir).toHaveBeenCalledWith('myproj/repository')

    const saved = baseData.projects.myproj
    expect(saved).toMatchObject({
      name: 'myproj',
      repositoryType: 'git',
      distPath: 'dist',
      exclude: [],
      include: [],
      testServers: [],
      isFullSync: false,
    })
    expect(json.write).toHaveBeenCalledTimes(1)

    const infoCalls = echo.info.mock.calls.map(c => c[0])
    expect(infoCalls.some(m => m.includes('创建成功'))).toBe(true)
    expect(infoCalls.some(m => m.includes('git clone'))).toBe(true)
  })

  it('svn 项目输出 svn co 提示', async () => {
    inquirer.prompt.mockResolvedValue({ ...defaultAnswers, repositoryType: 'svn' })

    await create.handler()

    expect(baseData.projects.myproj.repositoryType).toBe('svn')
    expect(echo.info.mock.calls.some(c => c[0].includes('svn co'))).toBe(true)
  })

  it('逗号分隔的 exclude/include/testServers 拆成数组', async () => {
    inquirer.prompt.mockResolvedValue({
      ...defaultAnswers,
      exclude: ' a , b ',
      include: 'c, d',
      testServers: '10.0.0.1, 10.0.0.2',
    })

    await create.handler()

    const saved = baseData.projects.myproj
    expect(saved.exclude).toEqual(['a', 'b'])
    expect(saved.include).toEqual(['c', 'd'])
    expect(saved.testServers).toEqual(['10.0.0.1', '10.0.0.2'])
    expect(saved.onlineServers).toEqual(['1.2.3.4'])
  })
})

describe('create 问答定义', () => {
  const getQuestions = async () => {
    inquirer.prompt.mockResolvedValue(defaultAnswers)
    await create.handler()

    return inquirer.prompt.mock.calls[0][0]
  }

  it('问题类型覆盖 input/select/confirm', async () => {
    const types = (await getQuestions()).map(q => q.type)

    expect(types.filter(t => t === 'input')).toHaveLength(8)
    expect(types).toContain('select')
    expect(types).toContain('confirm')
  })

  it('项目名 validate 校验规则', async () => {
    const nameQ = (await getQuestions()).find(q => q.name === 'projectName')

    expect(nameQ.validate('abc')).toBe(true)
    expect(nameQ.validate('a-b_c')).toBe(true)
    expect(nameQ.validate('  abc  ')).toBe(true)
    expect(nameQ.validate('ab')).toBe('请输入正确的项目名称')
    expect(nameQ.validate('ABC')).toBe('请输入正确的项目名称')
    expect(nameQ.validate('a'.repeat(51))).toBe('请输入正确的项目名称')
    expect(nameQ.validate('existing')).toBe('项目已存在，请重新输入项目名称')
  })

  it('必填字段的 validate 拒绝空值', async () => {
    const questions = await getQuestions()
    const emptyDenied = ['testDeployPath', 'onlineServers', 'onlineDeployPath']

    for (const name of emptyDenied) {
      const q = questions.find(x => x.name === name)
      expect(q.validate('')).toBeTruthy()
      expect(q.validate('some value')).toBe(true)
    }
  })

  it('distPath 默认值为 dist', async () => {
    const q = (await getQuestions()).find(x => x.name === 'distPath')

    expect(q.default).toBe('dist')
  })
})
