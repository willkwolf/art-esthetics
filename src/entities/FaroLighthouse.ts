import * as THREE from 'three'
import { Tween, Easing, Group as TweenGroup } from '@tweenjs/tween.js'
import type { Faro } from '../types'
import { ANIMATION_DURATION, FARO_LIGHT_INTENSITY, FARO_LIGHT_DISTANCE } from '../constants'

/**
 * Represents the active faro as a highlighted mesh with a PointLight.
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4
 */
export class FaroLighthouse {
  private group: THREE.Group | null = null
  private pointLight: THREE.PointLight | null = null
  private mesh: THREE.Mesh | null = null
  private currentTween: Tween<{ x: number; y: number; z: number }> | null = null
  private tweenGroup: TweenGroup

  constructor(tweenGroup: TweenGroup) {
    this.tweenGroup = tweenGroup
  }

  /**
   * Build the lighthouse group with a mesh and PointLight.
   * Validates: Requirements 6.1
   */
  build(faro: Faro, position: THREE.Vector3): THREE.Group {
    this.group = new THREE.Group()

    // Cone mesh for the lighthouse
    const geometry = new THREE.ConeGeometry(0.25, 1.0, 6)
    const material = new THREE.MeshPhongMaterial({
      color: 0xffdd44,
      emissive: 0xffaa00,
      emissiveIntensity: 0.6,
    })
    this.mesh = new THREE.Mesh(geometry, material)
    this.mesh.position.y = 0.5
    this.group.add(this.mesh)

    // PointLight
    this.pointLight = new THREE.PointLight(0xffdd44, FARO_LIGHT_INTENSITY, FARO_LIGHT_DISTANCE)
    this.pointLight.position.y = 1.2
    this.group.add(this.pointLight)

    // Position the group
    this.group.position.copy(position)
    this.group.userData['faroId'] = faro.id

    return this.group
  }

  /**
   * Animate movement to a new position with a tween of exactly 800ms.
   * Cancels any previous tween before starting.
   * Validates: Requirements 6.2, 6.3
   */
  moveTo(position: THREE.Vector3, duration: number = ANIMATION_DURATION): void {
    if (!this.group) return

    // Cancel previous tween — no accumulation
    if (this.currentTween) {
      this.currentTween.stop()
      this.currentTween = null
    }

    const current = {
      x: this.group.position.x,
      y: this.group.position.y,
      z: this.group.position.z,
    }

    this.currentTween = new Tween(current, this.tweenGroup)
      .to({ x: position.x, y: position.y, z: position.z }, duration)
      .easing(Easing.Cubic.InOut)
      .onUpdate(() => {
        if (this.group) {
          this.group.position.set(current.x, current.y, current.z)
        }
      })
      .onComplete(() => {
        this.currentTween = null
      })
      .start()
  }

  /**
   * Highlight the faro (increase emissive intensity and light intensity).
   * Validates: Requirements 6.4
   */
  highlight(): void {
    if (this.mesh) {
      const mat = this.mesh.material as THREE.MeshPhongMaterial
      mat.emissiveIntensity = 1.2
      mat.needsUpdate = true
    }
    if (this.pointLight) {
      this.pointLight.intensity = FARO_LIGHT_INTENSITY * 1.5
    }
  }

  /**
   * Dim the faro (reduce emissive intensity and light intensity).
   * Validates: Requirements 6.4
   */
  dim(): void {
    if (this.mesh) {
      const mat = this.mesh.material as THREE.MeshPhongMaterial
      mat.emissiveIntensity = 0.2
      mat.needsUpdate = true
    }
    if (this.pointLight) {
      this.pointLight.intensity = FARO_LIGHT_INTENSITY * 0.3
    }
  }

  /** Expose group for testing */
  getGroup(): THREE.Group | null {
    return this.group
  }

  /** Expose pointLight for testing */
  getPointLight(): THREE.PointLight | null {
    return this.pointLight
  }

  /** Expose current tween for testing */
  getCurrentTween(): Tween<{ x: number; y: number; z: number }> | null {
    return this.currentTween
  }
}
