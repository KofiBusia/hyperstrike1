import { WEAPON_TYPES } from './constants.js';

// Static equipment pickup spawn points scattered across the map. Server-authoritative
// collection: a player is granted the item only when the SERVER'S simulated position
// (not anything the client claims) is within range.
export const PICKUP_RESPAWN_MS = 25000;

export const PICKUP_POINTS = [
  { id: 'pk_smg_1', pos: [14, 1, 14], type: 'weapon', weaponId: WEAPON_TYPES.SMG },
  { id: 'pk_shotgun_1', pos: [-14, 1, 14], type: 'weapon', weaponId: WEAPON_TYPES.SHOTGUN },
  { id: 'pk_sniper_1', pos: [0, 18.5, 13.5], type: 'weapon', weaponId: WEAPON_TYPES.SNIPER },
  { id: 'pk_ar_1', pos: [26, 8.5, -26], type: 'weapon', weaponId: WEAPON_TYPES.ASSAULT_RIFLE },
  { id: 'pk_pistol_1', pos: [-26, 1, -26], type: 'weapon', weaponId: WEAPON_TYPES.PISTOL },
  { id: 'pk_smg_2', pos: [62.4, 4.5, 62.4], type: 'weapon', weaponId: WEAPON_TYPES.SMG },
  { id: 'pk_shotgun_2', pos: [-40, 4, -73.6], type: 'weapon', weaponId: WEAPON_TYPES.SHOTGUN },

  { id: 'pk_ammo_1', pos: [8, 1, -8], type: 'ammo' },
  { id: 'pk_ammo_2', pos: [-8, 1, -8], type: 'ammo' },
  { id: 'pk_ammo_3', pos: [8, 1, 8], type: 'ammo' },
  { id: 'pk_ammo_4', pos: [52, 22, 52], type: 'ammo' },

  { id: 'pk_resource_1', pos: [20, 1, 0], type: 'resource' },
  { id: 'pk_resource_2', pos: [-20, 1, 0], type: 'resource' },
  { id: 'pk_resource_3', pos: [0, 1, 20], type: 'resource' },
  { id: 'pk_resource_4', pos: [0, 1, -20], type: 'resource' },
  { id: 'pk_resource_5', pos: [62.4, 4.5, 62.4 - 8], type: 'resource' },

  { id: 'pk_shield_1', pos: [0, 1, -3], type: 'shield' },
  { id: 'pk_shield_2', pos: [30, 22, 30], type: 'shield' },
  { id: 'pk_shield_3', pos: [-90, 2, -85], type: 'shield' },
  { id: 'pk_shield_4', pos: [90, 2, 85], type: 'shield' },
];

export const PICKUP_RADIUS = 1.6;
