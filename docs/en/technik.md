[Deutsch](../technik.md) · English

# Technology

How Alcatraz is built and how to work on it.
What the app does: [funktionen.md](funktionen.md).
Operation without internet, backup and history: [betrieb.md](betrieb.md).
For agents and developers there is also the project map [CLAUDE.md](../../CLAUDE.md) (German) with the folder map and
the data flow.

## Contents

- [Structure](#structure)
- [Dependencies](#dependencies)
- [Offline storage](#offline-storage)
- [Device operation: security model](#device-operation-security-model)
- [Development](#development)
- [Documentation and images](#documentation-and-images)
- [Tests](#tests)

## Structure

Alcatraz is a pure browser application ([Vue 3](https://vuejs.org/), TypeScript, [Vite](https://vite.dev/)).
There is no server, no database and no login (see [README](../../README.en.md)).

- **Multilingual:** The user interface can be switched while running (so far German and English).
  The texts are in `src/i18n/`, one folder per language with files by area (`de/`, `en/`).
  The lists follow the language of the rulebook, not that of the user interface.
- **Addresses in the language of the user interface:** Every view, every tab and every jump target has an address
  to pass on (`#/listen/wkr`, in English `#/lists/race-officials`).
  - It is written in the language of the user interface and read in every language.
    A German link also opens with an English user interface and is rewritten without an extra step in the history.
  - The words are in one table per language in `src/lib/adressen.ts`; the names in the code stay German.
  - If a further language produces an ambiguous word, the English one applies for that target (`wortraum`).
  - A cross-reference can pass a selection to the tab (third segment, a value from the data, not translated).
    Example: “Weighing → Print weight lists” leads to `#/lists/weights/<origin>` (`*` = all).
    The view takes over the selection; afterwards the address shows only the tab again.
  - Only the hash changes – this also works in the single-file version under `file://`.
- **Several roots by address** (`src/main.ts`): the app itself (`App.vue`), the scoreboard `#/display`
  (German `#/anzeige`, `AnzeigeApp.vue`) and the spectator list `#/spectators` (German `#/zuschauer`,
  `ZuschauerApp.vue`) – both read-only – as well as a device without data of its own (`GeraetApp.vue`: read link,
  pairing, paired device, practice `#/uebung`).
- **Printed lists at the centre:** Printing goes through the browser’s print dialog (also “Save as PDF”).
  Each list counts its own page numbers.

Structure of `src/`:

- `domain/`: classes, race numbers, countries, flags
- `import/`: exchange with Excel
- `planung/`: interleaving, boats, parallel slalom
- `config/`: rulebooks, setups and positions as YAML
- `state/`: state as a pure reducer
- `persistenz/`: storage in the browser, backup
- `lib/`: pure logic – scoring, sheets, lists, team competition, offline storage
- `betrieb/`: operation on competition day (order of starts, public view, waiting times)
- `wkr/`: digital data entry by the race officials (lists, forms, taking over the values)
- `geraete/`: device operation via ntfy
- `i18n/`: languages
- `views/` and `components/`: user interface

The complete folder map is in [CLAUDE.md](../../CLAUDE.md) (German).

## Dependencies

The shipped app contains only a few third-party packages (`package.json`, `dependencies`):

| Package | Purpose | Licence |
|---|---|---|
| `vue` | user interface | MIT |
| `js-yaml` | rulebooks and setups (YAML) | MIT |
| `qrcode-generator` | QR codes on sheets, checklists and for the links of device operation | MIT |
| `vuedraggable` (with `sortablejs`) | dragging classes and breaks onto the lanes of the interleaving | MIT |
| `tweetnacl` | encryption and signatures in device operation (`src/geraete/`) | Unlicense (public domain) |

In addition there are the flag images from `country-flag-icons` (MIT; listed as a development dependency because only
the images are taken over at build time). Under “Settings → Third-party components and licences”
(`src/components/FremdeBestandteile.vue`) the app shows its own licence with a link to the repository and the notices
for flags, tweetnacl and racecourse drawings – the single-file version is passed on without the README.

`tweetnacl` (1.0.3, as in the prototype `tafel`; plan of 16.11.2026) instead of WebCrypto: `crypto.subtle` is missing
outside secure contexts and can be missing under `file://` with an opaque origin; tweetnacl runs everywhere.
It is part of the bundle because `src/main.ts` sets up device operation; a connection is nevertheless only made once
it is switched on (see below).

## Offline storage

What scorers see of this and have to do is described in [betrieb.md](betrieb.md).

- `scripts/offline-sw.js` is the service worker, written by hand, without Workbox.
  One strategy: everything in advance, with a checksum per file, one cache per version.
- Which version is served is decided by a pointer “valid version” in storage.
  Only “Update” changes it – or, with no data yet, the start –, not the service worker currently running.
  The file must therefore stay compatible across versions, see its header;
  old caches are removed after switching.
- There is no transition for versions from before the pointer:
  the application is still in development (decision of 15.11.2026).
- Tested with two builds in a row, served one after the other by a static server at the same address:
  With drivers, the old version stays across reloading, a new tab and restarting the browser
  until “Update” is pressed (other windows then show “please reload”).
  Without drivers, Alcatraz takes over the new version by itself when opened
  (or the next time it is opened, if work has already been done in the window).
- A device in device operation (`GeraetApp.vue`) fetches a new version by itself when the operating computer is
  newer or “Reload all devices” arrives (`holeNeueFassung` in `src/lib/offline.ts`).
- `scripts/offline-speicher.ts` writes the service worker at build time, with the list of all files, as `dist/sw.js`.
  The deployment runs the script once more after copying `alcatraz.html`.
  The development server has no offline storage: under `sw.js` it only serves the service worker’s unregistration.
- The page side: `src/lib/offline.ts`, `src/lib/update.ts`, `src/components/OfflinePanel.vue`.
- The second store: `src/persistenz/zweitspeicher.ts` (IndexedDB),
  `src/state/zweit.ts` (when it is written, reconciliation at start),
  `src/lib/verlauf.ts` (which state is newer, merging, limits), `src/components/VerlaufPanel.vue`.
- Every save carries a save mark (sequence number and time) issued by the store;
  the reducer stays without a clock.
  The mark is in the saved text, but not in the state and never in a file.
- Instead of the browser’s IndexedDB the tests use `fake-indexeddb` (for testing only).
- `public/manifest.webmanifest` makes the Pages version installable.

## Device operation: security model

As of 25.11.2026: The scoreboard and the spectator list go to other devices via read links (stage E6), paired phones
operate the start release of their areas (E7), race official devices enter their list (W1–W5). How to use it:
[betrieb.md](betrieb.md#device-operation). Checking and applying happen only on the operating computer: allowlist
`src/geraete/aufgaben.ts` according to the host’s register, never according to what a device says about itself; every
action carries a number (duplicates are only acknowledged), withdrawing a device blocks it at once.
Plan and decisions: [entscheidungen.md](../entscheidungen.md#betrieb-und-offline) (German); folder map
`src/geraete/CLAUDE.md`.

- **No connection without switching on:** Only “Switch on device operation” creates a room; until then the app opens
  neither a WebSocket nor a request nor the window bus (`src/main.geraete.test.ts`, `src/geraete/host.test.ts`). A
  device with a read link talks only to the server named in the link (`src/main.sehen.test.ts`). The practice of the
  race official form (`#/uebung`) never goes online (`src/main.uebung.test.ts`).
- **Read links:** `#/sehen/<paket>` (`src/geraete/paket.ts`), packed for a small QR code (version 10). The package
  carries server, room, topic, the key of its group and the public key of the operating computer – never the secret,
  never the topic of the devices. Scoreboard and spectators are two groups with keys of their own: the spectator link
  opens only the spectator view. A device (`src/GeraetApp.vue`) has no store and never touches the data of an event.
- **A third-party server, not one of our own:** Messages go via an ntfy server (default `ntfy.adminforge.de`,
  can be changed). It sees topics, times, sizes and IP addresses, but no contents.
- **The operating computer is the only truth.** Devices never get the data of the event, but a tailored view
  (`src/betrieb/sicht.ts`: never date of birth, weight, gender). Devices only send change requests; checking and
  applying them is done by the operating computer alone.
- **Race official devices:** Every list has an encrypted group of its own (`src/geraete/wkrGruppen.ts`). Its view
  (`src/wkr/sicht.ts`) gives race number and class, never name, origin, date of birth, weight or gender of the
  drivers, no values and no results. Exceptions: for a query, the value of exactly that cell; and only the pontoon
  list sees the extra weight of each start. The devices send rows with values; the operating computer checks them row
  by row (`erlaubteWkr` in `src/geraete/aufgaben.ts`) and takes them over like values typed in from paper: if the cell
  holds something other than what the device expects, a query arises, never a silent overwrite
  (`src/wkr/uebernahme.ts`).
- **Encrypted and signed:** Views per group with a shared key (secretbox), messages to a device and from a device with
  the device’s key or the operating computer’s key respectively (box). Every message of the operating computer is
  signed (Ed25519) – including topic, room, group, number, version and time of sending. An old message posted again
  loses against the newest one; a device without data of its own accepts only fresh ones (at most 2 hours old). A
  device reports “different version, update needed” only with a signed proof of version.
- **Topics:** The two public ones (scoreboard link, spectator link) are random and appear only in their link;
  the spectator link can be renewed without disturbing the scoreboard. All others are derived from a secret of the
  operating computer and are learned only by paired devices.
- **Against disruption:** The operating computer never loads an attachment; devices do so only after a signed
  announcement, with a checksum and at most 256 kB. The operating computer opens registrations from unknown devices
  only on pairing topics and throttled per topic, not at all on the topic of the paired devices; rejections and second
  replies cost it only a few publications. Every message of a device carries a sequence number; the operating
  computer keeps the last one permanently, also across a reload. Key changes and withdrawals stay in the room until
  ntfy has accepted them.
- **One window leads:** Only one window of the operating computer connects to ntfy (Web Locks, otherwise a lease in
  localStorage); actions are applied in the window operated last (window bus), so that there is only ever one writer.
  If the leading window goes into the back/forward cache, it hands over the lead.
- **Keys stay on the device:** Room, keys and device list are kept in the localStorage of this browser
  (`alcatraz.geraete.*`, on devices `alcatraz.geraet.*`), never in backup, template or history. They are stored there
  in plain text (whoever has the computer has the data anyway); another computer means a new room. On devices a stored
  view expires after 36 hours; the identifier and the sequence numbers of a device are kept in one entry and are only
  lost together (“Leave room” means pairing again with a new key).

## Development

```sh
npm install             # also sets up the pre-commit hook (.githooks, via `prepare`)
npm run dev             # development server (this computer only)
npm run dev:host        # the same on the local network, for tests with phone and tablet
npm run dev:https       # the same with HTTPS (self-signed): Wake Lock and Web Locks (no offline storage)
npm run preview:host    # built version (after build) on the local network
npm run check           # type check and tests
npm run build:all       # dist/ (GitHub Pages) and dist-single/ (one file)
npm run parcours:sync   # by hand: fetch the course drawings from ../Parcours (not part of CI)
```

**Testing with phone and tablet on Wi-Fi** (`dev:host`, 21.11.2026): Under “Network” Vite names the address on the
local network (e.g. `http://192.168.178.20:5173/`). Open the operating computer via **this** address, not via
`localhost` – read and pairing links take the address of the operating window, and no phone can reach `localhost`.
Without HTTPS the devices lack some browser features: keeping the screen awake (Wake Lock), offline storage and
Web Locks. The app still runs (fallback without Wake Lock, window lead via the lease). For the field test with
everything, use the version on GitHub Pages.

**With HTTPS on Wi-Fi** (`dev:https`, 21.11.2026): like `dev:host`, but via `https://192.168.…:5173/` with a
self-signed certificate (`@vitejs/plugin-basic-ssl`, devDependency only; `vite.config.ts` `--mode https`). The browser
warns once per device (“Your connection is not private”) – confirm “Advanced → Proceed to …” on the operating computer
AND on every phone; after that it is a secure context: the phone keeps the screen awake (Wake Lock), the operating
computer leads its windows via Web Locks. Here, too, open the operating computer via the network address, not via
`localhost`. The plugin stores the certificate under `node_modules/.vite/basic-ssl/`; it is for development only.
There is still NO offline storage this way: in the development server it is always off (“not available”,
`src/lib/offline.ts`), and service workers cannot be registered with a self-signed certificate – check offline use
only via GitHub Pages (finding of 21.11.2026).

**Race official forms without device operation:** The practice `#/uebung` shows the same form as a paired device,
with made-up starts without names, without a connection. First choose rules and list, then – where there is a
choice – the form (“Buttons”; “Picture” only for lists with buoys; “Table” only if the shorter side of the window
measures at least 600 px), then “Start practice”. The window size also decides whether the form is laid out as on the
phone or as on the tablet (`src/wkr/anordnung.ts`).

The course drawings under `src/assets/parcours/` come only via `npm run parcours:sync`, after `make` and a commit
in the Parcours repository; `src/lib/parcoursQuelle.test.ts` checks the checked-in files
(origin and licence: [`src/assets/parcours/LICENSE.md`](../../src/assets/parcours/LICENSE.md)).

## Documentation and images

**Bilingual** (24.11.2026): `README.md` and `README.en.md`, `docs/<name>.md` and `docs/en/<name>.md` with the same
name. Every file links to the other language in its first line (`Deutsch · [English](en/<name>.md)`, in the README
`Deutsch · [English](README.en.md)`, in the English files the other way round). Changes always in both languages.
Only the work logs with quotations stay German-only: `docs/entscheidungen.md`, `docs/plan-*.md`,
`docs/vorschlag-wkr-erfassung.md`.

**Writing:** factual, short sentences, terms as in the rulebook (DM-Reglement, UIM Rulebook rule 960). Describe only
what is in the code; delete what no longer applies. No real names, no e-mail addresses, no paths outside the repo.
The README stays short; details belong in `docs/`.

**Images** are kept in two folders with the same file names:

| Folder | User interface | Event | Origin | Lists |
|---|---|---|---|---|
| `docs/bilder/de/` | German | DM (German championship rules), “Hafenpokal” | federal state (Bundesland) | German |
| `docs/bilder/en/` | English | UIM, “Harbour Cup” | country | English |

The parallel slalom exists only under UIM: `parallel-results.png` shows English lists in the German folder, too.

| File | Content |
|---|---|
| `starter.png` | “Drivers” tab: classes with race numbers, names, origin with flag |
| `verzahnung.png` | Interleaving of the classes, locked |
| `wkr-bogen.png` | Race officials’ sheet (gate list) with QR code, disqualification legend and course drawing (“Lists” tab, print view) |
| `laufzettel.png` | Checklist with a box per list, steps and QR code |
| `erfassung.png` | Data entry: a sheet as an entry table with values |
| `wertungsliste.png` | Overall results of a class with three attempts (dropped attempt) |
| `mannschaftswertung.png` | Team competition |
| `parallel-results.png` | Parallel slalom: results of the preliminary heat with “Qualified” (UIM only) |
| `start-freigabe.png` | Operation → Start release on the operating computer with a start in progress |
| `anzeigetafel.png` | Scoreboard (`#/display`, German `#/anzeige`) in the second window, landscape |
| `zuschauer.png` | Spectator list (`#/spectators`, German `#/zuschauer`) at phone width |
| `wkr-handy.png` | Race official form “Buttons” or the buoy form on the phone (practice `#/uebung`, about 390 px wide, portrait) |
| `wkr-pad-bild.png` | Race official form “Picture” with course drawing on the tablet (practice `#/uebung`, about 1180 × 820, landscape) |

Rules for all images:

- Taken with `npm run dev` and the app’s sample data (“Event” tab → “Sample data”).
- Made-up data only: sample field of drivers, sample values, sample race officials, sample weights,
  a made-up event name without a year (the app appends the year; otherwise it would appear twice in the header).
- Origin “State” or “Country”, never “Club”: `src/data/clubs.ts` is modelled on real clubs,
  and made-up people should not appear to belong to real clubs.
- Light colour scheme (the scoreboard is always white on black), cropped to the essentials,
  views about 1200 px wide, at most 250 KB per file (reduced with ImageMagick to 64–256 colours and `oxipng`).
- Without the app’s footer and without the source line below the course drawing; the licence is in the README.
- The README shows a selection, only as a preview linking to the full image:
  views, sheets and phone 180–300 px wide, wide lists 600 px in a row of their own.

## Tests

Testing uses Vitest and happy-dom; the tests are next to the code (`*.test.ts`).
People in tests and sample data are made up (`src/data/names.ts`).
The commands for targeted and full runs are in the project map under [Befehle](../../CLAUDE.md#befehle) (German).
The pre-commit hook (`.githooks/pre-commit`) runs `npm run check` before every commit.

The CI (`.github/workflows/ci.yml`) runs `npm run check` and `npm run build:all`.
The deployment to GitHub Pages (`.github/workflows/deploy.yml`, on push to `master`) runs the tests, builds and also
ships the single-file version as `alcatraz.html`.

**Flaky tests** (24.11.2026): Two end-to-end tests in `src/GeraetWkr.test.ts` – “Probe beim Einrichten …
einmal je Raum und Liste” and “W5.2 Maske ‘Bild’: Probe am Bild …” (test names in German) – wait with a fixed time
limit for the device and a simulated ntfy server and occasionally fail under load with “Zeit abgelaufen” (timed out).
So that they do not hold up the Pages deploy, they run on GitHub (where `CI` is set) only on request. Rule:
`src/testHilfen.ts` `wackelTestsAuslassen`, in the tests `it.skipIf(WACKELTESTS_AUS)`; `src/testHilfen.test.ts`
checks that the rule matches the line in `ci.yml` (without the tick `0` = off) and that `deploy.yml` never sets the
variable.

- Locally, also in the pre-commit hook (without `CI`): they always run.
- To include them on GitHub: **Actions → CI → Run workflow**, choose the branch, tick “Wackelige Tests mitlaufen
  lassen” (run the flaky tests too), **Run workflow**. The tick sets `ALCATRAZ_WACKELTESTS=1`; on push and pull
  request it is off.
- Deploy (`deploy.yml`): never sets the variable; the two tests are always off there.
- To check locally as on GitHub: `CI=true npx vitest run src/GeraetWkr.test.ts -t "Probe"` (the two: skipped);
  with `ALCATRAZ_WACKELTESTS=1` in front they run too.
