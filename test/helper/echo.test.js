import { describe, it, expect, vi, afterEach } from 'vitest'
import echo from '../../helper/echo.js'

describe('echo', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('info 输出消息（前后留空行）', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})

    echo.info('hello')

    expect(spy).toHaveBeenCalledTimes(3)
    expect(String(spy.mock.calls[1][0])).toContain('hello')
  })

  it('error 输出消息', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})

    echo.error('boom')

    expect(spy).toHaveBeenCalledTimes(3)
    expect(String(spy.mock.calls[1][0])).toContain('boom')
  })

  it('warning 输出消息', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})

    echo.warning('careful')

    expect(spy).toHaveBeenCalledTimes(3)
    expect(String(spy.mock.calls[1][0])).toContain('careful')
  })
})
