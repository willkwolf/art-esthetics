import { PALETTE } from '../constants'

// ---------------------------------------------------------------------------
// FormulaDisplay
// ---------------------------------------------------------------------------

/**
 * FormulaDisplay
 *
 * A static element that always shows the formula `vista = región · faro · lente`.
 * Mounted once and never updated — it is a permanent visual anchor.
 *
 * Requirements: 9.4
 */
export class FormulaDisplay {
  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Render the formula element inside `container`.
   * Requirements: 9.4
   */
  mount(container: HTMLElement): void {
    container.innerHTML = ''

    // Inject scoped styles once.
    this._injectStyles(container)

    const el = document.createElement('div')
    el.className = 'formula-display'
    el.setAttribute('aria-label', 'Fórmula de la vista: vista igual a región por faro por lente')
    el.setAttribute('role', 'img')

    el.innerHTML = `
      <span class="formula-display__text">
        <span class="formula-display__var">vista</span>
        <span class="formula-display__op"> = </span>
        <span class="formula-display__var">región</span>
        <span class="formula-display__op"> · </span>
        <span class="formula-display__var">faro</span>
        <span class="formula-display__op"> · </span>
        <span class="formula-display__var">lente</span>
      </span>
    `

    container.appendChild(el)
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private _injectStyles(container: HTMLElement): void {
    const styleId = 'formula-display-styles'
    if (container.ownerDocument.getElementById(styleId)) return

    const style = container.ownerDocument.createElement('style')
    style.id = styleId
    style.textContent = `
      .formula-display {
        display: inline-flex;
        align-items: center;
        padding: 5px 14px;
        background: rgba(13,11,8,0.88);
        border: 1px solid rgba(196,176,122,0.3);
        border-radius: 3px;
        font-family: serif;
        user-select: none;
        pointer-events: none;
      }
      .formula-display__text {
        display: flex;
        align-items: baseline;
        gap: 0;
        white-space: nowrap;
      }
      .formula-display__var {
        font-size: 13px;
        font-style: italic;
        color: ${PALETTE.accent};
        letter-spacing: 0.04em;
      }
      .formula-display__op {
        font-size: 14px;
        color: ${PALETTE.text};
        opacity: 0.55;
        margin: 0 1px;
      }
    `
    container.ownerDocument.head.appendChild(style)
  }
}
