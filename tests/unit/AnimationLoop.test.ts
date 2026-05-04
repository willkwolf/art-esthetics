// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Type for mock tween instances returned by the factory
type MockTween = {
  _obj: object
  _group: object
  _active: boolean
  to: ReturnType<typeof vi.fn>
  easing: ReturnType<typeof vi.fn>
  onUpdate: ReturnType<typeof vi.fn>
  onComplete: ReturnType<typeof vi.fn>
  start: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
}

/** Helper: get the last mock tween instance created by the Tween constructor */
function getLastTween(TweenMock: ReturnType<typeof vi.fn>): MockTween | undefined {
  const results = TweenMock.mock.results
  return results[results.length - 1]?.value as MockTween | undefined
}

// Mock @tweenjs/tween.js
vi.mock('@tweenjs/tween.js', () => {
  // Track active tweens per group for Property 13 testing
  const activeTweens = new Map<object, Set<object>>()

  const mockTweenFactory = (obj: object, group: object) => {
    const tween: MockTween = {
      _obj: obj,
      _group: group,
      _active: false,
      to: vi.fn().mockReturnThis(),
      easing: vi.fn().mockReturnThis(),
      onUpdate: vi.fn().mockReturnThis(),
      onComplete: vi.fn().mockReturnThis(),
      start: vi.fn().mockImplementation(function (this: MockTween) {
        this._active = true
        if (!activeTweens.has(group)) activeTweens.set(group, new Set())
        activeTweens.get(group)!.add(this)
        return this
      }),
      stop: vi.fn().mockImplementation(function (this: MockTween) {
        this._active = false
        activeTweens.get(group)?.delete(this)
        return this
      }),
    }
    return tween
  }

  return {
    Tween: vi.fn((obj: object, group: object) => mockTweenFactory(obj, group)),
    Easing: { Cubic: { InOut: vi.fn() } },
    Group: vi.fn(() => ({
      update: vi.fn(),
      removeAll: vi.fn(),
    })),
    _activeTweens: activeTweens,
  }
})

import * as THREE from 'three'

describe('AnimationLoop', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // Provide a minimal requestAnimationFrame stub
    let rafId = 0
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafId++
      // Schedule callback asynchronously so tests can control timing
      setTimeout(() => cb(performance.now()), 0)
      return rafId
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  // ── 13.1: AnimationLoop with RAF and tween.js ──────────────────────────────

  it('13.1 start() begins the RAF loop and calls renderFn each frame', async () => {
    const { AnimationLoop } = await import('../../src/scene/AnimationLoop')
    const loop = new AnimationLoop()
    const renderFn = vi.fn()

    // Override RAF to fire once then stop the loop to avoid infinite recursion
    let callCount = 0
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      callCount++
      if (callCount === 1) {
        // Fire the callback once synchronously
        cb(performance.now())
      }
      return callCount
    })

    loop.start(renderFn)
    expect(loop.isRunning()).toBe(true)
    expect(renderFn).toHaveBeenCalled()

    loop.dispose()
  })

  it('13.1 start() is idempotent — calling twice does not create two loops', async () => {
    const { AnimationLoop } = await import('../../src/scene/AnimationLoop')
    const loop = new AnimationLoop()
    const renderFn = vi.fn()

    loop.start(renderFn)
    loop.start(renderFn) // second call should be a no-op

    expect(loop.isRunning()).toBe(true)
    loop.dispose()
  })

  it('13.1 stop() halts the RAF loop', async () => {
    const { AnimationLoop } = await import('../../src/scene/AnimationLoop')
    const loop = new AnimationLoop()
    const renderFn = vi.fn()

    loop.start(renderFn)
    loop.stop()

    expect(loop.isRunning()).toBe(false)
    expect(cancelAnimationFrame).toHaveBeenCalled()
  })

  it('13.1 stop() is safe to call when already stopped', async () => {
    const { AnimationLoop } = await import('../../src/scene/AnimationLoop')
    const loop = new AnimationLoop()

    expect(() => loop.stop()).not.toThrow()
  })

  // ── 13.2: tweenCamera with Cubic.InOut ────────────────────────────────────

  it('13.2 tweenCamera() creates a tween targeting the correct destination', async () => {
    const { AnimationLoop } = await import('../../src/scene/AnimationLoop')
    const { Tween } = await import('@tweenjs/tween.js')

    const loop = new AnimationLoop()
    const camera = new THREE.PerspectiveCamera()
    camera.position.set(0, 10, 20)
    const target = new THREE.Vector3(5, 0, 5)

    loop.tweenCamera(camera, target)

    // Tween constructor should have been called
    expect(Tween).toHaveBeenCalled()
    expect(loop.hasCameraTween()).toBe(true)

    loop.dispose()
  })

  it('13.2 tweenCamera() uses Cubic.InOut easing', async () => {
    const { AnimationLoop } = await import('../../src/scene/AnimationLoop')
    const { Easing } = await import('@tweenjs/tween.js')

    const loop = new AnimationLoop()
    const camera = new THREE.PerspectiveCamera()
    const target = new THREE.Vector3(0, 0, 0)

    loop.tweenCamera(camera, target)

    // The mock tween's .easing() should have been called with Cubic.InOut
    const { Tween } = await import('@tweenjs/tween.js')
    const mockTweenInstance = getLastTween(Tween as ReturnType<typeof vi.fn>)
    expect(mockTweenInstance?.easing).toHaveBeenCalledWith(Easing.Cubic.InOut)

    loop.dispose()
  })

  it('13.2 tweenCamera() uses ANIMATION_DURATION (800ms) by default', async () => {
    const { AnimationLoop } = await import('../../src/scene/AnimationLoop')
    const { Tween } = await import('@tweenjs/tween.js')

    const loop = new AnimationLoop()
    const camera = new THREE.PerspectiveCamera()
    const target = new THREE.Vector3(0, 0, 0)

    loop.tweenCamera(camera, target)

    const mockTweenInstance = getLastTween(Tween as ReturnType<typeof vi.fn>)
    // .to(dest, duration) — check duration argument
    expect(mockTweenInstance?.to).toHaveBeenCalledWith(expect.any(Object), 800)

    loop.dispose()
  })

  it('13.2 tweenCamera() accepts a custom duration', async () => {
    const { AnimationLoop } = await import('../../src/scene/AnimationLoop')
    const { Tween } = await import('@tweenjs/tween.js')

    const loop = new AnimationLoop()
    const camera = new THREE.PerspectiveCamera()
    const target = new THREE.Vector3(0, 0, 0)

    loop.tweenCamera(camera, target, 400)

    const mockTweenInstance = getLastTween(Tween as ReturnType<typeof vi.fn>)
    expect(mockTweenInstance?.to).toHaveBeenCalledWith(expect.any(Object), 400)

    loop.dispose()
  })

  // ── 13.3: No tween accumulation ───────────────────────────────────────────

  it('13.3 tweenCamera() cancels the previous camera tween before starting a new one', async () => {
    const { AnimationLoop } = await import('../../src/scene/AnimationLoop')
    const { Tween } = await import('@tweenjs/tween.js')

    const loop = new AnimationLoop()
    const camera = new THREE.PerspectiveCamera()
    camera.position.set(0, 10, 20)

    // First tween
    loop.tweenCamera(camera, new THREE.Vector3(1, 0, 1))
    const firstTween = getLastTween(Tween as ReturnType<typeof vi.fn>)
    expect(firstTween?._active).toBe(true)

    // Second tween — should stop the first
    loop.tweenCamera(camera, new THREE.Vector3(5, 0, 5))
    expect(firstTween?.stop).toHaveBeenCalled()
    expect(firstTween?._active).toBe(false)

    // New tween should be active
    expect(loop.hasCameraTween()).toBe(true)

    loop.dispose()
  })

  it('13.3 calling tweenCamera() N times results in exactly one active camera tween', async () => {
    const { AnimationLoop } = await import('../../src/scene/AnimationLoop')
    const { Tween } = await import('@tweenjs/tween.js')

    const loop = new AnimationLoop()
    const camera = new THREE.PerspectiveCamera()

    const targets = [
      new THREE.Vector3(1, 0, 1),
      new THREE.Vector3(2, 0, 2),
      new THREE.Vector3(3, 0, 3),
      new THREE.Vector3(4, 0, 4),
    ]

    const tweenInstances: MockTween[] = []

    for (const target of targets) {
      loop.tweenCamera(camera, target)
      const t = getLastTween(Tween as ReturnType<typeof vi.fn>)
      if (t) tweenInstances.push(t)
    }

    // Only the last tween should be active
    const activeTweens = tweenInstances.filter(t => t._active)
    expect(activeTweens).toHaveLength(1)
    expect(activeTweens[0]).toBe(tweenInstances[tweenInstances.length - 1])

    loop.dispose()
  })

  // ── 13.4: Integration — dispose cleans up everything ──────────────────────

  it('13.4 dispose() stops the RAF loop and cancels active tweens', async () => {
    const { AnimationLoop } = await import('../../src/scene/AnimationLoop')

    const loop = new AnimationLoop()
    const camera = new THREE.PerspectiveCamera()
    const renderFn = vi.fn()

    loop.start(renderFn)
    loop.tweenCamera(camera, new THREE.Vector3(5, 0, 5))

    expect(loop.isRunning()).toBe(true)
    expect(loop.hasCameraTween()).toBe(true)

    loop.dispose()

    expect(loop.isRunning()).toBe(false)
    expect(loop.hasCameraTween()).toBe(false)
  })
})

// ── Property 13: No tween accumulation (property-based style) ─────────────

describe('Property 13: No tween accumulation in AnimationLoop', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    let rafId = 0
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafId++
      setTimeout(() => cb(performance.now()), 0)
      return rafId
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  /**
   * Property 13: For any sequence of tweenCamera() calls, at most one camera
   * tween is active at any point in time.
   *
   * Validates: Requirements 11.3, 6.7
   */
  it('at most one camera tween is active after any sequence of tweenCamera calls', async () => {
    const { AnimationLoop } = await import('../../src/scene/AnimationLoop')
    const { Tween } = await import('@tweenjs/tween.js')

    const loop = new AnimationLoop()
    const camera = new THREE.PerspectiveCamera()

    // Simulate a sequence of rapid camera target changes (e.g., user clicking islands quickly)
    const sequence = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(10, 0, 10),
      new THREE.Vector3(-5, 0, 3),
      new THREE.Vector3(7, 0, -2),
      new THREE.Vector3(1, 0, 1),
    ]

    const allTweens: MockTween[] = []

    for (const target of sequence) {
      loop.tweenCamera(camera, target)
      const t = getLastTween(Tween as ReturnType<typeof vi.fn>)
      if (t) allTweens.push(t)
    }

    // Count active tweens — must be exactly 1
    const activeTweens = allTweens.filter(t => t._active)
    expect(activeTweens).toHaveLength(1)

    // All previous tweens must have been stopped
    for (let i = 0; i < allTweens.length - 1; i++) {
      expect(allTweens[i].stop).toHaveBeenCalled()
      expect(allTweens[i]._active).toBe(false)
    }

    loop.dispose()
  })
})
