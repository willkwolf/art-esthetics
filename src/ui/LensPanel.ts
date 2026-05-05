import { PALETTE } from '../constants'
import type { Lente } from '../types'

// ---------------------------------------------------------------------------
// LensPanel
// ---------------------------------------------------------------------------

/**
 * LensPanel
 *
 * Renders a row of buttons — one per thematic lens plus a "Sin filtro" button.
 * Tracks the active lens and notifies subscribers on change.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */
export class LensPanel {
  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------

  /** Currently active lens id. Empty string means "Sin filtro". */
  private activeLens = ''

  /** Registered change callback. */
  private changeCallback: ((lens: string) => void) | null = null

  /** Map from lens id → button element ('' key = "Sin filtro"). */
  private buttons = new Map<string, HTMLButtonElement>()

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Create buttons for each lens plus a "Sin filtro" button.
   * Initialises with "Sin filtro" active.
   * Requirements: 5.1, 5.4, 5.5
   */
  mount(container: HTMLElement, lenses: Lente[]): void {
    container.innerHTML = ''

    // Inject scoped styles once.
    this._injectStyles(container)

    const wrapper = document.createElement('div')
    wrapper.className = 'lens-panel'

    // "Sin filtro" button — always first.
    const noFilterBtn = this._makeButton('Sin filtro', '')
    wrapper.appendChild(noFilterBtn)
    this.buttons.set('', noFilterBtn)

    // One button per lens.
    for (const lente of lenses) {
      const btn = this._makeButton(lente.nombre, lente.id)
      wrapper.appendChild(btn)
      this.buttons.set(lente.id, btn)
    }

    container.appendChild(wrapper)

    // Initialise with "Sin filtro" active (req 5.5).
    this.setActive('')
  }

  /**
   * Register a callback invoked when the active lens changes.
   * Requirements: 5.2
   */
  onLensChange(callback: (lens: string) => void): void {
    this.changeCallback = callback
  }

  /**
   * Mark the button for `lens` as active and deactivate the previous one.
   * Requirements: 5.3
   */
  setActive(lens: string): void {
    // Deactivate previous.
    const prev = this.buttons.get(this.activeLens)
    if (prev) {
      prev.classList.remove('lens-btn--active')
      prev.style.background = 'transparent'
      prev.style.color = PALETTE.text
      prev.style.borderColor = PALETTE.accent
    }

    this.activeLens = lens

    // Activate new.
    const next = this.buttons.get(lens)
    if (next) {
      next.classList.add('lens-btn--active')
      next.style.background = PALETTE.active
      next.style.color = PALETTE.bg
      next.style.borderColor = PALETTE.active
    }
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private _makeButton(label: string, lensId: string): HTMLButtonElement {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.textContent = label
    btn.className = 'lens-btn'
    btn.dataset['lensId'] = lensId

    // Base styles.
    btn.style.background = 'transparent'
    btn.style.color = PALETTE.text
    btn.style.border = `1px solid ${PALETTE.accent}`
    btn.style.borderRadius = '3px'
    btn.style.padding = '4px 10px'
    btn.style.margin = '2px'
    btn.style.cursor = 'pointer'
    btn.style.fontFamily = 'serif'
    btn.style.fontSize = '12px'
    btn.style.letterSpacing = '0.03em'
    btn.style.transition = 'background 200ms ease, color 200ms ease, border-color 200ms ease'

    btn.addEventListener('click', () => {
      this.setActive(lensId)
      this.changeCallback?.(lensId)
    })

    return btn
  }

  private _injectStyles(container: HTMLElement): void {
    const styleId = 'lens-panel-styles'
    if (container.ownerDocument.getElementById(styleId)) return

    const style = container.ownerDocument.createElement('style')
    style.id = styleId
    style.textContent = `
      .lens-panel {
        display: flex;
        flex-wrap: wrap;
        gap: 2px;
        padding: 6px 4px;
        background: rgba(13,11,8,0.85);
        border-bottom: 1px solid rgba(196,176,122,0.2);
      }
      .lens-btn:hover {
        background: rgba(196,176,122,0.15) !important;
      }
      .lens-btn:focus-visible {
        outline: 2px solid ${PALETTE.active};
        outline-offset: 2px;
      }
    `
    container.ownerDocument.head.appendChild(style)
  }
}
