import * as THREE from 'three'
import { Tween, Easing, Group as TweenGroup } from '@tweenjs/tween.js'
import type { ArchipelagoData, Island } from '../types'
import {
  ANIMATION_DURATION,
  CAMERA_FAR,
  CAMERA_FOV,
  CAMERA_NEAR,
  DEFAULT_CAMERA_POSITION,
  AMBIENT_LIGHT_INTENSITY,
} from '../constants'
import { AnimationLoop } from './AnimationLoop'

/**
 * Manages the Three.js renderer, camera, lights, and render loop.
 * Delegates mesh creation to IslandMesh, FaroLighthouse, and EdgesManager.
 * Delegates the RAF loop and camera tweens to AnimationLoop.
 */
export class SceneManager {
  private renderer: THREE.WebGLRenderer | null = null
  private camera: THREE.PerspectiveCamera | null = null
  private scene: THREE.Scene | null = null
  /** AnimationLoop handles RAF + tween.js integration (Tasks 13.1–13.4) */
  private animationLoop: AnimationLoop = new AnimationLoop()
  /** Separate tween group for faro movement (not camera) */
  private faroTweenGroup: TweenGroup = new TweenGroup()
  private faroTween: Tween<{ x: number; y: number; z: number }> | null = null
  private islandMeshes: Map<string, THREE.Object3D> = new Map()
  private faroPosition: Map<string, THREE.Vector3> = new Map()
  private faroGroup: THREE.Group | null = null
  private data: ArchipelagoData | null = null

  /**
   * Initialize the renderer, camera, and lights.
   * Validates: Requirements 4.1
   */
  init(container: HTMLElement): void {
    // Create renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight)
    this.renderer.setPixelRatio(window.devicePixelRatio)
    container.appendChild(this.renderer.domElement)

    // Create scene
    this.scene = new THREE.Scene()

    // Create camera
    const aspect = (container.clientWidth || window.innerWidth) / (container.clientHeight || window.innerHeight)
    this.camera = new THREE.PerspectiveCamera(CAMERA_FOV, aspect, CAMERA_NEAR, CAMERA_FAR)
    this.camera.position.set(
      DEFAULT_CAMERA_POSITION.x,
      DEFAULT_CAMERA_POSITION.y,
      DEFAULT_CAMERA_POSITION.z,
    )
    this.camera.lookAt(0, 0, 0)

    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, AMBIENT_LIGHT_INTENSITY)
    this.scene.add(ambientLight)

    // Directional light for depth
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8)
    dirLight.position.set(5, 10, 5)
    this.scene.add(dirLight)

    // Handle resize
    window.addEventListener('resize', this.onResize.bind(this))
  }

  /**
   * Build the scene from ArchipelagoData.
   * Delegates to IslandMesh, FaroLighthouse, EdgesManager.
   * Validates: Requirements 4.2
   */
  buildScene(data: ArchipelagoData): void {
    if (!this.scene) throw new Error('SceneManager not initialized')
    this.data = data

    // Store faro positions (use island positions for faros)
    for (const island of data.islands) {
      if (island.faroId) {
        this.faroPosition.set(island.faroId, new THREE.Vector3(...island.position))
      }
    }

    // Create simple island meshes (icosahedron geometry)
    const geometry = new THREE.IcosahedronGeometry(0.3, 1)
    for (const island of data.islands) {
      const material = new THREE.MeshPhongMaterial({
        color: 0x4488ff,
        transparent: true,
        opacity: 0.8,
      })
      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.set(...island.position)
      mesh.userData['islandId'] = island.id
      this.scene.add(mesh)
      this.islandMeshes.set(island.id, mesh)
    }

    // Create edges (lines between connected islands)
    this.buildEdges(data.islands)

    // Create faro group (lighthouse)
    this.faroGroup = new THREE.Group()
    const faroGeo = new THREE.ConeGeometry(0.2, 0.8, 6)
    const faroMat = new THREE.MeshPhongMaterial({ color: 0xffdd44, emissive: 0xffaa00, emissiveIntensity: 0.5 })
    const faroMesh = new THREE.Mesh(faroGeo, faroMat)
    faroMesh.position.y = 0.5
    this.faroGroup.add(faroMesh)

    const pointLight = new THREE.PointLight(0xffdd44, 2.0, 50)
    this.faroGroup.add(pointLight)
    this.scene.add(this.faroGroup)
  }

  private buildEdges(islands: Island[]): void {
    if (!this.scene) return
    const islandMap = new Map(islands.map(i => [i.id, i]))
    const points: THREE.Vector3[] = []

    for (const island of islands) {
      if (island.connections) {
        for (const connId of island.connections) {
          const target = islandMap.get(connId)
          if (target) {
            points.push(new THREE.Vector3(...island.position))
            points.push(new THREE.Vector3(...target.position))
          }
        }
      }
    }

    if (points.length > 0) {
      const geometry = new THREE.BufferGeometry().setFromPoints(points)
      const material = new THREE.LineBasicMaterial({ color: 0x334466, transparent: true, opacity: 0.4 })
      const lines = new THREE.LineSegments(geometry, material)
      this.scene.add(lines)
    }
  }

  /**
   * Start the render loop via AnimationLoop.
   * AnimationLoop calls TWEEN.update() and the render function each frame.
   * Validates: Requirements 4.3
   */
  startRenderLoop(): void {
    this.animationLoop.start(() => {
      // Also advance faro tweens each frame
      this.faroTweenGroup.update(performance.now())
      if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera)
      }
    })
  }

  /**
   * Update island colors and opacities based on scores.
   * O(n) where n = number of islands.
   * Validates: Requirements 4.4
   */
  updateWeights(scores: Map<string, number>): void {
    // Find max score for normalization
    let maxScore = 0
    for (const score of scores.values()) {
      if (score > maxScore) maxScore = score
    }

    for (const [islandId, mesh] of this.islandMeshes) {
      const island = this.data?.islands.find(i => i.id === islandId)
      if (!island) continue

      const faroId = island.faroId
      const score = faroId ? (scores.get(faroId) ?? 0) : 0
      const normalized = maxScore > 0 ? score / maxScore : 0

      if (mesh instanceof THREE.Mesh) {
        const mat = mesh.material as THREE.MeshPhongMaterial
        mat.opacity = Math.max(0.05, normalized)
        // Color: interpolate from dim blue to bright gold
        const color = new THREE.Color()
        color.setHSL(0.6 - normalized * 0.4, 0.8, 0.2 + normalized * 0.5)
        mat.color = color
        mat.needsUpdate = true
      }
    }
  }

  /**
   * Move the faro lighthouse to the active faro position with 800ms animation.
   * Cancels any previous faro tween before starting a new one (Req 11.3).
   * Validates: Requirements 4.5, 6.2, 6.3
   */
  moveFaro(faroId: string): void {
    if (!this.faroGroup) return
    const targetPos = this.faroPosition.get(faroId)
    if (!targetPos) return

    // Cancel previous faro tween — no accumulation (Req 11.3)
    if (this.faroTween) {
      this.faroTween.stop()
      this.faroTween = null
    }

    const current = {
      x: this.faroGroup.position.x,
      y: this.faroGroup.position.y,
      z: this.faroGroup.position.z,
    }

    this.faroTween = new Tween(current, this.faroTweenGroup)
      .to({ x: targetPos.x, y: targetPos.y + 0.5, z: targetPos.z }, ANIMATION_DURATION)
      .easing(Easing.Cubic.InOut)
      .onUpdate(() => {
        if (this.faroGroup) {
          this.faroGroup.position.set(current.x, current.y, current.z)
        }
      })
      .onComplete(() => {
        this.faroTween = null
      })
      .start()
  }

  /**
   * Animate camera to look at a target position via AnimationLoop.
   * Delegates to AnimationLoop.tweenCamera() which cancels any previous
   * camera tween before starting the new one (Req 11.3, 6.7).
   * Validates: Requirements 6.7, 11.3
   */
  tweenCamera(target: THREE.Vector3): void {
    if (!this.camera) return
    this.animationLoop.tweenCamera(this.camera, target, ANIMATION_DURATION)
  }

  /**
   * Expose the AnimationLoop instance for external use or testing.
   */
  getAnimationLoop(): AnimationLoop {
    return this.animationLoop
  }

  /**
   * Dispose all Three.js resources.
   * Validates: Requirements 4.6
   */
  dispose(): void {
    // Stop the RAF loop and cancel all camera tweens
    this.animationLoop.dispose()

    // Cancel faro tween
    if (this.faroTween) {
      this.faroTween.stop()
      this.faroTween = null
    }
    this.faroTweenGroup.removeAll()

    if (this.scene) {
      this.scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose()
          if (Array.isArray(obj.material)) {
            obj.material.forEach(m => m.dispose())
          } else {
            obj.material.dispose()
          }
        }
      })
      this.scene.clear()
    }

    if (this.renderer) {
      this.renderer.dispose()
      this.renderer.domElement.remove()
      this.renderer = null
    }

    this.camera = null
    this.scene = null
    this.islandMeshes.clear()
    this.faroPosition.clear()
    this.faroGroup = null
    this.data = null

    window.removeEventListener('resize', this.onResize.bind(this))
  }

  private onResize(): void {
    if (!this.renderer || !this.camera) return
    const w = window.innerWidth
    const h = window.innerHeight
    this.renderer.setSize(w, h)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  /** Expose renderer for testing */
  getRenderer(): THREE.WebGLRenderer | null {
    return this.renderer
  }

  /** Expose camera for testing */
  getCamera(): THREE.PerspectiveCamera | null {
    return this.camera
  }

  /** Expose scene for testing */
  getScene(): THREE.Scene | null {
    return this.scene
  }

  /** Expose island meshes for testing */
  getIslandMeshes(): Map<string, THREE.Object3D> {
    return this.islandMeshes
  }
}
