import { afterEach, describe, expect, it, vi } from 'vitest'
import { currentTimeTool } from './currentTimeTool'

describe('currentTimeTool', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('throws when args is not an object', async () => {
    await expect(
      currentTimeTool.execute('now', {
        settings: createToolSettings(),
      }),
    ).rejects.toThrow('get_current_time 参数错误：需要对象参数。')
  })

  it('throws when timezone is invalid', async () => {
    await expect(
      currentTimeTool.execute({ timezone: 'Mars/Base-1' }, {
        settings: createToolSettings(),
      }),
    ).rejects.toThrow('get_current_time 参数错误：timezone 无效（Mars/Base-1）。')
  })

  it('returns structured current time data', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-09T12:34:56.000Z'))

    const result = await currentTimeTool.execute({ timezone: 'UTC' }, {
      settings: createToolSettings(),
    })
    const payload = JSON.parse(result.content) as {
      localDate: string
      localDateTime: string
      localTime: string
      timezone: string
      unixMs: number
      unixSeconds: number
      utcIso: string
      weekday: string
    }

    expect(payload).toMatchObject({
      timezone: 'UTC',
      utcIso: '2026-05-09T12:34:56.000Z',
      unixMs: 1778330096000,
      unixSeconds: 1778330096,
      localDate: '2026-05-09',
      localTime: '12:34:56',
      localDateTime: '2026-05-09T12:34:56',
    })
    expect(payload.weekday.length).toBeGreaterThan(0)
  })
})

function createToolSettings() {
  return {
    enabled: true,
    maxToolRounds: 3,
    builtinTools: {
      currentTime: {
        enabled: true,
      },
      tavilySearch: {
        enabled: false,
        apiKey: '',
      },
    },
    customTools: [],
  }
}
