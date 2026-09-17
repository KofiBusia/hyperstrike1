import { XP, xpForLevel } from '../../shared/constants.js';
import { getProfile, updateProfile } from './store.js';

async function applyGain(profileId, xpGain, coinGain, statMutator) {
  const leveledUp = [];
  const profile = await updateProfile(profileId, (p) => {
    p.xp += xpGain;
    p.coins += coinGain;
    if (statMutator) statMutator(p);
    while (p.xp >= xpForLevel(p.level)) {
      p.xp -= xpForLevel(p.level);
      p.level += 1;
      leveledUp.push(p.level);
    }
  });
  return { profile, xpGain, coinGain, leveledUp };
}

export async function grantKillReward(profileId, { headshot = false } = {}) {
  const xpGain = XP.killReward + (headshot ? XP.headshotBonus : 0);
  return applyGain(profileId, xpGain, XP.coinsPerKill, (p) => {
    p.kills += 1;
  });
}

export async function grantCheckpointReward(profileId) {
  return applyGain(profileId, XP.checkpointReward, 0);
}

export async function grantMatchEndReward(profileId, { won = false } = {}) {
  let xpGain = XP.matchCompleteReward;
  let coinGain = XP.coinsPerMatch;
  if (won) {
    xpGain += XP.winReward;
    coinGain += XP.coinsPerWin;
  }
  return applyGain(profileId, xpGain, coinGain, (p) => {
    p.matchesPlayed += 1;
    if (won) p.wins += 1;
  });
}

export async function getPlayerProfile(profileId) {
  return getProfile(profileId);
}

export async function purchaseCosmetic(profileId, cosmetic) {
  return updateProfile(profileId, (p) => {
    if (p.unlocked.includes(cosmetic.id)) return;
    if (p.level < cosmetic.unlockLevel) throw new Error('Level too low');
    if (p.coins < cosmetic.cost) throw new Error('Not enough coins');
    p.coins -= cosmetic.cost;
    p.unlocked.push(cosmetic.id);
  });
}

export async function equipCosmetic(profileId, cosmetic) {
  return updateProfile(profileId, (p) => {
    if (!p.unlocked.includes(cosmetic.id)) throw new Error('Not unlocked');
    p.equipped[cosmetic.type] = cosmetic.id;
  });
}
