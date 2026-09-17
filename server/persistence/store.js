// Minimal file-backed persistence for player progression (XP, coins, unlocks).
// No external DB dependency is required for a project this size; writes are
// serialized through a promise chain so concurrent saves can't corrupt the file.
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, '..', 'data', 'players.json');

let cache = null;
let writeQueue = Promise.resolve();

async function ensureLoaded() {
  if (cache) return cache;
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf-8');
    cache = JSON.parse(raw);
  } catch (err) {
    cache = {};
  }
  return cache;
}

function persist() {
  writeQueue = writeQueue.then(async () => {
    try {
      await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
      await fs.writeFile(DATA_FILE, JSON.stringify(cache, null, 2), 'utf-8');
    } catch (err) {
      console.error('[store] failed to persist players.json:', err.message);
    }
  });
  return writeQueue;
}

export async function getProfile(profileId) {
  const db = await ensureLoaded();
  if (!db[profileId]) {
    db[profileId] = {
      xp: 0,
      level: 1,
      coins: 150,
      kills: 0,
      deaths: 0,
      wins: 0,
      matchesPlayed: 0,
      unlocked: ['default_outfit', 'default_skin', 'default_trail'],
      equipped: { outfit: 'default_outfit', weaponSkin: 'default_skin', trail: 'default_trail', emote: null },
    };
    persist();
  }
  return db[profileId];
}

export async function saveProfile(profileId, profile) {
  const db = await ensureLoaded();
  db[profileId] = profile;
  persist();
}

export async function updateProfile(profileId, mutator) {
  const db = await ensureLoaded();
  const profile = await getProfile(profileId);
  mutator(profile);
  db[profileId] = profile;
  persist();
  return profile;
}
