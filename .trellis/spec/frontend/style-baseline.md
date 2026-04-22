# Style Baseline Contract

> Lock the current visual language to prevent large accidental UI drift.

---

## Scenario: Utility Chat Window Visual Baseline

### 1. Scope / Trigger

- Trigger: any change to `src/style.css`, `src/styles/app-shell.css`, or component-scoped visual styles.
- Trigger: any change that alters spacing rhythm, corner radius scale, toolbar height, or panel density.
- Trigger: any change that changes light/dark token meaning.

This spec exists to keep the current compact utility-window style stable while still allowing targeted improvements.

### 2. Signatures

#### Source of truth files

- Global token layer: `src/style.css`
- App shell layout layer: `src/styles/app-shell.css`
- Component visual layer:
  - `src/components/ChatComposer.vue`
  - `src/components/ModelPicker.vue`
  - `src/components/SidebarPanel.vue`
  - `src/components/SettingsPanel.vue`
  - `src/components/MessageBubble.vue`

#### Required token families

```css
--bg, --bg-soft, --bg-sidebar, --bg-hover, --bg-active
--border
--text, --text-muted
--accent, --accent-strong, --accent-soft
--danger
--radius-sm, --radius-md
--panel-shadow
```

#### App shell geometry contract

```css
.chat-header { height: 44px; }
.composer-container { padding: 0 14px 12px; }
.message-list { padding: 24px 16px; gap: 14px; }
.sidebar-panel { width: 260px; }
```

### 3. Contracts

#### Contract A: Token-driven styling only

- Colors, borders, shadows, and radii must come from CSS variables in `src/style.css`.
- Component-local hardcoded color values are forbidden, except transient overlay backgrounds already present in the current baseline (for example modal scrim alpha values).

#### Contract B: Utility-window density remains compact

- Keep compact controls label-first and single-line where possible.
- Do not add explanatory paragraphs to toolbar-like areas.
- Do not increase core vertical rails (`chat-header`, composer tool strip, sidebar rows) without explicit product requirement.

#### Contract C: Motion profile remains subtle

- Allowed default motion duration: `150ms` to `220ms`.
- Preferred properties: `opacity`, `transform`, border/background transitions.
- Avoid heavy blur/scale animations that change perceived layout density.

#### Contract D: App shell layout is stable

- `src/styles/app-shell.css` is the visual baseline for top-level layout.
- Refactors can move style location, but geometry and spacing rhythm must remain equivalent unless intentionally changed and documented.

#### Contract E: Theme parity

- Any new token must be defined in both `:root` and `[data-theme='dark']`.
- New components must support both themes via shared tokens.

### 4. Validation & Error Matrix

| Change Type | Validation | Required behavior |
|------------|------------|-------------------|
| Edited global tokens | Compare light/dark token pairs | No missing dark-mode counterpart |
| Edited app shell layout | Visual check on desktop + mobile width | Header/composer/sidebar geometry remains stable |
| Added component style | Search for hardcoded colors | Use shared CSS variables |
| Added interactive motion | Inspect transition properties | Keep motion subtle and utility-like |

### 5. Good/Base/Bad Cases

#### Good

- move `App.vue` style block to `src/styles/app-shell.css` while keeping visual output unchanged
- extract logic into composables without touching class names or token mapping
- add small hover state using existing `--bg-hover` or `--accent-soft`

#### Base

- adjust internal file structure while retaining existing selectors and design tokens
- add a new compact button that follows current border radius and font sizing rhythm

#### Bad

- replace token-based colors with raw hex values in component files
- increase major spacing/radius scales globally without specification update
- add descriptive UI copy blocks that make compact windows significantly taller

### 6. Tests Required

Minimum checks when style-related files change:

1. `npm run build` passes.
2. `npm run test` passes.
3. Manual smoke check in light theme:
   - header height, sidebar width, composer strip density unchanged.
4. Manual smoke check in dark theme:
   - no unreadable text or low-contrast token regressions.

### 7. Wrong vs Correct

#### Wrong

```css
.prompt-btn {
  background: #7b61ff;
  border-radius: 28px;
}
```

Why wrong:

- bypasses shared token system
- introduces unrelated visual language drift

#### Correct

```css
.prompt-btn {
  background: transparent;
  border-radius: 20px;
  border: 1px solid var(--border);
}
```

### Design Decision: Freeze visual language by contract, not by memory

Context:

- this project is edited frequently by AI and humans across sessions
- style drift tends to happen through many small “reasonable” edits

Decision:

- define explicit baseline geometry + token contracts in spec
- require style changes to be intentional and documented

Extension rule:

1. if visual language must change significantly, update this spec first
2. include the reason, expected new geometry/tokens, and validation checklist in the same change
