# Quality Guidelines

> Frontend quality rules that are already enforced by the current chat feature.

---

## Overview

For this project, frontend quality means:

- type-safe state transitions
- explicit visible failure states
- compact but usable interactions
- tests for non-obvious async behavior

---

## Forbidden Patterns

### Don't: Overwrite persistent conversation titles during normal saves

Problem:

```ts
title: buildConversationTitle(messages)
```

Why it is bad:

- generated titles regress to the first user message
- sidebar metadata becomes unstable

Instead:

```ts
title: existing?.title?.trim() || '新对话'
```

### Don't: Block independent metadata work behind full response completion

Problem:

- title generation starts only after the assistant reply fully completes

Why it is bad:

- metadata updates feel delayed
- unnecessary serial dependency

Instead:

- start metadata tasks after the first durable save when they do not require the final reply body

### Don't: Force auto-scroll after the user intentionally scrolls up

Why it is bad:

- makes streaming content difficult to inspect
- creates adversarial UI behavior

Instead:

- release auto-follow for the current streaming message when user scroll intent is detected

### Don't: Add non-functional copy to compact tool windows

Problem:

- settings panels become taller and harder to scan
- useful controls are pushed below the fold

Why it is bad:

- this project runs inside a small utility window
- explanatory copy competes with the primary task of editing values quickly

Instead:

- keep labels short
- use one-line notices only for actual state or risk
- remove repeated descriptions that do not change the next user action

---

## Required Patterns

### Required: Visible terminal message states

Assistant messages must always end in a visible terminal state:

- `done`
- `error`
- `interrupted`

### Required: Storage access behind service helpers

All uTools DB reads/writes must go through `src/services/utools.ts`.

Do not access `window.utools.db` directly from components or composables.

### Required: Tests for async orchestration

When changing send-flow ordering, add or update tests for:

- persist timing
- interruption timing
- metadata side effects

---

## Testing Requirements

Minimum required automated coverage for the chat flow:

1. successful streaming reply
2. reasoning content handling
3. restore interrupted session
4. delete active conversation
5. stop generation
6. title generation starts before stream completion
7. generated title is preserved across later saves

---

## Code Review Checklist

- Does a later save accidentally recompute metadata from transient UI state?
- Does streaming behavior expose a visible stop or interrupted outcome?
- Does compact UI stay compact, or did helper copy/padding inflate the layout?
- Does every visible sentence earn its space, or is it just repeating labels and values?
- Does a new async task need to run in parallel rather than after the entire flow?
- If theme-aware styling changed, are colors driven by shared variables rather than file-specific hardcoded values?
