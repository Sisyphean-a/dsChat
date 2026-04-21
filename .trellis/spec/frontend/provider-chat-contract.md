# Multi-Provider Settings And Chat Completion Contract

> Executable contract for the `settings -> normalization -> persistence -> request -> UI` flow.

---

## Scenario: Multi-provider settings, migration, and request dispatch

### 1. Scope / Trigger

- Trigger: the chat app no longer stores a single flat DeepSeek config.
- Trigger: request dispatch now depends on `activeProvider` and provider-specific normalization.
- Trigger: persistence must migrate legacy `settings/config` documents into the new structure without breaking existing users.

This spec is required whenever code changes any of:

- `src/types/chat.ts`
- `src/constants/providers.ts`
- `src/composables/chatAppSettings.ts`
- `src/services/utools.ts`
- `src/services/chatCompletion.ts`
- `src/composables/useChatApp.ts`
- `src/components/SettingsPanel.vue`
- `src/components/ModelPicker.vue`

### 2. Signatures

#### Types

```ts
type ProviderId = 'deepseek' | 'openai' | 'claude' | 'minimax'

interface ProviderSettings {
  apiKey: string
  baseUrl: string
  model: string
  temperature: number
}

type ProviderSettingsMap = Record<ProviderId, ProviderSettings>

interface SettingsForm {
  activeProvider: ProviderId
  providers: ProviderSettingsMap
  theme: ThemeMode
}

interface ActiveProviderSettings extends ProviderSettings {
  provider: ProviderId
}
```

#### Registry / normalization

```ts
buildDefaultSettings(): SettingsForm
buildDefaultProviderSettings(provider: ProviderId): ProviderSettings
normalizeSettings(currentSettings: SettingsForm): SettingsForm
getActiveProviderSettings(settings: SettingsForm): ActiveProviderSettings
getSendSettingsError(currentSettings: SettingsForm): string | null
modelSupportsTemperature(provider: ProviderId, model: string): boolean
```

#### Persistence

```ts
loadSettings(): Promise<SettingsForm>
saveSettings(settings: SettingsForm): Promise<void>
```

Storage document id:

```ts
SETTINGS_DOC_ID = 'settings/config'
```

#### Request layer

```ts
requestChatCompletion(
  messages: ChatMessage[],
  settings: ActiveProviderSettings,
): Promise<string>

streamChatCompletion(
  messages: ChatMessage[],
  settings: ActiveProviderSettings,
  onDelta: (delta: StreamDelta) => void,
  signal?: AbortSignal,
): Promise<string>
```

### 3. Contracts

#### Contract A: Default settings

`buildDefaultSettings()` must return:

- `activeProvider = 'deepseek'`
- `theme = 'light'`
- one independent `ProviderSettings` object per provider
- each provider seeded from `PROVIDER_REGISTRY`

Required invariant:

- switching providers must not overwrite another provider's `apiKey/baseUrl/model/temperature`

#### Contract B: Legacy migration

Legacy persisted document shape:

```ts
interface LegacySettingsDoc {
  _id: 'settings/config'
  type: 'settings'
  apiKey?: string
  baseUrl?: string
  model?: string
  temperature?: number
  theme?: ThemeMode
}
```

Migration rule:

1. map legacy flat fields into `providers.deepseek`
2. keep all other providers at registry defaults
3. set `activeProvider = 'deepseek'`
4. normalize the migrated result before returning it to UI state

No user action should be required after upgrade.

#### Contract C: Normalization boundary

`normalizeSettings()` is the only place allowed to coerce:

- invalid `activeProvider` -> `DEFAULT_PROVIDER_ID`
- missing provider entries -> provider defaults
- non-finite temperature -> provider default temperature
- out-of-range temperature -> clamp to provider range
- theme not in `THEME_OPTIONS` -> default theme

Required non-coercion:

- blank `baseUrl` must stay blank if the field was explicitly cleared
- blank `model` must stay blank if the field was explicitly cleared

Reason:

- send-time validation must surface missing config instead of silently falling back

#### Contract D: Send-time validation

`getSendSettingsError()` validates only the active provider.

Required checks:

1. missing `apiKey` -> `"请先在设置面板中填写 <ProviderLabel> API Key。"`
2. missing `baseUrl` -> `"请先在设置面板中填写 <ProviderLabel> Base URL。"`
3. missing `model` -> `"请先在设置面板中选择 <ProviderLabel> 模型。"`

The send flow in `useChatApp()` must:

1. normalize settings
2. compute `activeSettings`
3. validate
4. stop send and open settings when validation fails

#### Contract E: Chat completions endpoint

All supported providers currently use:

```ts
POST <baseUrl>/chat/completions
Authorization: Bearer <apiKey>
Content-Type: application/json
```

Base payload:

```json
{
  "messages": [{ "role": "user", "content": "..." }],
  "model": "provider-model-id",
  "stream": true
}
```

Conditional fields:

- include `temperature` only when `modelSupportsTemperature(provider, model)` is `true`
- include `reasoning_split: true` only for `provider === 'minimax'`

#### Contract F: Streaming delta parsing

DeepSeek / OpenAI / Claude compatible path:

- answer chunks come from `choices[0].delta.content`
- DeepSeek reasoning chunks come from `choices[0].delta.reasoning_content`

MiniMax path:

- answer chunks may be cumulative in `choices[0].delta.content`
- reasoning chunks may be cumulative in `choices[0].delta.reasoning_details[].text`
- parser must emit only the suffix delta, not the full cumulative value

Terminal rules:

- `[DONE]` ends the stream
- empty final content must throw `"<ProviderLabel> 未返回可用内容。"`
- `response.ok === false` must throw `"<ProviderLabel> 请求失败：<status> <statusText>"`

### 4. Validation & Error Matrix

| Boundary | Input | Validation | Required behavior |
|---------|------|------------|-------------------|
| Storage -> UI | no settings doc | use defaults | return `deepseek` as active provider |
| Storage -> UI | legacy flat doc | migrate + normalize | deepseek gets legacy values, others stay default |
| UI -> normalized state | invalid provider id | provider whitelist | fallback to `deepseek` |
| UI -> normalized state | explicit blank baseUrl/model | do not backfill | blank survives to send validation |
| UI -> send | blank apiKey/baseUrl/model | active provider only | open settings and show error, no request |
| Active settings -> request payload | model without temperature support | provider model metadata | omit/neutralize `temperature` |
| Response -> stream parser | cumulative MiniMax delta | prefix diffing | emit suffix only once |
| Response -> UI | empty final content | trim check | show provider-specific empty-content error |
| Request -> UI | non-2xx response | status check | show provider-specific failure error |

### 5. Good / Base / Bad Cases

#### Good

- user configures DeepSeek and OpenAI separately, switches between them, and each provider retains its own key and model
- legacy DeepSeek-only doc loads into `providers.deepseek` and chat keeps working
- MiniMax stream returns cumulative content and UI appends only the new suffix

#### Base

- new install with no settings doc starts on DeepSeek defaults
- user changes theme only; provider configs remain untouched
- user changes active provider in settings but does not save; in-memory UI reflects the new active provider immediately

#### Bad

- blank `baseUrl` is silently replaced by the default URL during normalization
- provider switch overwrites the previously configured provider's API key
- MiniMax cumulative stream is appended as full values, causing duplicated text in the assistant message
- request layer throws generic `"请求失败"` without provider label or status code

### 6. Tests Required

Minimum required tests for this scenario:

1. legacy flat settings doc migrates into `providers.deepseek`
   - assert `activeProvider === 'deepseek'`
   - assert non-DeepSeek providers still use defaults
2. multi-provider settings round-trip through persistence
   - assert active provider and selected provider fields survive save/load
3. send flow validates active provider only
   - assert blank active-provider `baseUrl` / `model` blocks send and opens settings
4. send flow uses a normalized active-provider snapshot
   - assert request layer receives `ActiveProviderSettings`
5. DeepSeek reasoning content is stored separately from answer content
6. MiniMax cumulative reasoning/content are diffed into suffix deltas
7. models without temperature support do not use free temperature payloads
8. request failures include provider label and HTTP status

Current reference tests:

- `src/composables/useChatApp.spec.ts`
- `src/services/chatCompletion.spec.ts`
- `src/services/utools.spec.ts`

### 7. Wrong vs Correct

#### Wrong

```ts
return {
  apiKey: incoming.apiKey?.trim() ?? defaults.apiKey,
  baseUrl: incoming.baseUrl?.trim() || defaults.baseUrl,
  model: incoming.model?.trim() || defaults.model,
  temperature: defaults.temperature,
}
```

Why wrong:

- explicit blank values are overwritten
- send-time validation never sees the missing config
- user mistakes are hidden instead of surfaced

#### Correct

```ts
return {
  apiKey: incoming.apiKey?.trim() ?? defaults.apiKey,
  baseUrl: incoming.baseUrl === undefined ? defaults.baseUrl : incoming.baseUrl.trim(),
  model: incoming.model === undefined ? defaults.model : incoming.model.trim(),
  temperature: normalizeTemperature(provider, model, incoming.temperature),
}
```

#### Wrong

```ts
if (provider === 'minimax') {
  return delta.content ?? ''
}
```

Why wrong:

- MiniMax may send cumulative content
- UI duplicates previously rendered text

#### Correct

```ts
if (provider === 'minimax') {
  return nextValue.startsWith(currentValue)
    ? nextValue.slice(currentValue.length)
    : nextValue
}
```

### Design Decision: Registry-driven provider metadata

Context:

- provider defaults, UI labels, supported models, and temperature ranges must stay aligned

Decision:

- use `PROVIDER_REGISTRY` in `src/constants/providers.ts` as the single source of truth

Extension rule:

1. add a new `ProviderId`
2. add its registry entry
3. ensure `buildDefaultProviderSettingsMap()` seeds it
4. add request-layer behavior only if its payload or stream format differs
5. add migration / payload / parsing tests before exposing it in UI

