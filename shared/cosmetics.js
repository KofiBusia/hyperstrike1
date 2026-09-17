// Cosmetic catalog - purely visual, no stat effects, unlocked with in-match
// earned coins/levels only (no real-money purchase path in this project).
export const COSMETICS = [
  { id: 'default_outfit', type: 'outfit', name: 'Recruit Fatigues', color: '#5b6b7c', unlockLevel: 1, cost: 0 },
  { id: 'outfit_crimson', type: 'outfit', name: 'Crimson Vanguard', color: '#c1443c', unlockLevel: 3, cost: 200 },
  { id: 'outfit_azure', type: 'outfit', name: 'Azure Runner', color: '#3d7fc1', unlockLevel: 5, cost: 250 },
  { id: 'outfit_toxic', type: 'outfit', name: 'Toxic Drift', color: '#7fc13d', unlockLevel: 8, cost: 350 },
  { id: 'outfit_gold', type: 'outfit', name: 'Gilded Operative', color: '#d4af37', unlockLevel: 15, cost: 600 },

  { id: 'default_skin', type: 'weaponSkin', name: 'Standard Issue', color: '#8a8f98', unlockLevel: 1, cost: 0 },
  { id: 'skin_carbon', type: 'weaponSkin', name: 'Carbon Weave', color: '#2b2f36', unlockLevel: 4, cost: 220 },
  { id: 'skin_neon', type: 'weaponSkin', name: 'Neon Circuit', color: '#38f2c8', unlockLevel: 7, cost: 300 },
  { id: 'skin_magma', type: 'weaponSkin', name: 'Magma Core', color: '#ff6a3d', unlockLevel: 12, cost: 450 },

  { id: 'default_trail', type: 'trail', name: 'None', color: '#ffffff', unlockLevel: 1, cost: 0 },
  { id: 'trail_spark', type: 'trail', name: 'Spark Trail', color: '#ffd23d', unlockLevel: 6, cost: 280 },
  { id: 'trail_frost', type: 'trail', name: 'Frost Trail', color: '#8fe3ff', unlockLevel: 9, cost: 320 },
  { id: 'trail_void', type: 'trail', name: 'Void Trail', color: '#b23dff', unlockLevel: 14, cost: 500 },

  { id: 'emote_wave', type: 'emote', name: 'Wave', unlockLevel: 2, cost: 100 },
  { id: 'emote_dance', type: 'emote', name: 'Victory Dance', unlockLevel: 6, cost: 250 },
  { id: 'emote_salute', type: 'emote', name: 'Salute', unlockLevel: 10, cost: 300 },
];

export function getCosmetic(id) {
  return COSMETICS.find((c) => c.id === id) || null;
}

export function cosmeticsForType(type) {
  return COSMETICS.filter((c) => c.type === type);
}
