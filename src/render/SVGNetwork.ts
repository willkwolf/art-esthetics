import {
  ANIMATION_DURATION,
  EDGE_COLOR_ACTIVE,
  EDGE_COLOR_INACTIVE,
  EDGE_OPACITY_ACTIVE,
  EDGE_OPACITY_INACTIVE,
  NODE_RADIUS_ARCHIPELAGO,
  NODE_SIZE_FARO_ACTIVE,
  NODE_SIZE_FARO_BASE,
  TETHER_OPACITY,
} from '../constants'
import type {
  Archipielago,
  CartografiaData,
  Faro,
} from '../types'

// ---------------------------------------------------------------------------
// SVG namespace helper
// ---------------------------------------------------------------------------

const SVG_NS = 'http://www.w3.org/2000/svg'

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] {
  return document.createElementNS(SVG_NS, tag)
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Build the `points` attribute string for an equilateral-ish upward triangle
 * centred at (cx, cy) with the given half-size.
 *
 * The triangle has:
 *   - top vertex at (cx, cy - size)
 *   - bottom-left at (cx - size, cy + size * 0.6)
 *   - bottom-right at (cx + size, cy + size * 0.6)
 */
function trianglePoints(cx: number, cy: number, size: number): string {
  const top = `${cx},${cy - size}`
  const bl  = `${cx - size},${cy + size * 0.6}`
  const br  = `${cx + size},${cy + size * 0.6}`
  return `${top} ${bl} ${br}`
}

// ---------------------------------------------------------------------------
// SVGNetwork
// ---------------------------------------------------------------------------

/**
 * SVGNetwork
 *
 * Renders the interactive node-edge graph on an SVG element.
 *
 * Node types:
 *   - Archipiélagos: <circle> radius 10px, colour by region
 *   - Faros:         <polygon> triangle, base size 7px
 *
 * Edge types:
 *   - Tethers:    dashed <line>, opacity 0.18, always visible
 *   - Conexiones: solid  <line>, active/inactive based on lens
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6
 */
export class SVGNetwork {
  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------

  private svg: SVGElement | null = null
  private data: CartografiaData | null = null

  /** Current viewport dimensions (set by mount / resize). */
  private width = 800
  private height = 600

  /** Map from faroId → <polygon> element */
  private faroEls = new Map<string, SVGPolygonElement>()

  /** Map from archipielagoId → <circle> element */
  private archEls = new Map<string, SVGCircleElement>()

  /**
   * Map from conexion key (`${origen}__${destino}`) → <line> element.
   * Key is always stored with origen < destino alphabetically so lookups
   * are direction-independent.
   */
  private conexionEls = new Map<string, SVGLineElement>()

  /** Registered click callback. */
  private clickCallback: ((node: Faro | Archipielago, tipo: 'faro' | 'archipielago') => void) | null = null

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Create all SVG elements for nodes and edges.
   * Requirements: 7.1, 7.2
   */
  mount(svg: SVGElement, data: CartografiaData): void {
    this.svg = svg
    this.data = data

    // Infer initial dimensions from the SVG element itself if possible.
    const rect = svg.getBoundingClientRect()
    if (rect.width > 0)  this.width  = rect.width
    if (rect.height > 0) this.height = rect.height

    // Inject a <style> block for CSS transitions once.
    this._injectStyles(svg)

    // Render layers in painter's order: edges first, then nodes on top.
    this._renderTethers(svg, data)
    this._renderConexiones(svg, data)
    this._renderArchipielagos(svg, data)
    this._renderFaros(svg, data)
  }

  /**
   * Activate edges where both faros share `activeLens` in their `lentes` array.
   * Update faro triangle sizes accordingly.
   * Requirements: 7.3, 7.4
   */
  updateLens(activeLens: string): void {
    if (!this.data) return

    const { faros, conexiones } = this.data

    // Build a set of faro ids that are active in this lens.
    const activeFaroIds = new Set(
      faros.filter(f => f.lentes.includes(activeLens)).map(f => f.id)
    )

    // Update conexion edges.
    for (const conexion of conexiones) {
      const key = this._conexionKey(conexion.origen, conexion.destino)
      const line = this.conexionEls.get(key)
      if (!line) continue

      const isActive =
        activeLens !== '' &&
        activeFaroIds.has(conexion.origen) &&
        activeFaroIds.has(conexion.destino)

      if (isActive) {
        line.style.stroke        = EDGE_COLOR_ACTIVE
        line.style.opacity       = String(EDGE_OPACITY_ACTIVE)
        line.style.strokeWidth   = '1.5'
        line.classList.add('active')
      } else {
        line.style.stroke        = EDGE_COLOR_INACTIVE
        line.style.opacity       = String(EDGE_OPACITY_INACTIVE)
        line.style.strokeWidth   = '0.6'
        line.classList.remove('active')
      }
    }

    // Update faro triangles.
    for (const faro of faros) {
      const poly = this.faroEls.get(faro.id)
      if (!poly) continue

      const isActive = activeLens !== '' && activeFaroIds.has(faro.id)
      const size = isActive ? NODE_SIZE_FARO_ACTIVE : NODE_SIZE_FARO_BASE
      const opacity = isActive ? '1.0' : '0.6'

      const cx = faro.x * this.width
      const cy = faro.y * this.height

      poly.setAttribute('points', trianglePoints(cx, cy, size))
      poly.style.opacity = opacity
    }
  }

  /**
   * Highlight nodes belonging to `activeRegion`; dim all others.
   * Requirements: 6.3, 7.5
   */
  updateRegion(activeRegion: string): void {
    if (!this.data) return

    const { faros, archipielagos } = this.data

    for (const faro of faros) {
      const el = this.faroEls.get(faro.id)
      if (!el) continue
      const match = activeRegion === '' || faro.regionId === activeRegion
      el.style.opacity = match ? '1.0' : '0.25'
    }

    for (const arch of archipielagos) {
      const el = this.archEls.get(arch.id)
      if (!el) continue
      const match = activeRegion === '' || arch.regionId === activeRegion
      el.style.opacity = match ? '1.0' : '0.25'
    }
  }

  /**
   * Register a callback invoked when the user clicks any node.
   * Requirements: 7.5
   */
  onNodeClick(
    callback: (node: Faro | Archipielago, tipo: 'faro' | 'archipielago') => void
  ): void {
    this.clickCallback = callback
  }

  /**
   * Recalculate all node positions using relative coordinates × new dimensions.
   * Requirements: 7.6
   */
  resize(width: number, height: number): void {
    this.width  = width
    this.height = height

    if (!this.data) return

    const { faros, archipielagos, tethers, conexiones } = this.data

    // Reposition faro triangles.
    for (const faro of faros) {
      const poly = this.faroEls.get(faro.id)
      if (!poly) continue
      const size = poly.style.opacity === '1.0' ? NODE_SIZE_FARO_ACTIVE : NODE_SIZE_FARO_BASE
      const cx = faro.x * width
      const cy = faro.y * height
      poly.setAttribute('points', trianglePoints(cx, cy, size))

      // Reposition label (stored as next sibling <text>).
      const label = poly.nextElementSibling as SVGTextElement | null
      if (label && label.tagName === 'text') {
        label.setAttribute('x', String(cx))
        label.setAttribute('y', String(cy + NODE_SIZE_FARO_BASE + 12))
      }
    }

    // Reposition archipelago circles.
    for (const arch of archipielagos) {
      const circle = this.archEls.get(arch.id)
      if (!circle) continue
      circle.setAttribute('cx', String(arch.x * width))
      circle.setAttribute('cy', String(arch.y * height))

      const label = circle.nextElementSibling as SVGTextElement | null
      if (label && label.tagName === 'text') {
        label.setAttribute('x', String(arch.x * width))
        label.setAttribute('y', String(arch.y * height + NODE_RADIUS_ARCHIPELAGO + 14))
      }
    }

    // Reposition tether lines.
    const archMap = new Map(archipielagos.map(a => [a.id, a]))
    const faroMap = new Map(faros.map(f => [f.id, f]))

    for (const tether of tethers) {
      const arch = archMap.get(tether.archipielagoId)
      const faro = faroMap.get(tether.faroId)
      if (!arch || !faro) continue

      const key = `tether__${tether.archipielagoId}__${tether.faroId}`
      const line = this.svg?.querySelector(`[data-key="${CSS.escape(key)}"]`) as SVGLineElement | null
      if (!line) continue

      line.setAttribute('x1', String(arch.x * width))
      line.setAttribute('y1', String(arch.y * height))
      line.setAttribute('x2', String(faro.x * width))
      line.setAttribute('y2', String(faro.y * height))
    }

    // Reposition conexion lines.
    for (const conexion of conexiones) {
      const origen  = faroMap.get(conexion.origen)
      const destino = faroMap.get(conexion.destino)
      if (!origen || !destino) continue

      const key = this._conexionKey(conexion.origen, conexion.destino)
      const line = this.conexionEls.get(key)
      if (!line) continue

      line.setAttribute('x1', String(origen.x  * width))
      line.setAttribute('y1', String(origen.y  * height))
      line.setAttribute('x2', String(destino.x * width))
      line.setAttribute('y2', String(destino.y * height))
    }
  }

  // -------------------------------------------------------------------------
  // Private rendering helpers
  // -------------------------------------------------------------------------

  /**
   * Inject a <style> element with CSS transitions into the SVG.
   * This enables smooth opacity/size animations on state changes.
   * Requirements: 7.7
   */
  private _injectStyles(svg: SVGElement): void {
    const style = svgEl('style')
    style.textContent = `
      .faro-node, .arch-node {
        transition: opacity ${ANIMATION_DURATION}ms ease,
                    points  ${ANIMATION_DURATION}ms ease;
      }
      .conexion-edge {
        transition: stroke        ${ANIMATION_DURATION}ms ease,
                    opacity       ${ANIMATION_DURATION}ms ease,
                    stroke-width  ${ANIMATION_DURATION}ms ease,
                    stroke-opacity ${ANIMATION_DURATION}ms ease;
      }
    `
    svg.appendChild(style)
  }

  /**
   * Render tether lines (dashed, always visible).
   * Requirements: 7.2
   */
  private _renderTethers(svg: SVGElement, data: CartografiaData): void {
    const archMap = new Map(data.archipielagos.map(a => [a.id, a]))
    const faroMap = new Map(data.faros.map(f => [f.id, f]))

    for (const tether of data.tethers) {
      const arch = archMap.get(tether.archipielagoId)
      const faro = faroMap.get(tether.faroId)
      if (!arch || !faro) continue

      const line = svgEl('line')
      const key  = `tether__${tether.archipielagoId}__${tether.faroId}`

      line.setAttribute('data-key', key)
      line.setAttribute('x1', String(arch.x * this.width))
      line.setAttribute('y1', String(arch.y * this.height))
      line.setAttribute('x2', String(faro.x * this.width))
      line.setAttribute('y2', String(faro.y * this.height))
      line.setAttribute('stroke', '#c4b07a')
      line.setAttribute('stroke-width', '0.8')
      line.setAttribute('stroke-dasharray', '4 4')
      line.setAttribute('opacity', String(TETHER_OPACITY))
      line.setAttribute('pointer-events', 'none')

      svg.appendChild(line)
    }
  }

  /**
   * Render conexion lines (solid, inactive by default).
   * Requirements: 7.1, 7.2
   */
  private _renderConexiones(svg: SVGElement, data: CartografiaData): void {
    const faroMap = new Map(data.faros.map(f => [f.id, f]))

    for (const conexion of data.conexiones) {
      const origen  = faroMap.get(conexion.origen)
      const destino = faroMap.get(conexion.destino)
      if (!origen || !destino) continue

      const line = svgEl('line')
      const key  = this._conexionKey(conexion.origen, conexion.destino)

      line.setAttribute('x1', String(origen.x  * this.width))
      line.setAttribute('y1', String(origen.y  * this.height))
      line.setAttribute('x2', String(destino.x * this.width))
      line.setAttribute('y2', String(destino.y * this.height))
      line.setAttribute('stroke', EDGE_COLOR_INACTIVE)
      line.setAttribute('stroke-width', '0.6')
      line.setAttribute('pointer-events', 'none')
      line.classList.add('conexion-edge')

      // Inactive default state.
      line.style.stroke  = EDGE_COLOR_INACTIVE
      line.style.opacity = String(EDGE_OPACITY_INACTIVE)

      this.conexionEls.set(key, line)
      svg.appendChild(line)
    }
  }

  /**
   * Render archipelago circles.
   * Requirements: 7.1
   */
  private _renderArchipielagos(svg: SVGElement, data: CartografiaData): void {
    for (const arch of data.archipielagos) {
      const cx = arch.x * this.width
      const cy = arch.y * this.height

      // Circle node.
      const circle = svgEl('circle')
      circle.setAttribute('cx', String(cx))
      circle.setAttribute('cy', String(cy))
      circle.setAttribute('r',  String(NODE_RADIUS_ARCHIPELAGO))
      circle.setAttribute('fill', arch.color)
      circle.setAttribute('stroke', arch.color)
      circle.setAttribute('stroke-width', '1.5')
      circle.setAttribute('cursor', 'pointer')
      circle.classList.add('arch-node')

      circle.addEventListener('click', () => {
        this.clickCallback?.(arch, 'archipielago')
      })

      this.archEls.set(arch.id, circle)
      svg.appendChild(circle)

      // Label.
      const label = this._makeLabel(arch.nombre, cx, cy + NODE_RADIUS_ARCHIPELAGO + 14)
      svg.appendChild(label)
    }
  }

  /**
   * Render faro triangles.
   * Requirements: 7.1
   */
  private _renderFaros(svg: SVGElement, data: CartografiaData): void {
    // Resolve region colour map for faro fill.
    const regionColor = new Map(data.regiones.map(r => [r.id, r.color]))

    for (const faro of data.faros) {
      const cx = faro.x * this.width
      const cy = faro.y * this.height

      const poly = svgEl('polygon')
      poly.setAttribute('points', trianglePoints(cx, cy, NODE_SIZE_FARO_BASE))
      poly.setAttribute('fill', regionColor.get(faro.regionId) ?? '#c4b07a')
      poly.setAttribute('stroke', '#c4b07a')
      poly.setAttribute('stroke-width', '1')
      poly.setAttribute('cursor', 'pointer')
      poly.classList.add('faro-node')

      // Default inactive state.
      poly.style.opacity = '0.6'

      poly.addEventListener('click', () => {
        this.clickCallback?.(faro, 'faro')
      })

      this.faroEls.set(faro.id, poly)
      svg.appendChild(poly)

      // Label.
      const label = this._makeLabel(faro.nombre, cx, cy + NODE_SIZE_FARO_BASE + 12)
      svg.appendChild(label)
    }
  }

  /**
   * Create a <text> label element.
   */
  private _makeLabel(text: string, x: number, y: number): SVGTextElement {
    const el = svgEl('text')
    el.setAttribute('x', String(x))
    el.setAttribute('y', String(y))
    el.setAttribute('text-anchor', 'middle')
    el.setAttribute('font-size', '9')
    el.setAttribute('font-family', 'serif')
    el.setAttribute('fill', '#d4c8a8')
    el.setAttribute('opacity', '0.75')
    el.setAttribute('pointer-events', 'none')
    el.textContent = text
    return el
  }

  /**
   * Stable key for a conexion edge, independent of direction.
   */
  private _conexionKey(a: string, b: string): string {
    return a < b ? `${a}__${b}` : `${b}__${a}`
  }
}
