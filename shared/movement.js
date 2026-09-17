// Deterministic parkour movement simulation. Runs identically on the client
// (for instant local prediction) and on the server (as the single source of
// truth). Never trust a client-computed position - the server always re-runs
// this same function over the client's raw inputs and uses ITS OWN result.
import { MOVEMENT, WORLD, HEALTH } from './constants.js';
import { groundHeightAt, resolveHorizontal, probeWalls, raycastBlocks, findLadderAt } from './collision.js';

export function createMovementState(pos = [0, 2, 0]) {
  return {
    pos: [...pos],
    vel: [0, 0, 0],
    yaw: 0,
    grounded: false,
    crouching: false,
    sliding: false,
    slideTimer: 0,
    slideDir: [0, 0],
    wallRunning: false,
    wallRunSide: null,
    wallRunTimer: 0,
    wallRunNormal: [0, 0],
    climbing: false,
    vaulting: false,
    vaultTimer: 0,
    vaultFrom: null,
    vaultTo: null,
    vaultKind: null,
    coyoteTimer: 0,
    jumpBufferTimer: 0,
    airborneFallStartY: null,
    canDoubleActionLock: false,
  };
}

function forwardRight(yaw) {
  const forward = [Math.sin(yaw), 0, Math.cos(yaw)];
  const right = [Math.cos(yaw), 0, -Math.sin(yaw)];
  return { forward, right };
}

function len2(x, z) {
  return Math.sqrt(x * x + z * z);
}

function approach(current, target, rate, dt) {
  const diff = target - current;
  const maxStep = rate * dt;
  if (Math.abs(diff) <= maxStep) return target;
  return current + Math.sign(diff) * maxStep;
}

// input: { moveX, moveZ (both -1..1, local space: moveZ+ = forward), yaw,
//          jumpPressed, jumpHeld, sprint, crouch, slidePressed, dt, useHeld }
export function simulateMovementTick(state, input, blocks) {
  const dt = input.dt;
  const events = [];
  state.yaw = input.yaw;
  const { forward, right } = forwardRight(input.yaw);

  // ---- timers ----
  if (state.coyoteTimer > 0) state.coyoteTimer -= dt;
  if (input.jumpPressed) state.jumpBufferTimer = MOVEMENT.jumpBufferTime;
  else if (state.jumpBufferTimer > 0) state.jumpBufferTimer -= dt;

  // ---- Vaulting / Mantling: kinematic interpolation, no physics this tick ----
  if (state.vaulting) {
    state.vaultTimer -= dt;
    const dur = state.vaultKind === 'mantle' ? MOVEMENT.mantleDuration : MOVEMENT.vaultDuration;
    const t = Math.min(1, Math.max(0, 1 - state.vaultTimer / dur));
    const ease = t * t * (3 - 2 * t);
    for (let i = 0; i < 3; i++) {
      state.pos[i] = state.vaultFrom[i] + (state.vaultTo[i] - state.vaultFrom[i]) * ease;
    }
    if (state.vaultTimer <= 0) {
      state.vaulting = false;
      state.vel = [0, 0, 0];
      state.grounded = true;
      events.push({ type: 'vaultEnd' });
    }
    return events;
  }

  // ---- Climbing ----
  const ladder = findLadderAt(state.pos[0], state.pos[1] + 0.9, state.pos[2], blocks);
  if (state.climbing) {
    if (!ladder || input.jumpPressed) {
      state.climbing = false;
      if (input.jumpPressed) {
        state.vel = [forward[0] * -3, MOVEMENT.jumpVelocity * 0.8, forward[2] * -3];
        events.push({ type: 'jump' });
      }
    } else {
      state.vel = [0, (input.moveZ * MOVEMENT.climbSpeed) || (input.jumpHeld ? MOVEMENT.climbSpeed : 0), 0];
      state.pos[1] += state.vel[1] * dt;
      state.grounded = false;
      return events;
    }
  } else if (ladder && input.moveZ > 0.4) {
    // Grab ladder when walking into it.
    state.climbing = true;
    state.vel = [0, 0, 0];
    events.push({ type: 'grabLadder' });
    return events;
  }

  // ---- Wall running ----
  const speedNow = len2(state.vel[0], state.vel[2]);
  if (!state.grounded && !state.climbing) {
    const wallProbe = probeWalls(state.pos, right, blocks, MOVEMENT.wallRunRayLength);
    const groundBelow = groundHeightAt(state.pos[0], state.pos[2], blocks, state.pos[1] - 0.1);
    const heightAboveGround = state.pos[1] - groundBelow;
    const wantsWallRun =
      wallProbe &&
      heightAboveGround > MOVEMENT.wallRunMinHeightAboveGround &&
      input.moveZ > 0.3 &&
      (state.wallRunning || speedNow > MOVEMENT.wallRunMinSpeed);

    if (wantsWallRun) {
      if (!state.wallRunning) events.push({ type: 'wallRunStart' });
      state.wallRunning = true;
      state.wallRunSide = wallProbe.side;
      state.wallRunTimer += dt;
      // Tangent direction along the wall, aligned with player's forward intent.
      const nx = wallProbe.side === 'right' ? right[0] : -right[0];
      const nz = wallProbe.side === 'right' ? right[2] : -right[2];
      state.wallRunNormal = [nx, nz];
      const tangent = [-nz, nx]; // rotate normal 90deg to get wall-parallel direction
      const dot = tangent[0] * forward[0] + tangent[1] * forward[2];
      const dir = dot >= 0 ? tangent : [-tangent[0], -tangent[1]];
      state.vel[0] = dir[0] * MOVEMENT.wallRunSpeed;
      state.vel[2] = dir[1] * MOVEMENT.wallRunSpeed;
      state.vel[1] -= WORLD.gravity * MOVEMENT.wallRunGravityScale * dt;

      if (input.jumpPressed) {
        state.vel[0] += nx * MOVEMENT.wallRunJumpAwayForce;
        state.vel[2] += nz * MOVEMENT.wallRunJumpAwayForce;
        state.vel[1] = MOVEMENT.wallRunJumpVelocity;
        state.wallRunning = false;
        state.wallRunTimer = 0;
        events.push({ type: 'wallJump' });
      } else if (state.wallRunTimer >= MOVEMENT.wallRunMaxTime) {
        state.wallRunning = false;
        state.wallRunTimer = 0;
      }
    } else if (state.wallRunning) {
      state.wallRunning = false;
      state.wallRunTimer = 0;
    }
  } else if (state.wallRunning) {
    state.wallRunning = false;
    state.wallRunTimer = 0;
  }

  // ---- Vault / Mantle trigger (works while grounded or airborne) ----
  if (!state.wallRunning && input.moveZ > 0.5) {
    // Cast low (just above the minimum vaultable height) so short obstacles
    // aren't missed by a ray that would otherwise pass over their top.
    const probeOrigin = [state.pos[0], state.pos[1] + MOVEMENT.vaultMinHeight + 0.05, state.pos[2]];
    const hit = raycastBlocks(probeOrigin, forward, MOVEMENT.vaultForwardCheckDist, blocks, (b) => b.type === 'box');
    if (hit && state.jumpBufferTimer > 0) {
      const bounds = boundsTop(hit.block);
      const obstacleHeight = bounds.maxY - state.pos[1];
      const clearAbove = !raycastBlocks(
        [state.pos[0], bounds.maxY + 0.3, state.pos[2]],
        forward,
        MOVEMENT.vaultForwardCheckDist + 0.6,
        blocks,
        (b) => b.type === 'box'
      );
      if (obstacleHeight >= MOVEMENT.vaultMinHeight && obstacleHeight <= MOVEMENT.vaultMaxHeight && clearAbove) {
        startVault(state, forward, bounds.maxY, 'vault');
        state.jumpBufferTimer = 0;
        events.push({ type: 'vaultStart' });
        return events;
      } else if (obstacleHeight > MOVEMENT.vaultMaxHeight && obstacleHeight <= MOVEMENT.mantleMaxHeight && clearAbove) {
        startVault(state, forward, bounds.maxY, 'mantle');
        state.jumpBufferTimer = 0;
        events.push({ type: 'mantleStart' });
        return events;
      }
    }
  }

  // ---- Sliding ----
  if (input.slidePressed && state.grounded && !state.sliding && speedNow > MOVEMENT.slideMinSpeedToStart) {
    state.sliding = true;
    state.slideTimer = MOVEMENT.slideDuration;
    const mag = speedNow || 1;
    state.slideDir = [state.vel[0] / mag, state.vel[2] / mag];
    state.vel[0] = state.slideDir[0] * MOVEMENT.slideStartSpeed;
    state.vel[2] = state.slideDir[1] * MOVEMENT.slideStartSpeed;
    events.push({ type: 'slideStart' });
  }
  if (state.sliding) {
    state.slideTimer -= dt;
    const cur = len2(state.vel[0], state.vel[2]);
    const next = Math.max(0, cur - MOVEMENT.slideFriction * dt);
    const scale = cur > 0 ? next / cur : 0;
    state.vel[0] *= scale;
    state.vel[2] *= scale;
    if (state.slideTimer <= 0 || next < MOVEMENT.crouchSpeed * 0.5) {
      state.sliding = false;
    }
  }

  state.crouching = input.crouch || state.sliding;

  // ---- Horizontal acceleration (skipped while sliding or wall-running) ----
  if (!state.sliding && !state.wallRunning) {
    const wishX = right[0] * input.moveX + forward[0] * input.moveZ;
    const wishZ = right[2] * input.moveX + forward[2] * input.moveZ;
    const wishLen = len2(wishX, wishZ);
    const norm = wishLen > 1 ? wishLen : 1;
    const maxSpeed = state.crouching
      ? MOVEMENT.crouchSpeed
      : input.sprint && input.moveZ > 0.1
      ? MOVEMENT.sprintSpeed
      : MOVEMENT.walkSpeed;
    const targetX = wishLen > 0 ? (wishX / norm) * maxSpeed : 0;
    const targetZ = wishLen > 0 ? (wishZ / norm) * maxSpeed : 0;
    const rate = state.grounded
      ? wishLen > 0
        ? MOVEMENT.acceleration
        : MOVEMENT.deceleration
      : MOVEMENT.acceleration * MOVEMENT.airControl;
    state.vel[0] = approach(state.vel[0], targetX, rate, dt);
    state.vel[2] = approach(state.vel[2], targetZ, rate, dt);
  }

  // ---- Jump ----
  const canJump = state.grounded || state.coyoteTimer > 0;
  if (canJump && state.jumpBufferTimer > 0 && !state.sliding) {
    state.vel[1] = MOVEMENT.jumpVelocity;
    state.grounded = false;
    state.coyoteTimer = 0;
    state.jumpBufferTimer = 0;
    events.push({ type: 'jump' });
  }

  // ---- Gravity ----
  if (!state.grounded && !state.wallRunning) {
    state.vel[1] -= WORLD.gravity * dt;
    if (state.vel[1] < -WORLD.terminalVelocity) state.vel[1] = -WORLD.terminalVelocity;
    if (state.airborneFallStartY === null) state.airborneFallStartY = state.pos[1];
  }

  // ---- Integrate + collide ----
  const wasGrounded = state.grounded;
  const nextX = state.pos[0] + state.vel[0] * dt;
  const nextZ = state.pos[2] + state.vel[2] * dt;
  const resolved = resolveHorizontal(nextX, nextZ, MOVEMENT.capsuleRadius, blocks, state.pos[1] + 0.1, state.pos[1] + (state.crouching ? MOVEMENT.capsuleHeightCrouch : MOVEMENT.capsuleHeightStand));
  state.pos[0] = resolved.x;
  state.pos[2] = resolved.z;

  const nextY = state.pos[1] + state.vel[1] * dt;
  const groundY = groundHeightAt(state.pos[0], state.pos[2], blocks, nextY + 0.9);
  if (nextY <= groundY + 0.02) {
    if (!wasGrounded && state.airborneFallStartY !== null) {
      const dropDist = state.airborneFallStartY - groundY;
      if (dropDist > HEALTH.fallDamageMinHeight) {
        events.push({ type: 'fallDamage', amount: (dropDist - HEALTH.fallDamageMinHeight) * HEALTH.fallDamageMultiplier });
      }
      events.push({ type: 'land' });
    }
    state.pos[1] = groundY;
    state.vel[1] = 0;
    state.grounded = true;
    state.coyoteTimer = MOVEMENT.coyoteTime;
    state.airborneFallStartY = null;
  } else {
    state.pos[1] = nextY;
    state.grounded = false;
  }

  return events;
}

function boundsTop(block) {
  const h = block.size[1];
  return { maxY: block.pos[1] + h / 2 };
}

function startVault(state, forward, obstacleTopY, kind) {
  state.vaulting = true;
  state.vaultKind = kind;
  state.vaultTimer = kind === 'mantle' ? MOVEMENT.mantleDuration : MOVEMENT.vaultDuration;
  state.vaultFrom = [...state.pos];
  const dist = kind === 'mantle' ? 1.4 : 1.6;
  state.vaultTo = [
    state.pos[0] + forward[0] * dist,
    obstacleTopY + 0.05,
    state.pos[2] + forward[2] * dist,
  ];
}
