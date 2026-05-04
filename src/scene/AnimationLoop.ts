import * as THREE from 'three'
import { Tween, Easing, Group as TweenGroup } from '@tweenjs/tween.js'
import { ANIMATION_DURATION } from '../constants'

/**
 * Manages the requestAnimationFrame render loop and tween.js animations.
 *
 * Responsibilities:
 * - Wrap requestAnimationFrame with start/stop lifecycle
 * - Call TWEEN.update() each frame so all tweens advance
 * - Provide tweenCamera() that animates camera position with Cubic.InOut easing
 * - Guarantee at most one active camera tween at any time (no accumulation)
 *
 * Validates: Requirements 6.7, 11.3
 */
export class AnimationLoop {
  private rafId: number | null = null
  private tweenGroup: TweenGroup = new TweenGroup()
  private cameraTween: Tween<{ x: number; y: number; z: number }> | null = null

  /**
   * Start the RAF loop.
   * Calls TWEEN.update(time) and renderFn each frame.
   * Safe to call multiple times — subsequent calls are no-ops if already running.
   */
  start(renderFn: () => void): void {
    if (this.rafId !== null) return

    const loop = (time: number) => {
      this.rafId = requestAnimationFrame(loop)
      this.tweenGroup.update(time)
      renderFn()
    }

    this.rafId = requestAnimationFrame(loop)
  }

  /**
   * Stop the RAF loop.
   * Safe to call when already stopped.
   */
  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }

  /**
   * Animate the camera position to a new target with Cubic.InOut easing.
   *
   * The camera is moved to (target.x, target.y + 8, target.z + 12) so it
   * looks down at the target from a comfortable distance, then lookAt is
   * called each frame to keep the camera oriented toward the target.
   *
   * Cancels any existing camera tween before starting the new one, ensuring
   * no tween accumulation (Property 13, Req 11.3).
   *
   * @param camera   The Three.js camera to animate
   * @param target   The world-space position to focus on
   * @param duration Animation duration in ms (defaults to ANIMATION_DURATION = 800)
   *
   * Validates: Requirements 6.7, 11.3
   */
  tweenCamera(
    camera: THREE.Camera,
    target: THREE.Vector3,
    duration: number = ANIMATION_DURATION,
  ): void {
    // Cancel previous camera tween — no accumulation (Req 11.3)
    if (this.cameraTween !== null) {
      this.cameraTween.stop()
      this.cameraTween = null
    }

    const current = {
      x: camera.position.x,
      y: camera.position.y,
      z: camera.position.z,
    }

    const dest = {
      x: target.x,
      y: target.y + 8,
      z: target.z + 12,
    }

    this.cameraTween = new Tween(current, this.tweenGroup)
      .to(dest, duration)
      .easing(Easing.Cubic.InOut)
      .onUpdate(() => {
        camera.position.set(current.x, current.y, current.z)
        camera.lookAt(target)
      })
      .onComplete(() => {
        this.cameraTween = null
      })
      .start()
  }

  /**
   * Update all tweens manually (useful when not using the RAF loop).
   * @param time Current timestamp in ms
   */
  update(time: number): void {
    this.tweenGroup.update(time)
  }

  /**
   * Dispose the animation loop: stop RAF and cancel all tweens.
   */
  dispose(): void {
    this.stop()

    if (this.cameraTween !== null) {
      this.cameraTween.stop()
      this.cameraTween = null
    }

    this.tweenGroup.removeAll()
  }

  /** Expose the tween group for testing */
  getTweenGroup(): TweenGroup {
    return this.tweenGroup
  }

  /** Returns true if the RAF loop is currently running */
  isRunning(): boolean {
    return this.rafId !== null
  }

  /** Returns true if a camera tween is currently active */
  hasCameraTween(): boolean {
    return this.cameraTween !== null
  }
}
