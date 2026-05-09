import type { AiTool } from '../ai/toolTypes'

const DEFAULT_TIME_LOCALE = 'en-CA'
const DEFAULT_TIME_ZONE = 'UTC'
const TIME_PARTS_OPTIONS: Intl.DateTimeFormatOptions = {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hourCycle: 'h23',
}
const WEEKDAY_OPTIONS: Intl.DateTimeFormatOptions = {
  weekday: 'long',
}

interface CurrentTimeToolArgs {
  timezone?: string
}

export const currentTimeTool: AiTool = {
  definition: {
    type: 'function',
    function: {
      name: 'get_current_time',
      description: '获取当前精确时间，帮助理解今天/昨天/本周等相对时间。',
      parameters: {
        type: 'object',
        properties: {
          timezone: {
            type: 'string',
            description: '可选 IANA 时区，例如 Asia/Shanghai 或 America/New_York。',
          },
        },
        additionalProperties: false,
      },
    },
  },
  async execute(args) {
    const parsed = parseCurrentTimeArgs(args)
    const now = new Date()
    const timezone = parsed.timezone ?? resolveLocalTimezone()
    const parts = formatDateTimeParts(now, timezone)
    const weekday = formatWeekday(now, timezone)

    return {
      content: JSON.stringify({
        timezone,
        utcIso: now.toISOString(),
        unixMs: now.getTime(),
        unixSeconds: Math.floor(now.getTime() / 1000),
        localDate: `${parts.year}-${parts.month}-${parts.day}`,
        localTime: `${parts.hour}:${parts.minute}:${parts.second}`,
        localDateTime: `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`,
        weekday,
      }),
      metadata: {
        timezone,
      },
    }
  },
}

function parseCurrentTimeArgs(args: unknown): CurrentTimeToolArgs {
  if (args === undefined || args === null) {
    return {}
  }

  if (typeof args !== 'object') {
    throw new Error('get_current_time 参数错误：需要对象参数。')
  }

  const timezone = (args as { timezone?: unknown }).timezone
  if (timezone === undefined) {
    return {}
  }

  if (typeof timezone !== 'string' || !timezone.trim()) {
    throw new Error('get_current_time 参数错误：timezone 必须是非空字符串。')
  }

  const normalized = timezone.trim()
  if (!isValidTimezone(normalized)) {
    throw new Error(`get_current_time 参数错误：timezone 无效（${normalized}）。`)
  }

  return {
    timezone: normalized,
  }
}

function resolveLocalTimezone(): string {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  if (typeof timezone === 'string' && timezone.trim()) {
    return timezone
  }

  return DEFAULT_TIME_ZONE
}

function isValidTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(DEFAULT_TIME_LOCALE, {
      ...TIME_PARTS_OPTIONS,
      timeZone: timezone,
    }).format(new Date())
    return true
  } catch {
    return false
  }
}

function formatDateTimeParts(
  date: Date,
  timezone: string,
): Record<'day' | 'hour' | 'minute' | 'month' | 'second' | 'year', string> {
  const formatter = new Intl.DateTimeFormat(DEFAULT_TIME_LOCALE, {
    ...TIME_PARTS_OPTIONS,
    timeZone: timezone,
  })
  const parts = formatter.formatToParts(date)
  return {
    year: resolvePart(parts, 'year'),
    month: resolvePart(parts, 'month'),
    day: resolvePart(parts, 'day'),
    hour: resolvePart(parts, 'hour'),
    minute: resolvePart(parts, 'minute'),
    second: resolvePart(parts, 'second'),
  }
}

function resolvePart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((item) => item.type === type)?.value ?? ''
}

function formatWeekday(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    ...WEEKDAY_OPTIONS,
    timeZone: timezone,
  }).format(date)
}
