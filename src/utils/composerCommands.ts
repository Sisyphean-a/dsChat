export interface NewConversationCommand {
  type: 'new-conversation'
}

export type ComposerCommand = NewConversationCommand

const NEW_CONVERSATION_COMMAND = '/new'

export function resolveComposerCommand(input: string): ComposerCommand | null {
  const normalized = input.trim().toLowerCase()
  if (!normalized) {
    return null
  }

  if (normalized === NEW_CONVERSATION_COMMAND) {
    return {
      type: 'new-conversation',
    }
  }

  return null
}
