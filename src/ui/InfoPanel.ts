import { PALETTE } from '../constants'
import type { Archipielago, Faro, Lente } from '../types'

// ---------------------------------------------------------------------------
// InfoPanel
// ---------------------------------------------------------------------------

/**
 * InfoPanel
 *
 * Displays contextual information about the selected node or active lens.
 * Falls back to a default instructional message when nothing is selected.
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4
 */
export class InfoPanel {
  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------

  private contentEl: HTMLElement | null = null

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Initialise the panel inside `container` with the default message.
   * Requirements: 9.4
   */
  mount(container: HTMLElement): void {
    container.innerHTML = ''

    // Inject scoped styles once.
    this._injectStyles(container)

    const panel = document.createElement('div')
    panel.className = 'info-panel'

    const content = document.createElement('div')
    content.className = 'info-panel__content'
    panel.appendChild(content)
    this.contentEl = content

    container.appendChild(panel)

    // Show default state immediately.
    this.showDefault()
  }

  /**
   * Show details for a faro or archipiélago node.
   * Requirements: 9.1, 9.2
   */
  showNode(node: Faro | Archipielago, tipo: 'faro' | 'archipielago'): void {
    if (!this.contentEl) return

    if (tipo === 'faro') {
      this._renderFaro(node as Faro)
    } else {
      this._renderArchipielago(node as Archipielago)
    }
  }

  /**
   * Show the faros illuminated by the given lens.
   * Requirements: 9.3
   */
  showLensInfo(lens: Lente, farosActivos: Faro[]): void {
    if (!this.contentEl) return

    const html = `
      <p class="info-panel__label">Lente activa</p>
      <h2 class="info-panel__title">${this._esc(lens.nombre)}</h2>
      <p class="info-panel__label">Faros iluminados (${farosActivos.length})</p>
      <ul class="info-panel__list">
        ${farosActivos.map(f => `<li>${this._esc(f.nombre)}</li>`).join('')}
      </ul>
    `
    this.contentEl.innerHTML = html
  }

  /**
   * Show the default instructional message with the formula.
   * Requirements: 9.4
   */
  showDefault(): void {
    if (!this.contentEl) return

    this.contentEl.innerHTML = `
      <p class="info-panel__hint">
        Selecciona una lente, una región o haz clic en un nodo para explorar el mapa.
      </p>
      <div class="info-panel__formula">
        <span class="info-panel__formula-text">vista = región · faro · lente</span>
      </div>
    `
  }

  // -------------------------------------------------------------------------
  // Private rendering helpers
  // -------------------------------------------------------------------------

  /** Render faro details. Requirements: 9.1 */
  private _renderFaro(faro: Faro): void {
    if (!this.contentEl) return

    const lentesHtml = faro.lentes.length > 0
      ? `<p class="info-panel__label">Lentes activas</p>
         <ul class="info-panel__list">
           ${faro.lentes.map(l => `<li>${this._esc(l)}</li>`).join('')}
         </ul>`
      : ''

    this.contentEl.innerHTML = `
      <p class="info-panel__label">Faro</p>
      <h2 class="info-panel__title">${this._esc(faro.nombre)}</h2>
      <p class="info-panel__meta">
        <span class="info-panel__label">Región</span>
        <span>${this._esc(faro.regionId)}</span>
      </p>
      <p class="info-panel__concept">${this._esc(faro.concepto)}</p>
      <p class="info-panel__meta">
        <span class="info-panel__label">Citaciones</span>
        <span class="info-panel__count">${faro.citationCount}</span>
      </p>
      ${lentesHtml}
    `
  }

  /** Render archipiélago details. Requirements: 9.2 */
  private _renderArchipielago(arch: Archipielago): void {
    if (!this.contentEl) return

    this.contentEl.innerHTML = `
      <p class="info-panel__label">Archipiélago</p>
      <h2 class="info-panel__title">${this._esc(arch.nombre)}</h2>
      <p class="info-panel__concept">${this._esc(arch.concepto)}</p>
      <p class="info-panel__hint">
        Explora los faros de esta región para descubrir sus pensadores.
      </p>
    `
  }

  /** Escape HTML special characters to prevent XSS. */
  private _esc(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  private _injectStyles(container: HTMLElement): void {
    const styleId = 'info-panel-styles'
    if (container.ownerDocument.getElementById(styleId)) return

    const style = container.ownerDocument.createElement('style')
    style.id = styleId
    style.textContent = `
      .info-panel {
        background: rgba(13,11,8,0.92);
        border: 1px solid rgba(196,176,122,0.25);
        border-radius: 4px;
        padding: 14px 16px;
        color: ${PALETTE.text};
        font-family: serif;
        font-size: 13px;
        line-height: 1.55;
        min-height: 80px;
      }
      .info-panel__title {
        margin: 4px 0 8px;
        font-size: 16px;
        font-weight: normal;
        color: ${PALETTE.active};
        letter-spacing: 0.02em;
      }
      .info-panel__label {
        margin: 6px 0 2px;
        font-size: 10px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: ${PALETTE.accent};
        opacity: 0.8;
      }
      .info-panel__meta {
        margin: 4px 0;
        display: flex;
        gap: 8px;
        align-items: baseline;
      }
      .info-panel__concept {
        margin: 6px 0;
        font-style: italic;
        color: ${PALETTE.text};
        opacity: 0.85;
      }
      .info-panel__count {
        font-size: 18px;
        color: ${PALETTE.active};
        font-variant-numeric: tabular-nums;
      }
      .info-panel__list {
        margin: 4px 0 0 0;
        padding-left: 16px;
        color: ${PALETTE.text};
        opacity: 0.9;
      }
      .info-panel__list li {
        margin-bottom: 2px;
      }
      .info-panel__hint {
        margin: 0 0 10px;
        color: ${PALETTE.text};
        opacity: 0.6;
        font-size: 12px;
      }
      .info-panel__formula {
        margin-top: 10px;
        padding: 8px 12px;
        border: 1px solid rgba(196,176,122,0.3);
        border-radius: 3px;
        text-align: center;
      }
      .info-panel__formula-text {
        font-size: 14px;
        color: ${PALETTE.accent};
        letter-spacing: 0.06em;
      }
    `
    container.ownerDocument.head.appendChild(style)
  }
}
