/**
 * Centralized color palette for the 3D scene & Stadium.
 * All values in pure HSL format for consistent cross-browser color reproduction.
 *
 * Three.js accepts standard CSS color strings including hsl().
 */

// ─── Galatasaray Brand ──────────────────────────────────────────────────────

export const GS_YELLOW = 'hsl(42, 100%, 59%)';
export const GS_RED = 'hsl(350, 84%, 42%)';
export const GS_YELLOW_DIM = 'hsl(42, 80%, 40%)';
export const GS_RED_DIM = 'hsl(350, 70%, 30%)';

// ─── Scene Background & Atmosphere ──────────────────────────────────────────

export const BG_COLOR = 'hsl(228, 38%, 5%)';
export const GROUND_COLOR = 'hsl(225, 38%, 3%)';

// ─── Pitch ──────────────────────────────────────────────────────────────────

export const FIELD_COLOR = 'hsl(142, 58%, 28%)';
export const FIELD_DARK_STRIPE = 'hsl(142, 58%, 23%)';
export const LINE_COLOR = 'hsl(0, 0%, 100%)';
export const TECHNICAL_AREA_COLOR = 'hsl(225, 25%, 20%)';

// ─── Stadium Stands & Seats ─────────────────────────────────────────────────

export const STAND_COLOR = 'hsl(225, 38%, 7%)';
export const STAND_ACCENT = 'hsl(229, 40%, 11%)';
export const SEAT_RED = 'hsl(350, 75%, 35%)';
export const SEAT_YELLOW = 'hsl(42, 90%, 50%)';
export const SEAT_DARK = 'hsl(225, 30%, 12%)';
export const CROWD_COLOR = 'hsl(228, 25%, 15%)';

// ─── Stadium Structures ─────────────────────────────────────────────────────

export const ROOF_STRUCTURE = 'hsl(225, 20%, 20%)';
export const ROOF_CANOPY = 'hsl(228, 30%, 10%)';
export const TUNNEL_COLOR = 'hsl(225, 35%, 12%)';
export const AD_BOARD_BG = 'hsl(228, 40%, 8%)';
export const AD_BOARD_GLOW = 'hsl(42, 100%, 55%)';
export const GOAL_POST_COLOR = 'hsl(0, 0%, 96%)';
export const GOAL_NET_COLOR = 'hsl(0, 0%, 80%)';
export const FLOODLIGHT_STRUCTURE = 'hsl(225, 20%, 25%)';

// ─── Lighting ───────────────────────────────────────────────────────────────

export const WARM_WHITE = 'hsl(32, 100%, 90%)';
export const COOL_AMBIENT = 'hsl(240, 37%, 16%)';
export const HEMISPHERE_SKY = 'hsl(226, 48%, 12%)';
export const OVERHEAD_FILL = 'hsl(264, 33%, 93%)';

// ─── Corner Flag & Accents ──────────────────────────────────────────────────

export const FLAG_POLE_COLOR = 'hsl(0, 0%, 80%)';
export const PARTICLE_COLOR = GS_YELLOW;

// ─── Rumor Bubble Colors (Confidence & Trend) ────────────────────────────────

export const BUBBLE_HIGH_CONFIDENCE = GS_YELLOW;
export const BUBBLE_MED_CONFIDENCE = 'hsl(36, 95%, 52%)';
export const BUBBLE_LOW_CONFIDENCE = 'hsl(14, 85%, 48%)';
export const BUBBLE_SELECTED = 'hsl(45, 100%, 65%)';
export const BUBBLE_HOVER_GLOW = 'hsl(42, 100%, 75%)';
