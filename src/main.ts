/**
 * main.ts — Orquestador principal de Cartografía Estética
 *
 * Flujo:
 *   1. Montar ScrollytellingIntro en #intro-container
 *   2. Al hacer clic en "Entra al mapa":
 *      a. Desmontar intro, mostrar #map-container
 *      b. Cargar datos con DataLoader
 *      c. Inicializar CanvasBackground, SVGNetwork
 *      d. Inicializar LensPanel, RegionFilter, InfoPanel, FormulaDisplay
 *      e. Conectar todos los eventos
 *   3. Si DataLoader lanza excepción → mostrar pantalla de error con botón de reintento
 *
 * Requirements: 1.1, 3.1, 4.3, 10.1, 10.2, 10.3
 */

import { ScrollytellingIntro } from './intro/ScrollytellingIntro'
import { DataLoader } from './logic/DataLoader'
import { ScoreEngine } from './logic/ScoreEngine'
import { createAppState } from './logic/AppState'
import { CanvasBackground } from './render/CanvasBackground'
import { SVGNetwork } from './render/SVGNetwork'
import { LensPanel } from './ui/LensPanel'
import { RegionFilter } from './ui/RegionFilter'
import { InfoPanel } from './ui/InfoPanel'
import { FormulaDisplay } from './ui/FormulaDisplay'
import type { CartografiaData, Faro, Archipielago } from './types'
import { DataValidationError, NetworkError } from './errors'

// ---------------------------------------------------------------------------
// DOM element references (all present in index.html)
// ---------------------------------------------------------------------------

const introContainer  = document.getElementById('intro-container')!
const mapContainer    = document.getElementById('map-container')!
const mapBgCanvas     = document.getElementById('map-bg') as HTMLCanvasElement
const networkSvg      = document.getElementById('network') as unknown as SVGElement
const lensPanelEl     = document.getElementById('lens-panel')!
const regionFilterEl  = document.getElementById('region-filter')!
const infoPanelEl     = document.getElementById('info-panel')!
const formulaDisplayEl = document.getElementById('formula-display')!
const errorScreen     = document.getElementById('error-screen')!
const errorTitle      = document.getElementById('error-title')!
const errorMessage    = document.getElementById('error-message')!
const retryButton     = document.getElementById('retry-button')!

// ---------------------------------------------------------------------------
// Module instances
// ---------------------------------------------------------------------------

const intro         = new ScrollytellingIntro()
const dataLoader    = new DataLoader()
const scoreEngine   = new ScoreEngine()
const canvasBg      = new CanvasBackground()
const svgNetwork    = new SVGNetwork()
const lensPanel     = new LensPanel()
const regionFilter  = new RegionFilter()
const infoPanel     = new InfoPanel()
const formulaDisplay = new FormulaDisplay()

// ---------------------------------------------------------------------------
// Error screen helpers
// ---------------------------------------------------------------------------

function showError(title: string, message: string): void {
  errorTitle.textContent = title
  errorMessage.textContent = message
  errorScreen.classList.remove('hidden')
}

function hideError(): void {
  errorScreen.classList.add('hidden')
}

// ---------------------------------------------------------------------------
// Map initialization
// ---------------------------------------------------------------------------

async function initMap(): Promise<void> {
  hideError()

  let data: CartografiaData
  try {
    data = await dataLoader.load()
  } catch (err) {
    if (err instanceof NetworkError) {
      showError(
        'Error de red',
        `No se pudo cargar el mapa: ${err.message} (HTTP ${err.statusCode})`,
      )
    } else if (err instanceof DataValidationError) {
      showError(
        'Error en los datos',
        `El archivo de datos contiene un error en el campo "${err.field}": ${err.message}`,
      )
    } else {
      showError(
        'Error inesperado',
        err instanceof Error ? err.message : 'Ocurrió un error desconocido.',
      )
    }
    return
  }

  // ── Compute initial scores ──────────────────────────────────────────────
  const defaultRegion = data.regiones[0].id
  const defaultLens   = ''   // "Sin filtro" — empty string means no lens active

  const initialScores = scoreEngine.computeScores(data.faros, defaultRegion, defaultLens)

  // ── Create AppState ─────────────────────────────────────────────────────
  const appState = createAppState(
    defaultRegion,
    defaultLens,
    initialScores.activeFaroId,
    data,
  )
  appState.setState({ scores: initialScores.scores })

  // ── Canvas background ───────────────────────────────────────────────────
  mapBgCanvas.width  = window.innerWidth
  mapBgCanvas.height = window.innerHeight
  canvasBg.mount(mapBgCanvas)
  canvasBg.draw()

  // ── SVG network ─────────────────────────────────────────────────────────
  svgNetwork.mount(networkSvg, data)

  // ── UI components ───────────────────────────────────────────────────────
  lensPanel.mount(lensPanelEl, data.lentes)
  regionFilter.mount(regionFilterEl, data.regiones)
  infoPanel.mount(infoPanelEl)
  formulaDisplay.mount(formulaDisplayEl)

  // ── Event: lens change ──────────────────────────────────────────────────
  lensPanel.onLensChange((lensId: string) => {
    const state = appState.getState()
    const newScores = scoreEngine.computeScores(
      data.faros,
      state.currentRegion,
      lensId,
    )

    appState.setState({
      currentLens: lensId,
      activeFaroId: newScores.activeFaroId,
      scores: newScores.scores,
    })

    svgNetwork.updateLens(lensId, newScores.scores)

    // Update InfoPanel with lens info if no node is selected
    if (lensId !== '') {
      const activeLente = data.lentes.find(l => l.id === lensId)
      const farosActivos = data.faros.filter(f => f.lentes.includes(lensId))
      if (activeLente) {
        infoPanel.showLensInfo(activeLente, farosActivos)
      }
    } else {
      infoPanel.showDefault()
    }
  })

  // ── Event: region change ────────────────────────────────────────────────
  regionFilter.onRegionChange((regionId: string) => {
    const state = appState.getState()
    const newScores = scoreEngine.computeScores(
      data.faros,
      regionId || defaultRegion,
      state.currentLens,
    )

    appState.setState({
      currentRegion: regionId || defaultRegion,
      activeFaroId: newScores.activeFaroId,
      scores: newScores.scores,
    })

    svgNetwork.updateRegion(regionId)
  })

  // ── Event: node click ───────────────────────────────────────────────────
  svgNetwork.onNodeClick((node: Faro | Archipielago, tipo: 'faro' | 'archipielago') => {
    infoPanel.showNode(node, tipo)
  })

  // ── Window resize ───────────────────────────────────────────────────────
  window.addEventListener('resize', () => {
    const w = window.innerWidth
    const h = window.innerHeight
    canvasBg.resize(w, h)
    svgNetwork.resize(w, h)
  })
}

// ---------------------------------------------------------------------------
// Retry button
// ---------------------------------------------------------------------------

retryButton.addEventListener('click', () => {
  initMap()
})

// ---------------------------------------------------------------------------
// Entry point: mount intro
// ---------------------------------------------------------------------------

intro.mount(introContainer)

intro.onEnterMap(() => {
  // Show map container, hide intro (intro already unmounts itself)
  mapContainer.style.display = 'block'

  // Start loading data and initializing the map
  initMap()
})
