# OpenText World 2026 Kiosk Mode (archived)

Booth loop of the H2 2026 Trading Grid Innovation Guide, run at OpenText World 2026 (Orlando, Oct 19 to 22, 2026).
Archived on Oct 24, 2026. Planned for reuse at OpenText World 2027.

## Current state

The kiosk is hidden, not deleted. Every line of kiosk CSS and JavaScript is still in the guide master (the claude.ai
artifact "Trading Grid Innovation Guide H2 2026") and in `site/index.html`. Two flags switch off the entry points:

| File | Flag | Effect when `false` |
|---|---|---|
| Guide master, slide show script (search `var KIOSK_ON`) | `var KIOSK_ON=false;` | No banner button, no footer link (it hides itself when the banner button is absent), `#conference` deep link ignored |
| `game/gridrunner.html` (top of the main script) | `const KIOSK_ON = false;` | Adds `html.nokiosk`: hides the "Innovation Guide kiosk" buttons, the hold-menu item and the K / Y hints; `goKiosk()` does nothing |

`master-2026-10-24-kiosk-on.html` in this folder is the full master exactly as it ran at the event (artifact version
1792413012-1e13, before the flag was added). The last site build with the kiosk on is commit `12b7477`.

## Revive

Quick path (recommended):
1. In the guide master, set `var KIOSK_ON=true;` and republish the artifact.
2. In `game/gridrunner.html`, set `const KIOSK_ON = true;`.
3. Build, commit `site/` and `game/`, push, trigger the Render deploy (see the repository README for the build command).
4. Check at 1920x1080 and 1366x768: banner button present, `/#conference` opens the loop, slide count in the bottom bar
   matches the content, Grid Runner K or Y opens `/#conference`. Phones never show the kiosk (by design).

Full restore: diff `master-2026-10-24-kiosk-on.html` against the current master and carry over anything removed since.
Never paste the snapshot over the live master; other sessions keep editing it.

## How it is built

All code lives in the master. Search the comment markers below.

### Entry points
- Banner button `.conf-btn`, created in script (end of the slide show script), desktop only (hidden under 900px and on
  short touch screens).
- Footer link `button.fkiosk` in `li.fk`; clicks the banner button.
- Deep links: `#conference`, `#conference-2x`, `#conference-3x` (speed 1x, 2x, 3x). Grid Runner links to `/#conference`.

### Deck assembly (`confDeck()`)
Slides are read from the page each time the kiosk opens, so page edits flow in automatically:
1. Cover (`t:'cover'`, `kiosk:true`): dark full-bleed slide, "OpenText World 2026" label, three statements in
   `cover.stmt`, product line in `.kv-bot`.
2. Trading Grid at a glance: one slide per scene in `#tg-glance .tga-main .tgs` (cloned live scenes).
3. Generally available: every `article.inn` per GA section via `capDeck()`, skipping `[data-copy]` (Aviator duplicates)
   and `[data-soon]` (no screenshots yet).
4. Scenarios: `scnDeck('#in-action')` and `scnDeck('#scn-aviator')`, filtered by `shots2` (at least two different
   pictures). Each step's screenshot comes from the linked entry; `data-shot="n"` on a caps link picks a gallery image.
5. Looking ahead: `laDeck()` builds one slide per entry in the `LA` list. Each `LA` item names the entry id, the progress
   label and a copy array (`LA_PM`, `LA_ASN`, `LA_SH`, `LA_TGI`, `LA_DI`, `LA_DE`, `LA_CS`). Copy array order must match
   the entry's gallery screenshot order; extra screenshots fall back to the caption.

### Playback (slide show script, `conf` mode)
- Timer: `SPD={1:20000,2:10000,3:4000}` ms per step; screenshots step within a slide before the next slide.
- Keys: Space/P/K pause, 1/2/3 speed, arrows step, PgUp/PgDn jump section (`secJump`), F full screen, Esc exit.
- Wheel steps screens; wheel over the bottom bar scrolls the bar.
- Idle: a paused kiosk resumes after 90 s (`bumpIdle`). Bars and cursor fade after 2 s in full screen (`ui-idle`).
- Tap a screenshot for full screen (`zmOpen`); next tap closes, the one after advances.
- Section changes play a full-bleed wipe (`kiosk()`, `.ss-wipe`) labelled by section type.
- Bottom bar: grouped by section (`.ss-prog.grp`), numbered, scrolls sideways, keeps the current slide centred.

### CSS markers
`conference mode`, `OpenText World 2026 kiosk mode motion`, `kiosk opening slide`, `kiosk, Looking ahead`,
`kiosk progress bar grouped`, `kiosk bar scrolls sideways`, `kiosk text 30% larger`, `tap a screenshot`,
`no scroll bars inside slides`, `bars fade after 2 seconds`, `kiosk: cover, section dividers` (inside the dark-navy
block), `kiosk entry on the banner grid`. Most rules are scoped to `.ss.conf`.

## Update for OpenText World 2027
- Text that names the 2026 event: banner button label, footer link, deck name in `confDeck()`, cover label in
  `render()` (`x.t==='cover'&&x.kiosk`), the CSS comments are informational only.
- Cover statements (`cover.stmt`) and the product line (`.kv-bot`) should reflect the 2027 edition.
- Rebuild the `LA` list and copy arrays for the Looking ahead entries in the 2027 guide.
- The H1 2027 guide adds industry views (Retail, Automotive, Financial Services); decide whether they get kiosk slides.
- Re-run the checks above; long sections may need the auto-fit steps (`fit1` to `fit3`) reviewed.
