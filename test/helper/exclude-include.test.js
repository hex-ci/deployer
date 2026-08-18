import { describe, it, expect } from 'vitest'
import excludeInclude from '../../helper/exclude-include.js'

describe('exclude-include.get', () => {
  it('始终包含默认排除项 .* 和 .*/', () => {
    const { exclude } = excludeInclude.get({ exclude: [], include: [] })

    expect(exclude).toContain('--exclude=".*"')
    expect(exclude).toContain('--exclude=".*/"')
  })

  it('追加 data.exclude', () => {
    const { exclude } = excludeInclude.get({ exclude: ['node_modules'], include: [] })

    expect(exclude).toBe('--exclude=".*" --exclude=".*/" --exclude="node_modules"')
  })

  it('无 data.include 时返回空字符串', () => {
    const { include } = excludeInclude.get({ exclude: [], include: [] })

    expect(include).toBe('')
  })

  it('追加 data.include', () => {
    const { include } = excludeInclude.get({ exclude: [], include: ['.pnpm', '.npmrc'] })

    expect(include).toBe('--include=".pnpm" --include=".npmrc"')
  })
})
