/**
 * src/main.ts — Application entry point and orchestrator.
 *
 * Initialization sequence (Tasks 14.1–14.5):
 *   1. Obtain DOM elements from index.html
 *   2. Call DataLoader.load('/data/archipelago.json')
 *   3. On success:
 *      a. Create AppState with default region/lens and initial activeFaroId
 *      b. Subscribe AppState to recompute scores when region or lens changes (Task 14.2)
 *      c. Subscribe AppState to update SceneManager when scores change (Task 14.3)
 *      d. Subscribe AppState to update UIPanel when activeFaroId changes (Task 14.4)
 *      e. Build scene, init UI, init InteractionController, start render loop (Task 14.5)
 *   4. On error:
 *      a. Show ErrorScreen with the error
 *      b. Wire retry button to re-invoke DataLoader.load()
 */

import * as THREE from 'three'
import { DataLoader } from './logic/DataLoader'
import { ScoreEngine } from './logic/ScoreEngine'
import { createAppState } from './logic/AppState'
import { SceneManager } from './scene/SceneManager'
import { UIPanel } from './ui/UIPanel'
import { ErrorScreen } from './ui/ErrorScreen'
import { InteractionController } from './interaction/InteractionController'
import type { ArchipelagoData, AppStateType } from './types'

// ─── DOM element references ───────────────────────────────────────────────────

const canvasContainer = document.getElementById('canvas-container') as HTMLElement
const controlsEl = document.getElementById('controls') as HTMLElement
const faroInfoEl = document.getElementById('faro-info') as HTMLElement
const errorScreenEl = document.getElementById('error-screen') as HTMLElement
const errorTitleEl = document.getElementById('error-title') as HTMLElement
const errorMessageEl = document.getElementById('error-message') as HTMLElement
const retryButton = document.getElementById('retry-button') as HTMLElement
const tooltipEl = document.getElementById('tooltip') as HTMLElement

// ─── Singleton instances ──────────────────────────────────────────────────────

const dataLoader = new DataLoader()
const scoreEngine = new ScoreEngine()
const sceneManager = new SceneManager()
const uiPanel = new UIPanel()
const errorScreen = new ErrorScreen()
const interactionController = new InteractionController()

// ─── Cleanup helpers (allow retry to tear down previous state) ────────────────

let disposeSubscriptions: (() => void) | null = null

function teardown(): void {
  disposeSubscriptions?.()
  disposeSubscriptions = null
  interactionController.dispose()
  uiPanel.dispose()
  sceneManager.dispose()
}

// ─── Main initialization function ────────────────────────────────────────────

async function initialize(): Promise<void> {
  // Tear down any previous state (e.g. after a retry)
  teardown()

  let data: ArchipelagoData

  try {
    data = await dataLoader.load('/data/archipelago.json')
  } catch (err) {
    errorScreen.showError(err instanceof Error ? err : new Error(String(err)))
    return
  }

  // ── Task 14.1: Initialize AppState with loaded data ──────────────────────

  const defaultRegion = data.regions[0]
  const defaultLens = data.lenses[0]

  // Compute initial scores to determine the first activeFaroId
  const initialScoreResult = scoreEngine.computeScores(data.faros, defaultRegion, defaultLens)

  const appState = createAppState(defaultRegion, defaultLens, initialScoreResult.activeFaroId)

  // Keep a local reference to the latest scores so SceneManager can be
  // updated whenever either region/lens or scores change.
  let latestScores = initialScoreResult.scores

  // ── Task 14.2: Recompute scores when currentRegion or currentLens changes ─

  let prevRegion = defaultRegion
  let prevLens = defaultLens

  const unsubscribeScores = appState.subscribe((state: AppStateType) => {
    const regionChanged = state.currentRegion !== prevRegion
    const lensChanged = state.currentLens !== prevLens

    if (regionChanged || lensChanged) {
      prevRegion = state.currentRegion
      prevLens = state.currentLens

      const result = scoreEngine.computeScores(data.faros, state.currentRegion, state.currentLens)
      latestScores = result.scores

      // Update AppState with new scores and activeFaroId (triggers further subscribers)
      appState.setState({ activeFaroId: result.activeFaroId })
    }
  })

  // ── Task 14.3: Update SceneManager when scores change ────────────────────

  const unsubscribeScene = appState.subscribe((state: AppStateType) => {
    if (state.activeFaroId) {
      sceneManager.updateWeights(latestScores)
      sceneManager.moveFaro(state.activeFaroId)

      // Tween camera toward the new active faro position
      const faroIsland = data.islands.find(i => i.faroId === state.activeFaroId)
      if (faroIsland) {
        const target = new THREE.Vector3(...faroIsland.position)
        sceneManager.tweenCamera(target)
      }
    }
  })

  // ── Task 14.4: Update UIPanel when activeFaroId changes ──────────────────
  // UIPanel already subscribes internally via its init() call below.
  // The subscription above (unsubscribeScene) also handles scene updates.
  // We collect all unsubscribe functions for cleanup on retry.

  disposeSubscriptions = () => {
    unsubscribeScores()
    unsubscribeScene()
  }

  // ── Task 14.5: Build scene, init UI, init InteractionController, start loop

  // Initialize SceneManager (renderer + camera + lights)
  sceneManager.init(canvasContainer)

  // Build the Three.js scene from loaded data
  sceneManager.buildScene(data)

  // Position faro at initial active faro
  sceneManager.moveFaro(initialScoreResult.activeFaroId)

  // Apply initial weights
  sceneManager.updateWeights(initialScoreResult.scores)

  // Initialize UIPanel — it subscribes to AppState internally for faro info updates
  uiPanel.init(controlsEl, faroInfoEl, data, appState, interactionController)

  // Initialize InteractionController with canvas, state, camera, and data
  const canvas = sceneManager.getRenderer()?.domElement
  const camera = sceneManager.getCamera()

  if (canvas && camera) {
    interactionController.init(
      canvas,
      appState,
      camera,
      data,
      tooltipEl,
      (target: THREE.Vector3) => sceneManager.tweenCamera(target),
    )
  }

  // Start the render loop
  sceneManager.startRenderLoop()
}

// ─── Error screen setup ───────────────────────────────────────────────────────

errorScreen.init(
  errorScreenEl,
  errorTitleEl,
  errorMessageEl,
  retryButton,
  () => {
    // Retry: re-invoke the full initialization
    initialize()
  },
)

// ─── Bootstrap ───────────────────────────────────────────────────────────────

initialize()
