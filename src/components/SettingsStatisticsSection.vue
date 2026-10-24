<script setup lang="ts">
import { computed } from 'vue'
import type { UsageStatistics } from '../services/usageStatistics'

const props = defineProps<{ statistics?: UsageStatistics | null; error?: string | null }>()
const totals = computed(() => props.statistics?.deepseek)
const tools = computed(() => Object.entries(props.statistics?.tools ?? {}).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])))
const toolCount = computed(() => tools.value.reduce((sum, [, count]) => sum + count, 0))
const format = (value: number) => value.toLocaleString('zh-CN')
const metrics = computed(() => totals.value ? [
  { label: 'API 请求', value: totals.value.requests, unit: '次' },
  { label: '输入', value: totals.value.inputTokens, unit: 'Token' },
  { label: '输出', value: totals.value.outputTokens, unit: 'Token' },
  { label: '缓存命中', value: totals.value.cacheHitTokens, unit: 'Token' },
  { label: '缓存未命中', value: totals.value.cacheMissTokens, unit: 'Token' },
] : [])
</script>

<template>
  <section class="settings-page" aria-labelledby="settings-statistics-title">
    <header class="page-heading">
      <h3 id="settings-statistics-title">统计</h3>
    </header>
    <p v-if="props.error" class="settings-save-error" role="alert">{{ props.error }}</p>
    <p v-if="!props.statistics" class="field-hint">{{ props.error ? '统计暂不可用' : '正在读取统计…' }}</p>
    <div v-else class="settings-grid">
      <article class="setting-card wide-card">
        <div class="setting-card-head"><h4>DeepSeek 使用量</h4></div>
        <dl class="usage-metrics">
          <div v-for="metric in metrics" :key="metric.label">
            <dt>{{ metric.label }}</dt>
            <dd>{{ format(metric.value) }} <small>{{ metric.unit }}</small></dd>
          </div>
        </dl>
        <p v-if="totals && totals.requests > totals.usageReports" class="field-hint">
          {{ format(totals.requests - totals.usageReports) }} 次请求未返回用量，未计入 Token。
        </p>
        <p v-if="totals && totals.usageReports > totals.cacheReports" class="field-hint">
          {{ format(totals.usageReports - totals.cacheReports) }} 次用量缺少缓存明细。
        </p>
      </article>
      <article class="setting-card wide-card">
        <div class="setting-card-head split-head">
          <h4>工具调用</h4><span>{{ format(toolCount) }} 次</span>
        </div>
        <p v-if="!tools.length" class="field-hint">暂无工具调用</p>
        <table v-else class="usage-tools">
          <thead><tr><th scope="col">工具</th><th scope="col">调用次数</th></tr></thead>
          <tbody>
            <tr v-for="[name, count] in tools" :key="name">
              <th scope="row">{{ name }}</th><td>{{ format(count) }}</td>
            </tr>
          </tbody>
        </table>
      </article>
      <p class="field-hint wide-card usage-note">
        本机累计 · 自 {{ new Date(props.statistics.since).toLocaleDateString('zh-CN') }} 起。含标题和工具轮次；缓存是输入的一部分。工具按实际执行计次，含失败和停止，不等于计费次数。
      </p>
    </div>
  </section>
</template>

<style scoped>
.usage-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 20px 16px;
  margin: 0;
}
.usage-metrics dt { color: var(--text-muted); font-size: 12px; }
.usage-metrics dd { margin: 6px 0 0; font-size: 22px; font-weight: 600; font-variant-numeric: tabular-nums; }
.usage-metrics small { font-size: 11px; font-weight: 400; color: var(--text-muted); }
.usage-tools { width: 100%; border-collapse: collapse; font-size: 13px; }
.usage-tools th, .usage-tools td { text-align: left; padding: 9px 0; overflow-wrap: anywhere; }
.usage-tools thead { color: var(--text-muted); }
.usage-tools tbody th { font-weight: 400; }
.usage-tools th:last-child, .usage-tools td:last-child { text-align: right; font-variant-numeric: tabular-nums; }
.field-hint { color: var(--text-muted); font-size: 12px; line-height: 1.6; }
.usage-note { margin: 0; }
</style>
