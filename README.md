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

## Season 2: Fury Road (in progress)

Phase 1, the **Lore Garage**, is in:
- **Chrome** is a second currency, earned by winning: 2 for a win, 1 for second place, and 3 more the first time you win a track. It buys:
  - the **Wasteland Legends**: the Buzzard, Nux Car, Interceptor, Big Foot, Doof Wagon, Peacemaker, Dementus's Chariot and the Gigahorse
  - **chrome upgrade levels 5–6**
  - **Shiny Chrome** paint
  - **hood ornaments** (Immortan's skull, the V8 wheel shrine, Dementus's teddy, bull horns)
- **Special moves:** each legend has its own, on Space:
  - the Interceptor's Blower
  - Nux's "Witness Me!" chrome star power
  - Big Foot's Stomp
  - the Doof Wagon's Flame Guitar
  - the Peacemaker's Thunder Shot
  - the Gigahorse's Double V8
  - the Chariot's Bike Swarm
  - the Buzzard's Spike Ram
- **War Boy weapons** for any car, bought with scrap: Thunder Sticks, Caltrops, Harpoon and Flamethrower. The War Rig comes with Thunder Sticks.
- **Wrecks:** lore weapons do damage. A car that takes enough hits explodes, tumbles and respawns 2 s later with a short shield. Armor adds hit points, shown as red pips above the gadget button. Season 1 gadgets (boost, goo, boing) still just spin cars out.
- **The Fury Road world:** opens after the Thunder Dome. It has three tracks: Citadel Circuit, Gas Town Gauntlet (rival: Slit) and Bullet Farm Blitz (rival: Rictus in Big Foot). War Boy racers fill out the grid.
- **New drivers:** Max, Furiosa, Nux, War Pup, the Doof Warrior and Toast.
- **The Valhalla Book** (from the garage): a card album of every character, car and place. Locked cards show a silhouette and how to get them. Opening a new card plays its voice line.

Coming next (see the plan): the drive-around Wasteland, Chase/Escort/Arena modes, boss battles, and the Fury Road and Dementus chapters.

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
src/data/        tracks, worlds, cars/upgrades/paint, characters, dialogue  ← most changes happen here
src/race/        trackGeometry (the math), CarBody (physics), AIDriver, trackMesh (3D), effects
src/scenes/      Title, DriverPick, Garage, TrackSelect, Race, Podium
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

Dev shortcut: `http://localhost:5173/?race=swamp-2` jumps straight into a race.
