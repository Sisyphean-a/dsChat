# Component Guidelines

> Component implementation rules derived from the current chat UI.

---

## Overview

The frontend favors **small presentational components + one orchestration composable**.

Reference files:

- `src/App.vue`
- `src/components/ChatComposer.vue`
- `src/components/MessageBubble.vue`
- `src/components/ModelPicker.vue`
- `src/components/SidebarPanel.vue`

---

## Component Structure

Use this split by default:

1. `App.vue` wires feature state to components
2. `useChatApp()` owns orchestration and persistence-aware transitions
3. UI components receive already-shaped props and emit narrow events

Good:

```ts
const emit = defineEmits<{
  select: [value: string]
}>()
```

Bad:

```ts
const emit = defineEmits(['change', 'update', 'sync', 'save'])
```

Use narrow, explicit emit contracts.

---

## Props Conventions

Props should be:

- fully typed
- minimal
- already normalized when possible

Examples from the chat feature:

- `MessageBubble` receives a full `ChatMessage`
- `ModelPicker` receives `modelValue`, `options`, `disabled`
- `ChatComposer` receives `modelValue`, `disabled`, `isSending`

Do not pass persistence services or request builders into presentational components.

---

## Convention: Model Pickers Stay Compact

This project prefers a compact tool strip under the composer.

Rules for chat tool controls:

1. model picker trigger stays single-line
2. avoid explanatory helper text inside the picker unless explicitly requested
3. tool controls should visually read as “toolbar controls”, not as a second content card

Good:

```vue
<ModelPicker
  :disabled="app.isSending.value"
  :model-value="app.settings.value.model"
  :options="app.modelOptions"
  @select="handleModelSelect"
/>
```

Wrong:

- multi-line trigger copy
- descriptive marketing-style text in the compact toolbar
- controls that increase the composer height substantially

## Convention: Utility Windows Prefer Labels Over Explanations

For small tool windows such as settings panels:

1. default to label-only UI
2. do not add descriptive paragraphs unless the user explicitly asks for explanation
3. every line of copy must justify the vertical space it consumes
4. status copy should be compressed to short tags like `已配` / `未配`, not sentences

Good:

- provider list shows only name + short state
- model presets show only model name
- browser-mode notice stays one line

Wrong:

- “what this provider is” paragraphs repeated inside cards
- “接入说明 / 备注 / 即时预览” style helper copy that does not unblock action
- summary cards that restate editable field values below them

---

## Convention: Streaming UI Must Be Interruptible

If a component reflects streaming state, it must also expose a stop action where relevant.

Required chat composer behavior:

- sending state swaps the send button into a stop button
- stop action emits an explicit `stop` event

Example:

```ts
const emit = defineEmits<{
  send: []
  stop: []
}>()
```

Do not hide abort behavior inside key handlers or parent-only shortcuts.

---

## Convention: Reasoning Panels Auto-Collapse When Answer Output Starts

For reasoning-model responses:

1. expand the reasoning area while the assistant is still in the pure reasoning stage
2. collapse it automatically when final answer content starts streaming
3. still allow manual reopen after collapse

Current reasoning-stage contract:

```ts
const inReasoningStage = computed(() => {
  return message.role === 'assistant'
    && message.status === 'streaming'
    && !message.content.trim()
    && hasReasoning.value
})
```

Why:

- reasoning remains discoverable
- final answer becomes the visual focus as soon as it exists

---

## Convention: Auto-Scroll Must Yield To User Scroll Intent

For streaming chat views:

1. default behavior is follow-to-bottom
2. if the user manually scrolls away from the bottom during the current streaming message, stop forcing scroll
3. reset auto-follow when the next streaming message starts

This is a component orchestration rule, but the list component must support it by exposing a stable scroll container and using passive scroll listeners.

---

## Styling Patterns

Use local scoped styles inside components and shared design tokens from `src/style.css`.
Top-level shell styles live in `src/styles/app-shell.css`.

Required:

- derive spacing, borders, and colors from CSS variables
- prefer `transform` / `opacity` / simple layout transitions for micro-interactions
- keep code blocks theme-aware through shared variables, not hardcoded highlight theme files

Avoid:

- one-off hardcoded colors that ignore the active theme
- default browser `select` styling when a compact custom control is already established

## Convention: Keep Template Click Logic Declarative

For maintainability and type safety:

1. avoid long inline `@click` imperative statements
2. route quick actions through small script functions (`applyQuickPrompt`, etc.)
3. keep template event payloads simple and predictable

Why:

- reduces template syntax regressions
- keeps behavior unit-testable from script logic

## Convention: App Shell Visual Rules Stay Externalized

Rules:

1. `App.vue` should focus on wiring logic and structure
2. shell-level style baseline belongs to `src/styles/app-shell.css`
3. when shell geometry changes, update `style-baseline.md` in the same change

---

## Accessibility

Even in compact utility controls:

- use `button` for interactive elements
- keep `title` on icon-only actions
- preserve visible focus states through border/background changes
- do not make destructive actions appear only through invisible hover-only hit areas

The delete button in history rows should stay compact, but its hit area must remain easy to target.

---

## Common Mistakes

### Common Mistake: Adding explanatory copy to compact toolbars

Symptom:

- the layout looks heavier than the rest of the app

Fix:

- keep compact controls label-only unless the user explicitly asks for richer explanation

### Common Mistake: Treating reasoning and final answer as one visual block

Symptom:

- long reasoning text pushes the final answer too far down

Fix:

- render reasoning in its own collapsible section
- transition focus to the final answer as soon as answer content appears
