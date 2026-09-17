import teamDeathmatch from './teamDeathmatch.js';
import freeForAll from './freeForAll.js';
import battleRoyale from './battleRoyale.js';
import parkourRace from './parkourRace.js';
import { GAME_MODES } from '../../../shared/constants.js';

const registry = {
  [GAME_MODES.TEAM_DEATHMATCH]: teamDeathmatch,
  [GAME_MODES.FREE_FOR_ALL]: freeForAll,
  [GAME_MODES.BATTLE_ROYALE]: battleRoyale,
  [GAME_MODES.PARKOUR_RACE]: parkourRace,
};

export function getModeController(modeId) {
  const controller = registry[modeId];
  if (!controller) throw new Error(`Unknown game mode: ${modeId}`);
  return controller;
}
