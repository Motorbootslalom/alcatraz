# Plan W5 „Pad“ der digitalen WKR-Erfassung

Stand 22.11.2026 (W5.1–W5.5 gebaut – W5 fertig; Auslegungen am 22.11.2026 beantwortet, Runde 8, §10) · Grundlage: [vorschlag-wkr-erfassung.md](vorschlag-wkr-erfassung.md) §3
(Rahmen), §4.1–§4.9 (Masken je Position und Gerät), §11 W5, §12 F9/F14/F15; der gebaute Stand W1–W4 und die Antworten
der Runden 3–6 ([plan-wkr-w1.md](plan-wkr-w1.md) … [plan-wkr-w4.md](plan-wkr-w4.md),
[plan-antworten-runde3-6.md](plan-antworten-runde3-6.md), Commit 3210da2). Antworten des Nutzers, die W5 betreffen
([entscheidungen.md](entscheidungen.md)):

- „Die Pad-Geräte-Listen sehen auf dem Pad noch sehr komisch aus“ (T10, Übergang: mittige Handy-Spalte 560 px bis W5).
- **W3-03** (21.11.2026): Handy eine, Pad zwei ist nur eine Empfehlung, mehr Listen sollen gehen – „beim Pad könnten die
  Listen dann auch nebeneinander stehen“ (gebaut GF8: bis 4 Listen, nebeneinander nur bei genau zwei, ≥ 1000 px quer).
- **W3-25**: Die Geräteart (Handy/Pad) meldet das Gerät beim Koppeln, der Bedienrechner speichert sie (gebaut GF7).
- **W4-13**: Beim Hochwischen soll die Parcours-Zeichnung mit angezeigt werden (gebaut GF9: WkrParcoursBild unter den
  Knöpfen, Sicht `bild`).
- **F9**: Zeit nur abgelesen eintippen, kein Stoppen am Gerät. **F14**: Der Bedienrechner gibt die Maske vor, der WKR
  darf wechseln, wenn nicht festgelegt. **F2**: Schalter je Boje und Richtung, Tor 5 Zähler, Tor 1 Rück zwei Zeilen.
- **W4-12**: Disq. an der Boje mit Punkten und Buchstabe in derselben Zelle („5J“), DISQ fragt auf Bojen-Listen immer
  erst die Boje. **V3** (22.11.2026): Bojen-Folge „Rückweg gedreht“ (Vorgabe) | „Fahrtfolge“ | „Alles untereinander“.
- **P-18/W3-01**: Hell/Dunkel des Geräts ist Vorgabe – gilt für jede neue Maske.

Keine Rückfragen beim Bau: Auslegungen datiert („22.11.2026, noch zu bestätigen“) an genau einer Stelle
(`WKR_ANNAHMEN`, src/wkr/annahmen.ts) und hier in §10 gesammelt. Nicht committen.

## 1. Ziel und Grenzen

W3/W4 haben die Handy-Masken gebaut: „Knöpfe“ (Steg, Tor 5, MüB, Vorsteg) und „Bojen“ (Fahrtfolge, Schalter). Auf dem
Pad steht davon bis heute nur die Handy-Spalte in der Mitte (T10). Listen mit Zeit- oder Knotenfeldern zeigen
„Maske folgt – bitte Papier“ (`maskenArt` → `spaeter`), Listen ohne Lauf (Knoten) kennt der Kern gar nicht (W1
`listenOhneLaufErstW5`). W5 liefert:

1. **Pad-Anordnung** quer und hoch statt der mittigen Handy-Spalte: Arbeitsfläche groß, rechts (quer) bzw. unten (hoch)
   eine **Spalte Schlange / Zuletzt / Einträge**, Fuß über die volle Breite.
2. **Mehrere Listen nebeneinander** (bis vier, W3-03): Tor 1/3/5 + Tor 2/4/5, Racecourse A + B, Steg Ablegen + Anlegen
   (ein Gerät für den ganzen Steg: beide Teile nebeneinander statt Reiter, §4.4).
3. **Maske „Bild“**: Parcours-Zeichnung der Klasse (src/assets/parcours), Bojen der eigenen Liste antippen, Hin/Rück
   über großen Umschalter, Klassenwechsel mit neuer Zeichnung, Disq. an der Boje mit Punkten + Buchstabe; unter UIM
   eine schematische Zeichnung je Racecourse (es gibt kein Parallel-SVG).
4. **Maskenwahl** (F14): Bedienrechner gibt je Gerät und Liste vor (Knöpfe | Bild | Tabelle, „fest“), der WKR wechselt
   unter „Mehr → Ansicht → Maske“, wenn nicht fest.
5. **Knoten-Prüfliste am Tisch**: Kern nimmt Listen **ohne Lauf** an (Start = Starter, kein gezeigter Start, keine
   Schlange der Startfolge, sondern Nummer eintippen), ✓/✗ je Knoten, Abschicken erst, wenn alles gesetzt ist.
6. **Zeit-Listen mit Ziffernblock**: eigene Tasten, Lesart wie am Rechner (`lib/time.ts` parseTime), Deutung groß,
   „Keine Zeit“; auf dem Pad die Zeitfelder nebeneinander. Gemischte Listen (Bojen + Zeit: `moewezeit`, `bstartziel`)
   bekommen damit ebenfalls eine Maske.
7. **Tabelle für Geübte**: die Zeile des Bogens, letzte 5 + nächste 3 Zeilen, Tab/Enter wie die Erfassung am Rechner,
   dieselben Sanierer.

**Wiederverwendet, nicht neu gebaut**: Kern `geraete/erfassen.ts` (ErfassungsQuelle, Ausgang, Quittung, Korrektur,
Lebenszeichen), `geraete/uebung.ts` (Übung ohne Netz), Rahmen (WkrKopf, WkrStarterKarte, WkrAusweichen, WkrFuss,
WkrZuletzt, WkrMehr, WkrRuhe, WkrAbschluss), Overlay WkrUebertragen, Takt `wechselTakt` mit Sperre, Parcours-Ampel
(`ampel` in der Sicht, Karte), Probe (WkrProbe), Entwurf und Zellen aus `wkr/maske.ts` (`tippeBoje`,
`tippeBojenDisq`, `zellenAus`, `entwurfAus`), Bojen-Folge (`bojenAbschnitte`), WkrDisqOrt, WkrParcoursBild-Quelle
(`lib/parcoursQuelle.ts`, `lib/parcoursbild.ts`).

**Nicht in W5** (W6 nach Befund): Bild auf dem Handy hoch (Vorschlag „Option ≤ 6 Bojen“), Zeit auf dem Handy als
eigene Optimierung (der Ziffernblock läuft dort einfach mit, ohne eigene Feinarbeit), Teilkopplung der Zeit-Felder
(F16: nur Steg), Plausibilität der Zeiten über die bestehende Prüfung der Erfassung hinaus, Stoppen am Gerät (F9 nein),
Steg im Parallelslalom mit zwei Spalten „A | B“ in EINER Steg-Maske (§4.4 letzter Punkt – braucht einen Steg-Bogen je
Seite; Befund erst im Feldtest). Der wackelige CI-Test GeraetWkr „Probe beim Einrichten … einmal je Raum“ wird auf
Wunsch des Nutzers in W5 nicht bearbeitet – neue Tests vermeiden dieselbe Form (Neuladen + feste Grenze).

## 2. Befund: was heute da ist und was fehlt

| Stelle | heute | W5 braucht |
|---|---|---|
| `components/wkr/systemModus.ts` useMedien | Medienabfrage, `quer` ≥ 1000 px | eine reine Anordnung aus Breite, Höhe, Geräteart, Listen |
| `WkrGeraet.vue` | Reiter je Liste; `nebeneinander` nur bei genau 2 Listen, ≥ 1000 px quer, je Spalte die Handy-Maske | Anordnung handy / padQuer / padHoch; 2–4 Spalten; Steg-Teile nebeneinander |
| `styles/wkr-geraet.css` | ab 700 px Handy-Spalte 560 px über padding-inline (T10), geraet.css gibt die Hülle frei | eigene Pad-Raster (`data-anordnung`), Spalte Schlange/Zuletzt; T10-Regeln entfallen |
| `WkrMaske.vue` (1021 Zeilen) | Kopf, Karte, Mitte nach `art`, Zuletzt-Leiste, Fuß | Mitte je Maske austauschbar (Knöpfe, Bojen, Bild, Prüfliste, Ziffern, Tabelle); Seitenspalte auf dem Pad |
| `wkr/maske.ts` maskenArt | `katalog` / `vorsteg` / `bojen` / `spaeter` (Zeit, Knoten, Bojen außerhalb des Fahrwegs) | `pruefliste` (Knoten), `zeit` (nur Zeitfelder), Bojen + Zeit gemischt |
| `geraete/aufgaben.ts` | `maske?: 'knoepfe'|'bild'|'text'`, `fest?` – vom Host nie gesetzt (G4) | Host setzt es; `bild` gilt, `text` = Tabelle |
| `GeraeteListe.vue` | Art handy/pad/rechner (GF7), Hinweis „Maske: Knöpfe“ / „Maske folgt“ | Auswahl der Maske je Liste + „fest“ |
| `wkr/liste.ts` listenDerVeranstaltung | nur Listen mit Lauf (`listenOhneLaufErstW5`) | Knoten (lauf: false) als eigene Liste |
| `wkr/zeile.ts` GeraeteZeile.s | Kennung eines gezeigten Starts (`refKey`) | für Listen ohne Lauf: Kennung des Starters |
| `wkr/druck.ts` | Knoten immer gedruckt (Z6) | Knoten-Liste „digital“ wie die anderen (druckOhneDigital) |
| `assets/parcours/Klasse*.svg` | IDs `Tor1_innen/_aussen`, `Tor2…`, `Tor5_oben/_unten`, `StartZiel_oben/_unten`, `Speedboje_oben/_unten`, `Schikane`, `Ring` | Zuordnung ID → Feld-Kennung je Klasse und Blick |
| Parallelslalom | kein SVG, `bildErzeugen` fehlt in parallel.yaml | schematische Zeichnung aus PARALLEL_FAHRWEG |

## 3. Was wohin gehört

- **Rein (src/wkr/)**: Anordnung (`wkr/anordnung.ts` neu), Bild-Zuordnung (`wkr/bild.ts` neu), Prüfliste und Zeit im
  Entwurf (`wkr/maske.ts`), Listen ohne Lauf (`liste.ts`, `zeile.ts`, `schlange.ts`, `sicht.ts`, `lage.ts`,
  `abschluss.ts`), Tabelle (`wkr/tabelle.ts` neu: Spalten der Zeile, Zellwert ↔ Eingabe über die Sanierer). Nichts aus
  geraete/, kein DOM, kein Date.now().
- **Gerät (src/geraete/)**: `erfassen.ts` (Starts ohne Lauf, Maske aus der Aufgabe), `uebung.ts` (Knoten-, Zeit-Übung),
  `ablage.ts` (Maskenwahl je Raum + Liste in der Ansicht, nie AppState), `host.ts` (Maskenvorgabe in die Aufgabe).
- **Oberfläche (components/wkr/)**: neue Mitten WkrBild, WkrPruefliste, WkrZiffern, WkrTabelle; WkrSeite (Spalte
  Schlange/Zuletzt/Einträge); WkrGeraet/WkrMaske nach Anordnung. Stile nur `styles/wkr-geraet.css`, Farben nur
  `--wkr-*` (auch `--wkr-bild-*` der Zeichnung), keine Maskenklassen in app.css, Modus „Wie Gerät“ (GF1) überall.
- **Bedienrechner**: `GeraeteListe.vue` (Maske je Liste), `GeraeteKoppeln.vue` (Knoten-Liste wählbar), WkrMatrix
  (Knoten eigene Ansicht ohne Lauf), i18n `geraete.*`, `wkr.*` (de/ UND en/).

## 4. Pad-Anordnung (W5.1)

### 4.1 `wkr/anordnung.ts` (neu, rein)

`anordnung({ breite, hoehe, typ, listen, teile })` → `{ art: 'handy' | 'padQuer' | 'padHoch', spalten: Spalte[],
reiter: string[], seite: 'rechts' | 'unten' | null }`:

- **Art**: Typ aus der Kopplung (Register `typ`, GF7; das Gerät kennt ihn aus `willkommen`/Aufgaben) hat Vorrang vor
  der Breite; ohne Typ entscheidet die kürzere Seite (≥ 600 CSS-px = Pad, PD1). `rechner` wie Pad.
- **Spalten**: padQuer bis zu `floor(breite / 480)` Listen nebeneinander, höchstens 4; padHoch höchstens 2 (übereinander
  wäre Scrollen, nebeneinander zu schmal ab 3 – PD2); was nicht passt, als Reiter darüber (Rest-Reiter wie heute).
- **Ein Gerät für den ganzen Steg** auf dem Pad: Ablegen und Anlegen als zwei Spalten derselben Liste (§4.4 Bild), der
  Steg-Reiter (GF3) entfällt dort; „nie derselbe Starter in beiden“ (T3) bleibt im Kern (erfassen.ts).
- **Seitenspalte** (Schlange / Zuletzt / Einträge): bei genau einer Spalte quer rechts (≈ 30 %), hoch unten; ab zwei
  Spalten keine eigene Seitenspalte – jede Spalte trägt Schlange und Zuletzt kompakt unter ihrer Karte (PD3).
- Tests (`anordnung.test.ts`): Tabelle Breite × Höhe × Typ × Listen; nie mehr Spalten als Listen, nie > 4; Steg ganz.

### 4.2 Oberfläche

- `WkrGeraet`: `data-anordnung` = art, Raster je Art; `useMedien` bleibt nur als Lieferant von Breite/Höhe
  (`resize`/matchMedia, ohne feste Pausen in Tests – Breite über `window.innerWidth` setzen und Ereignis auslösen).
  Die Bedingung `nebeneinander` (genau 2) wird durch `anordnung.spalten` ersetzt.
- `WkrSeite.vue` (neu): Schlange (`> 23 Kl. 3 aktiv`, danach 4–6 Einträge, „Nr. suchen“ → WkrAusweichen), Zuletzt
  (WkrZuletzt als Liste, nicht als Leiste), **Einträge im Klartext** (texte.ts `zellenText` des Entwurfs + Σ) – die
  Kontrolle „was dort steht, wird abgeschickt“ (§4.2). Auf dem Handy unverändert (Leiste + Ausweichen).
- **Racecourse A + B**: zwei Spalten; gehören beide zu derselben Runde und demselben Paar, steht EIN Band
  „Quarterfinal · Attempt 1 · Pair 3/8“ über beiden (aus `laeuft`/ListenStart; PD4), sonst je Spalte der eigene Kopf.
  Zwei Abschickknöpfe (ein Boot ist früher fertig, §4.8). Attempt-Wechsel bei derselben Nummer: Kopf „23 · ATTEMPT 2“
  invers mit Sperrsekunde (§4.8, bisher nicht gebaut – PD5).
- **Größen** Pad: Trefferflächen ≥ 15 mm (`data-ziel` gross ≥ 64 px bleibt Mindestmaß; auf dem Pad Tokens
  `--wkr-ziel-pad`), Startnummer 96 px quer; nie Text abschneiden (Prüfung bei 768×1024, 1024×768, 1366×1024 und
  zwei/drei/vier Spalten in `wkr-geraet.test.ts`, wie die 360-px-Prüfung).
- **T10 fällt**: padding-inline-Spalte und `.geraet-freigabe:has(...)` aus geraet.css nur noch für Reiter/Banner der
  Freigabe; `WKR_ANNAHMEN.padSpalteBisW5` → false mit Datum.
- **Hochwischen (W4-13)**: Auf dem Pad steht die Parcours-Zeichnung in der Seitenspalte unter „Einträge“, solange die
  Maske nicht „Bild“ ist (PD6); auf dem Handy bleibt WkrParcoursBild unter den Knöpfen.

### 4.3 Maskenwahl (F14)

- Host: `GeraeteListe.vue` je Listen-Aufgabe ein Auswahlfeld Maske (nur erlaubte: Knöpfe immer, Bild nur bei
  Bojen-Listen, Tabelle immer außer Knoten/Zeit) + Haken „fest“ → `host.setzeAufgaben` (Aufgabe.maske/fest, bisher
  nie gesetzt). Vorgabe ohne Auswahl (MW1): Pad + Bojen-Liste → `bild`, sonst `knoepfe`; Handy immer `knoepfe` (Bild
  auf dem Handy erst W6). Zeit → Ziffernblock, Knoten → Prüfliste (eigene Art, keine Wahl).
- Gerät: `erfassen.ts` reicht `maske`/`fest` je Liste in die ErfassungsQuelle; `WkrMehr` „Ansicht → Maske“ zeigt die
  erlaubten, wenn nicht `fest`; gemerkt in `ablage.ts` ABLAGE.ansicht je Raum+Liste (wie `bojenFolge`), mit
  Fassung/Typprüfung beim Lesen; „Raum verlassen“ räumt die Wahl (MW2).
- Probe: je Maske eine eigene Probe (Bild: „Tippe Tor 1 innen an“), Probe-Merker je Raum+Liste+Maske (MW3).

## 5. Maske „Bild“ (W5.2)

### 5.1 `wkr/bild.ts` (neu, rein)

- `BILD_BOJEN`: Tabelle SVG-ID → `{ halt, seite }` aus den IDs der Klassen-SVGs (Tor1_innen/_aussen, Tor2…, Tor3…,
  Tor4…, Tor5_oben/_unten, StartZiel_oben/_unten, Speedboje_oben/_unten). Welche Seite „innen/außen“ für `seiteA/B`
  ist, folgt dem Blick (dieselbe Quelle wie `boje.spalte`, P7 – BD1: an `bojenHalt`/`spalte` geprüft, nicht neu
  erfunden). `bildTreffer(sicht, klasse)` → je MaskenBoje der Liste die SVG-ID; Bojen anderer Listen → `blass`.
- Test über **alle** `Klasse*.svg` × alle Aufbauten × alle Klassen: jede Boje einer Bojen-Liste hat genau eine ID im
  Bild der Klasse, sonst fällt die Klasse auf Knöpfe zurück (BD2) – kein stilles Fehlen.
- **Parallelslalom**: `schemaParallel(seite)` liefert eine schematische Zeichnung (Start/Ziel, Bojen 1–5 nach
  PARALLEL_FAHRWEG, B gespiegelt) als Daten, gezeichnet von der Komponente (BD3).
- Hin/Rück: Tor 5 und Bojen, die nur auf einem Weg liegen, wissen ihren Weg; Bojen mit Hin UND Rück (Tor 1/3 …) zählen
  auf den gewählten Weg. Der Umschalter springt nach dem ersten Tipp an Tor 5 auf „Rückweg“ (Vorschlag §4.2; BD4 –
  anders als P8 bei den Knöpfen, weil das Bild beide Wege an derselben Stelle zeigt); zurückstellbar. Tor 1 der
  Speedrunde (t1c): im Rückweg ein eigener Umschalter-Zustand „Rück 2“ (BD5), sonst wäre die zweite Durchfahrt nicht
  antippbar. Tor 5 Zähler wie in den Knöpfen.

### 5.2 Oberfläche `WkrBild.vue`

- Das SVG **inline** (gebündelter Text aus `parcoursSvg`/`bildSvg` mit Dimmen der fremden Positionen, keine fremde
  Quelle), gedreht wie der WKR am Ufer steht (`bild.drehung`, auf dem Pad auch ±90°). Trefferflächen als eigene
  Kreise darüber, Mittelpunkt aus `getBBox()` der ID, Radius ≥ 7,5 mm; liegen zwei Treffer näher als 15 mm, werden sie
  auseinandergeschoben (Linie zur echten Boje, BD6). Ohne `getBBox` (Test-DOM) ersatzweise Liste der Knöpfe – Tests
  prüfen die Zuordnung über `data-feld`, nicht Koordinaten.
- Gesetzte Boje: ✔ + Punkte, Zähler „n×“, Disq. „5 G“ (BZ1). Blasse Bojen nicht antippbar.
- **Disq.**: DISQ im Fuß öffnet WkrDisqOrt wie bisher; zusätzlich im Bild: Langdruck ist nicht erlaubt (U3), darum
  Knopf „Disq. an Boje …“ → nächster Tipp ins Bild wählt die Boje, dann die Buchstaben (BD7).
- **Klassenwechsel**: neue Zeichnung + Band „Klasse 7 – anderer Parcours“ 2 s über dem Bild, nur beim ersten Start
  der Klasse im Punkt (GF9).
- Seitenspalte zeigt die Einträge im Klartext (Pflicht für Bild).
- Probe (`WkrProbe` Schritte bild → zurueck → rueckweg → haupt), Übung mit Bild (Pad-Übung `#/uebung` bekommt die Wahl
  der Maske).

## 6. Listen ohne Lauf und Knoten-Prüfliste (W5.3)

### 6.1 Kern

- `liste.ts`: `listenDerVeranstaltung` nimmt Listen mit `lauf: false` auf; Bereich = **`tisch`** (eine Knoten-Liste je
  Veranstaltung, nicht je Parcours, KN1), Kennung `['l', 'tisch', 'knoten', null]`. `istParcoursListe` bleibt false.
- **Start ohne Lauf**: Kennung `['o', starterId]` statt `refKey`; `startAufListe` löst sie zu `{ starter, lauf:
  laufSchluessel(disziplin, OHNE_LAUF) }` auf, nur Starter der Klassen mit der Liste, nicht X (KN2). `zeile.ts`
  `pruefeZeile` nimmt sie an; Werte nur über `eingaben` wie heute.
- **Keine Schlange der Startfolge**: Die Sicht trägt für Listen ohne Lauf eine `bestand`-Liste (Startnummer, Klasse,
  erledigt ja/nein – nie Namen, F6) und `offen n / m`; die Nummer tippt der WKR ein (KN3). LISTEN_SICHT_FASSUNG 9,
  Positivliste in sicht.test.ts.
- `lage.ts`/WkrMatrix: Knoten-Liste eigener Block „Knoten: 14 / 38 offen“, nie Rückstand, nie Ampel, nie Rückfrage vor
  „Nächster Start“ (KN4). `abschluss.ts`: Abschluss der ganzen Liste (Punkt `ohne`), nur ohne offene Starter oder mit
  „Rest auf Papier“ (KN5). `druck.ts`: Knoten-Liste wie jede andere (Z6 → nur digital möglich, KN6).
- Koppeln: Knoten-Liste in `GeraeteKoppeln`/`wkrListenWahl` wählbar (Gruppe „Am Tisch“).

### 6.2 Maske `pruefliste`

- `maskenArt`: alle Felder `buoy` ohne Fahrweg auf einer Liste ohne Lauf → `pruefliste` (Merker in maske.ts).
- Entwurf `pruef: Record<feld, 'ok'|'fehler'>`; `zellenAus`: ✓ → leer, ✗ → Punkte (wie P4, „5“), Bemerkung als Text;
  `fertig(e, aufbau)` erst, wenn jedes Feld gesetzt ist (Hauptknopf vorher gesperrt mit „noch 2 offen“, KN7).
  maske.test.ts prüft wie immer `wertGilt` unverändert.
- `WkrPruefliste.vue`: Kopf „Knoten · Nr. [ 2 3 _ ] · 23 · Kl. 3 · offen 14 / 38“, Zeilen je Knoten ✓ / ✗ · 5, Fuß
  ABSCHICKEN · Σ. Nummer über WkrZiffern (aus 7.2) bzw. WkrAusweichen; schon erledigte Nummer öffnet die Korrektur.
  Pad: Liste rechts der offenen Nummern (antippbar). Kein Overlay-Takt mit Startwechsel (am Tisch kein fahrendes
  Boot) – nach dem Abschicken leert sich das Nummernfeld (KN8).
- Übung: `uebung.ts` Knoten-Liste mit 20 erfundenen Startern, ohne Takt.

## 7. Zeit-Listen mit Ziffernblock (W5.4)

### 7.1 Kern

- `maskenArt`: nur `time` (+ Disq./Text) → `zeit`; Bojen auf dem Fahrweg + `time` → `bojen` mit Zeit-Abschnitt
  (`moewezeit`, `bstartziel`, ZT1). `zeit` bleibt keine Parcours-Liste (AM2), gemischte bleiben es (Ampel/Auto dann
  möglich).
- Entwurf `zeiten: Record<feld, string>` (Ziffernfolge wie getippt); `zellenAus` schreibt genau die Form, die die
  Erfassung aus `parseTime` macht und `wertGilt` unverändert lässt (`lib/time.ts` formatMinutenEingabe/
  sanitizeTimeInput – an der Erfassung abgelesen, nicht neu erfunden; ZT2).
- **Eine Zeile je Start mit allen Zeitfeldern der Liste** (keine Teilkopplung, F16); Abschicken, sobald jedes Feld
  eine Zeit oder „keine Zeit“ hat (ZT3).
- **„Keine Zeit“** je Feld: Zelle bleibt leer, Grund als Code (`anlage`, `nichtImZiel`, `anderes`) in der Zeile `kz`,
  am Bedienrechner im Eingang und in der Matrix „Papier ansehen“ (wie `nv`, ZT4); nie auf Tafel/Zuschauer/Freigabe.

### 7.2 Oberfläche

- `WkrZiffern.vue`: Tasten 0–9, „,“, ⌫ als eigene Knöpfe (keine Systemtastatur), Anzeige groß „1:23,45“ und darunter
  die Deutung „= 1 min 23,45 s“; unlesbar → rot „so nicht lesbar“, Hauptknopf gesperrt. Wiederverwendet für die
  Startnummer der Knoten.
- Pad: die Zeitfelder der Liste nebeneinander, je Feld ein Block, der aktive umrandet; Handy: Feld-Reiter. Zuletzt mit
  Zeiten („12 1:31,02 ✓“).
- Übung mit der Zeit-Liste; Probe „Tippe 83,45 ein“.

## 8. Tabelle für Geübte (W5.5)

- `wkr/tabelle.ts` (rein): Spalten der Zeile aus der Sicht (Reihenfolge und Köpfe wie der Bogen der Klasse), Eingabe
  → Zellwert über dieselben Sanierer wie ErfassungTabelle (`wertGilt`), Fehler je Zelle als Code.
- `WkrTabelle.vue`: letzte 5 (gesendet, ✓/↑) + aktive + nächste 3 Zeilen; Tab/Enter wie die Erfassung, Enter in der
  letzten Zelle = Abschicken; echte Tastatur des Pads; Codes als Text („2x6, 20“), Bojen als Zahl/„5J“. Nur Pad/Rechner
  (Handy: Auswahl ausgegraut, TB1). Nie Vorgabe (MW1). Korrektur einer gesendeten Zeile direkt in der Tabelle → derselbe
  Weg wie „Zuletzt → Korrigieren“ (Rückfrage alt → neu).
- Abschluss: Ende von W5 – Doku nachziehen (CLAUDE.md der Ordner, docs/stand.md, docs/feldtest.md „Pad“-Abschnitt:
  Querformat, Hülle, Ladekabel, zwei WKR an einem Pad, Knoten am Tisch, Zeitnahme mit Anlage und Stoppuhr).

## 9. Scheiben (nacheinander baubar, jede mit grünen Tests)

| # | Scheibe | Inhalt | Tests |
|---|---|---|---|
| W5.1 ✓ 22.11.2026 | Pad-Rahmen und Maskenwahl | §4: anordnung.ts, WkrSeite, Spalten 1–4, Steg-Teile nebeneinander, Racecourse-Band, Attempt-Wechsel, T10 weg, Maskenvorgabe Host + Gerät (zunächst nur Knöpfe/Bojen wählbar) | anordnung.test.ts, wkr-geraet.test.ts (kein Abschneiden Pad), GeraetWkr.test.ts (zwei/drei Listen, Steg ganz), host/aufgaben (maske/fest), ablage.test.ts |
| W5.2 ✓ 22.11.2026 | Maske „Bild“ | §5: bild.ts, WkrBild, Parallel-Schema, Disq. an der Boje, Klassenwechsel, Probe/Übung | bild.test.ts über alle SVGs, maske.test.ts (gleiche Zellen wie Knöpfe für dieselben Tipps), WkrBild-Komponententest über `data-feld` |
| W5.3 ✓ 22.11.2026 | Listen ohne Lauf, Knoten-Prüfliste | §6: Kern (liste/zeile/sicht/lage/abschluss/druck), Koppeln, WkrPruefliste, WkrZiffern (Grundform), Übung | wkr/*.test.ts, sicht.test.ts (Positivliste, Fassung 9), geraete/wkr.test.ts Ende zu Ende Knoten, druck.test.ts |
| W5.4 ✓ 22.11.2026 | Zeit-Listen | §7: maskenArt zeit/gemischt, Entwurf zeiten, „keine Zeit“, WkrZiffern voll, Pad nebeneinander | maske.test.ts (jede Tipp-Folge → wertGilt), zeile.test.ts (`kz`), lage.test.ts, Ampel/Auto mit moewezeit |
| W5.5 ✓ 22.11.2026 | Tabelle für Geübte + Doku | §8 | tabelle.test.ts, WkrTabelle (Tab/Enter), volle Suite, `npx vue-tsc -b`, `npx vitest run src/i18n` |

Jede Scheibe: i18n de/ UND en/ (Begriffe nach Regelbuch, englisch: race official, racecourse, attempt, re-run),
Reducer rein, neue Zustandsfelder in migrate() (W5.3: Abschluss `ohne`, Kennzeichen `kz`), nie Netz ohne Raum,
Geräte ohne Store, Kommentare mit Warum + Datum 22.11.2026, gezielt testen, volle Suite am Ende (`npm run test:leise`),
Tests ohne feste Pausen (`bis()`/`zeigt()`), nichts committen.

## 10. Auslegungen W5 (22.11.2026, beim Planen, noch zu bestätigen) – datiert in `WKR_ANNAHMEN`

**Antworten 22.11.2026 (Fragenseite Runde 8, R8-01 … R8-42):** Bestätigt mit „passt“: PD1 (R8-08), PD2 (R8-09),
PD3 + PD6 (R8-10), PD4 (R8-11), PD5 (R8-12), Tastatur/PD1-Prüfbefund (R8-13, im Feldtest weiter prüfen), MW1–MW3
(R8-14 … -16), BD1 (R8-17), BD2 (R8-18), BD5 (R8-21), BD6 (R8-22), Drehung nur ohne Verkleinerung (R8-24), KN1 (R8-25),
KN2 (R8-26), KN4–KN6 (R8-28 … -30), ZT1 (R8-33), ZT2 (R8-34), ZT4 (R8-36), Probe der Zeit-Listen mit 83,45 (R8-37),
TB1–TB5 (R8-38 … -42), dazu die Bojen-Folge V3 (a)–(g) (R8-01 … -07) – in `WKR_ANNAHMEN` je Eintrag „Bestätigt
22.11.2026 (Frage)“. Anders entschieden, noch nicht umgebaut ([entscheidungen.md](entscheidungen.md) „Antworten 22.11.2026 (Runden 7–8)“): **BD3** (R8-19, Parallel-
Zeichnung aus dem Parcours-Repo statt Schema), **BD4** (R8-20, kein automatischer Wechsel auf „Rückweg“), **BD7**
(R8-23, zusätzlich langes Drücken), **KN3** (R8-27, nächste offene Nummer vorschlagen), **KN7** (R8-31, Hauptknopf
„Alle richtig“), **KN8** (R8-32, erfasste Nummer nur nach Rückfrage öffnen), **ZT3** (R8-35, Weiterspringen erlaubt,
weitere Zeitfelder optional).

- **PD1** Pad erkannt an der Geräteart der Kopplung, ohne sie an der kürzeren Seite ≥ 600 px; Rechner wie Pad.
- **PD2** Spalten: quer `floor(breite/480)`, höchstens 4; hoch höchstens 2; Rest als Reiter. Beim Bau (22.11.2026): hoch
  zählt `floor(breite/360)` (sonst stünde ein 768-px-Pad hochkant immer einspaltig); der Rest teilt sich als Reiter die
  LETZTE Spalte; Steg ganz nur zweispaltig, wenn alle Listen samt Teilen passen.
- **PD3** Eigene Seitenspalte nur bei einer Spalte; sonst Schlange/Zuletzt kompakt je Spalte.
- **PD4** Ein gemeinsames Rundenband über Racecourse A + B nur bei gleicher Runde/Attempt/Paar. Beim Bau (22.11.2026):
  „Pair 3/8“ fehlt – die Paarnummer steht nicht in der Listen-Sicht (sonst neue LISTEN_SICHT_FASSUNG).
- **PD5** Attempt-Wechsel bei derselben Nummer: Kopf invers mit Sperrsekunde (§4.8, bisher fehlend).
- **PD6** Parcours-Zeichnung auf dem Pad in der Seitenspalte, solange die Maske nicht „Bild“ ist.
- **MW1** Vorgabe ohne Auswahl: Pad + Bojen-Liste → Bild, sonst Knöpfe; Tabelle nie Vorgabe; Zeit/Knoten feste Art.
- **MW2** Wahl des WKR gerätelokal je Raum + Liste, geht mit „Raum verlassen“.
- **MW3** Probe je Maske. Beim Bau (22.11.2026): Bild (W5.2) und Tabelle (W5.5) sind noch nicht gebaut
  (wkr/maskenWahl.ts MASKEN_GEBAUT) – das Gerät zeigt statt ihrer Knöpfe, der Bedienrechner Bild ausgegraut, Tabelle nicht.
- **BD1** innen/außen ↔ seiteA/B über dieselbe Blick-Regel wie `boje.spalte` (P7). Beim Bau (22.11.2026): eine Stelle,
  config/kurzform.ts bildBojeId (SEITE, INNEN), aus der auch die Unterspalten entstehen.
- **BD2** Fehlt eine Boje im Bild, zeigt die Klasse Knöpfe (Test über alle SVGs). Beim Bau (22.11.2026): betrifft heute
  genau Klasse 7 auf Möwe-Listen (Klasse7_Moewe.svg ohne Speedboje_unten, die Liste fragt Sp. 2 ab) – im Test fest
  benannt, damit eine neue Lücke auffällt.
- **BD3** Parallelslalom: schematische Zeichnung je Racecourse, B gespiegelt. Beim Bau (22.11.2026): Start und Ziel
  dasselbe Tor (seiteA links), Boje n hin und rück dieselbe Boje; die Lage der Bahnen ist geraten.
- **BD4** Bild-Umschalter springt nach dem ersten Tipp an Tor 5 auf Rückweg (anders als P8). Beim Bau (22.11.2026):
  eine zweite Berührung von Tor 5 auf dem Hinweg tippt der WKR nach dem Zurückstellen – Frage: lieber erst nach der
  Einfahrt springen? Umgebaut 22.11.2026 (R8-20): kein Sprung mehr, der Umschalter wechselt nur von Hand.
- **BD5** Tor 1 der Speedrunde als eigener Zustand „Rück 2“. Beim Bau: nur im Bild; WkrMaske merkt Hin/Rück je Start,
  „Rück 2“ beginnt nach einem Reiterwechsel wieder auf „Rückweg“.
- **BD6** Trefferflächen ≥ 15 mm, eng liegende auseinandergeschoben. Beim Bau: Lage über getBoundingClientRect der ID
  (berücksichtigt die Drehung), ohne Lage Knopfliste; Deckkraft als `style` am Element (kein `<style>`-Block inline).
  Prüfbefund 22.11.2026: 15 CSS-mm (96 dpi), Kreis nie kleiner als --wkr-ziel.
- **BD7** Disq. im Bild über Knopf „Disq. an Boje …“ + Tipp, kein Langdruck (U3). Umgebaut 22.11.2026 (R8-23): dazu
  langes Drücken auf den Trefferkreis (LD1–LD4, plan-antworten-runde7-8.md §4).
- Beim Bau W5.2 (22.11.2026): ±90° nur auf dem Pad (Handy liegend wie WkrParcoursBild, `bildDrehungNurPad`; seit dem
  Prüfbefund 22.11.2026 auch dort nur, wenn die gedrehte Zeichnung nicht kleiner wird, `bildDrehungNachPlatz`); mit Bild
  stehen die Einträge im Klartext auch auf dem Handy (WkrSeite kompakt); Übung `#/uebung` mit Wahl Knöpfe/Bild bei
  Bojen-Listen, Vorgabe nach Fenstergröße wie MW1.
- **KN1** Eine Knoten-Liste je Veranstaltung, Bereich `tisch`.
- **KN2** Start ohne Lauf = Starter (Kennung `['o', id]`), nur Klassen mit der Liste, nicht X.
- **KN3** Keine Schlange: Nummer eintippen, Bestand „offen n / m“ in der Sicht (ohne Namen).
- **KN4** Knoten nie Rückstand, Ampel oder Rückfrage vor „Nächster Start“.
- **KN5** Abschluss der ganzen Knoten-Liste, offene nur mit „Rest auf Papier“.
- **KN6** Knoten-Liste darf nur digital sein (Z6 angepasst).
- **KN7** ✓ = leere Zelle, ✗ = Punkte; Abschicken erst bei allen gesetzt.
- **KN8** Kein Startwechsel-Takt am Tisch; nach dem Abschicken leeres Nummernfeld.
- Beim Bau W5.3 (22.11.2026, noch zu bestätigen): „nicht X“ (KN2) = nicht abgemeldet (AppState.abgemeldet) – die
  Knoten-Liste hat keine Disq.-Spalte; der Bestand folgt der Folge der Starter. Typ `WkrPunkt` = PunktId | `ohne`
  (types/wkr.ts), Abschluss-Schlüssel `ohne` nur an der Liste am Tisch (Reducer, erlaubteWkr, normalisiereWkr).
  Erledigt in der Sicht = Haken (wie die Schlange), in der Lage = Haken oder eigene Werte (wie die Matrix). Die
  Knoten-Liste steht auch ohne Bereich des Betriebs (vor der Verzahnung); eine Pause nimmt keine Starter aufs Papier.
  WKR-Name am Tisch: zuerst Einteilung unter `tisch`, sonst der erste eingetragene Name der Knoten-Liste je Parcours.
  Gerät: ✓-Knoten gehen als leere Zellen ohne `vorher` nicht hinaus – die Korrektur liest Fehlendes als ✓; Korrektur
  am Tisch ohne Rückfrage alt → neu (Hinweisband statt Dialog); eine schon anderswo erledigte Nummer darf trotzdem
  geschickt werden (Rückfrage am Bedienrechner bei Abweichung). Keine Probe für die Prüfliste; „Liste abschließen“
  als Knopf im Fuß (kein Band – es gibt keinen Lauf, der endet). Übung `#/uebung`: Liste „Knoten (am Tisch)“.
  Lebenszeichen: Die Sicht am Tisch hat immer einen Punkt (`ohne`) – das Gerät meldet sich also auch ohne Lauf.
- **ZT1** Bojen + Zeit gemischt = Bojen-Maske mit Zeit-Abschnitt.
- **ZT2** Zellform der Zeit genau wie die Erfassung am Rechner.
- **ZT3** Eine Zeile je Start mit allen Zeitfeldern.
- **ZT4** „Keine Zeit“ mit Grund-Code, Zelle leer, Bedienrechner „Papier ansehen“.
- Beim Bau W5.4 (22.11.2026, noch zu bestätigen): Zeit neben Katalog OHNE Bojen bleibt `spaeter` (kein Aufbau hat
  es). Zelle = Ziffernfolge wie getippt mit Komma (sanitizeTimeInput, wie ZeitZelle.vue speichert); auf dem Gerät kein
  Doppelpunkt, englisch zeigt die Taste „.“, gespeichert wird „,“. Das aktive Zeitfeld springt nie von selbst weiter.
  `kz` geht auf Zeit-Listen IMMER mit (auch leer) und ersetzt das Kennzeichen des Starts; ohne `kz` bleibt es; eine
  Zeit im Feld (Abtippen, spätere Zeile) hebt es auf (wkr/keineZeit.ts ohneUeberholteKeineZeit). Ablehnung ohne neuen
  Code: `feld-fremd` (kein Zeitfeld, doppelt) bzw. `wert-ungueltig` (Form, Grund, Zeit UND „keine Zeit“, mit `n`).
  Rückfrage/Vorschlag tragen `keineZeit` und wirken erst mit der Entscheidung für das Gerät (wie `nichtVorbei`). Die
  Matrix zeigt „✓ keine Zeit“ (Zelle bleibt `ok`, kein eigener Zellstand). Entwürfe merken Zeiten wie getippt, auch
  halb, aber nie „keine Zeit“; die Korrektur holt es aus dem eigenen Stand (Erfassung.keineZeit). Probe: erstes Feld
  83,45, mit mehreren Feldern danach „übrige Felder“; gemischte Listen üben Bojen, dann Zeit (bestätigt 22.11.2026, R8-37). Keine neue
  LISTEN_SICHT_FASSUNG (die Sicht trägt Zeitfelder schon seit W1; `kz` steht nie in der Sicht).
- **TB1** Tabelle nur Pad/Rechner. Beim Bau (22.11.2026): wkr/maskenWahl.ts maskeAufGeraet; auf dem Handy unter „Mehr“
  ausgegraut („Tabelle (nur Pad)“), am Bedienrechner für ein Handy ausgegraut mit Grund; eine Vorgabe „Tabelle“ zeigt
  dort „Knöpfe“. Reine Zeit-Listen haben keine Maskenwahl (feste Art, MW1: erlaubteMasken `zeit`).
- Beim Bau W5.5 (22.11.2026, noch zu bestätigen): **TB2** keine Probe für die Tabelle (für Geübte). **TB3** Spalten
  und Köpfe aus der Sicht, nur Felder, die die Knöpfe des Teils auch schicken; jede Eingabe durch dieselben Sanierer
  wie ErfassungTabelle (wkr/tabelle.ts zelleAusEingabe); was der Sanierer still verwürfe, ist ein Fehler je Zelle
  (`zeichen-fremd`, `code-unbekannt`, `boje-punkte`, `zeit-unlesbar`, `zu-lang`), dazu die Rund-Probe über den
  Entwurf (`nicht-darstellbar`: z. B. derselbe Disq.-Buchstabe doppelt); Fehler sperren Enter und Hauptknopf („2
  Zellen prüfen“), gezeigt erst nach dem Verlassen der Zelle. Geschickt wird über DENSELBEN Entwurf wie bei den Knöpfen
  (entwurfAus → zellenAus), DISQ im Fuß entfällt (Buchstaben in der Zelle), Esc bricht eine Korrektur ab, „Keine Zeit“
  bleibt für leere Zeitfelder gemischter Listen stehen (setzen nur über die Knöpfe). **TB4** Bojen als Punkte („5“,
  „10“, „5J“), nicht als Zahl der Berührungen. **TB5** letzte 5 eigene Zeilen (Werte aus dem eigenen Stand), aktive
  Zeile, nächste 3 Starts; in der Korrektur steht die Zeile an ihrem Platz, der aktuelle Start wartet unter den
  nächsten. Übung `#/uebung`: „Tabelle“ nur auf einem Pad wählbar.

## 11. Risiken

- **getBBox/Drehung** im echten Browser vs. Test-DOM: Zuordnung rein testen, Koordinaten nur im Feldtest (Bildschirmfoto
  klein, Beispieldaten).
- **WkrMaske wächst**: vor W5.1 die Mitte in eine Wahl-Komponente auslagern (`WkrMitte.vue`), sonst unlesbar.
- **Sicht-Fassung 9** (W5.3): alte Geräte zeigen „bitte neu laden“ (wie bisher bei neuen Fassungen).
- **Kontingent**: mehr Listen je Gerät = mehr Gruppen-Abos; Grenze 4 bleibt (LISTEN_JE_GERAET).

## 12. Stand nach W5 (22.11.2026)

W5.1–W5.5 gebaut, Tests grün (`npx vue-tsc -b`, `npx vitest run src/i18n`, `npm run test:leise`). Was das Pad jetzt
kann: Anordnung quer/hoch mit bis vier Spalten und Seitenspalte, ganzer Steg als zwei Spalten, Rundenband über
Racecourse A + B, Attempt-Wechsel invers (W5.1); Maskenwahl je Gerät und Liste – Knöpfe | Bild | Tabelle, Vorgabe und
„fest“ am Bedienrechner (W5.1, W5.2, W5.5); Maske „Bild“ mit Klassen-SVG bzw. Parallel-Schema (W5.2); Knoten am Tisch
als Liste ohne Lauf mit Prüfliste (W5.3); Zeit-Listen mit Ziffernblock und „Keine Zeit“, gemischte Listen mit
Zeit-Abschnitt (W5.4); Tabelle für Geübte mit Tastatur (W5.5). Neue Dateien: wkr/anordnung.ts, maskenWahl.ts, bild.ts,
keineZeit.ts, tabelle.ts; components/wkr/WkrMitte, WkrSeite, WkrBild, WkrPruefliste, WkrZiffern, WkrZeiten,
WkrTabelle.

Offen: alle Auslegungen §10 (PD, MW, BD, KN, ZT, TB) mit dem Nutzer bestätigen; Feldtest Pad
([feldtest.md](feldtest.md) „Pad (W5)“: Querformat, Hülle, Ladekabel, zwei WKR an einem Pad, Bild im echten Browser,
Knoten am Tisch, Zeitnahme mit Anlage und Stoppuhr, Tabelle); danach W6 nach Befund (Bild auf dem Handy, Zeit auf dem
Handy, Steg im Parallelslalom mit A | B in einer Maske). Der wackelige CI-Test GeraetWkr „Probe beim Einrichten …
einmal je Raum“ bleibt auf Wunsch des Nutzers zurückgestellt.

## 13. Prüfbefunde W5 (22.11.2026)

Behoben (alle Auslegungen datiert in `WKR_ANNAHMEN`, noch zu bestätigen):

- **Tabelle stahl den Fokus** (WkrTabelle): Fokus von selbst (neuer Start, Ende der Sperre) nur, wenn er nicht in einer
  anderen `.wkr-spalte` steht – zwei Tabellen nebeneinander auf dem Pad tippen nie in die falsche Liste. Test
  WkrTabelle.test.ts „zwei Tabellen nebeneinander“.
- **„Rück 2“ ging nach DISQ verloren** (WkrBild/WkrMitte): WkrMitte merkt „Rück 2“ je Start (`bildWeg`), das neu
  gebaute Bild steht wieder darauf. Test WkrBild.test.ts.
- **„Rückweg gedreht“ war nicht gedreht** (wkr/maske.ts bojenAbschnitte): Abschnitte ohne Gegenstück stehen jetzt vor
  ihrem Vorgänger in der Fahrtfolge – der Rück-Reiter ist in jeder Liste die umgekehrte Fahrtfolge (Klasse 7: Ziel,
  Tor 1 (2.), Speed 2, Tor 1 R, Tor 3, Tor 5). V3 (a) neu gefasst; die Probe nimmt für „Disq. an Boje“ weiter Tor 1 R
  (ein Tor der 2. Durchfahrt nur ohne anderes, V3 (d)).
- **Bild auf dem Pad viel höher als der Bildschirm** (WkrBild, wkr-geraet.css): ±90° nur, wenn die gedrehte Zeichnung
  im freien Platz nicht kleiner wird (wkr/bild.ts wirksameDrehung, `bildDrehungNachPlatz`), und die Zeichnung nie
  höher als Fenster − `--wkr-bild-rest` (440 px, mindestens 200 px). Tests bild.test.ts (gate135 auf 1024×768),
  wkr-geraet.test.ts.
- **Namensnennung fehlte auf dem Gerät** (CC BY-NC-SA 4.0 Abschnitt 3(a)): WkrBildNachweis.vue unter dem Bild und
  unter WkrParcoursBild (auch in WkrSeite) – Urheber, „bearbeitet“, Quelle mit Stand, Lizenz-Link; Sprache der Liste
  (`wkr.geraet.nachweis*`); nicht unter dem eigenen Parallel-Schema.
- **Trefferkreise kleiner als --wkr-ziel** (wkr-geraet.css): Kreis = `max(var(--wkr-ziel), 15 CSS-mm)`, Abstand beim
  Auseinanderschieben dieselbe Größe; `bildTrefferMm` ausdrücklich als CSS-mm ausgelegt (Frage: Pad-Ziele größer?).
- **ResizeObserver hing am alten Element** (WkrBild): beobachtet die jeweils aktuelle Fläche. Test WkrBild.test.ts.
- **Tastatur kippte die Anordnung** (systemModus.ts useFenster): reine Höhenänderung bei gleicher Breite, während
  ein Eingabefeld den Fokus hat, zählt nicht (`tastaturAendertNichts`). Test components/wkr/systemModus.test.ts; das
  echte Verhalten der Android-Tastatur bleibt Feldtest.
- **`.wkr-tisch` ohne Regel** (WkrMatrix): Regel in app.css.

Verworfen: keiner. Der Befund zur Tastatur ist im Test-DOM nur über `resize` nachstellbar (plausibel, nicht am Gerät
geprüft). Unter voller Last lief einmal auch „W5.2 Maske Bild: Probe am Bild …“ in die 10-s-Grenze beim Warten auf die
Probe (dieselbe Familie wie der zurückgestellte Test „Probe … einmal je Raum“); in Wiederholungen grün, der Test
nennt jetzt den Gerätezustand im Fehlertext.

