import { describe, it, expect, vi, beforeEach } from 'vitest'

const fsMocks = vi.hoisted(() => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}))

vi.mock('fs', () => ({ default: fsMocks }))

beforeEach(() => {
  vi.resetModules()
  fsMocks.existsSync.mockReset()
  fsMocks.readFileSync.mockReset()
  fsMocks.writeFileSync.mockReset()
})

const loadModule = () => import('../../helper/read-data.js')

describe('read-data', () => {
  it('data.json 不存在时写入默认结构', async () => {
    fsMocks.existsSync.mockReturnValue(false)
    fsMocks.readFileSync.mockReturnValue(JSON.stringify({ projects: {} }))

    const mod = await loadModule()

    expect(fsMocks.writeFileSync).toHaveBeenCalledTimes(1)
    expect(mod.default).toEqual({ projects: {} })
  })

  it('data.json 存在时读取其内容', async () => {
    fsMocks.existsSync.mockReturnValue(true)
    fsMocks.readFileSync.mockReturnValue(JSON.stringify({ projects: { demo: { name: 'demo' } } }))

    const mod = await loadModule()

    expect(mod.default.projects.demo).toEqual({ name: 'demo' })
  })

  it('缺 projects 字段时补齐为空对象', async () => {
    fsMocks.existsSync.mockReturnValue(true)
    fsMocks.readFileSync.mockReturnValue(JSON.stringify({}))

    const mod = await loadModule()

    expect(mod.default).toEqual({ projects: {} })
  })
})
