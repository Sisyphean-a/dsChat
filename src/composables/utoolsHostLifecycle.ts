import { ref, type Ref } from 'vue'
import type { PluginEnterPayload } from '../types/utools'

export interface UtoolsHostLifecycleOptions {
  isReady: () => boolean
  onEnter: (payload: PluginEnterPayload) => Promise<void> | void
  onOut: () => Promise<void> | void
}

export interface UtoolsHostLifecycle {
  enterSignal: Ref<number>
  flushPendingEnter: () => Promise<void>
  register: () => void
}

/**
 * Flow: 进入插件先恢复上次会话再套用划词草稿；离开插件交给 onOut 收尾。
 * Rule: 只注册一次宿主回调；初始化完成前收到的进入事件先缓存，由 flushPendingEnter 补发。
 * Guarantee: 初始化前缓存的进入事件不发 enterSignal，只有就绪后的进入事件才通知界面聚焦。
 */
export function createUtoolsHostLifecycle(options: UtoolsHostLifecycleOptions): UtoolsHostLifecycle {
  const enterSignal = ref(0)
  let registered = false
  let pendingPayload: PluginEnterPayload | null = null

  return {
    enterSignal,
    async flushPendingEnter(): Promise<void> {
      const payload = pendingPayload
      pendingPayload = null
      if (payload) {
        await options.onEnter(payload)
      }
    },
    register(): void {
      if (registered) {
        return
      }

      const utools = window.utools
      if (!utools?.onPluginEnter) {
        return
      }

      registered = true
      utools.onPluginEnter(async (payload) => {
        if (!options.isReady()) {
          pendingPayload = payload
          return
        }

        try {
          await options.onEnter(payload)
        } finally {
          enterSignal.value += 1
        }
      })

      utools.onPluginOut(async () => {
        await options.onOut()
      })
    },
  }
}
