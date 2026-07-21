import type { ProcessTimelineItem, ToolTraceRecord } from '../../types/chat'
import type { ProviderStreamEvent } from './providerStream'

export type ReplyStreamEvent = ProviderStreamEvent
  | { type: 'tool-trace'; trace: ToolTraceRecord }
  | { type: 'timeline'; item: ProcessTimelineItem }
