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

### Don't: Save async metadata with a pre-`await` conversation snapshot

Problem:

- background title generation captures a conversation doc before awaiting the title request
- by the time the title returns, the main send flow may already have persisted a newer `_rev`

Why it is bad:

- the title save can fail only in real persistence environments
- UI looks normal except the conversation title stays `新对话`

Instead:

- await the metadata request first
- reload the latest conversation doc from reactive state
- write the metadata on top of that fresh snapshot
- serialize metadata writes and message writes for the same conversation id

### Don't: Force auto-scroll after the user intentionally scrolls up

Why it is bad:

- makes streaming content difficult to inspect
- creates adversarial UI behavior

Instead:

- release auto-follow for the current streaming message immediately on upward scroll intent
- allow re-follow only when user manually returns to bottom threshold

### Don't: Unlock auto-follow on near-bottom heuristics

Problem:

- tiny downward jitter after an upward user scroll can accidentally resume auto-follow

Why it is bad:

- creates “scroll control fighting” during streaming
- behavior looks random under fast mouse wheel input

Instead:

- use deterministic lock/unlock state machine
- lock on upward intent
- unlock only on explicit return-to-bottom condition

### Don't: Use scroll-event skip counters as the primary anti-jitter strategy

Problem:

- skip-count logic can swallow real user intent events in rapid scroll sequences

Why it is bad:

- introduces probabilistic behavior
- hard to reason about in bug reports

Instead:

- prefer stateful lock keyed to current streaming message
- treat wheel-up as high-priority user intent

### Don't: Re-scan the whole message list on every stream chunk

Problem:

- hot path uses `messages.map(...)` for each token delta

Why it is bad:

- unnecessary O(n) work per chunk as history grows
- harder to reason about stream performance regressions

Instead:

- patch the assistant message by preferred index
- fallback to id lookup only when index becomes stale

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

### Don't: Let streaming visual polish break readable markdown

Problem:

- reveal overlays or repeated entry animations can make assistant output unreadable during streaming
- users perceive flicker or "whole block flashing" instead of smoothness

Why it is bad:

- readability is the baseline contract
- "fancier" motion that regresses markdown stability is a net quality loss

Instead:

- keep text release smoothing in a UI-only layer
- keep markdown rendering structurally stable
- disable or remove an animation path as soon as it causes flicker in real usage

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
- metadata writes that resolve after a later conversation save with revisioned persistence
- metadata writes that begin before a later message save but must not race on the same conversation doc

### Required: Stop-generation behavior is covered

At least one automated test must verify:

1. stream in progress
2. user triggers stop
3. assistant message ends in `interrupted`
4. visible stopped content is persisted (`已停止生成。` fallback when empty)

### Required: Streaming markdown segmentation is covered

At least one automated test must verify:

1. completed fenced code blocks are extracted as independent render segments
2. incomplete fenced blocks stay in prose mode while streaming
3. markdown readability is preserved when visual smoothing is enabled

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
8. generated title still persists when the title request resolves after the final message save
9. stream delta updates do not depend on full-list remap hot path semantics
10. auto-follow lock/unlock remains deterministic across multiple up-down cycles in one stream
11. slight downward jitter after an upward lock does not unexpectedly re-enable auto-follow
12. streamed markdown segmentation keeps completed code blocks separate from prose

---

## Code Review Checklist

- Does a later save accidentally recompute metadata from transient UI state?
- Does streaming behavior expose a visible stop or interrupted outcome?
- Does compact UI stay compact, or did helper copy/padding inflate the layout?
- If shell style/layout changed, did we update `style-baseline.md`?
- Does every visible sentence earn its space, or is it just repeating labels and values?
- Does a new async task need to run in parallel rather than after the entire flow?
- Does an async metadata write re-read the latest persisted document after `await`, or is it saving a stale `_rev` snapshot?
- Do multiple writes for the same conversation pass through one serialized persistence boundary, or can they still hit storage concurrently?
- If theme-aware styling changed, are colors driven by shared variables rather than file-specific hardcoded values?
