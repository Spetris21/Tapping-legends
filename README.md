# Tapping Legends

A 3D multiplayer tap simulator for lunch breaks. Tap, hatch pets, rebirth, beat the obby, take down the Tap Titan boss together, and trade with friends.

Made by **Parker** and **Wolfie**.

## Run it on your computer

1. Install Node.js 18 or newer (nodejs.org).
2. Open a terminal in this folder and run:
   ```
   npm install
   npm start
   ```
3. Open http://localhost:3000. Friends on the same network can open `http://<your-computer's-IP>:3000`.

**Offline (no server):** double-click `TappingLegends-offline.html`. It's one file with everything inside, so it works anywhere. Guest mode only: accounts, the boss, trading and the leaderboard need the server. If you change the code, rebuild it with `npm run offline`.

(`public/index.html` also works as a file, but only while it sits next to the other files in `public/`.)

## Hosting it online

Any Node host works: Railway, Render, Fly.io, or a spare PC.
- Start command: `npm start`. The server reads the `PORT` it is given.
- **Saves live in `data/db.json`.** Many free hosts wipe files when they restart, which would delete every account. Attach a persistent disk or volume and set the env var `DATA_DIR` to its path (for example `DATA_DIR=/data`).
- Use the `https://` address your host gives you, so passwords are encrypted on the way to the server.
- A backup is kept at `data/db.json.bak` and trades are logged to `data/trades.log`.

## Controls

| Key | Action |
|---|---|
| WASD / arrows | Move |
| Space | Jump |
| Click / hold | Tap (holding taps 6 times a second). Max 15 clicks per second |
| E | Use the glowing pad you're standing on |
| Shift | Shift lock (mouse turns the camera, character faces forward). Esc to exit |
| Right-drag, Q/R | Turn the camera |
| Scroll | Zoom |
| Enter | Chat |
| G | Emote wheel (wave, dance, flex, tap spam) |

On a phone or tablet, use the joystick plus the JUMP and USE buttons.

## Events (server clock, each lasts 3 minutes, never overlapping)

- ⚡ Frenzy (2x taps): :00, :20, :40
- ⚔️ Tap Titan boss: :10, :30, :50. Everyone online needs 1,000 hits together. Hit it at least 25 times to get the reward.
- 🍀 Lucky Eggs (2x luck): :15, :45

## Nebula Moon

Buy the rocket in the Space Station hangar (5 rebirths + 600M taps, kept forever), stand on the pad and press E.
On the moon: low gravity, meteor showers every 2.5 minutes (stand in the glowing rings to catch them for ✨ Stardust),
jetpack and bounce pads up to floating platforms, the Moon Egg and Nebula Egg (moon pets are kept through rebirths),
the Stardust Shop, the Shiny Machine (5 of the same pet = 1 Shiny with 2x power) and the moon obby:
29 floating rocks up a giant crystal with sliding and vanishing rocks, bounce rocks, red crystal spikes, spinning bars
and ⭐ star rings that give you a mid-air jump. Checkpoints every 7 rocks.

## Changing the balance

Every number is in `public/config.js`: egg costs, pet power, rebirth cost, gem amounts, shop prices, event times and boss HP. The server and guest mode both read it.

After changing numbers, run `npm run sim` to see how fast a bot progresses. Pass `npm run sim -- 3` for a slower tapper.

## Files

| File | What it does |
|---|---|
| `server.js` | Web server, WebSocket, accounts, saving, events, boss, trading, weekly board, anti-cheat |
| `public/config.js` | All balance numbers |
| `public/logic.js` | Game rules, shared by the server and the browser |
| `public/engine.js` | Custom WebGL renderer: lights, shadows, fog, textures, particles |
| `public/world.js` | Islands, stations, signs, characters, pets, the Tap Titan |
| `public/ui.js` | HUD, menus, hatch animations, start screen |
| `public/game.js` | Controls, camera, networking, main loop |
| `public/audio.js` | Synthesized sounds and music |
| `tests/` | Headless tests (see below) |

## Tests

- `npm test` runs 35 rule tests (including checks that every obby and moon obby jump is possible), a layout test (nothing built on a footpath), a walk test (a player walks every path, bridge, the hangar and the moon using the real hitboxes) and 20 live server tests (real WebSocket clients against the real server).
- `tests/islands-shots.js`, `tests/visual-tour.js`, `tests/lobby-shots.js`, `tests/moon-shots.js`, `tests/moon-obby-shots.js`, `tests/boss-shots.js`, `tests/browser-account.js` and `tests/browser-trade.js` need Playwright and Chromium. They take screenshots and click through the real UI.

## Fonts

The game bundles **Outfit** (menus and HUD) and **Boldonse** (logo and tap counter), both under the SIL Open Font License. The licence files are in `public/fonts/`.
