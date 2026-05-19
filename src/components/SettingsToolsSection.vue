<script setup lang="ts">
import { openExternalLink } from '../services/linkNavigation'
import type { SettingsForm } from '../types/chat'

const props = defineProps<{
  settings: SettingsForm
}>()

const emit = defineEmits<{
  updateBuiltinToolEnabled: [tool: 'currentTime' | 'tavilySearch', enabled: boolean]
  updateBuiltinToolTavilyApiKey: [apiKey: string]
  updateBuiltinToolTavilyBaseUrl: [baseUrl: string]
  updateToolEnabled: [enabled: boolean]
  updateToolOpenAiNativeSearch: [enabled: boolean]
}>()

function openTavilyOfficialSite(): void {
  openExternalLink('https://www.tavily.com')
}
</script>

<template>
  <section class="settings-page" aria-labelledby="settings-tools-title">
    <header class="page-heading">
      <p class="eyebrow">Tools</p>
      <h3 id="settings-tools-title">工具</h3>
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
        </div>
      </article>

      <article class="setting-card wide-card">
        <div class="setting-card-head">
          <div>
            <h4>内置工具</h4>
          </div>
        </div>
        <div class="builtin-tool-list">
          <section class="builtin-tool-item">
            <div class="builtin-tool-row">
              <p class="builtin-tool-meta">
                <span class="builtin-tool-name">get_current_time</span>
                <span class="builtin-tool-desc">用来获取当前的日期时间</span>
              </p>
              <label class="switch-row">
                <input
                  :checked="props.settings.toolSettings.builtinTools.currentTime.enabled"
                  type="checkbox"
                  @change="emit('updateBuiltinToolEnabled', 'currentTime', ($event.target as HTMLInputElement).checked)"
                />
                <span>启用</span>
              </label>
            </div>
          </section>

          <section class="builtin-tool-item">
            <div class="builtin-tool-row">
              <p class="builtin-tool-meta">
                <span class="builtin-tool-name">tavily_search</span>
                <span class="builtin-tool-desc">用来联网查询，需要配置密钥</span>
              </p>
              <div class="builtin-tool-actions">
                <a
                  class="tool-official-link"
                  href="https://www.tavily.com"
                  rel="noreferrer noopener"
                  @click.prevent="openTavilyOfficialSite"
                >
                  官网
                </a>
                <label class="switch-row">
                  <input
                    :checked="props.settings.toolSettings.builtinTools.tavilySearch.enabled"
                    type="checkbox"
                    @change="emit('updateBuiltinToolEnabled', 'tavilySearch', ($event.target as HTMLInputElement).checked)"
                  />
                  <span>启用</span>
                </label>
              </div>
            </div>
            <div class="builtin-tool-fields">
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

    </div>
  </section>
</template>
