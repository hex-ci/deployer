import { describe, it, expect, vi } from 'vitest'
import echo from '../../helper/echo.js'
import banner from '../../helper/banner.js'

vi.mock('../../helper/echo.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}))

describe('banner', () => {
  it('输出含版本号的欢迎语', () => {
    banner()

    expect(echo.info).toHaveBeenCalledTimes(1)
    expect(echo.info.mock.calls[0][0]).toMatch(/Deployer Ver \d+\.\d+\.\d+/)
  })
})
