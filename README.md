# Hyper Strike

An original fast-paced multiplayer parkour shooter: server-authoritative combat,
custom parkour movement (sprint, slide, crouch, vault, mantle, wall-run, ladder
climb), a simple building system, four game modes, and progression/cosmetics.
Runs in the browser (desktop + mobile) — Node.js/Socket.io server, Three.js client.

## Run it

```
npm install
npm start
```

Then open `http://localhost:3000` in a browser. Open it in two tabs (or from
two devices on the same network, using your machine's LAN IP) to play multiplayer.

## Controls (desktop)

- `WASD` move, mouse look, `Space` jump, `Shift` sprint, `C` crouch (crouch
  while sprinting = slide), `R` reload, `1`/`2`/`3` switch weapon, mouse wheel
  cycles weapons.
- Right-click to aim down sights, left-click to fire.
- `B` or `Tab` toggles the build menu; `4`/`5`/`6` pick wall/ramp/platform;
  left-click places while the build menu is open.
- Run at a low obstacle and jump near it to vault/mantle automatically. Run
  alongside a tall wall while airborne to wall-run; jump again to wall-jump.
  Walk into a ladder and hold forward to climb.

Touch devices (or "Force Mobile Controls" in Settings) get an on-screen
joystick, look pad, and action buttons instead.

## Architecture

- `shared/` — code shared by client and server so movement/collision/combat
  math can't drift between prediction and authority: map layout generator,
  collision primitives, the parkour movement simulation, weapon/game-mode
  constants, cosmetics catalog, build-piece definitions.
- `server/` — authoritative game server (Express + Socket.io). Owns player
  positions, damage, ammo, building, scoring, storm shrink, XP/coins, and
  persistence (`server/data/players.json`). Clients only ever send *inputs*
  (movement axes, fire/build requests) — never positions or damage claims.
- `client/` — Three.js renderer, input handling (desktop + touch), client-side
  movement prediction (using the exact same `shared/movement.js` the server
  runs) with server reconciliation, HUD, menus, locker, and mobile controls.

## Notes on scope

This is a genuine, playable vertical slice of everything requested — all four
modes, full parkour movement, hit-scan combat with 5 weapon types, building,
pickups, progression/cosmetics, and mobile controls — built with lightweight
custom collision (no physics engine) so it runs well in-browser on modest
hardware. It's an original art direction (flat-shaded low-poly geometry,
no borrowed assets/names/sounds). Things a longer production pass would add:
squads/duos for battle royale, richer character/weapon models, sound design,
and a proper matchmaking/lobby system beyond "one shared match per mode."
