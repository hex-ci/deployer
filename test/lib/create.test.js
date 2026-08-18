import { describe, it, expect, vi, beforeEach } from 'vitest'
import inquirer from 'inquirer'
import echo from '../../helper/echo.js'
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

const fileAnswers = {
  projectName: 'myproj',
  repositoryType: 'git',
  deployType: 'file',
  distPath: 'dist',
  exclude: '',
  include: '',
  testServers: '',
  testDeployPath: '/tmp/deploy',
  onlineServers: '1.2.3.4',
  onlineDeployPath: '/var/www/app',
  isFullSync: false,
}

const dockerAnswers = {
  projectName: 'myproj',
  repositoryType: 'git',
  deployType: 'docker',
  imageName: 'demo',
  registry: 'harbor.example.com',
  dockerfile: 'Dockerfile',
  composeFile: 'docker-compose.yml',
  testServers: '',
  testDeployPath: '/tmp/docker-deploy',
  onlineServers: '1.2.3.4',
  onlineDeployPath: '/var/www/docker-app',
}

beforeEach(() => {
  vi.clearAllMocks()
  baseData.projects = { existing: { name: 'existing' } }
})

describe('create.handler 创建项目', () => {
  it('file 项目：写 file 字段，不写 docker 字段', async () => {
    inquirer.prompt.mockResolvedValue(fileAnswers)

    await create.handler()

    const saved = baseData.projects.myproj
    expect(saved).toMatchObject({
      name: 'myproj',
      repositoryType: 'git',
      deployType: 'file',
      distPath: 'dist',
      exclude: [],
      include: [],
      testServers: [],
      isFullSync: false,
    })
    expect(saved.imageName).toBeUndefined()
  })

  it('docker 项目：写 docker 字段，不写 file 专属字段', async () => {
    inquirer.prompt.mockResolvedValue(dockerAnswers)

    await create.handler()

    const saved = baseData.projects.myproj
    expect(saved.deployType).toBe('docker')
    expect(saved.imageName).toBe('demo')
    expect(saved.registry).toBe('harbor.example.com')
    expect(saved.dockerfile).toBe('Dockerfile')
    expect(saved.composeFile).toBe('docker-compose.yml')
    expect(saved.distPath).toBeUndefined()
    expect(saved.testServers).toEqual([])
    expect(saved.onlineServers).toEqual(['1.2.3.4'])
  })

  it('docker 项目 registry/dockerfile/composeFile 留空取默认值', async () => {
    inquirer.prompt.mockResolvedValue({ ...dockerAnswers, registry: '', dockerfile: '', composeFile: '' })

    await create.handler()

    const saved = baseData.projects.myproj
    expect(saved.registry).toBe('')
    expect(saved.dockerfile).toBe('Dockerfile')
    expect(saved.composeFile).toBe('docker-compose.yml')
  })

  it('逗号分隔的 exclude/include/testServers 拆成数组', async () => {
    inquirer.prompt.mockResolvedValue({
      ...fileAnswers,
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

  it('svn 项目输出 svn co 提示', async () => {
    inquirer.prompt.mockResolvedValue({ ...fileAnswers, repositoryType: 'svn' })

    await create.handler()

    expect(echo.info.mock.calls.some(c => c[0].includes('svn co'))).toBe(true)
  })
})

describe('create 问答定义', () => {
  const getQuestions = async (answers = fileAnswers) => {
    inquirer.prompt.mockResolvedValue(answers)

    await create.handler()

    return inquirer.prompt.mock.calls[0][0]
  }

  it('问题类型覆盖 input/select/confirm', async () => {
    const types = (await getQuestions()).map(q => q.type)

    expect(types.filter(t => t === 'input')).toHaveLength(12)
    expect(types.filter(t => t === 'select')).toHaveLength(2)
    expect(types).toContain('confirm')
  })

  it('deployType 默认 file，选项为 file/docker', async () => {
    const q = (await getQuestions()).find(x => x.name === 'deployType')

    expect(q.default).toBe('file')
    expect(q.choices).toEqual(['file', 'docker'])
  })

  it('file/docker 专属问题按 when 条件显示', async () => {
    const questions = await getQuestions()
    const dist = questions.find(q => q.name === 'distPath')
    const image = questions.find(q => q.name === 'imageName')

    expect(dist.when({ deployType: 'file' })).toBe(true)
    expect(dist.when({ deployType: 'docker' })).toBe(false)
    expect(image.when({ deployType: 'docker' })).toBe(true)
    expect(image.when({ deployType: 'file' })).toBe(false)
  })

  it('项目名 validate 校验规则', async () => {
    const nameQ = (await getQuestions()).find(q => q.name === 'projectName')

    expect(nameQ.validate('abc')).toBe(true)
    expect(nameQ.validate('ab')).toBe('请输入正确的项目名称')
    expect(nameQ.validate('ABC')).toBe('请输入正确的项目名称')
    expect(nameQ.validate('existing')).toBe('项目已存在，请重新输入项目名称')
  })

  it('必填字段 validate 拒绝空值', async () => {
    const questions = await getQuestions()

    for (const name of ['testDeployPath', 'onlineServers', 'onlineDeployPath', 'imageName']) {
      const q = questions.find(x => x.name === name)
      expect(q.validate('')).toBeTruthy()
      expect(q.validate('some value')).toBe(true)
    }
  })

  it('默认值：distPath=dist、dockerfile=Dockerfile、composeFile=docker-compose.yml', async () => {
    const questions = await getQuestions()

    expect(questions.find(x => x.name === 'distPath').default).toBe('dist')
    expect(questions.find(x => x.name === 'dockerfile').default).toBe('Dockerfile')
    expect(questions.find(x => x.name === 'composeFile').default).toBe('docker-compose.yml')
  })

  it('所有 when 条件按 deployType 正确过滤', async () => {
    const questions = await getQuestions()
    const fileOnly = ['distPath', 'exclude', 'include', 'isFullSync']
    const dockerOnly = ['imageName', 'registry', 'dockerfile', 'composeFile']

    for (const name of fileOnly) {
      const q = questions.find(x => x.name === name)
      expect(q.when({ deployType: 'file' })).toBe(true)
      expect(q.when({ deployType: 'docker' })).toBe(false)
    }

    for (const name of dockerOnly) {
      const q = questions.find(x => x.name === name)
      expect(q.when({ deployType: 'docker' })).toBe(true)
      expect(q.when({ deployType: 'file' })).toBe(false)
    }
  })
})
