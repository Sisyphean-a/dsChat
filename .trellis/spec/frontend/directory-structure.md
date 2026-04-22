# Directory Structure

> Frontend module organization contract for this repository.

---

## Overview

The project uses a compact feature-first structure:

1. top-level shell in `App.vue`
2. orchestration composable in `src/composables/useChatApp.ts`
3. isolated UI components in `src/components/`
4. IO boundaries in `src/services/`
5. pure data/helpers in `src/constants/` and `src/utils/`

Primary objective:

- keep UI rendering, orchestration, and service IO separated
- keep each file focused on one layer responsibility

---

## Directory Layout

```text
src/
├── App.vue                         # Shell wiring only
├── main.ts
├── style.css                       # Global design tokens and reset
├── styles/
│   └── app-shell.css               # App shell layout baseline styles
├── components/                     # Presentational components
│   ├── ChatComposer.vue
│   ├── MessageBubble.vue
│   ├── ModelPicker.vue
│   ├── SettingsPanel.vue
│   └── SidebarPanel.vue
├── composables/                    # Orchestration and view-model logic
│   ├── useChatApp.ts
│   ├── useMessageListAutoScroll.ts
│   ├── chatAppSettings.ts
│   ├── chatAppSettingsActions.ts
│   ├── chatAppSendActions.ts
│   ├── chatAppMessages.ts
│   └── chatAppErrors.ts
├── services/                       # External IO boundaries
│   ├── chatCompletion.ts
│   ├── conversationTitle.ts
│   ├── markdown.ts
│   ├── theme.ts
│   └── utools.ts
├── constants/
│   ├── app.ts
│   └── providers.ts
├── types/
│   ├── chat.ts
│   └── utools.ts
└── utils/
    ├── chat.ts
    └── session.ts
```

---

## Module Organization Rules

### Rule A: Components stay presentational

- Components receive typed props and emit narrow events.
- Components do not call storage/network services directly.

### Rule B: Orchestration lives in composables

- `useChatApp.ts` wires feature state and action composition.
- Split orchestration helpers by concern:
  - `chatAppSettingsActions.ts`: settings updates and save flow
  - `chatAppSendActions.ts`: send/interrupt stream flow
  - `chatAppMessages.ts`: message mutation helpers
  - `chatAppErrors.ts`: shared error guards
  - `useMessageListAutoScroll.ts`: scroll-follow UI behavior

### Rule C: Services are strict boundaries

- `services/*` files handle fetch, uTools DB, markdown render/highlight, theme application.
- Composables call services; components do not.

### Rule D: Utility and constants stay pure

- `utils/*` and `constants/*` should be deterministic and side-effect free.
- Persistence/network side effects are forbidden in these folders.

---

## Naming Conventions

- Vue components: `PascalCase.vue`
- Composables: `use*.ts` for consumer-facing composables, `chatApp*.ts` for feature-internal modules
- Services and utils: `camelCase.ts`
- Types: grouped by domain (`types/chat.ts`, `types/utools.ts`)

---

## Change Discipline

Before introducing a new file:

1. check whether the logic belongs to existing composable/service/helper.
2. if a file grows beyond one responsibility, split by concern, not by arbitrary size.
3. update this doc when adding a new stable layer boundary.
