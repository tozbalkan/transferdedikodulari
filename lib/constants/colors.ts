/**
 * Universal HSL Color System for Transfer Radar.
 * Ensures consistent rendering across all browsers and devices without color shift.
 */
export const HSL_COLORS = {
  // Brand & Kit Colors
  GS_CRIMSON: 'hsl(350, 92%, 28%)',
  GS_CRIMSON_DARK: 'hsl(350, 92%, 14%)',
  GS_CRIMSON_FLAG: 'hsl(347, 95%, 34%)',
  GS_CRIMSON_EMISSIVE: 'hsl(350, 90%, 20%)',
  GS_GOLD: 'hsl(43, 98%, 53%)',
  GS_GOLD_BRIGHT: 'hsl(44, 100%, 59%)',
  GS_GOLD_EMISSIVE: 'hsl(41, 98%, 39%)',
  GS_GOLD_ACCENT_EMISSIVE: 'hsl(42, 94%, 28%)',

  // Player Material Colors
  SKIN_TONE: 'hsl(24, 52%, 65%)',
  HAIR_DARK: 'hsl(30, 8%, 10%)',
  SHORTS_CHARCOAL: 'hsl(225, 17%, 9%)',
  BOOTS_BLACK: 'hsl(223, 31%, 5%)',
  POLE_WHITE: 'hsl(210, 40%, 98%)',
  WHITE_LINES: 'hsl(0, 0%, 100%)',
  WHITE_LINES_EMISSIVE: 'hsl(152, 81%, 90%)',
  INDICATOR_SLATE: 'hsl(215, 16%, 65%)',

  // Pitch Grass HSL Tones
  PITCH_BASE_DARK: 'hsl(140, 60%, 5%)',
  PITCH_GLB_BASE: 'hsl(139, 51%, 11%)',
  PITCH_BAND_DARK: 'hsl(140, 58%, 17%)',
  PITCH_BAND_LIGHT: 'hsl(140, 57%, 20%)',

  // Stadium Architecture
  STADIUM_CONCRETE: 'hsl(222, 29%, 7%)',
  STADIUM_CONCRETE_EMISSIVE: 'hsl(220, 33%, 2%)',
  STADIUM_SEATS: 'hsl(351, 67%, 13%)',
  STADIUM_SEATS_EMISSIVE: 'hsl(350, 75%, 5%)',
  CANVAS_BACKGROUND: 'hsl(228, 38%, 5%)',

  // Transfer Statuses
  STATUS_AGREEMENT: 'hsl(160, 84%, 39%)',
  STATUS_ADVANCED: 'hsl(43, 98%, 53%)',
  STATUS_CONTACT: 'hsl(38, 92%, 50%)',
  STATUS_RUMORED: 'hsl(0, 84%, 60%)',

  // Lighting & Atmosphere
  LIGHT_FLOOD: 'hsl(55, 30%, 96%)',
  LIGHT_KEY: 'hsl(50, 40%, 95%)',
  LIGHT_FILL_BLUE: 'hsl(220, 60%, 65%)',
  LIGHT_WARM_AMBER: 'hsl(38, 90%, 55%)',
  LIGHT_AMBIENT: 'hsl(225, 45%, 55%)',
  FOG_COLOR: 'hsl(228, 38%, 5%)',
} as const;
