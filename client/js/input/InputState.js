// Single shared input state written to by either desktop (keyboard/mouse) or
// mobile (touch) input sources, and read once per frame by the game loop.
export const InputState = {
  moveX: 0,
  moveZ: 0,
  yaw: 0,
  pitch: 0,
  sprint: false,
  crouch: false,
  ads: false,
  fireHeld: false,

  // Edge-triggered flags - consumed (reset to false) after being read once.
  jumpPressed: false,
  slidePressed: false,
  firePressedEdge: false,
  reloadPressed: false,
  buildPressed: false,
  switchWeaponIndex: -1,
  buildPieceSelect: -1,

  jumpHeld: false,
};

export function consumeEdges() {
  InputState.jumpPressed = false;
  InputState.slidePressed = false;
  InputState.firePressedEdge = false;
  InputState.reloadPressed = false;
  InputState.buildPressed = false;
  InputState.switchWeaponIndex = -1;
  InputState.buildPieceSelect = -1;
}
