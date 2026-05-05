import { PALETTE } from '../constants'

/**
 * ScrollytellingIntro
 *
 * Renders a 3-screen narrative introduction using HTML/CSS scroll-snap.
 * No external render dependencies — pure DOM + inline styles.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */
export class ScrollytellingIntro {
  private container: HTMLElement | null = null
  private wrapper: HTMLElement | null = null
  private enterMapCallback: (() => void) | null = null

  // Keep references to every listener so we can remove them on unmount
  private ctaClickHandler: (() => void) | null = null
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null

  // ─── Public API ────────────────────────────────────────────────────────────

  /** Render the 3 intro screens inside `container`. Req 4.1, 4.2, 4.4 */
  mount(container: HTMLElement): void {
    this.container = container

    // Outer wrapper — full-viewport scroll-snap container
    const wrapper = document.createElement('div')
    wrapper.id = 'scrollytelling-intro'
    wrapper.setAttribute('role', 'main')
    wrapper.setAttribute('aria-label', 'Introducción narrativa')
    applyStyles(wrapper, {
      position: 'fixed',
      inset: '0',
      overflowY: 'scroll',
      scrollSnapType: 'y mandatory',
      backgroundColor: PALETTE.bg,
      color: PALETTE.text,
      fontFamily: "'Georgia', 'Times New Roman', serif",
      zIndex: '100',
    })

    wrapper.appendChild(this.buildScreen1())
    wrapper.appendChild(this.buildScreen2())
    wrapper.appendChild(this.buildScreen3())

    this.wrapper = wrapper
    container.appendChild(wrapper)
  }

  /** Register the callback invoked when the user clicks "Entra al mapa". Req 4.3 */
  onEnterMap(callback: () => void): void {
    this.enterMapCallback = callback
  }

  /** Remove all event listeners and DOM nodes. Req 4.5 */
  unmount(): void {
    // Remove CTA click listener
    if (this.ctaClickHandler && this.wrapper) {
      const btn = this.wrapper.querySelector<HTMLButtonElement>('#cta-enter-map')
      if (btn) {
        btn.removeEventListener('click', this.ctaClickHandler)
      }
    }

    // Remove keyboard listener
    if (this.keydownHandler) {
      document.removeEventListener('keydown', this.keydownHandler)
    }

    // Remove DOM
    if (this.wrapper && this.container) {
      this.container.removeChild(this.wrapper)
    }

    // Clear references
    this.wrapper = null
    this.container = null
    this.ctaClickHandler = null
    this.keydownHandler = null
    this.enterMapCallback = null
  }

  // ─── Screen builders ───────────────────────────────────────────────────────

  /** Screen 1 — "El problema de estudiar Arte y Estética". Req 4.1 */
  private buildScreen1(): HTMLElement {
    const screen = createScreen('screen-1')

    const inner = document.createElement('div')
    applyStyles(inner, {
      maxWidth: '680px',
      padding: '0 2rem',
      textAlign: 'center',
    })

    const eyebrow = document.createElement('p')
    eyebrow.textContent = 'Cartografía Estética'
    applyStyles(eyebrow, {
      fontSize: '0.85rem',
      letterSpacing: '0.18em',
      textTransform: 'uppercase',
      color: PALETTE.accent,
      marginBottom: '1.5rem',
    })

    const title = document.createElement('h1')
    title.textContent = 'El problema de estudiar Arte y Estética'
    applyStyles(title, {
      fontSize: 'clamp(1.6rem, 4vw, 2.6rem)',
      fontWeight: '400',
      lineHeight: '1.25',
      color: PALETTE.text,
      marginBottom: '2rem',
    })

    const body = document.createElement('p')
    body.textContent =
      '¿Cómo se estudia o visualiza el Arte y la Estética a través de culturas ' +
      'sin imponer un único centro? Occidente ha dominado el canon durante siglos, ' +
      'pero el pensamiento estético es global, plural y sin jerarquía fija. ' +
      'Este mapa no tiene un centro predeterminado: la centralidad emerge de la ' +
      'intersección entre región, pensador y lente temática.'
    applyStyles(body, {
      fontSize: '1.05rem',
      lineHeight: '1.75',
      color: PALETTE.text,
      opacity: '0.85',
      marginBottom: '3rem',
    })

    const hint = document.createElement('p')
    hint.textContent = '↓ Desplázate para continuar'
    applyStyles(hint, {
      fontSize: '0.8rem',
      letterSpacing: '0.1em',
      color: PALETTE.accent,
      opacity: '0.6',
      animation: 'intro-pulse 2s ease-in-out infinite',
    })

    inner.appendChild(eyebrow)
    inner.appendChild(title)
    inner.appendChild(body)
    inner.appendChild(hint)
    screen.appendChild(inner)

    return screen
  }

  /** Screen 2 — "Tres capas de lectura" with SVG diagram. Req 4.2 */
  private buildScreen2(): HTMLElement {
    const screen = createScreen('screen-2')

    const inner = document.createElement('div')
    applyStyles(inner, {
      maxWidth: '720px',
      padding: '0 2rem',
      textAlign: 'center',
    })

    const title = document.createElement('h2')
    title.textContent = 'Tres capas de lectura'
    applyStyles(title, {
      fontSize: 'clamp(1.4rem, 3.5vw, 2.2rem)',
      fontWeight: '400',
      color: PALETTE.text,
      marginBottom: '2.5rem',
    })

    inner.appendChild(title)
    inner.appendChild(this.buildLayersDiagram())
    inner.appendChild(this.buildLayersLegend())

    const hint = document.createElement('p')
    hint.textContent = '↓ Continúa'
    applyStyles(hint, {
      fontSize: '0.8rem',
      letterSpacing: '0.1em',
      color: PALETTE.accent,
      opacity: '0.6',
      marginTop: '2rem',
      animation: 'intro-pulse 2s ease-in-out infinite',
    })
    inner.appendChild(hint)

    screen.appendChild(inner)
    return screen
  }

  /** Screen 3 — "Entra al mapa" CTA. Req 4.3 */
  private buildScreen3(): HTMLElement {
    const screen = createScreen('screen-3')

    const inner = document.createElement('div')
    applyStyles(inner, {
      maxWidth: '560px',
      padding: '0 2rem',
      textAlign: 'center',
    })

    const title = document.createElement('h2')
    title.textContent = 'Entra al mapa'
    applyStyles(title, {
      fontSize: 'clamp(1.6rem, 4vw, 2.8rem)',
      fontWeight: '400',
      color: PALETTE.text,
      marginBottom: '1.25rem',
    })

    const subtitle = document.createElement('p')
    subtitle.textContent =
      '12 pensadores · 5 regiones · 9 lentes temáticas. ' +
      'La vista emerge de la intersección.'
    applyStyles(subtitle, {
      fontSize: '1rem',
      lineHeight: '1.7',
      color: PALETTE.text,
      opacity: '0.75',
      marginBottom: '3rem',
    })

    const formula = document.createElement('p')
    formula.textContent = 'vista = región · faro · lente'
    applyStyles(formula, {
      fontSize: '1.1rem',
      fontStyle: 'italic',
      color: PALETTE.accent,
      marginBottom: '3rem',
      letterSpacing: '0.04em',
    })

    const btn = document.createElement('button')
    btn.id = 'cta-enter-map'
    btn.textContent = 'Entra al mapa →'
    btn.setAttribute('aria-label', 'Entrar al mapa interactivo')
    applyStyles(btn, {
      display: 'inline-block',
      padding: '0.9rem 2.4rem',
      fontSize: '1rem',
      letterSpacing: '0.08em',
      fontFamily: 'inherit',
      color: PALETTE.bg,
      backgroundColor: PALETTE.active,
      border: 'none',
      borderRadius: '2px',
      cursor: 'pointer',
      transition: 'background-color 0.2s ease, transform 0.15s ease',
    })

    // Hover effect via pointer events
    btn.addEventListener('mouseenter', () => {
      btn.style.backgroundColor = PALETTE.accent
    })
    btn.addEventListener('mouseleave', () => {
      btn.style.backgroundColor = PALETTE.active
    })

    // CTA click handler — stored for cleanup in unmount()
    this.ctaClickHandler = () => {
      this.handleEnterMap()
    }
    btn.addEventListener('click', this.ctaClickHandler)

    // Keyboard accessibility: Enter/Space on the button is handled natively,
    // but also support pressing Enter anywhere on screen 3
    this.keydownHandler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const active = document.activeElement
        if (active === btn) return // already handled by click
        this.handleEnterMap()
      }
    }
    document.addEventListener('keydown', this.keydownHandler)

    inner.appendChild(title)
    inner.appendChild(subtitle)
    inner.appendChild(formula)
    inner.appendChild(btn)
    screen.appendChild(inner)

    return screen
  }

  // ─── SVG diagram helpers ───────────────────────────────────────────────────

  /** Simple SVG diagram illustrating the three layers: Archipiélagos, Faros, Lentes */
  private buildLayersDiagram(): SVGSVGElement {
    const NS = 'http://www.w3.org/2000/svg'
    const svg = document.createElementNS(NS, 'svg')
    svg.setAttribute('viewBox', '0 0 480 200')
    svg.setAttribute('role', 'img')
    svg.setAttribute('aria-label', 'Diagrama de las tres capas: Archipiélagos, Faros y Lentes')
    applyStyles(svg as unknown as HTMLElement, {
      width: '100%',
      maxWidth: '480px',
      height: 'auto',
      display: 'block',
      margin: '0 auto',
      overflow: 'visible',
    })

    // ── Background ──
    const bg = document.createElementNS(NS, 'rect')
    bg.setAttribute('width', '480')
    bg.setAttribute('height', '200')
    bg.setAttribute('fill', 'rgba(13,11,8,0.6)')
    bg.setAttribute('rx', '4')
    svg.appendChild(bg)

    // ── Column positions ──
    const cols = [100, 240, 380]
    const cy = 100

    // ── Archipiélagos — circles ──
    const archCircle = document.createElementNS(NS, 'circle')
    archCircle.setAttribute('cx', String(cols[0]))
    archCircle.setAttribute('cy', String(cy))
    archCircle.setAttribute('r', '22')
    archCircle.setAttribute('fill', 'none')
    archCircle.setAttribute('stroke', PALETTE.accent)
    archCircle.setAttribute('stroke-width', '1.5')
    svg.appendChild(archCircle)

    // ── Faros — triangles ──
    const tx = cols[1]
    const size = 18
    const faroPoints = `${tx},${cy - size} ${tx - size},${cy + size} ${tx + size},${cy + size}`
    const faroTri = document.createElementNS(NS, 'polygon')
    faroTri.setAttribute('points', faroPoints)
    faroTri.setAttribute('fill', 'none')
    faroTri.setAttribute('stroke', PALETTE.active)
    faroTri.setAttribute('stroke-width', '1.5')
    svg.appendChild(faroTri)

    // ── Lentes — diamond / rotated square ──
    const lx = cols[2]
    const ls = 18
    const lensPoints = `${lx},${cy - ls} ${lx + ls},${cy} ${lx},${cy + ls} ${lx - ls},${cy}`
    const lensDiamond = document.createElementNS(NS, 'polygon')
    lensDiamond.setAttribute('points', lensPoints)
    lensDiamond.setAttribute('fill', 'none')
    lensDiamond.setAttribute('stroke', PALETTE.text)
    lensDiamond.setAttribute('stroke-width', '1.5')
    lensDiamond.setAttribute('opacity', '0.7')
    svg.appendChild(lensDiamond)

    // ── Connecting lines ──
    const line1 = document.createElementNS(NS, 'line')
    line1.setAttribute('x1', String(cols[0] + 22))
    line1.setAttribute('y1', String(cy))
    line1.setAttribute('x2', String(cols[1] - size - 4))
    line1.setAttribute('y2', String(cy))
    line1.setAttribute('stroke', PALETTE.accent)
    line1.setAttribute('stroke-width', '1')
    line1.setAttribute('stroke-dasharray', '4 3')
    line1.setAttribute('opacity', '0.5')
    svg.appendChild(line1)

    const line2 = document.createElementNS(NS, 'line')
    line2.setAttribute('x1', String(cols[1] + size + 4))
    line2.setAttribute('y1', String(cy))
    line2.setAttribute('x2', String(cols[2] - ls - 4))
    line2.setAttribute('y2', String(cy))
    line2.setAttribute('stroke', PALETTE.active)
    line2.setAttribute('stroke-width', '1')
    line2.setAttribute('stroke-dasharray', '4 3')
    line2.setAttribute('opacity', '0.5')
    svg.appendChild(line2)

    // ── Labels ──
    const labels: Array<{ x: number; text: string }> = [
      { x: cols[0], text: 'Archipiélagos' },
      { x: cols[1], text: 'Faros' },
      { x: cols[2], text: 'Lentes' },
    ]
    for (const { x, text } of labels) {
      const label = document.createElementNS(NS, 'text')
      label.setAttribute('x', String(x))
      label.setAttribute('y', String(cy + 48))
      label.setAttribute('text-anchor', 'middle')
      label.setAttribute('fill', PALETTE.text)
      label.setAttribute('font-size', '13')
      label.setAttribute('font-family', "Georgia, 'Times New Roman', serif")
      label.setAttribute('opacity', '0.8')
      label.textContent = text
      svg.appendChild(label)
    }

    return svg
  }

  /** Three-row legend describing each layer */
  private buildLayersLegend(): HTMLElement {
    const list = document.createElement('dl')
    applyStyles(list, {
      display: 'grid',
      gridTemplateColumns: '1fr',
      gap: '0.75rem',
      marginTop: '2rem',
      textAlign: 'left',
      maxWidth: '480px',
      margin: '2rem auto 0',
    })

    const items: Array<{ term: string; desc: string }> = [
      {
        term: 'Archipiélagos',
        desc: 'Tradiciones estéticas por región cultural — el suelo del mapa.',
      },
      {
        term: 'Faros',
        desc: 'Pensadores con alta centralidad académica — rosas de los vientos intelectuales.',
      },
      {
        term: 'Lentes',
        desc: 'Prácticas contemporáneas que recolorean las conexiones entre pensadores.',
      },
    ]

    for (const { term, desc } of items) {
      const dt = document.createElement('dt')
      dt.textContent = term
      applyStyles(dt, {
        fontWeight: '600',
        color: PALETTE.accent,
        fontSize: '0.9rem',
        letterSpacing: '0.05em',
        marginBottom: '0.1rem',
      })

      const dd = document.createElement('dd')
      dd.textContent = desc
      applyStyles(dd, {
        margin: '0 0 0.5rem 0',
        color: PALETTE.text,
        opacity: '0.8',
        fontSize: '0.9rem',
        lineHeight: '1.6',
      })

      list.appendChild(dt)
      list.appendChild(dd)
    }

    return list
  }

  // ─── Internal ──────────────────────────────────────────────────────────────

  /** Invoke the registered callback and unmount. Req 4.3, 4.5 */
  private handleEnterMap(): void {
    const cb = this.enterMapCallback
    this.unmount()
    if (cb) cb()
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Create a full-viewport scroll-snap screen section */
function createScreen(id: string): HTMLElement {
  const section = document.createElement('section')
  section.id = id
  section.setAttribute('aria-label', `Pantalla ${id}`)
  applyStyles(section, {
    scrollSnapAlign: 'start',
    scrollSnapStop: 'always',
    minHeight: '100dvh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4rem 1rem',
    boxSizing: 'border-box',
  })
  return section
}

/** Apply a plain object of CSS properties to an HTMLElement */
function applyStyles(el: HTMLElement, styles: Partial<CSSStyleDeclaration>): void {
  Object.assign(el.style, styles)
}

// ─── Global CSS for animations ────────────────────────────────────────────────

// Inject once per page load (idempotent via id check)
if (typeof document !== 'undefined' && !document.getElementById('scrollytelling-styles')) {
  const style = document.createElement('style')
  style.id = 'scrollytelling-styles'
  style.textContent = `
    @keyframes intro-pulse {
      0%, 100% { opacity: 0.6; transform: translateY(0); }
      50%       { opacity: 1;   transform: translateY(4px); }
    }
    #scrollytelling-intro {
      scrollbar-width: none;
    }
    #scrollytelling-intro::-webkit-scrollbar {
      display: none;
    }
  `
  document.head.appendChild(style)
}
