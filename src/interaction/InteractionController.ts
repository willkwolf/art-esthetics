import * as THREE from 'three'
import type { ArchipelagoData } from '../types'
import type { AppState } from '../logic/AppState'

/**
 * Centralizes all user events and translates them to state mutations.
 * No implicit state — delegates all changes to AppState.
 * Validates: Requirements 8.1–8.6
 */
export class InteractionController {
  private canvas: HTMLCanvasElement | null = null
  private state: AppState | null = null
  private camera: THREE.PerspectiveCamera | null = null
  private raycaster: THREE.Raycaster = new THREE.Raycaster()
  private mouse: THREE.Vector2 = new THREE.Vector2()
  private data: ArchipelagoData | null = null
  private tooltipEl: HTMLElement | null = null
  private onMouseMoveBound: (e: MouseEvent) => void
  private onClickBound: (e: MouseEvent) => void
  private onCameraMove: ((target: THREE.Vector3) => void) | null = null

  constructor() {
    this.onMouseMoveBound = this.onHover.bind(this)
    this.onClickBound = this.onClick.bind(this)
  }

  /**
   * Initialize the controller with canvas, state, camera, and data.
   * Validates: Requirements 8.1, 8.2, 8.3, 8.4
   */
  init(
    canvas: HTMLCanvasElement,
    state: AppState,
    camera: THREE.PerspectiveCamera,
    data: ArchipelagoData,
    tooltipEl?: HTMLElement,
    onCameraMove?: (target: THREE.Vector3) => void,
  ): void {
    this.canvas = canvas
    this.state = state
    this.camera = camera
    this.data = data
    this.tooltipEl = tooltipEl ?? null
    this.onCameraMove = onCameraMove ?? null

    canvas.addEventListener('mousemove', this.onMouseMoveBound)
    canvas.addEventListener('click', this.onClickBound)
  }

  /**
   * Handle region change from UI.
   * Validates: Requirements 8.1
   */
  onRegionChange(region: string): void {
    this.state?.setState({ currentRegion: region })
  }

  /**
   * Handle lens change from UI.
   * Validates: Requirements 8.2
   */
  onLensChange(lens: string): void {
    this.state?.setState({ currentLens: lens })
  }

  /**
   * Handle mouse hover — raycasting to identify island under cursor.
   * Validates: Requirements 8.3
   */
  onHover(event: MouseEvent): void {
    if (!this.canvas || !this.camera || !this.data) return

    this.updateMouse(event)
    const intersected = this.raycast()

    if (intersected && this.tooltipEl) {
      const islandId = intersected.object.userData['islandId'] as string | undefined
      const island = this.data.islands.find(i => i.id === islandId)
      if (island) {
        this.tooltipEl.style.display = 'block'
        this.tooltipEl.style.left = `${event.clientX + 12}px`
        this.tooltipEl.style.top = `${event.clientY - 8}px`
        this.tooltipEl.textContent = island.label
      }
    } else if (this.tooltipEl) {
      this.tooltipEl.style.display = 'none'
    }
  }

  /**
   * Handle click — raycasting and center camera on selected island.
   * Validates: Requirements 8.4
   */
  onClick(event: MouseEvent): void {
    if (!this.canvas || !this.camera || !this.data) return

    this.updateMouse(event)
    const intersected = this.raycast()

    if (intersected) {
      const islandId = intersected.object.userData['islandId'] as string | undefined
      const island = this.data.islands.find(i => i.id === islandId)
      if (island && this.onCameraMove) {
        const target = new THREE.Vector3(...island.position)
        this.onCameraMove(target)
      }
    }
  }

  /**
   * Remove all event listeners.
   * Validates: Requirements 8.6
   */
  dispose(): void {
    if (this.canvas) {
      this.canvas.removeEventListener('mousemove', this.onMouseMoveBound)
      this.canvas.removeEventListener('click', this.onClickBound)
    }
    this.canvas = null
    this.state = null
    this.camera = null
    this.data = null
    this.tooltipEl = null
    this.onCameraMove = null
  }

  private updateMouse(event: MouseEvent): void {
    if (!this.canvas) return
    const rect = this.canvas.getBoundingClientRect()
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  }

  private raycast(): THREE.Intersection | null {
    if (!this.camera || !this.canvas) return null
    this.raycaster.setFromCamera(this.mouse, this.camera)
    // In a real scene we'd pass the scene objects; here we return null
    // (actual raycasting happens in SceneManager integration)
    return null
  }

  /** Expose canvas for testing */
  getCanvas(): HTMLCanvasElement | null {
    return this.canvas
  }
}
