# H2 2026 Trading Grid Innovation Guide on Render

Two Render services built from this repo:

| Service | Type | What it serves |
|---|---|---|
| `tg-innovation-guide` | Static site, publish directory `site` | The guide (`site/index.html`), its images, the visitor stats page (`site/stats/`) and Grid Runner, the Trading Grid game (`site/play/`) |
| `tg-guide-stats` | Node web service, `node server/index.mjs` | `POST /api/hit` (one open of the guide), `POST /api/play` (one Grid Runner run started), `GET /api/stats?days=1..90`, `GET /healthz` |
| `tg-guide-stats-db` | Render Postgres | Table `visits`, one row per open; table `plays`, one row per run started |

Master copy of the guide: the claude.ai artifact. Master copy of the game: `game/gridrunner.html` (the owner's
GRIDRUNNERkiosk.html with invented partner names, since the guide never names clients, and a hook in `startRun()`).
`site/` is generated from both, never edited by hand. The game shows "Grid Runner, the official game of Trading Grid" above its frame at all times, uses current product
names (Trading Grid Data Platform, Trading Grid Decisions Intelligence, Command Center Performance Monitor) and plays with
a game controller (Gamepad API, standard mapping, such as an Xbox controller over Bluetooth or USB): left stick or d-pad
routes, A, RB or RT fires, Menu starts and holds, B resumes, View opens settings; rumble in Chrome and Edge.

Kiosk behaviour (OpenText World):
- Two-controller co-op: controller 2 presses A on the title for a co-op shift, or A mid-shift to join. Two routers
  (P1 blue, P2 amber) defend one network: shared score, escalations, weapon and power-ups, separate validator heat,
  about 15% more traffic. A dropped controller 2 returns the shift to solo; a dropped controller 1 holds it.
- Idle reset and attract mode: 60 seconds with no input during a shift, on hold, in settings or on the review screen
  returns to the title. After 15 quiet seconds there the game plays itself, alternating a solo demo from wave 1 (40 s)
  with a co-op demo from wave 3 that reaches an incident (50 s). A, Menu, Enter, Space or a tap plays (controller 2:
  co-op); any other input shows the title. A demo never counts as a play, never saves, never rumbles and is silent.
- Hold menu: Esc, P or Menu during a shift (Esc or B on the title and review screens) opens Resume, Settings, End shift,
  Innovation Guide kiosk and Exit to the Innovation Guide, each with its controller button beside its keyboard key,
  and a controls table; the controller column shows only while a controller is connected.
- Innovation Guide kiosk: Y or K on the title, review and hold screens (and a button on each) opens `/#conference`,
  which starts the guide's OpenText World kiosk mode.

Build:

```
API_ORIGIN=https://tg-guide-stats.onrender.com node tools/build-site.mjs /path/to/master.html /path/to/image-root
```

## How the counts work
1. The guide sends one `navigator.sendBeacon` to `API_ORIGIN/api/hit` when it is opened (skipped for automated browsers).
2. The service hashes today's random salt + IP + user agent into a 16-character visitor id, looks the address up in the
   open DB-IP Lite city database (CC BY 4.0, bundled through npm) for country, region and city, and stores one row:
   day, country, region, city, visitor id. The IP address is never stored. Crawlers are skipped; 30 opens a minute per
   address at most; only origins listed in `ALLOWED_ORIGINS` may report opens.
3. The salt is kept for one UTC day and then deleted, so ids cannot be reversed or linked across days. No cookies.
4. `site/stats/` reads `GET /api/stats?days=90` and draws totals, a day-by-day chart, countries and cities.
5. Grid Runner: each run started calls `window.grPlayed`, which the build defines to send one beacon to
   `API_ORIGIN/api/play`; the service stores it in table `plays` with the same rules and the same daily visitor id.
   `/api/stats` adds `plays` (runs started) and `players` (visitor ids) to each day; the stats page shows them in its
   Grid Runner card.

`?test=1` on the API routes uses tables `visits_test` and `plays_test`, for checks that must not touch the real counts.

## Environment (web service)
- `DATABASE_URL`: the database's Internal Database URL (set in the Render dashboard; never committed)
- `ALLOWED_ORIGINS`: comma-separated origins allowed to report opens, e.g. `https://tg-innovation-guide.onrender.com`

## History
`data/netlify-history.json` is the Netlify `/api/stats?days=90` export taken at the move. On start the service carries
it over once (stand-in visitor ids starting `nf`); a newer export replaces the earlier carry-over.

## Tests
`npm test` (helper tests). The service runs locally against any Postgres with `DATABASE_URL=... node server/index.mjs`.
