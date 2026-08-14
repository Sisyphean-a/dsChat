import type { MessageAttachment } from '../../types/chat'
import type { AiTool, ToolExecutionContext } from '../ai/toolTypes'
import { validateImageAttachment } from '../imageAttachmentValidation'
import { analyzeImageWithQwen } from './qwenClient'

interface ImageToolArgs {
  attachment_id?: unknown
  prompt?: unknown
}

interface ExtractTextArgs extends ImageToolArgs {
  programming_language?: unknown
}

interface DiagnoseErrorArgs extends ImageToolArgs {
  context?: unknown
}

const IMAGE_ATTACHMENT_ID_PROPERTY = {
  attachment_id: {
    type: 'string',
    description: '当前用户消息中图片附件的 ID，只能使用系统提示中提供的 attachment_id。',
  },
}

export const qwenExtractTextFromScreenshotTool: AiTool = {
  definition: {
    type: 'function',
    function: {
      name: 'qwen_extract_text_from_screenshot',
      description: '当用户需要从截图、代码截图或文档截图中提取文字时使用。',
      parameters: {
        type: 'object',
        properties: {
          ...IMAGE_ATTACHMENT_ID_PROPERTY,
          programming_language: { type: 'string', description: '截图包含代码时可填写编程语言，例如 typescript、python。' },
          prompt: { type: 'string', description: '要提取的内容和格式要求。' },
        },
        required: ['attachment_id', 'prompt'],
        additionalProperties: false,
      },
    },
  },
  async execute(args, context) {
    const parsed = parseExtractTextArgs(args)
    return executeQwenImageTool({
      context,
      image: resolveImageAttachment(parsed.attachment_id, context),
      prompt: `${parsed.prompt}${parsed.programming_language ? `\n编程语言：${parsed.programming_language}` : ''}`,
      systemPrompt: '你是一个严谨的截图 OCR 助手。请忠实识别图片中的文字，不要臆造看不清的内容；按照用户要求返回结果。',
    })
  },
}

export const qwenDiagnoseErrorScreenshotTool: AiTool = {
  definition: {
    type: 'function',
    function: {
      name: 'qwen_diagnose_error_screenshot',
      description: '当用户需要分析错误截图、堆栈信息或异常提示时使用。',
      parameters: {
        type: 'object',
        properties: {
          ...IMAGE_ATTACHMENT_ID_PROPERTY,
          context: { type: 'string', description: '错误发生的额外背景，例如运行 npm install 或部署后。' },
          prompt: { type: 'string', description: '需要分析的问题和期望得到的帮助。' },
        },
        required: ['attachment_id', 'prompt'],
        additionalProperties: false,
      },
    },
  },
  async execute(args, context) {
    const parsed = parseDiagnoseErrorArgs(args)
    return executeQwenImageTool({
      context,
      image: resolveImageAttachment(parsed.attachment_id, context),
      prompt: `${parsed.prompt}${parsed.context ? `\n错误背景：${parsed.context}` : ''}`,
      systemPrompt: '你是一个错误截图诊断助手。请先准确读取截图中的错误，再区分确定事实和推测原因，给出可执行的排查建议。',
    })
  },
}

export const qwenAnalyzeImageTool: AiTool = {
  definition: {
    type: 'function',
    function: {
      name: 'qwen_analyze_image',
      description: '当其他专用图片工具不适用时，对图片进行通用分析。',
      parameters: {
        type: 'object',
        properties: {
          ...IMAGE_ATTACHMENT_ID_PROPERTY,
          prompt: { type: 'string', description: '需要从图片中分析、提取或理解的内容。' },
        },
        required: ['attachment_id', 'prompt'],
        additionalProperties: false,
      },
    },
  },
  async execute(args, context) {
    const parsed = parseImageToolArgs(args, 'qwen_analyze_image')
    return executeQwenImageTool({
      context,
      image: resolveImageAttachment(parsed.attachment_id, context),
      prompt: parsed.prompt,
      systemPrompt: '你是一个通用图片分析助手。请只根据图片和用户要求作答；看不清或无法判断的内容要明确说明。',
    })
  },
}

export const qwenImageTools: AiTool[] = [
  qwenExtractTextFromScreenshotTool,
  qwenDiagnoseErrorScreenshotTool,
  qwenAnalyzeImageTool,
]

function executeQwenImageTool(options: {
  context: ToolExecutionContext
  image: MessageAttachment
  prompt: string
  systemPrompt: string
}): Promise<{ content: string; metadata: Record<string, unknown> }> {
  const settings = options.context.settings.builtinTools.qwenImage
  if (!settings) {
    return Promise.reject(new Error('阿里云 Qwen 图片工具配置缺失。'))
  }

  return analyzeImageWithQwen({
    apiKey: settings.apiKey,
    baseUrl: settings.baseUrl,
    imageDataUrl: options.image.dataUrl,
    model: settings.model,
    prompt: options.prompt,
    signal: options.context.signal,
    systemPrompt: options.systemPrompt,
  }).then((content) => ({ content, metadata: { attachmentId: options.image.id } }))
}

function resolveImageAttachment(attachmentId: string, context: ToolExecutionContext): MessageAttachment {
  const attachment = context.attachments?.find((item) => item.id === attachmentId)
  if (!attachment || attachment.type !== 'image') throw new Error(`找不到图片附件：${attachmentId}`)
  validateImageAttachment(attachment)
  return attachment
}

function parseExtractTextArgs(args: unknown): { attachment_id: string; programming_language?: string; prompt: string } {
  const payload = parseImageToolArgs(args, 'qwen_extract_text_from_screenshot') as ExtractTextArgs & { attachment_id: string; prompt: string }
  if (payload.programming_language !== undefined && typeof payload.programming_language !== 'string') {
    throw new Error('qwen_extract_text_from_screenshot 参数错误：programming_language 必须是字符串。')
  }
  return {
    attachment_id: payload.attachment_id,
    programming_language: payload.programming_language?.trim() || undefined,
    prompt: payload.prompt,
  }
}

function parseDiagnoseErrorArgs(args: unknown): { attachment_id: string; context?: string; prompt: string } {
  const payload = parseImageToolArgs(args, 'qwen_diagnose_error_screenshot') as DiagnoseErrorArgs & { attachment_id: string; prompt: string }
  const context = (args as DiagnoseErrorArgs).context
  if (context !== undefined && typeof context !== 'string') {
    throw new Error('qwen_diagnose_error_screenshot 参数错误：context 必须是字符串。')
  }
  return {
    attachment_id: payload.attachment_id,
    context: context?.trim() || undefined,
    prompt: payload.prompt,
  }
}

function parseImageToolArgs(args: unknown, toolName: string): { attachment_id: string; prompt: string } {
  if (typeof args !== 'object' || args === null) throw new Error(`${toolName} 参数错误：需要对象参数。`)
  const payload = args as ImageToolArgs
  if (typeof payload.attachment_id !== 'string' || !payload.attachment_id.trim()) {
    throw new Error(`${toolName} 参数错误：attachment_id 必须是非空字符串。`)
  }
  if (typeof payload.prompt !== 'string' || !payload.prompt.trim()) {
    throw new Error(`${toolName} 参数错误：prompt 必须是非空字符串。`)
  }
  return { attachment_id: payload.attachment_id.trim(), prompt: payload.prompt.trim() }
}
