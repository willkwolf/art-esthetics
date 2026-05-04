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
 */
export class SceneManager {
  private renderer: THREE.WebGLRenderer | null = null
  private camera: THREE.PerspectiveCamera | null = null
  private scene: THREE.Scene | null = null
  private animationLoop: AnimationLoop = new AnimationLoop()
  private faroTweenGroup: TweenGroup = new TweenGroup()
  private faroTween: Tween<{ x: number; y: number; z: number }> | null = null
  private islandMeshes: Map<string, THREE.Object3D> = new Map()
  private islandLabels: Map<string, THREE.Sprite> = new Map()
  private faroPosition: Map<string, THREE.Vector3> = new Map()
  private faroGroup: THREE.Group | null = null
  private faroLight: THREE.PointLight | null = null
  private data: ArchipelagoData | null = null
  private edgesLine: THREE.LineSegments | null = null

  init(container: HTMLElement): void {
    const w = container.clientWidth || window.innerWidth
    const h = container.clientHeight || window.innerHeight

    // Renderer — solid background, no alpha blending issues
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setSize(w, h)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.appendChild(this.renderer.domElement)

    // Scene with dark background
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x080810)
    this.scene.fog = new THREE.FogExp2(0x080810, 0.018)

    // Camera
    this.camera = new THREE.PerspectiveCamera(CAMERA_FOV, w / h, CAMERA_NEAR, CAMERA_FAR)
    this.camera.position.set(
      DEFAULT_CAMERA_POSITION.x,
      DEFAULT_CAMERA_POSITION.y,
      DEFAULT_CAMERA_POSITION.z,
    )
    this.camera.lookAt(0, 0, 0)

    // Lights
    const ambient = new THREE.AmbientLight(0x334466, AMBIENT_LIGHT_INTENSITY * 2)
    this.scene.add(ambient)

    const dirLight = new THREE.DirectionalLight(0x8899cc, 1.2)
    dirLight.position.set(10, 20, 10)
    this.scene.add(dirLight)

    const rimLight = new THREE.DirectionalLight(0x223355, 0.6)
    rimLight.position.set(-10, -5, -10)
    this.scene.add(rimLight)

    // Grid helper for spatial reference
    const grid = new THREE.GridHelper(30, 30, 0x112233, 0x0a1520)
    grid.position.y = -0.5
    this.scene.add(grid)

    window.addEventListener('resize', this.onResize.bind(this))
  }

  buildScene(data: ArchipelagoData): void {
    if (!this.scene) throw new Error('SceneManager not initialized')
    this.data = data

    // Map faro positions from their islands
    for (const island of data.islands) {
      if (island.faroId) {
        this.faroPosition.set(island.faroId, new THREE.Vector3(...island.position))
      }
    }

    // Island meshes — icosahedron with glow material
    const geo = new THREE.IcosahedronGeometry(0.45, 1)
    for (const island of data.islands) {
      const mat = new THREE.MeshPhongMaterial({
        color: 0x2255aa,
        emissive: 0x112244,
        emissiveIntensity: 0.4,
        transparent: true,
        opacity: 0.9,
        shininess: 80,
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(...island.position)
      mesh.userData['islandId'] = island.id
      this.scene.add(mesh)
      this.islandMeshes.set(island.id, mesh)

      // Text label sprite
      const sprite = this.makeLabel(island.label)
      sprite.position.set(island.position[0], island.position[1] + 0.9, island.position[2])
      this.scene.add(sprite)
      this.islandLabels.set(island.id, sprite)
    }

    // Edges
    this.buildEdges(data.islands)

    // Faro lighthouse group
    this.faroGroup = new THREE.Group()

    const baseGeo = new THREE.CylinderGeometry(0.08, 0.15, 0.6, 8)
    const baseMat = new THREE.MeshPhongMaterial({ color: 0xddcc88, emissive: 0x886600, emissiveIntensity: 0.3 })
    const base = new THREE.Mesh(baseGeo, baseMat)
    base.position.y = 0.3
    this.faroGroup.add(base)

    const topGeo = new THREE.OctahedronGeometry(0.22, 0)
    const topMat = new THREE.MeshPhongMaterial({
      color: 0xffee44,
      emissive: 0xffaa00,
      emissiveIntensity: 1.0,
      transparent: true,
      opacity: 0.95,
    })
    const top = new THREE.Mesh(topGeo, topMat)
    top.position.y = 0.85
    this.faroGroup.add(top)

    // Halo ring
    const ringGeo = new THREE.TorusGeometry(0.35, 0.03, 8, 32)
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffdd44, transparent: true, opacity: 0.6 })
    const ring = new THREE.Mesh(ringGeo, ringMat)
    ring.rotation.x = Math.PI / 2
    ring.position.y = 0.85
    this.faroGroup.add(ring)

    this.faroLight = new THREE.PointLight(0xffdd44, 3.0, 12)
    this.faroLight.position.y = 0.85
    this.faroGroup.add(this.faroLight)

    this.scene.add(this.faroGroup)
  }

  private makeLabel(text: string): THREE.Sprite {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 64
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.clearRect(0, 0, 256, 64)
      ctx.font = 'bold 22px Georgia, serif'
      ctx.fillStyle = 'rgba(200, 220, 255, 0.9)'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(text, 128, 32)
    }
    const tex = new THREE.CanvasTexture(canvas)
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false })
    const sprite = new THREE.Sprite(mat)
    sprite.scale.set(2.2, 0.55, 1)
    return sprite
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
      const material = new THREE.LineBasicMaterial({
        color: 0x2244aa,
        transparent: true,
        opacity: 0.35,
      })
      this.edgesLine = new THREE.LineSegments(geometry, material)
      this.scene.add(this.edgesLine)
    }
  }

  startRenderLoop(): void {
    let t = 0
    this.animationLoop.start(() => {
      t += 0.01
      this.faroTweenGroup.update(performance.now())

      // Pulse the faro light
      if (this.faroLight) {
        this.faroLight.intensity = 2.5 + Math.sin(t * 2) * 0.8
      }
      // Slowly rotate the faro top
      if (this.faroGroup) {
        const top = this.faroGroup.children[1]
        if (top) top.rotation.y = t * 0.8
      }

      if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera)
      }
    })
  }

  updateWeights(scores: Map<string, number>): void {
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
        // Opacity: min 0.15 so islands never fully disappear
        mat.opacity = 0.15 + normalized * 0.85
        // Color: cool blue (low) → warm gold (high)
        const color = new THREE.Color()
        color.setHSL(0.62 - normalized * 0.45, 0.85, 0.2 + normalized * 0.45)
        mat.color = color
        mat.emissive = color.clone().multiplyScalar(0.3)
        mat.needsUpdate = true
      }

      // Label opacity
      const label = this.islandLabels.get(islandId)
      if (label) {
        const mat = label.material as THREE.SpriteMaterial
        mat.opacity = 0.3 + normalized * 0.7
        mat.needsUpdate = true
      }
    }

    // Edge opacity reflects average score
    if (this.edgesLine) {
      const mat = this.edgesLine.material as THREE.LineBasicMaterial
      const avg = maxScore > 0 ? 0.2 : 0.1
      mat.opacity = avg + 0.15
      mat.needsUpdate = true
    }
  }

  moveFaro(faroId: string): void {
    if (!this.faroGroup) return
    const targetPos = this.faroPosition.get(faroId)
    if (!targetPos) return

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
      .to({ x: targetPos.x, y: targetPos.y, z: targetPos.z }, ANIMATION_DURATION)
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

  tweenCamera(target: THREE.Vector3): void {
    if (!this.camera) return
    this.animationLoop.tweenCamera(this.camera, target, ANIMATION_DURATION)
  }

  getAnimationLoop(): AnimationLoop {
    return this.animationLoop
  }

  dispose(): void {
    this.animationLoop.dispose()

    if (this.faroTween) {
      this.faroTween.stop()
      this.faroTween = null
    }
    this.faroTweenGroup.removeAll()

    if (this.scene) {
      this.scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Sprite) {
          if ('geometry' in obj) (obj as THREE.Mesh).geometry.dispose()
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m: THREE.Material) => m.dispose())
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
    this.islandLabels.clear()
    this.faroPosition.clear()
    this.faroGroup = null
    this.faroLight = null
    this.edgesLine = null
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

  getRenderer(): THREE.WebGLRenderer | null { return this.renderer }
  getCamera(): THREE.PerspectiveCamera | null { return this.camera }
  getScene(): THREE.Scene | null { return this.scene }
  getIslandMeshes(): Map<string, THREE.Object3D> { return this.islandMeshes }
}
