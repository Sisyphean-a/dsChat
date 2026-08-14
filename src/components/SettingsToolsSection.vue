<script setup lang="ts">
import { openExternalLink } from '../services/linkNavigation'
import type { SettingsForm } from '../types/chat'
import type { SettingsEdit } from '../types/settingsPanel'

const props = defineProps<{
  settings: SettingsForm
}>()

const emit = defineEmits<{
  edit: [edit: SettingsEdit]
}>()

function openTavilyOfficialSite(): void {
  openExternalLink('https://www.tavily.com')
}

function openQwenOfficialSite(): void {
  openExternalLink('https://help.aliyun.com/zh/model-studio/user-guide/qwen3-vl')
}
</script>

<template>
  <section class="settings-page" aria-labelledby="settings-tools-title">
    <header class="page-heading">
      <p class="eyebrow">调用能力</p>
      <h3 id="settings-tools-title">工具</h3>
    </header>

    <div class="settings-grid">
      <article class="setting-card wide-card">
        <div class="setting-card-head split-head">
          <div>
            <h4>工具调用总开关</h4>
          </div>
          <label class="switch-row emphasized-switch">
            <input
              :checked="props.settings.toolSettings.enabled"
              type="checkbox"
              @change="emit('edit', { domain: 'tools', action: 'toggle', enabled: ($event.target as HTMLInputElement).checked })"
            />
            <span>启用</span>
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
                  @change="emit('edit', { domain: 'tools', action: 'toggleBuiltin', tool: 'currentTime', enabled: ($event.target as HTMLInputElement).checked })"
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
                    @change="emit('edit', { domain: 'tools', action: 'toggleBuiltin', tool: 'tavilySearch', enabled: ($event.target as HTMLInputElement).checked })"
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
                  @input="emit('edit', { domain: 'tools', action: 'updateTavilyBaseUrl', value: ($event.target as HTMLInputElement).value })"
                />
              </label>
              <label class="field-shell">
                <span>API Key</span>
                <input
                  :value="props.settings.toolSettings.builtinTools.tavilySearch.apiKey"
                  placeholder="tvly-..."
                  type="password"
                  @input="emit('edit', { domain: 'tools', action: 'updateTavilyApiKey', value: ($event.target as HTMLInputElement).value })"
                />
              </label>
            </div>
          </section>

          <section class="builtin-tool-item">
            <div class="builtin-tool-row">
              <p class="builtin-tool-meta">
                <span class="builtin-tool-name">qwen_image</span>
                <span class="builtin-tool-desc">使用阿里云 Qwen 视觉模型识别、提取和分析图片；基础地址填写到 compatible-mode/v1，应用会自动追加 chat/completions</span>
              </p>
              <div class="builtin-tool-actions">
                <a
                  class="tool-official-link"
                  href="https://help.aliyun.com/zh/model-studio/user-guide/qwen3-vl"
                  rel="noreferrer noopener"
                  @click.prevent="openQwenOfficialSite"
                >
                  文档
                </a>
                <label class="switch-row">
                  <input
                    :checked="props.settings.toolSettings.builtinTools.qwenImage.enabled"
                    type="checkbox"
                    @change="emit('edit', { domain: 'tools', action: 'toggleBuiltin', tool: 'qwenImage', enabled: ($event.target as HTMLInputElement).checked })"
                  />
                  <span>启用</span>
                </label>
              </div>
            </div>
            <div class="builtin-tool-fields">
              <label class="field-shell">
                <span>基础地址</span>
                <input
                  :value="props.settings.toolSettings.builtinTools.qwenImage.baseUrl"
                  placeholder="https://{WorkspaceId}.cn-beijing.maas.aliyuncs.com/compatible-mode/v1"
                  type="text"
                  @input="emit('edit', { domain: 'tools', action: 'updateQwenImageBaseUrl', value: ($event.target as HTMLInputElement).value })"
                />
              </label>
              <label class="field-shell">
                <span>模型</span>
                <input
                  :value="props.settings.toolSettings.builtinTools.qwenImage.model"
                  placeholder="qwen3-vl-flash"
                  type="text"
                  @input="emit('edit', { domain: 'tools', action: 'updateQwenImageModel', value: ($event.target as HTMLInputElement).value })"
                />
              </label>
              <label class="field-shell">
                <span>API Key</span>
                <input
                  :value="props.settings.toolSettings.builtinTools.qwenImage.apiKey"
                  placeholder="DashScope API Key"
                  type="password"
                  @input="emit('edit', { domain: 'tools', action: 'updateQwenImageApiKey', value: ($event.target as HTMLInputElement).value })"
                />
              </label>
            </div>
          </section>
        </div>
      </article>

    </div>
  </section>
</template>
