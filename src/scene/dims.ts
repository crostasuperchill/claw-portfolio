// Shared contract between scene modules. ORCHESTRATOR-OWNED: subagents must not edit this file.
// Dimensions are frozen (physics, camera and cabinet depend on them).
export const D = {
  cabinet: { w: 1.02, h: 1.72, d: 0.78 },
  plinthH: 0.6,
  playfield: { w: 0.86, d: 0.56, y: 0.72 },
  glass: { w: 0.92, h: 0.62, y: 1.03, z: 0.39 },
  capsuleR: 0.058,
  clawHomeY: 1.18,
  clawDropY: 1.08,
  grabTipOffset: -0.16,
  grabRadius: 0.085,
  clawScale: 1.25,
  chute: { x: -0.31, z: 0 },
  colors: {
    pink: '#f2a7c3',
    blue: '#2b4bff',
    white: '#f6f5f2',
    red: '#e8262b',
    yellow: '#ffc21a',
    bg: '#e9e9e7',
    ink: '#17150f',
  },
} as const;

/**
 * Palette sampled from reference/target.png (the visual target).
 * Use these for the new 2D-ish illustrated look.
 */
export const REF = {
  bg: '#ced1da', // page / studio backdrop
  framePink: '#f4a9d2', // main cabinet pink shell
  framePinkShade: '#e19ecb', // pink in shadow / lower plinth trim
  sidePostBlue: '#1e9be0', // vertical blue side posts
  bandBlue: '#2b8dca', // blue band behind クレーンゲーム
  panelBlue: '#68bff2', // control panel top surface
  bottomWhite: '#f2f3f6', // lower white sticker panel
  backWall: '#9095aa', // glass box back wall (grey-lavender)
  glassTint: '#cfe4f4', // glass / side walls tint
  neonCyan: '#b7f2f8', // marquee neon + vertical neon tubes
  neonCore: '#ffffff',
  titleMagenta: '#e8338f', // クレーンゲーム / outline of UFO PORTFOLIO
  arrowPink: '#f04db0',
  knobRed: '#d2131b',
  buttonYellow: '#ffd84a',
  buttonGlow: '#fff6b0',
  ink: '#151517', // feet, joystick base, button ring
  chrome: '#dfe3ea',
  capsules: ['#ff8fc8', '#7fe39a', '#ffe36b', '#7cc8ff', '#c79bff', '#ff6b6b', '#9ff0e0'],
} as const;
