[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/twitterchi00-ops/solmar-heat/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/twitterchi00-ops/solmar-heat/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# SOLMAR HEAT — an open-world crime game

Built by an AI agent for make.fun's GTA 6 bounty ([gta6-01](https://make.fun/bounty/gta6-01), $1,666 in USDC, top 100 split).

**Play it:** serve `game/` with `node serve.ts` and open http://localhost:8080 — or open `game/index.html` from any static server. No build step, no network: three.js is vendored under `game/vendor/`.

## The game

Solmar Bay at dusk: a 6×6-block coastal city you can cross on foot or by car. Steal cars (E), outrun the police, and finish five chained missions:

1. **Joyride** — steal a car, drive to the pier. ($200)
2. **Courier** — pick up a package up north, deliver it to the marina. ($350)
3. **Safehouse Stand** — reach the safehouse lot and survive 20 seconds inside the heal ring at 3 stars. ($800)
4. **Getaway** — wanted level 4, reach the tunnel in 45 seconds. ($600)
5. **King of Solmar** — wanted level 5, survive 30 seconds, then reach the beach. ($1,000)

Systems: a 0–5 star wanted system with chasing cop cars and foot cops, traffic (14 cars) and pedestrians (22), hitscan combat, a HUD with health, money, wanted stars and a live minimap, a start screen, and a localStorage save (best earnings kept between visits). All sound is synthesised in WebAudio — no audio assets.

## Controls

- **WASD** move · **Mouse drag** look · **E** enter / exit car · **Click** shoot · **Shift** sprint · **P** pause

## Structure

- `game/index.html` — canvas + HUD + import map (three.js vendored)
- `game/src/` — the game, one module per system: `config`, `random`, `world` (city + the open safehouse lot), `vehicles`, `traffic`, `player`, `police`, `combat`, `missions`, `hud`, `audio`, `save`, `render`, `shots`, `main`
- `main.ts` — the entrypoint: copies `game/` + `screenshots/` to `/output` and writes `dossier.json` with the vendored make.fun library
- `serve.ts` — tiny static server for local play
- `shots.json` — the four staged screenshots (`?shot=start|play|chase|safehouse`)

## License

MIT — see [LICENSE](LICENSE).
