# Type Safety

> Type contracts and runtime normalization rules for chat frontend code.

---

## Overview

Type system:

- TypeScript + Vue `script setup`
- strict linting (`noUnusedLocals`, `noUnusedParameters`, fallthrough guard)

Core principle:

- types describe domain contracts
- normalization functions enforce runtime boundaries

---

## Type Organization

### Domain types

- `src/types/chat.ts`:
  - chat message model
  - settings model
  - provider model
  - persistence document model

- `src/types/utools.ts`:
  - uTools DB API surface used by services

### Layer usage contract

1. components use typed props/events only
2. composables use domain types and normalized settings
3. services receive fully shaped inputs from composables

---

## Validation And Normalization

Runtime normalization entry:

- `normalizeSettings(settings)` in `src/composables/chatAppSettings.ts`

Required normalization boundaries:

1. `loadSettings()` result must be normalized before use.
2. `saveSettings()` writes normalized data.
3. send flow validates normalized active settings before dispatching request.

Required non-coercion:

- explicit blank `baseUrl` and `model` must remain blank so send-time validation can surface errors explicitly.

---

## Common Patterns

### Pattern A: Narrow event contracts

Use tuple-typed emits:

```ts
const emit = defineEmits<{
  select: [value: string]
}>()
```

### Pattern B: Immutable state updates

When mutating arrays/objects in refs:

- clone item/object
- replace array/object reference

This keeps Vue change detection explicit and testable.

### Pattern C: Error guards over broad casting

Use small guards/utilities (`isAbortError`, `getErrorMessage`) instead of `as any` branches.

---

## Forbidden Patterns

### Forbidden: `any` for cross-layer payloads

Do not use `any` for:

- chat completion payloads
- stream delta parsing
- settings persistence models

### Forbidden: Silent type widening in action modules

Do not accept `unknown` input and mutate state directly without normalization/guards.

### Forbidden: Unused typed values left in facade modules

With `noUnusedLocals` enabled, dead typed branches indicate drift.
Remove or wire every typed value intentionally.
