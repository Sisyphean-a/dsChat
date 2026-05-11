<script setup lang="ts">
import type { CustomToolSettings, SettingsForm } from '../types/chat'
import type { CustomToolEditableField } from '../types/settingsPanel'

const props = defineProps<{
  settings: SettingsForm
}>()

const emit = defineEmits<{
  addCustomTool: []
  removeCustomTool: [id: string]
  updateBuiltinToolEnabled: [tool: 'currentTime' | 'tavilySearch', enabled: boolean]
  updateBuiltinToolTavilyApiKey: [apiKey: string]
  updateBuiltinToolTavilyBaseUrl: [baseUrl: string]
  updateCustomToolField: [
    id: string,
    field: CustomToolEditableField,
    value: string | boolean | CustomToolSettings['headers'],
  ]
  updateToolEnabled: [enabled: boolean]
  updateToolMaxRounds: [maxToolRounds: number]
  updateToolOpenAiNativeSearch: [enabled: boolean]
}>()
</script>

<template>
  <section class="settings-page" aria-labelledby="settings-tools-title">
    <header class="page-heading">
      <p class="eyebrow">Tools</p>
      <h3 id="settings-tools-title">工具</h3>
      <p>工具调用只保留执行相关选项，内置工具和自定义工具分层展示。</p>
    </header>

    <div class="settings-grid">
      <article class="setting-card wide-card">
        <div class="setting-card-head split-head">
          <div>
            <h4>工具调用</h4>
            <p>总开关关闭时，模型只进行普通对话。</p>
          </div>
          <label class="switch-row emphasized-switch">
            <input
              :checked="props.settings.toolSettings.enabled"
              type="checkbox"
              @change="emit('updateToolEnabled', ($event.target as HTMLInputElement).checked)"
            />
            <span>启用</span>
          </label>
        </div>
        <div class="tool-preferences">
          <label class="switch-row">
            <input
              :checked="props.settings.toolSettings.openaiUseNativeWebSearch"
              type="checkbox"
              @change="emit('updateToolOpenAiNativeSearch', ($event.target as HTMLInputElement).checked)"
            />
            <span>OpenAI 使用原生 web_search，避免与工具编排冲突</span>
          </label>
          <label class="rounds-control">
            <span>最大轮数</span>
            <input
              :value="props.settings.toolSettings.maxToolRounds"
              min="1"
              max="10"
              step="1"
              type="number"
              @change="emit('updateToolMaxRounds', Number(($event.target as HTMLInputElement).value))"
            />
          </label>
        </div>
      </article>

      <article class="setting-card wide-card">
        <div class="setting-card-head">
          <div>
            <h4>内置工具</h4>
            <p>高频工具直接暴露，复杂配置收进对应工具卡片。</p>
          </div>
        </div>
        <div class="builtin-tool-grid">
          <section class="tool-card compact-tool-card">
            <div>
              <h5>当前时间</h5>
              <p>get_current_time</p>
            </div>
            <label class="switch-row">
              <input
                :checked="props.settings.toolSettings.builtinTools.currentTime.enabled"
                type="checkbox"
                @change="emit('updateBuiltinToolEnabled', 'currentTime', ($event.target as HTMLInputElement).checked)"
              />
              <span>启用</span>
            </label>
          </section>

          <section class="tool-card tavily-tool-card">
            <div class="tool-card-head">
              <div>
                <h5>Tavily 搜索</h5>
                <p>tavily_search</p>
              </div>
              <label class="switch-row">
                <input
                  :checked="props.settings.toolSettings.builtinTools.tavilySearch.enabled"
                  type="checkbox"
                  @change="emit('updateBuiltinToolEnabled', 'tavilySearch', ($event.target as HTMLInputElement).checked)"
                />
                <span>启用</span>
              </label>
            </div>
            <div class="field-grid two-field-grid">
              <label class="field-shell">
                <span>服务地址</span>
                <input
                  :value="props.settings.toolSettings.builtinTools.tavilySearch.baseUrl"
                  placeholder="Tavily 后端地址"
                  type="text"
                  @input="emit('updateBuiltinToolTavilyBaseUrl', ($event.target as HTMLInputElement).value)"
                />
              </label>
              <label class="field-shell">
                <span>API Key</span>
                <input
                  :value="props.settings.toolSettings.builtinTools.tavilySearch.apiKey"
                  placeholder="tvly-..."
                  type="password"
                  @input="emit('updateBuiltinToolTavilyApiKey', ($event.target as HTMLInputElement).value)"
                />
              </label>
            </div>
          </section>
        </div>
      </article>

      <article class="setting-card wide-card">
        <div class="setting-card-head split-head">
          <div>
            <h4>自定义工具</h4>
            <p>预配置入口先放这里，执行引擎接入后再展开高级能力。</p>
          </div>
          <button class="ghost-action" type="button" @click="emit('addCustomTool')">新增</button>
        </div>

        <div v-if="!props.settings.toolSettings.customTools.length" class="empty-card">
          暂无自定义工具，保持默认即可。
        </div>

        <div
          v-for="item in props.settings.toolSettings.customTools"
          :key="item.id"
          class="custom-tool-card"
        >
          <div class="provider-head">
            <label class="provider-title-field">
              <span>工具名称</span>
              <input
                class="provider-name-input"
                :value="item.name"
                placeholder="工具名称"
                type="text"
                @input="emit('updateCustomToolField', item.id, 'name', ($event.target as HTMLInputElement).value)"
              />
            </label>
            <button class="danger-text" type="button" @click="emit('removeCustomTool', item.id)">删除</button>
          </div>
          <label class="switch-row">
            <input
              :checked="item.enabled"
              type="checkbox"
              @change="emit('updateCustomToolField', item.id, 'enabled', ($event.target as HTMLInputElement).checked)"
            />
            <span>启用</span>
          </label>
          <div class="field-grid custom-tool-grid">
            <label class="field-shell custom-tool-description">
              <span>描述</span>
              <input
                :value="item.description"
                placeholder="给模型看的工具能力说明"
                type="text"
                @input="emit('updateCustomToolField', item.id, 'description', ($event.target as HTMLInputElement).value)"
              />
            </label>
            <label class="field-shell">
              <span>方法</span>
              <select
                :value="item.method"
                @change="emit('updateCustomToolField', item.id, 'method', ($event.target as HTMLSelectElement).value)"
              >
                <option value="POST">POST</option>
                <option value="GET">GET</option>
              </select>
            </label>
            <label class="field-shell custom-tool-url">
              <span>Endpoint</span>
              <input
                :value="item.url"
                placeholder="https://example.com/tool-endpoint"
                type="text"
                @input="emit('updateCustomToolField', item.id, 'url', ($event.target as HTMLInputElement).value)"
              />
            </label>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>
