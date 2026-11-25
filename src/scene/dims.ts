// Shared contract between scene modules. ORCHESTRATOR-OWNED: subagents must not edit this file.
// Dimensions are frozen (physics, camera and cabinet depend on them).
export const D = {
  cabinet: { w: 1.02, h: 1.72, d: 0.78 },
  plinthH: 0.6,
  playfield: { w: 0.86, d: 0.56, y: 0.72 },
  glass: { w: 0.92, h: 0.62, y: 1.03, z: 0.39 },
  capsuleR: 0.058,
  clawHomeY: 1.18,
  clawDropY: 0.89,
  grabTipOffset: -0.16,
  grabRadius: 0.085,
  clawScale: 1.25,
  chute: { x: -0.31, z: 0 },
  colors: {
    pink: '#f697c8',
    blue: '#0c92eb',
    white: '#f7f7fa',
    red: '#dc101c',
    yellow: '#ffd226',
    bg: '#e2e5ed',
    ink: '#17150f',
  },
} as const;

/**
 * Vivid candy-pop palette sampled from reference/target.png.
 */
export const REF = {
  bg: '#e2e5ed', // bright studio backdrop
  framePink: '#f795c8', // juicy bubblegum pink cabinet shell
  framePinkShade: '#df6eae', // richer rose-pink trim / shade
  sidePostBlue: '#0b93ec', // electric cerulean blue side posts
  bandBlue: '#115cb3', // deep royal cobalt band behind クレーンゲーム
  panelBlue: '#18a2f0', // glossy vibrant sky-cerulean control deck
  bottomWhite: '#f8f8fb', // crisp lower white sticker panel
  backWall: '#8e9ab6', // cool silver-lavender chamber back wall
  glassTint: '#c8e7fc', // glass / ceiling tint
  neonCyan: '#8df0ff', // marquee neon + vertical neon tubes
  neonCore: '#ffffff',
  titleMagenta: '#f0258e', // クレーンゲーム / outline of UFO PORTFOLIO
  arrowPink: '#f62998',
  knobRed: '#dc101c',
  buttonYellow: '#ffd226',
  buttonGlow: '#fff7a8',
  ink: '#14151a', // feet, joystick base, button ring
  chrome: '#eef3f9',
  capsules: ['#ff4da6', '#28dc6c', '#ffd624', '#26b2ff', '#a85eff', '#ff4757', '#30e6cf'],
} as const;
