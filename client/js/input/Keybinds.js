// Rebindable desktop key configuration. Mouse buttons (fire/aim) stay fixed -
// remapping those has far lower value and a much fussier UI, so it's out of
// scope. Everything keyboard-driven is remappable and persisted locally.
export const DEFAULT_KEYBINDS = {
  moveForward: 'KeyW',
  moveBack: 'KeyS',
  moveLeft: 'KeyA',
  moveRight: 'KeyD',
  jump: 'Space',
  sprint: 'ShiftLeft',
  crouch: 'KeyC',
  reload: 'KeyR',
  toggleBuild: 'KeyB',
  weapon1: 'Digit1',
  weapon2: 'Digit2',
  weapon3: 'Digit3',
  buildWall: 'Digit4',
  buildRamp: 'Digit5',
  buildPlatform: 'Digit6',
};

export const ACTION_LABELS = {
  moveForward: 'Move Forward',
  moveBack: 'Move Back',
  moveLeft: 'Move Left',
  moveRight: 'Move Right',
  jump: 'Jump',
  sprint: 'Sprint',
  crouch: 'Crouch / Slide',
  reload: 'Reload',
  toggleBuild: 'Toggle Build Menu',
  weapon1: 'Weapon Slot 1',
  weapon2: 'Weapon Slot 2',
  weapon3: 'Weapon Slot 3',
  buildWall: 'Select Wall',
  buildRamp: 'Select Ramp',
  buildPlatform: 'Select Platform',
};

const STORAGE_KEY = 'hs_keybinds';

export function loadKeybinds() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return { ...DEFAULT_KEYBINDS, ...parsed };
  } catch {
    return { ...DEFAULT_KEYBINDS };
  }
}

export function saveKeybinds(binds) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(binds));
}

// Human-readable label for a KeyboardEvent.code value.
export function codeToLabel(code) {
  if (!code) return '—';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const special = {
    Space: 'Space', ShiftLeft: 'L-Shift', ShiftRight: 'R-Shift',
    ControlLeft: 'L-Ctrl', ControlRight: 'R-Ctrl', AltLeft: 'L-Alt', AltRight: 'R-Alt',
    Tab: 'Tab', CapsLock: 'Caps', Escape: 'Esc',
  };
  return special[code] || code;
}

// If `code` is already bound to a different action, clear that binding so a
// single key press never silently triggers two actions at once.
export function rebind(binds, action, code) {
  const next = { ...binds };
  for (const key of Object.keys(next)) {
    if (key !== action && next[key] === code) next[key] = null;
  }
  next[action] = code;
  return next;
}
