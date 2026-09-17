export function isTouchDevice() {
  return ('ontouchstart' in window || navigator.maxTouchPoints > 0) && window.matchMedia('(pointer: coarse)').matches;
}

export function getOrCreateProfileId() {
  let id = localStorage.getItem('hs_profile_id');
  if (!id) {
    id = 'p_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('hs_profile_id', id);
  }
  return id;
}

export function loadSettings() {
  const defaults = {
    sensitivity: 1, fov: 90, volume: 0.6, forceMobile: false, invertY: false, graphics: 'high',
    sprintMode: 'hold', crouchMode: 'hold', aimMode: 'hold', controlSize: 1,
  };
  try {
    const raw = localStorage.getItem('hs_settings');
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
  } catch {
    return defaults;
  }
}

export function saveSettings(settings) {
  localStorage.setItem('hs_settings', JSON.stringify(settings));
}
