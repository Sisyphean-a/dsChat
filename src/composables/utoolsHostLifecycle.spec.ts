import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PluginEnterPayload } from '../types/utools'
import { createUtoolsHostLifecycle } from './utoolsHostLifecycle'

type EnterHandler = (payload: PluginEnterPayload) => void | Promise<void>

describe('createUtoolsHostLifecycle', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does nothing when the uTools host is unavailable', () => {
    vi.stubGlobal('window', {})

    const lifecycle = createUtoolsHostLifecycle({
      isReady: () => true,
      onEnter: vi.fn(),
      onOut: vi.fn(),
    })

    expect(() => lifecycle.register()).not.toThrow()
    expect(lifecycle.enterSignal.value).toBe(0)
  })

  it('runs onEnter for later entries and notifies the composer', async () => {
    const host = installHost()
    const onEnter = vi.fn()
    const lifecycle = createUtoolsHostLifecycle({
      isReady: () => true,
      onEnter,
      onOut: vi.fn(),
    })
    lifecycle.register()

    await host.enter({ code: 'ask-ds', payload: 'text' })

    expect(onEnter).toHaveBeenCalledTimes(1)
    expect(lifecycle.enterSignal.value).toBe(1)
  })

  it('defers entries that arrive before the app is ready', async () => {
    const host = installHost()
    const onEnter = vi.fn()
    let ready = false
    const lifecycle = createUtoolsHostLifecycle({
      isReady: () => ready,
      onEnter,
      onOut: vi.fn(),
    })
    lifecycle.register()

    await host.enter({ code: 'ask-ds', payload: '第一次' })
    expect(onEnter).not.toHaveBeenCalled()

    ready = true
    await lifecycle.flushPendingEnter()

    expect(onEnter).toHaveBeenCalledTimes(1)
    expect(onEnter).toHaveBeenCalledWith({ code: 'ask-ds', payload: '第一次' })
    expect(lifecycle.enterSignal.value).toBe(0)

    await lifecycle.flushPendingEnter()
    expect(onEnter).toHaveBeenCalledTimes(1)
  })

  it('registers host callbacks once and forwards plugin exit', async () => {
    const host = installHost()
    const onOut = vi.fn()
    const lifecycle = createUtoolsHostLifecycle({
      isReady: () => true,
      onEnter: vi.fn(),
      onOut,
    })

    lifecycle.register()
    lifecycle.register()

    expect(host.onPluginEnter).toHaveBeenCalledTimes(1)
    await host.exit()

    expect(onOut).toHaveBeenCalledTimes(1)
  })
})

function installHost() {
  let enterHandler: EnterHandler | undefined
  let outHandler: (() => void | Promise<void>) | undefined
  const onPluginEnter = vi.fn((callback: EnterHandler) => {
    enterHandler = callback
  })
  const onPluginOut = vi.fn((callback: () => void | Promise<void>) => {
    outHandler = callback
  })

  vi.stubGlobal('window', {
    utools: { onPluginEnter, onPluginOut },
  })

  return {
    onPluginEnter,
    async enter(payload: PluginEnterPayload) {
      await enterHandler?.(payload)
    },
    async exit() {
      await outHandler?.()
    },
  }
}
