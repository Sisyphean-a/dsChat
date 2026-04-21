# State Management

> State conventions for the chat-style frontend in this project.

---

## Overview

This project uses **Vue refs + a single feature composable** for stateful chat flows.

Current reference implementation:

- `src/composables/useChatApp.ts`
- `src/services/utools.ts`
- `src/utils/chat.ts`

The default pattern is:

1. Keep feature state inside one composable
2. Keep persistence at the service boundary
3. Keep component-local UI state inside components
4. Persist conversation state explicitly after each meaningful transition

---

## State Categories

### Feature Session State

Keep chat runtime state in `useChatApp()`:

```ts
const conversations = ref<ConversationDoc[]>([])
const activeConversationId = ref<string | null>(null)
const messages = ref<ChatMessage[]>([])
const isSending = ref(false)
const lastError = ref<string | null>(null)
```

Use this category for:

- active conversation identity
- ordered message list
- streaming / stopped / interrupted flags
- persistent settings loaded from storage

### Component-Local UI State

Keep purely presentational state in the component that owns it:

- model picker open/close
- reasoning panel expanded/collapsed
- scroll release state for the current streaming message

Do not promote these to shared state unless another component must coordinate with them.

### Persistence State

Persistence lives behind `src/services/utools.ts`.

Do not read or write `window.utools.db` directly from components.

---

## Convention: Persist By Transition, Not By Guessing

When a chat flow changes meaningfully, persist immediately.

Required persist points for the chat feature:

1. after appending the user message and assistant placeholder
2. after final assistant completion
3. after interrupted/error recovery writes a new visible state
4. after deleting the active conversation

Example:

```ts
messages.value = [...messages.value, userMessage, assistantMessage]
await persistConversation()
```

Why:

- reopening the plugin must restore a valid visible state
- crashes or exits during streaming must not leave an untracked transient state

---

## Convention: Generated Conversation Titles Are Persistent Metadata

`ConversationDoc.title` is **not** derived UI text after first save. It is persistent metadata.

Rules:

1. Before title generation finishes, new conversations use the neutral fallback title `New Chat` / `新对话`
2. Title generation starts **after the first conversation save succeeds**
3. Title generation runs in parallel with the assistant reply stream
4. Later conversation saves must preserve the existing generated title

Correct pattern:

```ts
await persistConversation()
generateConversationTitle(conversationId, firstUserMessage, settingsSnapshot)
```

Wrong pattern:

```ts
await streamChatCompletion(...)
await persistConversation()
generateConversationTitle(...)
```

Wrong pattern effect:

- title updates feel delayed
- title can be overwritten by the first user message if later saves recompute it

---

## Convention: Use Settings Snapshots For Derived Async Work

Any background task spawned from `sendMessage()` must use a normalized snapshot of settings taken at send time.

Current example:

```ts
const normalizedSettings = normalizeSettings(settings.value)
generateConversationTitle(conversationId, content, normalizedSettings)
```

Why:

- users can change model/theme/temperature while streaming
- async title generation should use the same request configuration that existed when the send started

---

## Convention: Stop And Interrupt Are Visible Message States

This project does not silently discard aborted streams.

Required user-visible outcomes:

- plugin exit during streaming -> message becomes `interrupted` with interruption text
- user stop during streaming -> message becomes `interrupted` with stop text
- request failure -> message becomes `error`

Required state contract:

```ts
type MessageStatus = 'done' | 'streaming' | 'error' | 'interrupted'
```

Do not introduce hidden “cancelled but invisible” states for assistant messages.

---

## Server State Boundary

For this frontend, server state is request-driven rather than cached by a query library.

Rules:

1. `src/services/chatCompletion.ts` owns request payloads and SSE parsing
2. `useChatApp()` owns orchestration and view-model state
3. Components consume already-shaped message state

Do not let components parse SSE frames or build request payloads directly.

---

## Validation And Error Matrix

| Scenario | Expected state | Persist required | Visible result |
|---------|----------------|------------------|----------------|
| Missing API key / model / base URL | `isSending` stays `false` | No | Settings panel opens with error |
| First persist fails | assistant placeholder -> `error` | No later stream call | Error bubble visible |
| Stream abort by user | assistant -> `interrupted` | Yes | Partial content kept, marked stopped |
| Stream abort by plugin exit | assistant -> `interrupted` | Yes | Reopened session is usable |
| Title generation fails | conversation remains usable | No blocking failure | Warning only |

---

## Tests Required

For chat state changes, keep these assertions covered:

1. streaming success updates assistant content and final status
2. reasoning content is stored separately from final answer content
3. restoring a saved `streaming` message repairs it to `interrupted`
4. deleting the active conversation clears session pointer and visible messages
5. title generation starts before the streaming reply finishes
6. generated titles are not overwritten by later conversation saves

---

## Common Mistakes

### Common Mistake: Recomputing `ConversationDoc.title` on every save

Symptom:

- sidebar title becomes the first user message again

Cause:

- save logic derives title from messages instead of preserving persisted metadata

Fix:

- preserve `existing.title` during normal saves
- only update title from the dedicated title-generation flow

### Common Mistake: Starting background tasks after the whole reply completes

Symptom:

- metadata such as conversation title updates noticeably late

Fix:

- start independent async work immediately after the first durable save
