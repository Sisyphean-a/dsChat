# Hook Guidelines

> Composable contracts for this Vue frontend.

---

## Overview

This project uses Vue composables as feature orchestration boundaries.

Current anchors:

- `useChatApp.ts` (feature facade)
- `chatAppSettingsActions.ts` (settings write actions)
- `chatAppSendActions.ts` (send/abort stream actions)
- `useMessageListAutoScroll.ts` (message list scroll-follow behavior)
- `useBufferedTextStream.ts` (chunk-aware visible text release)

Goal:

- keep orchestration testable
- isolate high-frequency mutation logic
- preserve UI behavior while simplifying extension points

---

## Custom Hook Patterns

### Pattern A: One facade + internal action modules

`useChatApp()` is the only composable consumed by `App.vue` for chat feature state.
Internal concerns are split into focused modules and composed by `useChatApp`.

Benefits:

- stable external API for components
- easier internal refactor with fewer template-level changes

### Pattern B: Explicit dependency boundaries

Action composables receive required refs/functions through options objects instead of importing UI-level concerns.

Required:

- options objects contain only needed dependencies
- keep action modules independent from component instances

### Pattern C: Hot-path mutation optimization

For stream delta updates, avoid full-array `map` on every chunk when a stable target index is available.

Required:

- use index-first mutation strategy with safe id fallback
- preserve immutable array replacement for Vue reactivity

### Pattern D: Deterministic Auto-Scroll State Machine

For streaming message list auto-follow:

1. represent follow-release as explicit state (locked/unlocked) keyed by current streaming message id
2. lock on upward user intent (`wheel` up or upward `scrollTop` delta)
3. unlock only on explicit return-to-bottom condition
4. keep `wheel` intent listener at capture phase to reduce event-order ambiguity
5. when auto-follow is still unlocked, delayed layout-height changes from markdown segmentation / code highlighting must also keep the list pinned to bottom
6. when auto-follow is locked, those same delayed height changes must preserve the locked anchor instead of snapping back to bottom

This avoids probabilistic behavior under fast wheel input.

### Pattern E: Chunk-Aware Visible Text Release

For streamed assistant text:

1. the network layer still appends raw deltas immediately to message state
2. the view layer may expose a second "displayed text" stream that lags behind the raw content slightly
3. release cadence should depend on chunk append timing, not only on a fixed chars-per-second constant
4. when streaming ends, remaining buffered text should flush immediately instead of dragging the tail animation

Why:

- keeps persistence and business state exact
- allows UI-only smoothing without corrupting message content
- avoids the "slow fake typing after completion" effect

---

## Data Fetching And Side Effects

This project does not use query libraries.
All network and persistence side effects are orchestrated by composables through service functions.

Rules:

1. fetch/stream logic stays in `services/chatCompletion.ts`
2. persistence stays in `services/utools.ts`
3. composables coordinate side effects and view-model transitions
4. components emit intent only (`send`, `stop`, `select`, etc.)

---

## Naming Conventions

- Consumer-facing composables: `use*` (`useChatApp`, `useMessageListAutoScroll`)
- Feature-internal composable helpers: `chatApp*`
- Action factory naming: `create*Actions` (e.g., `createChatAppSendActions`)

---

## Common Mistakes

### Common Mistake: Letting facade composables become monoliths

Symptom:

- one composable file mixes settings, send flow, persistence, lifecycle, and UI wiring

Fix:

- split by concern into action modules
- keep `useChatApp` as composition layer

### Common Mistake: Performing expensive full-list scans on each stream chunk

Symptom:

- stream updates become slower as message history grows

Fix:

- patch assistant message by preferred index
- fallback to id lookup only when index is stale

### Common Mistake: Hiding side effects in components

Symptom:

- components directly call services or embed orchestration branches

Fix:

- move side effects to composables
- keep components presentational and event-driven

### Common Mistake: Mixing heuristic skip counters with user-intent state

Symptom:

- “sometimes still auto-scrolls after I scrolled up”

Fix:

- remove skip-count as primary control logic
- use explicit lock/unlock transitions and test multi-cycle interactions
