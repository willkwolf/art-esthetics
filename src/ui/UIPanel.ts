import type { ArchipelagoData, Faro } from '../types'
import type { AppState } from '../logic/AppState'
import type { InteractionController } from '../interaction/InteractionController'

/**
 * UI panel with region/lens selectors and active faro info.
 * No business logic — delegates to InteractionController.
 * Validates: Requirements 9.1–9.4
 */
export class UIPanel {
  private faroInfoEl: HTMLElement | null = null
  private regionSelect: HTMLSelectElement | null = null
  private lensSelect: HTMLSelectElement | null = null
  private unsubscribe: (() => void) | null = null
  private faroMap: Map<string, Faro> = new Map()

  /**
   * Initialize the panel with data, state, and controller.
   * Validates: Requirements 9.1, 9.2, 9.3, 9.4
   */
  init(
    controlsEl: HTMLElement,
    faroInfoEl: HTMLElement,
    data: ArchipelagoData,
    state: AppState,
    controller: InteractionController,
  ): void {
    this.faroInfoEl = faroInfoEl
    this.faroMap = new Map(data.faros.map(f => [f.id, f]))

    // Build region selector
    this.regionSelect = this.buildSelect('region-select', data.regions, (value) => {
      controller.onRegionChange(value)
    })

    // Build lens selector
    this.lensSelect = this.buildSelect('lens-select', data.lenses, (value) => {
      controller.onLensChange(value)
    })

    // Add labels and selectors to controls
    const regionLabel = document.createElement('label')
    regionLabel.textContent = 'Región'
    regionLabel.htmlFor = 'region-select'

    const lensLabel = document.createElement('label')
    lensLabel.textContent = 'Lente'
    lensLabel.htmlFor = 'lens-select'

    controlsEl.appendChild(regionLabel)
    controlsEl.appendChild(this.regionSelect)
    controlsEl.appendChild(lensLabel)
    controlsEl.appendChild(this.lensSelect)

    // Subscribe to state changes to update faro info
    this.unsubscribe = state.subscribe((s) => {
      if (s.activeFaroId) {
        this.updateFaroInfo(s.activeFaroId)
      }
    })

    // Initial render with current state
    const currentState = state.getState()
    if (currentState.activeFaroId) {
      this.updateFaroInfo(currentState.activeFaroId)
    }
  }

  private buildSelect(id: string, options: string[], onChange: (value: string) => void): HTMLSelectElement {
    const select = document.createElement('select')
    select.id = id

    for (const opt of options) {
      const option = document.createElement('option')
      option.value = opt
      option.textContent = opt
      select.appendChild(option)
    }

    select.addEventListener('change', () => onChange(select.value))
    return select
  }

  private updateFaroInfo(faroId: string): void {
    if (!this.faroInfoEl) return
    const faro = this.faroMap.get(faroId)
    if (!faro) return

    this.faroInfoEl.innerHTML = `
      <div class="faro-tag">Faro activo</div>
      <div class="faro-name">${faro.label}</div>
      <div class="faro-hindex">h-index PhilPapers: ${faro.hindex}</div>
      ${faro.description ? `<div class="faro-desc">${faro.description}</div>` : ''}
    `
  }

  /**
   * Get the list of region options currently shown in the selector.
   * Validates: Requirements 9.1
   */
  getRegionOptions(): string[] {
    if (!this.regionSelect) return []
    return Array.from(this.regionSelect.options).map(o => o.value)
  }

  /**
   * Get the list of lens options currently shown in the selector.
   * Validates: Requirements 9.2
   */
  getLensOptions(): string[] {
    if (!this.lensSelect) return []
    return Array.from(this.lensSelect.options).map(o => o.value)
  }

  /**
   * Get the current faro info element content.
   */
  getFaroInfoEl(): HTMLElement | null {
    return this.faroInfoEl
  }

  /**
   * Dispose the panel and unsubscribe from state.
   */
  dispose(): void {
    this.unsubscribe?.()
    this.unsubscribe = null
    this.faroInfoEl = null
    this.regionSelect = null
    this.lensSelect = null
  }
}
