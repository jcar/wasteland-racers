# Wasteland Racers

A cartoon Mad Max combat racer for 6-year-olds, modeled on Rock n' Roll Racing. You race junk-built cars around isometric desert tracks, earn scrap every race, and spend it in the garage to make your car faster and tougher. The gadgets are silly: goo, boing bumpers and rocket boosts. Nothing explodes, nobody gets hurt, and every race earns something.

## Play

```bash
npm install
npm run dev        # open http://localhost:5173
```

Or play it online: https://jcar.github.io/wasteland-racers/ (every push to `main` redeploys it through GitHub Actions).

| Key | What it does |
| --- | --- |
| ← → | Steer |
| ↑ | Gas (or turn on Auto gas in Grown-ups) |
| ↓ | Brake |
| Space | Use your gadget (the button glows when you have one) |
| Esc | Pause / back |

Menus work with the arrows and Space, or the mouse.

Grown-up keys on the title screen: **G** opens settings, **M** turns sound on/off, **V** turns voice on/off, and holding **R** for 3 seconds starts a fresh game.

**Grown-ups settings:**
- **Steer help** (Strong/Medium/Off): with no arrow held, the car gently follows the road.
- **Auto gas.**
- **Other racers** (Chill/Normal/Tough): how fast the AI drives.

Start on Strong + Chill and move up as he gets the hang of it.

## How it plays

- **Garage** is the hub. It has five tabs:
  - **Fix Up** has four upgrades with 4 levels each (Engine, Tires, Armor, Gadget). Every level bolts a visible part onto the car.
  - **Cars:** Rusty Buggy → Dune Hopper → Spike Truck → Monster Truck → War Rig. Upgrades carry over to every car.
  - **Paint:** colors and stickers (some stickers are prizes).
  - **Gadgets:** Rocket Boost, Goo Slick and Boing Bumper.
  - **Driver:** Goggles Kid, Sprocket, Bolt and Lizzy.
- **Worlds:** Dusty Dunes, Junkyard Canyon, Goo Swamp, Volcano Highway, then the Thunder Dome finale. Each world has 3 tracks, and the last one is a race against its rival (Rusty Rex, Captain Muffler, Big Bertha, The Warlord).
- **Scrap:** 1st place pays 100, 2nd 70, 3rd 50, 4th 40. Each bolt you grab on the track adds 3, and winning a track for the first time adds 50. Winning a track opens the next one.
- **Kid-proofing:** the walls are rubbery and bounce you back. If you're stuck or facing the wrong way for 2 seconds, the **tow drone** lifts you back onto the road. The pack rubber-bands so races stay close.
- Progress saves automatically in the browser (localStorage).

## Season 2: Fury Road

Season 2 opens when you beat the Thunder Dome. From then on, the title screen takes you to **the Wasteland**.

**The Wasteland** is a big map you drive around.
- **Story events** are colored beams of light: drive into one and press Space.
- **Steer help** points you at your next adventure, and an arrow shows the way when it's off screen.
- War Boy **patrols** chase you (wreck them for guzzoline), and **guzzoline and chrome** are hidden around the map.
- The **garage** and the **Thunder Dome Classics** (all the Season 1 tracks) are doors on the map.
- **Esc** opens fast travel.

**Five chapters**, each opening with a comic and ending in a boss. Beating a boss gives you their car:

| # | Chapter | Events | Boss |
|---|---|---|---|
| 1 | The Citadel | Citadel Circuit, War Boy Ambush (chase), Citadel Pit Smash | Rictus in Big Foot: dodge his charges; when he slams into a wall he's dazed, so hit him |
| 2 | Gas Town | Gas Town Gauntlet, Guzzoline Run (escort), Doof Run (boost on the drumbeat) | The People Eater: a race through fire jets; hit his glowing tanker or beat him to the line |
| 3 | The Bullet Farm | Bullet Farm Blitz (night), Mine Pit Smash (night), Night Raid (chase) | The Bullet Farmer in the Peacemaker: dodge the red rings, hit him while he reloads |
| 4 | Fury Road | The Fury Road (escort), Into the Storm (sandstorm), The Bog at Night (crow people on stilts), Canyon Chase | Immortan Joe in the Gigahorse: protect the War Rig and knock off his glowing wheels |
| 5 | Dementus's Horde | Horde Chase, Gas Town Showdown, Wasteland Rally | Dementus's chariot: knock his three bikes loose while they glow |

Beat them all for the "Shiny and Chrome" finale.

**The event types:**
- **Race:** lap race. Win to complete it.
- **Chase:** get down the road ahead of the War Party.
- **Escort:** keep raiders off Furiosa's War Rig. Damage only slows it, and it waits for you.
- **Smash:** grab the most fuel cans in a walled pit. Getting hit spills them.
- **Boss:** each boss glows when it can be hurt, and touching it then counts as a hit.

Every finish pays scrap and earns 1–3 stars. The first win also pays chrome and guzzoline.

**Lore Garage (Phase 1):**
- **Chrome** buys the 8 Wasteland Legends, each with a special move on Space (Interceptor, Nux Car, Buzzard, Big Foot, Doof Wagon, Peacemaker, Dementus's Chariot, Gigahorse).
- Chrome also buys upgrade levels 5–6, Shiny Chrome paint and hood ornaments.
- **War Boy weapons** (Thunder Sticks, Caltrops, Harpoon, Flamethrower) cost scrap.
- **Wrecks:** lore weapons do damage, and a wrecked car explodes and respawns.
- New drivers, the Fury Road world, and the **Valhalla Book** card album.

## Art, voice and music (Gemini)

Everything has a placeholder drawn in code, so the game always works. Generated assets replace the placeholders as they're made.

```bash
cp .env.example .env             # put your GEMINI_API_KEY in .env (it's git-ignored)
npm run assets -- --dry-run      # see what would be generated
npm run assets                   # generate everything that's missing
npm run assets -- --only rival-rex --force   # redo one thing
npm run assets -- --only prop-*              # prefix match
npm run assets -- --kind voice   # images | voice | music
npm run assets -- --rekey        # redo cut-outs and seamless tiling from saved originals (no API calls)
npm run assets -- --list-models  # which models your key can use
```

- Prompts live in `tools/assets/manifest.json`. They share one style block so the art looks consistent; Season 2 lore art opts into a grittier `"style": "lore"` block. Sprites whose background doesn't cut out cleanly are retried automatically. Images use Nano Banana Pro (`gemini-3-pro-image`), voices use Gemini TTS, and music uses Lyria.
- Sprites are generated on magenta, which is then cut out. Ground and road textures are blended so they tile without seams. The untouched originals are kept in `tools/assets/raw/`.
- Voice lines come from `src/data/dialogue.json`. If a voice file is missing, the browser's built-in speech reads the line instead.
- Only prompts and dialogue text are sent to Google.
- The 3D cars are built from shapes in code (`src/art/carBuilder.ts`), because Gemini doesn't make 3D models.
- **Your own art works too.** Drop a PNG named after a texture key (e.g. `driver-kid.png`) into `public/assets/images/`, then run `npm run assets -- --index`.

## Code map

```
src/data/        tracks, storyTracks, arenas, story (chapters/events), worlds, cars, characters, cards, dialogue  ← most changes happen here
src/race/        EventScene (shared event core), ground (tracks/arenas/terrain), CarBody (physics), weapons, AIDriver, trackMesh/arenaMesh, effects
src/modes/       lap race, chase, escort, arena smash, bosses, variants (night, sandstorm, Doof beat, fire jets, crows)
src/scenes/      Title, DriverPick, Garage, TrackSelect, Race, Podium, Wasteland, Comic, StoryResult, Valhalla
src/systems/     Economy (prices, payouts, unlocks), SaveManager, Controls, assets
src/art/         carBuilder (cars + bolt-on parts), materials, placeholders
src/audio/       synthesized sound effects, engine hum, voice, music
src/ui/          HUD, arrow-key menus, grown-ups panel, styles
tools/           Gemini asset pipeline
```

To add a track, add it to `src/data/tracks.ts` (points around the loop, plus hills, jumps, boost pads, crates, bolts and goo) and run `npm test`. The tests check that the loop never crosses itself, that the corners are wide enough, and that both an AI car and a "just hold the gas" kid can get around.

```bash
npm test           # save, economy balance, track shape, and driving simulations
npm run build      # type-check and production build into dist/
```

Dev shortcuts: `?race=swamp-2` jumps into a race, `?event=c1-boss` into a story event, `?scene=wasteland` onto the map. Add `&fast` for a cheap, sped-up run (used by automated playthroughs).
