/** Duration of CSS transitions and animations in milliseconds */
export const ANIMATION_DURATION = 300

/** Radius of archipelago (region) circle nodes in pixels */
export const NODE_RADIUS_ARCHIPELAGO = 10

/** Half-size of faro (thinker) triangle nodes in pixels — base state */
export const NODE_SIZE_FARO_BASE = 7

/** Half-size of faro triangle nodes in pixels — when lens is active */
export const NODE_SIZE_FARO_ACTIVE = 10

/** Opacity of tether lines (faro → archipielago) */
export const TETHER_OPACITY = 0.18

/** Opacity of connection edges when no lens is active */
export const EDGE_OPACITY_INACTIVE = 0.12

/** Opacity of connection edges when activated by the current lens */
export const EDGE_OPACITY_ACTIVE = 0.9

/** Stroke color of inactive connection edges */
export const EDGE_COLOR_INACTIVE = 'rgba(196,176,122,0.12)'

/** Stroke color of active connection edges */
export const EDGE_COLOR_ACTIVE = '#e8b060'

/** Dark parchment color palette */
export const PALETTE = {
  bg:       '#0d0b08',
  text:     '#d4c8a8',
  accent:   '#c4b07a',
  active:   '#e8b060',
  grid:     'rgba(180,160,100,0.045)',
  diagonal: 'rgba(180,160,100,0.022)',
  compass:  '#c4b07a',
} as const
