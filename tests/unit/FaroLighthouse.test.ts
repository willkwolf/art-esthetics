// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import type { Faro } from '../../src/types'

// Mock @tweenjs/tween.js
vi.mock('@tweenjs/tween.js', () => {
  // Track active tweens per group for property testing
  const activeTweens = new Map<object, Set<object>>()

  const mockTweenInstance = (group: object) => {
    const tween: Record<string, unknown> = {
      _active: true,
      to: vi.fn().mockReturnThis(),
      easing: vi.fn().mockReturnThis(),
      onUpdate: vi.fn().mockReturnThis(),
      onComplete: vi.fn().mockReturnThis(),
      start: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
        if (!activeTweens.has(group)) activeTweens.set(group, new Set())
        activeTweens.get(group)!.add(this)
        return this
      }),
      stop: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
        this._active = false
        activeTweens.get(group)?.delete(this)
        return this
      }),
    }
    return tween
  }

  return {
    Tween: vi.fn().mockImplementation((_obj: unknown, group: object) => mockTweenInstance(group)),
    Easing: { Cubic: { InOut: vi.fn() } },
    Group: vi.fn().mockImplementation(() => ({
      update: vi.fn(),
      removeAll: vi.fn(),
    })),
  }
})

function makeFaro(id: string): Faro {
  return {
    id,
    label: id,
    hindex: 10,
    boost: { Formalismo: 1.5 },
    afinidad: { Europa: 0.9 },
  }
}

// ---------------------------------------------------------------------------
// Property 13: No tween accumulation
// Validates: Requirements 6.3, 11.3
// ---------------------------------------------------------------------------

describe('Property 13: No tween accumulation — at most 1 active tween at any time', () => {
  it('calling moveTo multiple times results in at most 1 active tween', async () => {
    const { FaroLighthouse } = await import('../../src/entities/FaroLighthouse')
    const { Group: TweenGroup } = await import('@tweenjs/tween.js')
    const THREE = await import('three')

    const tweenGroup = new TweenGroup()
    const lighthouse = new FaroLighthouse(tweenGroup)
    const faro = makeFaro('faro-1')
    const startPos = new THREE.Vector3(0, 0, 0)
    lighthouse.build(faro, startPos)

    // Call moveTo multiple times in sequence
    lighthouse.moveTo(new THREE.Vector3(1, 0, 0))
    const tween1 = lighthouse.getCurrentTween()

    lighthouse.moveTo(new THREE.Vector3(2, 0, 0))
    const tween2 = lighthouse.getCurrentTween()

    lighthouse.moveTo(new THREE.Vector3(3, 0, 0))
    const tween3 = lighthouse.getCurrentTween()

    // Each new moveTo should have stopped the previous tween
    // tween1 and tween2 should have been stopped
    expect(tween1).not.toBeNull()
    expect(tween2).not.toBeNull()
    expect(tween3).not.toBeNull()

    // The stop method should have been called on tween1 and tween2
    // (they were replaced by subsequent calls)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((tween1 as any).stop).toHaveBeenCalled()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((tween2 as any).stop).toHaveBeenCalled()

    // The current tween is tween3 (the last one started)
    expect(lighthouse.getCurrentTween()).toBe(tween3)
  })

  it('calling moveTo once results in exactly 1 active tween', async () => {
    const { FaroLighthouse } = await import('../../src/entities/FaroLighthouse')
    const { Group: TweenGroup } = await import('@tweenjs/tween.js')
    const THREE = await import('three')

    const tweenGroup = new TweenGroup()
    const lighthouse = new FaroLighthouse(tweenGroup)
    const faro = makeFaro('faro-2')
    lighthouse.build(faro, new THREE.Vector3(0, 0, 0))

    lighthouse.moveTo(new THREE.Vector3(5, 0, 5))

    expect(lighthouse.getCurrentTween()).not.toBeNull()
  })

  it('no tween is active before moveTo is called', async () => {
    const { FaroLighthouse } = await import('../../src/entities/FaroLighthouse')
    const { Group: TweenGroup } = await import('@tweenjs/tween.js')
    const THREE = await import('three')

    const tweenGroup = new TweenGroup()
    const lighthouse = new FaroLighthouse(tweenGroup)
    const faro = makeFaro('faro-3')
    lighthouse.build(faro, new THREE.Vector3(0, 0, 0))

    expect(lighthouse.getCurrentTween()).toBeNull()
  })

  it('calling moveTo 5 times in sequence — only last tween is active', async () => {
    const { FaroLighthouse } = await import('../../src/entities/FaroLighthouse')
    const { Group: TweenGroup } = await import('@tweenjs/tween.js')
    const THREE = await import('three')

    const tweenGroup = new TweenGroup()
    const lighthouse = new FaroLighthouse(tweenGroup)
    const faro = makeFaro('faro-4')
    lighthouse.build(faro, new THREE.Vector3(0, 0, 0))

    const tweens: ReturnType<typeof lighthouse.getCurrentTween>[] = []
    for (let i = 1; i <= 5; i++) {
      lighthouse.moveTo(new THREE.Vector3(i, 0, 0))
      tweens.push(lighthouse.getCurrentTween())
    }

    // All previous tweens should have been stopped
    for (let i = 0; i < tweens.length - 1; i++) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((tweens[i] as any).stop).toHaveBeenCalled()
    }

    // Only the last tween is current
    expect(lighthouse.getCurrentTween()).toBe(tweens[tweens.length - 1])
  })
})

// ---------------------------------------------------------------------------
// Unit tests: build, moveTo, highlight, dim
// ---------------------------------------------------------------------------

describe('FaroLighthouse unit tests', () => {
  it('build creates a THREE.Group with a PointLight', async () => {
    const { FaroLighthouse } = await import('../../src/entities/FaroLighthouse')
    const { Group: TweenGroup } = await import('@tweenjs/tween.js')
    const THREE = await import('three')

    const tweenGroup = new TweenGroup()
    const lighthouse = new FaroLighthouse(tweenGroup)
    const faro = makeFaro('faro-build')
    const pos = new THREE.Vector3(3, 0, -2)

    const group = lighthouse.build(faro, pos)

    expect(group).not.toBeNull()
    expect(group.isGroup).toBe(true)

    // Group should contain a mesh and a PointLight
    const pointLight = lighthouse.getPointLight()
    expect(pointLight).not.toBeNull()
    expect(pointLight!.isPointLight).toBe(true)

    // Group position should match the provided position
    expect(group.position.x).toBeCloseTo(pos.x)
    expect(group.position.y).toBeCloseTo(pos.y)
    expect(group.position.z).toBeCloseTo(pos.z)

    // userData should store faroId
    expect(group.userData['faroId']).toBe('faro-build')
  })

  it('build stores faroId in group userData', async () => {
    const { FaroLighthouse } = await import('../../src/entities/FaroLighthouse')
    const { Group: TweenGroup } = await import('@tweenjs/tween.js')
    const THREE = await import('three')

    const tweenGroup = new TweenGroup()
    const lighthouse = new FaroLighthouse(tweenGroup)
    const faro = makeFaro('my-faro-id')
    const group = lighthouse.build(faro, new THREE.Vector3(0, 0, 0))

    expect(group.userData['faroId']).toBe('my-faro-id')
  })

  it('moveTo starts a tween animation', async () => {
    const { FaroLighthouse } = await import('../../src/entities/FaroLighthouse')
    const { Group: TweenGroup } = await import('@tweenjs/tween.js')
    const THREE = await import('three')

    const tweenGroup = new TweenGroup()
    const lighthouse = new FaroLighthouse(tweenGroup)
    lighthouse.build(makeFaro('faro-move'), new THREE.Vector3(0, 0, 0))

    expect(lighthouse.getCurrentTween()).toBeNull()

    lighthouse.moveTo(new THREE.Vector3(10, 0, 10))

    expect(lighthouse.getCurrentTween()).not.toBeNull()
  })

  it('highlight increases emissive intensity', async () => {
    const { FaroLighthouse } = await import('../../src/entities/FaroLighthouse')
    const { Group: TweenGroup } = await import('@tweenjs/tween.js')
    const THREE = await import('three')
    const { FARO_LIGHT_INTENSITY } = await import('../../src/constants')

    const tweenGroup = new TweenGroup()
    const lighthouse = new FaroLighthouse(tweenGroup)
    lighthouse.build(makeFaro('faro-highlight'), new THREE.Vector3(0, 0, 0))

    lighthouse.highlight()

    const pointLight = lighthouse.getPointLight()!
    expect(pointLight.intensity).toBeCloseTo(FARO_LIGHT_INTENSITY * 1.5)
  })

  it('dim decreases emissive intensity', async () => {
    const { FaroLighthouse } = await import('../../src/entities/FaroLighthouse')
    const { Group: TweenGroup } = await import('@tweenjs/tween.js')
    const THREE = await import('three')
    const { FARO_LIGHT_INTENSITY } = await import('../../src/constants')

    const tweenGroup = new TweenGroup()
    const lighthouse = new FaroLighthouse(tweenGroup)
    lighthouse.build(makeFaro('faro-dim'), new THREE.Vector3(0, 0, 0))

    lighthouse.dim()

    const pointLight = lighthouse.getPointLight()!
    expect(pointLight.intensity).toBeCloseTo(FARO_LIGHT_INTENSITY * 0.3)
  })

  it('highlight then dim restores lower intensity', async () => {
    const { FaroLighthouse } = await import('../../src/entities/FaroLighthouse')
    const { Group: TweenGroup } = await import('@tweenjs/tween.js')
    const THREE = await import('three')
    const { FARO_LIGHT_INTENSITY } = await import('../../src/constants')

    const tweenGroup = new TweenGroup()
    const lighthouse = new FaroLighthouse(tweenGroup)
    lighthouse.build(makeFaro('faro-toggle'), new THREE.Vector3(0, 0, 0))

    lighthouse.highlight()
    const highlightIntensity = lighthouse.getPointLight()!.intensity

    lighthouse.dim()
    const dimIntensity = lighthouse.getPointLight()!.intensity

    expect(highlightIntensity).toBeGreaterThan(dimIntensity)
    expect(highlightIntensity).toBeCloseTo(FARO_LIGHT_INTENSITY * 1.5)
    expect(dimIntensity).toBeCloseTo(FARO_LIGHT_INTENSITY * 0.3)
  })

  it('getGroup returns null before build', async () => {
    const { FaroLighthouse } = await import('../../src/entities/FaroLighthouse')
    const { Group: TweenGroup } = await import('@tweenjs/tween.js')

    const tweenGroup = new TweenGroup()
    const lighthouse = new FaroLighthouse(tweenGroup)

    expect(lighthouse.getGroup()).toBeNull()
    expect(lighthouse.getPointLight()).toBeNull()
  })
})
