import { PALETTE } from '../constants'
import type { Region } from '../types'

// ---------------------------------------------------------------------------
// RegionFilter
// ---------------------------------------------------------------------------

/**
 * RegionFilter
 *
 * Renders a set of region controls (buttons) plus an "Todas las regiones"
 * option. Notifies subscribers when the selected region changes.
 *
 * Requirements: 6.1, 6.2, 6.4
 */
export class RegionFilter {
  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------

  /** Currently selected region id. Empty string means "Todas las regiones". */
  private activeRegion = ''

  /** Registered change callback. */
  private changeCallback: ((region: string) => void) | null = null

  /** Map from region id → button element ('' key = "Todas"). */
  private buttons = new Map<string, HTMLButtonElement>()

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Create controls for each region plus an "Todas las regiones" option.
   * Requirements: 6.1, 6.4
   */
  mount(container: HTMLElement, regiones: Region[]): void {
    container.innerHTML = ''

    // Inject scoped styles once.
    this._injectStyles(container)

    const wrapper = document.createElement('div')
    wrapper.className = 'region-filter'

    // "Todas las regiones" option — always first.
    const allBtn = this._makeButton('Todas las regiones', '', '#c4b07a')
    wrapper.appendChild(allBtn)
    this.buttons.set('', allBtn)

    // One button per region.
    for (const region of regiones) {
      const btn = this._makeButton(region.nombre, region.id, region.color)
      wrapper.appendChild(btn)
      this.buttons.set(region.id, btn)
    }

    container.appendChild(wrapper)

    // Initialise with "Todas" active.
    this._setActive('')
  }

  /**
   * Register a callback invoked when the selected region changes.
   * Requirements: 6.2
   */
  onRegionChange(callback: (region: string) => void): void {
    this.changeCallback = callback
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private _setActive(regionId: string): void {
    // Deactivate previous.
    const prev = this.buttons.get(this.activeRegion)
    if (prev) {
      prev.classList.remove('region-btn--active')
      prev.style.background = 'transparent'
      prev.style.color = PALETTE.text
    }

    this.activeRegion = regionId

    // Activate new.
    const next = this.buttons.get(regionId)
    if (next) {
      next.classList.add('region-btn--active')
      const color = next.dataset['regionColor'] ?? PALETTE.active
      next.style.background = color
      next.style.color = PALETTE.bg
    }
  }

  private _makeButton(label: string, regionId: string, color: string): HTMLButtonElement {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.textContent = label
    btn.className = 'region-btn'
    btn.dataset['regionId'] = regionId
    btn.dataset['regionColor'] = color

    // Base styles.
    btn.style.background = 'transparent'
    btn.style.color = PALETTE.text
    btn.style.border = `1px solid ${color}`
    btn.style.borderRadius = '3px'
    btn.style.padding = '4px 10px'
    btn.style.margin = '2px'
    btn.style.cursor = 'pointer'
    btn.style.fontFamily = 'serif'
    btn.style.fontSize = '12px'
    btn.style.letterSpacing = '0.03em'
    btn.style.transition = 'background 200ms ease, color 200ms ease'

    btn.addEventListener('click', () => {
      this._setActive(regionId)
      this.changeCallback?.(regionId)
    })

    return btn
  }

  private _injectStyles(container: HTMLElement): void {
    const styleId = 'region-filter-styles'
    if (container.ownerDocument.getElementById(styleId)) return

    const style = container.ownerDocument.createElement('style')
    style.id = styleId
    style.textContent = `
      .region-filter {
        display: flex;
        flex-wrap: wrap;
        gap: 2px;
        padding: 6px 4px;
        background: rgba(13,11,8,0.85);
        border-bottom: 1px solid rgba(196,176,122,0.2);
      }
      .region-btn:hover {
        opacity: 0.85;
      }
      .region-btn:focus-visible {
        outline: 2px solid ${PALETTE.active};
        outline-offset: 2px;
      }
    `
    container.ownerDocument.head.appendChild(style)
  }
}
