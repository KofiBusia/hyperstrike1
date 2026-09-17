// Shared constants used by BOTH the authoritative server and the client.
// Keeping this identical on both sides is what makes client-side prediction
// reconcile cleanly with server state. Do not fork these values per-side.

export const TICK_RATE = 30; // server simulation ticks per second
export const TICK_DT = 1 / TICK_RATE;

export const WORLD = {
  gravity: 27, // units/s^2 (units ~= meters)
  terminalVelocity: 60,
};

export const MOVEMENT = {
  walkSpeed: 5.2,
  sprintSpeed: 8.4,
  crouchSpeed: 2.6,
  slideStartSpeed: 11,
  slideMinSpeedToStart: 4.5,
  slideFriction: 6.5,
  slideDuration: 0.9,
  airControl: 0.35,
  jumpVelocity: 8.6,
  coyoteTime: 0.12,
  jumpBufferTime: 0.12,
  eyeHeightStand: 1.7,
  eyeHeightCrouch: 1.05,
  capsuleRadius: 0.4,
  capsuleHeightStand: 1.8,
  capsuleHeightCrouch: 1.1,
  crouchTransitionSpeed: 10,

  // Wall run
  wallRunMinSpeed: 4.5,
  wallRunSpeed: 7.6,
  wallRunGravityScale: 0.18,
  wallRunMaxTime: 1.6,
  wallRunJumpVelocity: 8.0,
  wallRunJumpAwayForce: 5.2,
  wallRunRayLength: 0.75,
  wallRunMinHeightAboveGround: 1.0,

  // Mantle / vault
  vaultMaxHeight: 1.35,
  vaultMinHeight: 0.35,
  vaultForwardCheckDist: 0.9,
  vaultDuration: 0.38,
  mantleMaxHeight: 2.4,
  mantleDuration: 0.5,

  // Climb (ladders / climbable surfaces)
  climbSpeed: 3.6,

  acceleration: 45,
  deceleration: 55,
};

export const WEAPON_TYPES = {
  PISTOL: 'pistol',
  SMG: 'smg',
  ASSAULT_RIFLE: 'assault_rifle',
  SHOTGUN: 'shotgun',
  SNIPER: 'sniper',
};

// Hitscan weapon definitions. fireRate = shots per second.
export const WEAPONS = {
  [WEAPON_TYPES.PISTOL]: {
    id: WEAPON_TYPES.PISTOL,
    name: 'Sidearm',
    damage: 22,
    headshotMultiplier: 2,
    fireRate: 4.5,
    automatic: false,
    magSize: 12,
    reserveMax: 60,
    reloadTime: 1.1,
    range: 55,
    falloffStart: 25,
    falloffMultiplier: 0.6,
    baseSpread: 0.012,
    movingSpreadMultiplier: 1.8,
    adsSpreadMultiplier: 0.35,
    recoilPerShot: 0.9,
    recoilRecovery: 6,
    equipTime: 0.35,
  },
  [WEAPON_TYPES.SMG]: {
    id: WEAPON_TYPES.SMG,
    name: 'Ravager SMG',
    damage: 15,
    headshotMultiplier: 1.8,
    fireRate: 11,
    automatic: true,
    magSize: 30,
    reserveMax: 150,
    reloadTime: 1.6,
    range: 30,
    falloffStart: 12,
    falloffMultiplier: 0.55,
    baseSpread: 0.02,
    movingSpreadMultiplier: 1.4,
    adsSpreadMultiplier: 0.4,
    recoilPerShot: 0.6,
    recoilRecovery: 9,
    equipTime: 0.3,
  },
  [WEAPON_TYPES.ASSAULT_RIFLE]: {
    id: WEAPON_TYPES.ASSAULT_RIFLE,
    name: 'Falcon AR',
    damage: 24,
    headshotMultiplier: 2,
    fireRate: 8,
    automatic: true,
    magSize: 25,
    reserveMax: 120,
    reloadTime: 2.0,
    range: 60,
    falloffStart: 30,
    falloffMultiplier: 0.65,
    baseSpread: 0.016,
    movingSpreadMultiplier: 1.6,
    adsSpreadMultiplier: 0.3,
    recoilPerShot: 1.1,
    recoilRecovery: 7,
    equipTime: 0.4,
  },
  [WEAPON_TYPES.SHOTGUN]: {
    id: WEAPON_TYPES.SHOTGUN,
    name: 'Breacher',
    damage: 11,
    pellets: 8,
    headshotMultiplier: 1.5,
    fireRate: 1.1,
    automatic: false,
    magSize: 6,
    reserveMax: 30,
    reloadTime: 0.55, // per-shell reload
    reloadPerShell: true,
    range: 14,
    falloffStart: 6,
    falloffMultiplier: 0.35,
    baseSpread: 0.09,
    movingSpreadMultiplier: 1.3,
    adsSpreadMultiplier: 0.75,
    recoilPerShot: 2.4,
    recoilRecovery: 5,
    equipTime: 0.45,
  },
  [WEAPON_TYPES.SNIPER]: {
    id: WEAPON_TYPES.SNIPER,
    name: 'Longshot',
    damage: 85,
    headshotMultiplier: 2.5,
    fireRate: 0.85,
    automatic: false,
    magSize: 5,
    reserveMax: 20,
    reloadTime: 2.4,
    range: 150,
    falloffStart: 150,
    falloffMultiplier: 1,
    baseSpread: 0.002,
    movingSpreadMultiplier: 3,
    adsSpreadMultiplier: 0.02,
    recoilPerShot: 3.2,
    recoilRecovery: 4,
    equipTime: 0.55,
    boltAction: true,
  },
};

export const BUILDING = {
  pieces: {
    wall: { id: 'wall', health: 150, cost: 10, buildTime: 0.25, width: 3, height: 3, thickness: 0.25 },
    ramp: { id: 'ramp', health: 120, cost: 10, buildTime: 0.3, width: 3, height: 3, depth: 3 },
    platform: { id: 'platform', health: 130, cost: 12, buildTime: 0.3, width: 3, depth: 3, thickness: 0.25 },
  },
  maxPlaceDistance: 6,
  gridSize: 3,
  startingResources: 100,
  maxResources: 500,
  resourcePerScrapPickup: 25,
};

export const HEALTH = {
  maxHealth: 100,
  maxShield: 100,
  shieldDamageAbsorb: 0.66, // portion of incoming damage shield soaks while > 0
  fallDamageMinHeight: 5.5,
  fallDamageMultiplier: 9,
  respawnTime: 4, // seconds, non-BR modes
};

export const GAME_MODES = {
  TEAM_DEATHMATCH: 'team_deathmatch',
  FREE_FOR_ALL: 'free_for_all',
  BATTLE_ROYALE: 'battle_royale',
  PARKOUR_RACE: 'parkour_race',
};

export const MODE_CONFIG = {
  [GAME_MODES.TEAM_DEATHMATCH]: {
    label: 'Team Deathmatch',
    teams: 2,
    scoreLimit: 50,
    timeLimit: 600,
    respawns: true,
  },
  [GAME_MODES.FREE_FOR_ALL]: {
    label: 'Free-for-All',
    teams: 0,
    scoreLimit: 30,
    timeLimit: 600,
    respawns: true,
  },
  [GAME_MODES.BATTLE_ROYALE]: {
    label: 'Battle Royale',
    teams: 0,
    timeLimit: 900,
    respawns: false,
    stormShrinkIntervals: [60, 55, 50, 45, 40, 35, 30, 25],
  },
  [GAME_MODES.PARKOUR_RACE]: {
    label: 'Parkour Race',
    teams: 0,
    timeLimit: 300,
    respawns: true,
    laps: 1,
  },
};

export const XP = {
  killReward: 100,
  headshotBonus: 25,
  assistReward: 40,
  winReward: 250,
  placementRewardPerRank: 8, // BR: bonus per rank climbed toward #1
  matchCompleteReward: 60,
  checkpointReward: 15, // parkour race
  levelCurveBase: 400,
  levelCurveGrowth: 1.12,
  coinsPerKill: 15,
  coinsPerWin: 100,
  coinsPerMatch: 25,
};

export function xpForLevel(level) {
  return Math.round(XP.levelCurveBase * Math.pow(XP.levelCurveGrowth, level - 1));
}

export const PLAYER_RADIUS = MOVEMENT.capsuleRadius;

export const MAP = {
  size: 400, // half-extent of the play area (square, -size..size)
  killPlaneY: -25,
};
