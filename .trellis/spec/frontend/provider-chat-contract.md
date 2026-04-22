# DeepSeek-First Settings And Added Models Contract

> Executable contract for the `settings -> normalization -> migration -> request -> UI` flow.

---

## Scenario: DeepSeek built-in settings plus added model presets

### 1. Scope / Trigger

- Trigger: settings are no longer modeled as one tab per provider.
- Trigger: the app now keeps one built-in `DeepSeek` config and a list of user-created added models.
- Trigger: previous flat DeepSeek docs and the intermediate multi-provider docs must both migrate into the new structure.

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
type ProviderId = 'deepseek' | 'openai' | 'minimax' | 'kimi' | 'custom'
type AddableProviderId = 'openai' | 'minimax' | 'kimi' | 'custom'

interface ProviderSettings {
  apiKey: string
  baseUrl: string
  model: string
  temperature: number
}

interface AddedModelConfig extends ProviderSettings {
  id: string
  name: string
  provider: AddableProviderId
}

interface SettingsForm {
  activeConfigId: string
  deepseek: ProviderSettings
  customModels: AddedModelConfig[]
  theme: ThemeMode
}

interface ActiveProviderSettings extends ProviderSettings {
  configId: string
  label: string
  provider: ProviderId
}
```

#### Registry / normalization

```ts
buildDefaultSettings(): SettingsForm
buildDefaultProviderSettings(provider: ProviderId): ProviderSettings
createAddedModelDraft(provider: AddableProviderId, currentModels: AddedModelConfig[]): AddedModelConfig
normalizeSettings(settings: SettingsForm): SettingsForm
getActiveProviderSettings(settings: SettingsForm): ActiveProviderSettings
getSendSettingsError(settings: SettingsForm): string | null
getModelConfigOptions(settings: SettingsForm): ModelConfigOption[]
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
requestChatCompletion(messages: ChatMessage[], settings: ActiveProviderSettings): Promise<string>
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

- `activeConfigId = 'deepseek'`
- `theme = 'light'`
- one built-in `deepseek` config seeded from registry defaults
- `customModels = []`

Required invariant:

- DeepSeek always exists even when there are zero added models
- deleting an added model that is currently active must fall back to `deepseek`

#### Contract B: Legacy migration

Supported legacy shapes:

1. flat DeepSeek-only doc
2. previous multi-provider doc with `activeProvider` + `providers`

Migration rules:

1. flat docs map into `deepseek`
2. previous multi-provider docs map `providers.deepseek` into `deepseek`
3. previous `openai / minimax / kimi` entries become `customModels` only when they are meaningfully configured
4. previous `claude` entries are dropped
5. `activeConfigId` resolves to the migrated custom model when possible, otherwise `deepseek`

Required non-fallback:

- do not create added models just because an old doc stored untouched registry defaults

#### Contract C: Normalization boundary

`normalizeSettings()` is the only place allowed to coerce:

- invalid or missing `activeConfigId` -> `'deepseek'`
- malformed `customModels` -> filtered normalized array
- invalid theme -> default theme
- invalid temperature -> provider default temperature

Required non-coercion:

- explicit blank `baseUrl` must stay blank
- explicit blank `model` must stay blank

Reason:

- send-time validation must surface missing configuration instead of hiding it

#### Contract D: Send-time validation

`getSendSettingsError()` validates only the active config.

Required checks:

1. missing `apiKey` -> `"请先在设置面板中填写 <Label> API Key。"`
2. missing `baseUrl` -> `"请先在设置面板中填写 <Label> Base URL。"`
3. missing `model` -> `"请先在设置面板中选择 <Label> 模型。"`

The send flow in `useChatApp()` must:

1. normalize settings
2. compute `ActiveProviderSettings`
3. validate
4. stop send and open settings when validation fails

#### Contract E: Added models UI

Settings UI is split into exactly three pages:

1. `基础设置`
2. `DeepSeek`
3. `新增模型`

`基础设置` must allow:

- selecting the active config from `deepseek + customModels`
- switching theme

`DeepSeek` must allow:

- editing only `Base URL / API Key / 模型`

`新增模型` must allow:

- creating entries from presets `OpenAI / MiniMax / Kimi / 自定义`
- editing `名称 / Base URL / API Key / 模型`
- deleting added models

Required non-goal:

- no `Claude` page or preset
- no runtime “同步模型” flow

#### Contract F: Chat completions endpoint

All providers currently use:

```ts
POST <baseUrl>/chat/completions
Authorization: Bearer <apiKey>
Content-Type: application/json
```

Conditional payload fields:

- include `temperature` only when `modelSupportsTemperature(provider, model)` is `true`
- include `reasoning_split: true` only for `provider === 'minimax'`

#### Contract G: Streaming delta parsing

DeepSeek path:

- answer chunks come from `choices[0].delta.content`
- reasoning chunks come from `choices[0].delta.reasoning_content`

MiniMax path:

- answer chunks may be cumulative in `choices[0].delta.content`
- reasoning chunks may be cumulative in `choices[0].delta.reasoning_details[].text`
- parser must emit only the suffix delta

Generic path:

- `openai / kimi / custom` use `choices[0].delta.content`

Terminal rules:

- `[DONE]` ends the stream
- empty final content must throw `"<Label> 未返回可用内容。"`
- non-2xx response must throw `"<Label> 请求失败：<status> <statusText>"`

### 4. Validation & Error Matrix

| Boundary | Input | Validation | Required behavior |
|---------|------|------------|-------------------|
| Storage -> UI | no settings doc | defaults | return built-in DeepSeek |
| Storage -> UI | flat legacy doc | migrate | deepseek receives legacy values |
| Storage -> UI | previous multi-provider doc | migrate | deepseek + meaningful custom models |
| UI -> normalized state | deleted active custom model | config id resolution | fallback to `deepseek` |
| UI -> send | blank active `apiKey/baseUrl/model` | active config only | open settings and block request |
| Active settings -> request payload | MiniMax active | provider switch | add `reasoning_split: true` |
| Response -> stream parser | MiniMax cumulative delta | prefix diffing | append suffix once |
| Response -> UI | empty final content | trim check | show label-specific error |

### 5. Good / Base / Bad Cases

#### Good

- user keeps DeepSeek as default and adds one OpenAI preset entry for occasional use
- user deletes the currently active added model and the app falls back to DeepSeek
- old multi-provider docs migrate OpenAI and MiniMax into added models while dropping Claude

#### Base

- new install starts with only DeepSeek configured
- user adds a Kimi preset and edits only `API Key`
- user changes theme without touching model configs

#### Bad

- deleting an added model leaves `activeConfigId` pointing at a missing id
- old untouched preset defaults are all migrated into visible added models
- request errors still say `"DeepSeek 请求失败"` even when the active config label is custom

### 6. Tests Required

Minimum required automated coverage:

1. flat legacy doc migrates into `deepseek`
2. previous multi-provider doc migrates into `deepseek + customModels`
3. active custom config with blank base URL blocks send and opens settings
4. active custom config is normalized before request dispatch
5. DeepSeek reasoning content is stored separately from final content
6. MiniMax cumulative content is diffed into suffix deltas
7. deleting the active added model falls back to `deepseek`
8. build and tests pass after changing settings structure

### 7. Wrong vs Correct

#### Wrong

```ts
return {
  activeConfigId: incoming.activeConfigId ?? firstCustomId,
  customModels: incoming.customModels ?? [],
}
```

Why wrong:

- can leave `activeConfigId` pointing to a removed config

#### Correct

```ts
return {
  activeConfigId: customModels.some((item) => item.id === incoming.activeConfigId)
    ? incoming.activeConfigId
    : 'deepseek',
  customModels,
}
```

#### Wrong

```ts
if (legacy.providers?.kimi) {
  customModels.push(createAddedModelDraft('kimi', []))
}
```

Why wrong:

- migrates untouched preset defaults into visible noise

#### Correct

```ts
if (isMeaningfulProviderSettings('kimi', legacy.providers?.kimi ?? {})) {
  customModels.push(toLegacyCustomModel('kimi', legacy.providers?.kimi))
}
```

### Design Decision: Provider becomes preset metadata

Context:

- the user-facing settings IA is no longer “switch provider and edit everything inside one page”

Decision:

- keep provider metadata only as preset definitions and request behavior
- use `activeConfigId` as the runtime selection key

Extension rule:

1. new vendor presets must be added as `AddableProviderId`
2. built-in `deepseek` remains singular and cannot be deleted
3. only add a new preset when it can be represented by `Base URL / API Key / 模型`
