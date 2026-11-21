# Plan W4 „Handy, Bojen“ der digitalen WKR-Erfassung

Stand 21.11.2026 (W4.1 gebaut 21.11.2026: wkr/bojen.ts, Sicht Fassung 4, Maske `bojen` – P1–P15 noch zu bestätigen; W4.2 gebaut 21.11.2026: WkrBojen, WkrWegUmschalter, Probe, Übung – P17, Q1–Q7 noch zu bestätigen; W4.3 gebaut 21.11.2026: „Nicht vorbeigekommen“, Doku – P16, R1–R8 noch zu bestätigen; W4 fertig, Feldtest offen, §11) · Grundlage: [vorschlag-wkr-erfassung.md](vorschlag-wkr-erfassung.md) §3
(Rahmen), §4.2 (Bojen und Tore), §4.8 (Parallelslalom), §5 (Abschicken, Korrektur), §7 (Sonderfälle, „Nicht
vorbeigekommen“), §11 W4, §12 F2; der gebaute Stand W1–W3 ([plan-wkr-w1.md](plan-wkr-w1.md),
[plan-wkr-w2.md](plan-wkr-w2.md), [plan-wkr-w3.md](plan-wkr-w3.md), Feldtest-Befunde bis Commit 6a7753e). Antworten des
Nutzers: [entscheidungen.md](entscheidungen.md) „Digitale WKR-Erfassung“, besonders **F2** (je Boje und Fahrtrichtung
eine Berührung = Schalter 5/0; Torbojen Tor 5 = Zähler; Tor 1 auf der Rückfahrt wegen der Speedrunde zweimal). Keine
Rückfragen beim Bau: Auslegungen datiert in `WKR_ANNAHMEN` (P1–P17, §10), „noch zu bestätigen“.

## 1. Ziel und Grenzen

W3 hat die Maske „Knöpfe“ für Listen aus Katalog, Disq. und Bemerkung gebaut (Steg, Tor 5, MüB, Vorsteg). Jede Liste
mit einem Bojenfeld zeigt heute „Maske folgt – bitte Papier“ (`maskenArt` → `spaeter`, G2/G14). Das sind gerade die
Listen mit den meisten Einträgen: Tor 1/3/5, Tor 2/4/5, Parcours mit Start/Ziel, die Listen der Aufbauten
Baden-Württemberg, Berlin, Frontal, Möwe und der Parallelslalom (UIM). W4 liefert:

1. **Bojen-Maske** (Knöpfe in Fahrtfolge) für jede Liste, deren Bojenfelder auf dem Fahrweg liegen – auch gemischt mit
   Katalog (Tor 5 Einfahrt, MüB), Disq. und Bemerkung. Je Boje und Richtung ein **Schalter** (5/leer), Torbojen von
   Tor 5 ein **Zähler**, Tor 1 auf der Rückfahrt **zwei Zeilen** (eine je Durchfahrt).
2. **Seiten nach Blick**: Die zwei Bojen eines Tores stehen nebeneinander, so wie der WKR sie von seinem Platz sieht
   und wie die Unterspalten auf seinem Bogen stehen; beschriftet wie der Bogen (R/L, Land/See, I/A, Pfeile).
3. **Hinweg/Rückweg-Umschalter**, sobald eine Klasse mehr Zeilen hat, als ohne Scrollen passen (Klasse 7: elf Halte).
4. **Probe** mit Bojen-Schritten („Tippe bei Tor 1 ‚H L‘ an“), **Übung** mit Bojen-Listen.
5. **„Nicht vorbeigekommen“** (G15 hat es auf W4 verschoben): Meldung vom Gerät, Kennzeichen im Stand, in der Matrix
   gelb, kein X.

**Nicht in W4** (mit Grund): Bild-Maske und Pad quer (W5 – der Vorschlag §4.2 „Pad quer, Bild“), zwei Listen
nebeneinander und Racecourse A|B auf einem Pad (W5; zwei Listen bekommen wie in W3 Reiter), Knoten-Prüfliste und
Ziffernblock Zeit (W5 – Listen mit Zeit- oder Knotenfeldern bleiben `spaeter`, auch die mit Start/Ziel-Bojen wie
`moewezeit`, `bstartziel`), Steg im Parallelslalom mit zwei Spalten „A | B“ (W5), eine echte Maskenwahl (F14 – es
gibt weiter nur „Knöpfe“, G4), Bojen grau je Klasse auf dem Bild.

## 2. Befund: wie die Spalten Bojen heute abbilden

Grundlage für alle Auslegungen unten – gelesen in `config/kurzform.ts`, `config/feld.ts`, `config/build.ts`,
`lib/eingaben.ts`, `lib/disq.ts`, `lib/scoring.ts`, `config/aufbauten/*.yaml`, `config/regelwerke/*.yaml`.

**Feld-Kennungen** (`config/feld.ts feldKennungen`): je Unterspalte `${key}|${sub}`, also `t1a|hin seiteB` (Tor 1,
Hinfahrt, Boje seiteB). Tor 5 heißt immer `t5|hin seiteA` / `t5|rueck seiteA` (`spaltenKennung` macht aus den geteilten
Spalten `t5a`/`t5b` wieder `t5`). Start/Ziel: `start|hin seiteA`, `ziel|rueck seiteB`. Speedbojen ohne Unterspalte:
`speed1`, `speed2`. Parallelslalom (`parallel.yaml`): `start|seiteB`, `start|seiteA`, `b1a` … `b4a`, `b5`, `b4b` …
`b1b`, `ziel|seiteB`, `ziel|seiteA`. Knoten sind ebenfalls `typ: boje` (`webleinstek` …) – **an der Art allein ist eine
Boje nicht erkennbar.**

**Zellwert** einer Boje (`lib/scoring.ts bojenWert`, `lib/disq.ts sanitizeBuoy`): die **Punkte** („5“, „10“, „15“ …
direkt eingetragen) oder **ein** Disq.-Buchstabe. `wkr/zeile.ts wertGilt` nimmt einen Wert nur, wenn `sanitizeBuoy` ihn
unverändert lässt – „5“, „10“, „G“ gelten, „5 G“, „1x5“ nicht. Die Punkte je Berührung stehen im Regelwerk nur als Text
(`direktpunkte`: DM „Bojen … je Boje und je Fahrtrichtung 5“, „Tor 5 … je Boje und Berührung 5“; UIM „Touching of a
buoy 5“), nicht als Zahl an der Spalte.

**F2 im Fahrweg** (`FAHRWEG`): Tor 1 auf der Rückfahrt sind **zwei Halte mit eigenen Spalten** – `t1b` („1 R“, nicht
Klasse 4) und `t1c` („1 R“, Speedrunde, nur Klasse 7), beide mit beiden Bojen. Also schon heute zwei Zellen je Boje,
nicht eine Zelle mit 0–2 Berührungen. **Die Maske baut deshalb zwei Zeilen mit je einem Schalter je Boje** (F2 wörtlich:
„je Durchfahrt eine Zeile mit eigenem Schalter, passend zu den zwei Spalten“), keinen Zähler 0–2 – ein Zähler müsste
seine Berührungen auf zwei Zellen verteilen, die der WKR auf dem Bogen getrennt sieht. Tor 5: je Richtung ein Feld
(`t5|hin …`, `t5|rueck …`), mehrere Berührungen = höhere Punkte in derselben Zelle → **Zähler** je Feld.

**Klassen**: `listenFelder(konfig, typeId, klasse)` liefert die Felder schon je Klasse (Tor 1 R ohne Klasse 4, Sp. 1 ab
Klasse 5, Sp. 2 und Tor 1 Speedrunde nur Klasse 7). Die Sicht trägt die Maske je Klasse (`ListenSicht.klassen`) – der
Klassenwechsel kommt also von selbst.

**Reihenfolge auf dem Bogen ≠ Fahrtfolge**: Die Kurzform ordnet die Unterspalten nach `blick` (von vorne liegt die
obere Boje links, sonst die untere) – das ist schon „was der WKR sieht“. Die **Spalten** folgen meist dem Fahrweg, aber
nicht immer: `blick: vorne` (frontal) stellt Tor 5 rück vor hin (`tor5Ordnen`), Parcours-Listen stellen die Bojen vor
die Fehler, und bei einer Tor-5-Boje ohne Einfahrt-Katalog stehen hin und rück in **einer** Spalte (gate135).

**Disq. und Bemerkung**: Jede Liste mit Bojen hat eine Spalte „Disq.“ (`disq: parcours` bzw. `mueb`). „Bemerkung“ nur
bei Parcours-Listen und Listen ohne Bojen (`kurzformPosition` `bemerkung`) – Tor-Listen haben keine.

**Listen mit Bojen** (alle Aufbauten, DM und UIM):

| Liste | Bojen | dazu | W4 |
|---|---|---|---|
| gate135, gate135os, gate245, gate245os, frontal135, frontal245, moewe245, bawueland1, bawuewasser2 | Tore, Tor-5-Boje, Speedboje, ggf. Start/Ziel | Disq. | Bojen |
| moewe135, bawueland2, blinks | dto. | Katalog Tor 5 (Einfahrt) | Bojen + Katalog |
| bawuewasser1, brechts | dto. | Katalog MüB | Bojen + Katalog |
| parcoursms | Start/Ziel | Disq., Bemerkung | Bojen |
| tor5puems | Start/Ziel | Katalog Tor 5, Disq., Bemerkung | Bojen + Katalog |
| parallelparcours (UIM, Racecourse A/B) | Start, Boje 1–5–1, Ziel | Disq. | Bojen |
| moewezeit, bstartziel | Start/Ziel | Zeit | `spaeter` (W5) |
| knoten | (Knoten als `boje`) | Bemerkung | `spaeter` (W5) |

## 3. Was wohin gehört

| Angabe | Ort | Warum |
|---|---|---|
| Halt einer Bojen-Kennung (Tor, Richtung, Seite, Folge im Fahrweg, Zähler, Durchfahrt) | **neu, rein** `src/wkr/bojen.ts` | Kennt FAHRWEG (`config/kurzform.ts`) und die Parallel-Folge; an EINER Stelle, damit Sicht, Maske und Tests dasselbe lesen |
| Bojen-Angabe je Feld für das Gerät | `wkr/sicht.ts` `MaskenFeld.boje` (LISTEN_SICHT_FASSUNG 4) | Das Gerät kennt den Aufbau nicht; Kopf der Unterspalte (Beschriftungsschema) steht nur am Host |
| Aufbau der Bojen-Maske, Entwurf mit Bojen, Zellwerte | `wkr/maske.ts` (art `bojen`, `abschnitte`, `Entwurf.bojen`, `tippeBoje`) | dieselbe Regel wie W3: `zellenAus` = genau, was `wertGilt` unverändert annimmt |
| Punkte je Berührung, Zähler-Höchstwert, Grenze für den Umschalter, Klassenwechsel-Band | `WKR_ANNAHMEN` | Zahlen an einer Stelle, datiert |
| Oberfläche | **neu** `components/wkr/WkrBojen.vue`, `WkrWegUmschalter.vue`; Einbau in `WkrMaske.vue`, `WkrProbe.vue`, `WkrUebung.vue`, `texte.ts` | W3-Rahmen bleibt, nur die Mitte kommt dazu |
| „Nicht vorbeigekommen“ | Protokoll (`GeraeteZeile.n`), `wkr/zeile.ts`, `types/wkr.ts`, `state/reducer/wkr.ts`, `wkr/lage.ts`, `geraete/erfassen.ts`, `WkrMehr.vue` | wie jede Zeile: über die Erfassung, Kennzeichen im Stand (Sicherung), nie im Betrieb |

## 4. Reine Logik

### 4.1 `src/wkr/bojen.ts` (neu)

```ts
type Weg = 'hin' | 'rueck'
interface BojenHalt {
  halt: string                 // FAHRWEG-Key bzw. Parallel-Key: 't1a', 't5', 'speed1', 'start', 'b3a', 'b5' …
  weg: Weg                     // Seite des Umschalters (Parallel: b1a–b4a, Start, b5 = hin; Rest rueck)
  seite: 'seiteA' | 'seiteB' | null   // physische Boje (aus der Kennung); Speedboje, Parallel-Bojen 1–5: null
  folge: number                // Position in der Fahrt (FAHRWEG-Index; Tor 5 hin/rück getrennt; Parallel: Spaltenfolge)
  zaehler: boolean             // nur Torbojen Tor 5 (F2)
  durchfahrt?: 2               // zweiter Halt desselben Tores in derselben Richtung (t1c, Speedrunde)
}
function bojenHalt(kennung: string): BojenHalt | null     // null = keine Fahrweg-Boje (Knoten, eigener Key)
function katalogFolge(kennung: string): { folge: number; weg: Weg } | null  // katalog:tor5 → zwischen t5 hin/rück; katalog:mueb → nach t1b
```

- Rein, ohne Konfiguration: liest nur die Kennung und `FAHRWEG`. Eine Kennung, die weder auf dem Fahrweg noch im
  Parallel-Fahrweg liegt, ist keine Boje der Maske (P1) – so bleiben Knoten und eigene ausführliche Aufbauten Papier.
- Parallel-Fahrweg als Konstante hier (`PARALLEL_FAHRWEG = ['start', 'b1a', …, 'b5', …, 'b1b', 'ziel']`), mit
  Kommentar „wie parallel.yaml `spalten`“ und Test, der die Folge gegen die Spalten der Liste prüft (fällt eine Spalte
  weg oder kommt eine dazu, schlägt er an).

### 4.2 `src/wkr/sicht.ts` – Bojen-Angabe je Feld (LISTEN_SICHT_FASSUNG 4)

```ts
interface MaskenFeld {
  …                                          // wie W3
  boje?: {
    halt: string; weg: 'hin' | 'rueck'; folge: number
    titel: string                            // Kopf der Spalte („Tor 1“, „Sp. 2“, „Boje 3“) in der Sprache der Liste
    unter: string                            // Kopf der Unterspalte wie auf dem Bogen („H L“; Start/Ziel nur „L“); '' ohne
    spalte: 0 | 1 | null                     // links/rechts aus Sicht des WKR (P7); null = volle Breite
    zaehler?: true
    durchfahrt?: 2
  }
}
```

- `maskenJeKlasse` setzt `boje` für jedes `buoy`-Feld mit `bojenHalt ≠ null`; `titel`/`unter` aus
  `defFuerKlasse(sprachKonfig.getSheetDef(typeId), k).columns` (Spalte `label`, `sub[i]` – schon nach Beschriftung
  aufgelöst, auch I/A und gespiegelte Pfeile). `spalte`: Index der Seite in der Unterspalten-Folge der ersten
  zweibojigen Spalte dieser Liste; ohne eine solche (nur Start/Ziel einzeln) `null`.
- `andere` (F13) bekommt je Bojenfeld nur `titel`/`unter` der anderen Sprache (`AndereFeld.boje?: {titel, unter}`).
- Positivliste in `sicht.test.ts` um `boje` ergänzen (nur Bogentexte und Fahrweg-Angaben, keine Werte, keine Namen).
- Größe: Test „Sicht gate135 DM, alle Klassen, 12 Starts, komprimiert < 4 kB“ (Inline-Grenze, Risiko aus W3 §8).

### 4.3 `src/wkr/maske.ts` – Bojen

```ts
type MaskenArt = 'katalog' | 'vorsteg' | 'bojen' | 'spaeter'
interface MaskenBoje { feld: string; unter: string; spalte: 0 | 1 | null; zaehler: boolean; punkte: number }
interface MaskenHalt { halt: string; titel: string; weg: 'hin' | 'rueck'; durchfahrt?: 2; bojen: MaskenBoje[] }
type MaskenAbschnitt = { art: 'halt'; halt: MaskenHalt } | { art: 'katalog'; teil: MaskenTeil; weg: 'hin' | 'rueck' }
interface MaskenAufbau { …; abschnitte: MaskenAbschnitt[] /* in Fahrtfolge; leer außer bei 'bojen' */; umschalter: boolean }
interface Entwurf { …; bojen: Record<string /*feld*/, number /*Berührungen*/> }   // `folge` bekommt `#boje:<feld>`
function tippeBoje(e: Entwurf, boje: MaskenBoje): Entwurf   // Schalter: 0 ↔ 1; Zähler: +1 bis bojenZaehlerMax
```

- `maskenArt`: `time`/`points` oder ein `buoy` ohne `boje` → `spaeter`; sonst irgendein `buoy` → `bojen`; sonst wie W3.
  `listeMitMaske` (Bedienrechner, J1) folgt von selbst – die Bojen-Listen verlieren „Maske folgt – Papier“.
- `maskeFuer` baut bei `bojen` die Halte (Felder gleichen Halts und Wegs zusammen, nach `folge`) und setzt die
  Katalog-Teile (W3-`teile`) an ihren Fahrweg-Platz (`katalogFolge`); `umschalter` = mehr als
  `bojenZeilenEineSeite` Zeilen (Halte + Codes) in der Klasse.
- `zellenAus`: je Bojenfeld `String(n × punkte)` bzw. `''` (auch leer – „Fehlerfrei“ wie W3, `schicke` lässt leere ohne
  `vorher` weg). Disq. ins Disq.-Feld der Liste (P9), nie in eine Bojenzelle.
- `entwurfAus`: Ziffern einer Bojenzelle → `round(wert / punkte)` Berührungen (Schalter höchstens 1 – ein „10“ aus einer
  Korrektur des Bedieners kann das Gerät nicht haben, es liest nur seinen eigenen Stand, M2); Buchstaben in Bojenzellen
  kommen vom Gerät nie vor und werden übergangen.
- `zurueck`, `eintraege`, `punkteVon` kennen `#boje:`; `teileFuer`/`disqFuer` unverändert.
- `probeMaske`: bei Bojen-Listen die Klasse mit den **meisten** Zeilen (zeigt Speedrunde und Umschalter, P11).

## 5. Oberfläche auf dem Handy (`components/wkr/`, `styles/wkr-geraet.css`)

Rahmen aus W3 unverändert: Kopf, Starterkarte, Ausweichen/Suche, Zuletzt mit Korrektur und Rückgängig, Overlay „wird
übertragen …“ mit Quittung (N1), Blitz und Sperre (G5), Fuß mit „− letzte zurück“ / DISQ↔FEHLER (N6) / Hauptknopf,
Mehr, Abschluss mit Prüfansicht, Ruhe-Zustände, Gedächtnis je Quelle und Liste (M4), sticky Fuß (M5).

### 5.1 Neue Teile

```
WkrBojen.vue          Mitte der Bojen-Maske: Abschnitte der gewählten Seite (bzw. alle ohne Umschalter) in Fahrtfolge,
                      Kopfzeile HINWEG / RÜCKWEG, je Halt eine Zeile, Katalog-Abschnitte über WkrKnoepfe
WkrWegUmschalter.vue  [ HINWEG · 1 ] [ RÜCKWEG · 0 ] – zwei große Reiter (≥ 64 px), Zahl der Einträge je Seite
```

```
+--------------------------------------+
| ● Tor 1/3/5 · P1 · 1. Lauf           |
|   23   Kl. 7     danach [41][17][Nr.]|
+--------------------------------------+
| [ HINWEG · 1 ]   [ RÜCKWEG · 0 ]     |   nur wenn mehr als 7 Zeilen (P8)
|  Start            [ R  · ]           |   Einzelboje in der Spalte ihrer Seite (P7)
|  Tor 1  [ H R  · ]   [ H L ✔5 ]      |   Schalter: Tipp setzt, zweiter nimmt weg
|  Tor 3  [ H R  · ]   [ H L  · ]      |
|  Tor 5  [ H R  · Berührungen ]       |   Zähler: jeder Tipp +5, „2× = 10“
+--------------------------------------+
| [ − letzte zurück ]                  |
| [ DISQ ]          [ ABSCHICKEN · 5 ] |
+--------------------------------------+
Rückweg (Kl. 7): Tor 5 (Zähler) · Tor 3 · Tor 1 · Sp. 2 (volle Breite) · Tor 1 „2. Durchfahrt“ · Ziel
```

### 5.2 Regeln

- Knöpfe ≥ 64 px hoch, zwei je Zeile mit ≥ 8 px Abstand, `data-ziel="gross"` (Stil-Test wie W3); Zeilentitel links
  schmal, die Knöpfe teilen den Rest. Gesetzt: schwarz hinterlegt mit ✔ und Punkten („✔ 5“), Zähler „2× = 10“ – nie nur
  Farbe. Kein [−][+]: zurück nur über „− letzte zurück“ (bei Zähler: letzter Tipp).
- **Schalter** (alle Bojen außer Tor 5): ein Tipp setzt (5), der zweite nimmt weg. **Zähler** (Torbojen Tor 5): jeder
  Tipp +1 bis `bojenZaehlerMax`, danach nimmt der Knopf nichts mehr an und sagt es kurz.
- **Tor 1, 2. Durchfahrt** (`durchfahrt: 2`): eigene Zeile „Tor 1 · 2. Durchfahrt (Speedrunde)“ an ihrem Platz nach
  Sp. 2 – nicht direkt unter der ersten, so wie das Boot fährt.
- **Umschalter** wechselt nie von selbst; ein neuer Start beginnt auf „Hinweg“, ein Start mit Entwurf (Ausweichen, zwei
  Boote zugleich) auf der Seite, auf der der WKR ihn verlassen hat (Gedächtnis je Quelle, Liste und Start, nicht
  abgelegt). Einträge auf der verdeckten Seite stehen als Zahl am Reiter.
- **Klassenwechsel** (P10): Hat der Start andere Halte als der zuvor gezeigte, liegt `klassenWechselMs` lang ein Band
  „Klasse 7 – andere Halte“ über der Mitte (wie „Keine Bestätigung“, M5: verschiebt nichts, nimmt keinen Tipp).
- Startnummer auf Bojen-Listen 80 px (wie ≤ 700 px Höhe, M5) – die Zeilen brauchen den Platz (P17).
- `WkrFuss` `art: 'bojen'` = Hauptknopf wie Katalog („Fehlerfrei ✓“ → „Abschicken · n Pkt.“, K9 mit Disq.).
- `texte.ts zellenText`: Bojen als „Tor 1 H L: 5 · Tor 5 H R: 10“ (Titel + Unterspalte wie auf dem Bogen) – Zuletzt,
  Korrektur-Dialog („alt → neu“), Prüfansicht (dort Punkte auch bei `bojen`, `pruefText`).
- Parallelslalom: dieselbe Maske; Zeilen „Start“, „Boje 1“ … „Boje 5“ … „Boje 1“, „Ziel“; Kopf „Attempt 2“ invers
  wie W3 (`invers`); die Seite (A/B) schickt der Kern schon mit (`seite`).

### 5.3 Probe und Übung

- **Probe** (`WkrProbe.vue`, G10/N5): Schritte aus dem Aufbau, je nach dem, was die Liste hat:
  1. „Tippe bei ‚Tor 1‘ den Knopf ‚H L‘ an.“ (erste zweibojige Zeile, linker Knopf; ohne eine solche die erste Boje),
  2. „Tippe ‚− letzte zurück‘.“,
  3. nur mit Zähler: „Tippe bei ‚Tor 5‘ zweimal – das zählt 2 Berührungen (10).“,
  4. nur mit Umschalter: „Tippe ‚Rückweg‘ – dort stehen die Bojen der Rückfahrt.“,
  5. „Tippe ‚Fehlerfrei‘ – die Maske springt weiter.“ (Takt mit Sperre wie W3).
  Katalog-Teile der gemischten Liste übt die Probe nicht (die Schritte sind dieselben wie in W3).
- **Übung** (`WkrUebung.vue`): zur Wahl kommen „Tor 1/3/5“ (`gate135`), „Tor 2/4/5“ (`gate245`), „Parcours mit
  Start/Ziel“ (`parcoursms`), unter UIM „Parallelslalom, Racecourse A“ (`parallelparcours`, nur die Maske – ohne Paar
  und Attempt-Wechsel, P12). Kern `geraete/uebung.ts` bleibt; `wkr/uebung.ts` braucht nichts Neues (Masken über
  `maskenJeKlasse`).

## 6. „Nicht vorbeigekommen“ (W4.3, löst G15 ein)

Vorschlag §7: „Boot kam nicht vorbei (vorher aufgegeben, Abbruch) – leere Zeile mit Kennzeichen, kein X; in der Matrix
gelb“. Ohne sie bleibt ein solcher Start in der Schlange stehen, bis der WKR ihn „fehlerfrei“ meldet – falsch – oder
Papier nimmt.

| Stelle | Änderung |
|---|---|
| Gerät | „Mehr → Nicht vorbeigekommen“ für den gezeigten Start; große Rückfrage („23 ist hier nicht vorbeigekommen? Es wird nichts eingetragen.“); `schicke` mit `nv: true` und ohne Zellen; Zuletzt/Prüfansicht zeigen „⊘ nicht vorbeigekommen“; Korrektur (doch vorbei) schickt Werte und hebt es auf |
| Leitung | `GeraeteZeile.n?: true` (nur mit leerem `c`, sonst `wert-ungueltig`); LISTEN_SICHT_FASSUNG 5, damit kein Gerät/Bedienrechner mit altem Stand ein `n` als „fehlerfrei“ liest |
| Prüfung | `pruefeZeile` → `WkrZeile.nichtVorbei: true`; nicht am Vorsteg und nicht im Steg-Ablegen (dort ist es X, F5) → `teil-fremd` bzw. eigener Code `nv-nicht-erlaubt` |
| Stand | `WkrStand.nichtVorbei: Record<liste, string[]>` (`${lauf}|${starter}` bzw. mit `|an`), `normalisiereWkr` (migrate), Sicherung ja (wie Rückfragen), Verlauf `wkrNichtVorbei` |
| Reducer | `WKR_ZEILEN`: setzt den Haken (Schlange und Rückstand gehen weiter – das Boot kommt ja nicht) und das Kennzeichen; eine spätere Zeile mit Werten oder ein Abtippen am Bedienrechner löscht es |
| Bedienrechner | `lage.ts` Zellstand `nv` (Vorrang nach Rückfrage, vor Haken), Matrix „⊘“ gelb mit Wort, Erfassung Zeilenmarke „Papier ansehen“, Abschluss zählt „1 nicht vorbeigekommen: 27“; Start-Freigabe warnt nicht |

## 7. Bedienrechner

Nichts Neues zu bedienen: `listeMitMaske` macht die Bojen-Listen in GeraeteKoppeln/GeraeteListe von selbst zu „Maske:
Knöpfe“; Matrix, Eingang, ◆ und „Papier ansehen“ gelten für jede Liste. Neu nur der Zellstand `nv` (W4.3) mit Legende.
Prüfung und Übernahme bleiben `pruefeZeile`/`wertGilt` – Bojenzellen gehen durch dieselben Sanierer wie die
Erfassungstabelle (`sanitizeBuoy`).

## 8. Scheiben (nacheinander baubar, jede mit grünen Tests)

1. **W4.1 Bojen rein und Sicht** (gebaut 21.11.2026; Brücke bis W4.2: WkrMaske zeigt `bojen` wie `spaeter`,
   WkrGeraet ohne Probe auf Bojen-Listen; Sicht gate135 DM mit allen acht Klassen komprimiert ≈ 2,7 kB) – `wkr/bojen.ts`; `wkr/sicht.ts` (`MaskenFeld.boje`, `AndereFeld.boje`,
   LISTEN_SICHT_FASSUNG 4); `wkr/maske.ts` (art `bojen`, Halte/Abschnitte/Umschalter, `Entwurf.bojen`, `tippeBoje`,
   `zellenAus`/`entwurfAus`/`zurueck`/`eintraege`/`punkteVon`, `probeMaske`); WKR_ANNAHMEN P1–P15 mit Zahlen
   (`bojenPunkte` 5, `bojenZaehlerMax` 9, `bojenZeilenEineSeite` 7, `klassenWechselMs` 2000). Tests:
   `wkr/bojen.test.ts` (jede Bojen-Kennung aller Positionen DM/UIM hat einen Halt; Knoten keinen; t1b/t1c zwei Halte,
   t1c `durchfahrt: 2`; t5 Zähler, sonst Schalter; Folge = FAHRWEG; Parallel-Folge = Spalten von `parallelparcours`;
   `bojenPunkte` = `direktpunkte` beider Regelwerke), `wkr/maske.test.ts` (für **jede** Position mit Art `bojen` in
   DM und UIM und jede Klasse: Schalter-, Zähler- und gemischte Tipp-Folgen → `zellenAus` übersteht `wertGilt`
   unverändert; Fahrtfolge frontal135 = gate135; gate135 Kl. 4 ohne Tor 1 R, Kl. 7 mit Sp. 2 und 2. Durchfahrt;
   moewe135 Einfahrt zwischen Tor 5 hin/rück; Umschalter ab 8 Zeilen; `entwurfAus` rund; `listeMitMaske` gate135 ja,
   knoten/moewezeit nein), `wkr/sicht.test.ts` (Positivliste `boje`, Seite/Spalte nach Blick gate135 vs. frontal135,
   Beschriftung `ls` und `ia`, Größe < 4 kB), `wkr/uebung.test.ts` (gate135 ohne Namen).
2. **W4.2 Handy-Maske Bojen, Probe, Übung** (gebaut 21.11.2026; Auslegungen beim Bau Q1–Q7 in §10 und WKR_ANNAHMEN;
   die Brücke aus W4.1 – `ohneOberflaeche`, keine Probe auf Bojen-Listen – ist entfernt) – `WkrBojen.vue`, `WkrWegUmschalter.vue`, Einbau in `WkrMaske.vue`
   (art `bojen`, Seiten-Gedächtnis, Klassenwechsel-Band), `WkrFuss`, `WkrProbe` (Bojen-Schritte), `WkrUebung` (Listen),
   `texte.ts zellenText`, `styles/wkr-geraet.css` (`.wkr-bojen*`, Sonne/Hell/Dunkel, keine feste Farbe), i18n
   `wkr.geraet.bojen.*`, `wkr.geraet.probe.boje*`, `wkr.geraet.uebung.liste.*` (de + en). Tests: `src/GeraetWkr.test.ts`
   „Bojen“ (gate135 Kl. 7: Tor 1 H L → „Abschicken · 5“ → Erfassung am Host `t1a|hin seiteB` = „5“; zweiter Tipp nimmt
   weg; Tor 5 dreimal → „15“; Tor 1 R und 2. Durchfahrt landen in `t1b`/`t1c`; Kl. 4 ohne Tor 1 R; Umschalter wechselt
   nie von selbst, Zahl am Reiter, Seite je Start gemerkt; Disq. ins Disq.-Feld; Fehlerfrei → Haken ohne Zellen;
   Korrektur „Tor 1 H L: 5 → Tor 1 H L: 5 · Tor 3 R L: 5“; Klassenwechsel-Band verschiebt nichts; Doppeltipp in der
   Sperre wirkt nicht – Fake-Uhr; Probe mit fünf Schritten, nichts am Host; Übung Tor 1/3/5; UIM Parallel Racecourse A
   → `parallel:<runde>/<attempt>`), `styles/wkr-geraet.test.ts` (Bojen-Knöpfe ≥ 64 px über `data-ziel`, Kontrast),
   `geraete/wkr.test.ts` Ende zu Ende (gate135 ganze Zeile, moewe135 Bojen + Einfahrt in einer Zeile).
3. **W4.3 „Nicht vorbeigekommen“, Doku** (gebaut 21.11.2026; Auslegungen beim Bau R1–R8 in §10 und WKR_ANNAHMEN) – §6; i18n `wkr.geraet.nichtVorbei*`, `betrieb.wkr.zelle.nv`; Tests:
   `wkr/zeile.test.ts` (`n` nur ohne Zellen, nicht Vorsteg/Ablegen), `state/reducer/wkr.test.ts` (Haken + Kennzeichen,
   spätere Werte löschen es), `state/migrate.test.ts`, `wkr/lage.test.ts` (`nv`, kein Rückstand),
   `views/BetriebWkr.test.ts` (⊘ mit Wort), `src/GeraetWkr.test.ts` (Mehr → Rückfrage → Zuletzt ⊘, Prüfansicht zählt),
   `wkr/sicht.test.ts` F17 (nichts davon auf Tafel/Zuschauer). Doku: `src/wkr/CLAUDE.md`, `geraete/CLAUDE.md`,
   `components/CLAUDE.md`, Wurzel-Karte („Wo ändere ich“: Bojen-Maske), `docs/betrieb.md`, `docs/feldtest.md`
   (Bojen-Punkte §9), `entscheidungen.md` (P1–P17), Stand im Vorschlag und hier.

Nach jeder Scheibe `npx vue-tsc -b`, `npx vitest run src/i18n` und gezielt `npx vitest run src/wkr src/geraete/wkr
src/geraete/uebung src/GeraetWkr src/styles/wkr-geraet src/views/BetriebWkr`; am Ende `npm run test:leise`.

## 9. Risiken

- **Platz auf dem Handy**: Klasse 7 auf gate135 hat zehn Zeilen, moewe135 mit Einfahrt-Katalog zwölf (neun Halte
  und drei Codes). Der Umschalter teilt sie in 4 + 6 bzw. 6 + 6; trotzdem Feldtest mit kleinem Handy (≤ 700 px) und Handschuhen – notfalls
  Grenze senken oder Codes der Einfahrt zweispaltig.
- **Mehrere Boote zugleich** an einer Tor-Liste: Das älteste Boot ist oft schon auf dem Rückweg, wenn das nächste auf
  dem Hinweg durch Tor 1 fährt. Ausweichen + Entwurf je Start + Seite je Start tragen das; ob es am Wasser reicht, zeigt
  erst der Feldtest (feldtest.md: „zwei Boote im Parcours, Tor 1/3/5“).
- **Seiten nach Blick bei `rechts`/`links`** (Baden-Württemberg, Berlin, Möwe 2/4/5): Dort liegen die zwei Bojen nah
  und fern, nicht links und rechts. Die Maske folgt dem Bogen (P7) – ob „oben/unten“ besser wäre, klärt der Feldtest.
- **Möwe-Parcours** (Klassen 5–7 mit eigenem Bild): Die Fahrtfolge kommt aus FAHRWEG; fährt die Möwe die Halte anders,
  stimmt die Reihenfolge der Zeilen für diese Klassen nicht (die Zellen schon). Vor dem Bau mit `kurse`/Bildern
  abgleichen.
- **LISTEN_SICHT_FASSUNG 4 und 5**: Geräte mit altem Programm zeigen „aktualisieren“ (gewollt, Selbst-Update E8).
- **Größe der Sicht**: `boje` je Feld und Klasse; Test < 4 kB komprimiert, sonst `titel`/`unter` je Liste statt je
  Klasse.

## 10. Auslegungen W4 (21.11.2026, beim Planen, noch zu bestätigen) – kommen datiert in `WKR_ANNAHMEN`

- **P1 Bojen-Maske an den Feldern erkannt**: ein `buoy`-Feld ist eine Boje der Maske, wenn seine Kennung auf dem
  Fahrweg (FAHRWEG) oder dem Parallel-Fahrweg liegt; sonst (Knoten, eigene ausführliche Aufbauten) bleibt die Liste
  Papier. Listen mit Zeit- oder Punktfeldern bleiben `spaeter` (W5). Gemischte Listen (Bojen + Einfahrt Tor 5 / MüB,
  Disq., Bemerkung) bekommen EINE Maske.
- **P2 Schalter und Zähler** (F2): Zähler nur die Torbojen von Tor 5 (je Richtung ein Feld); Start/Ziel, Tore 1–4,
  Speedbojen und die Bojen des Parallelslaloms sind Schalter. Unter UIM gleich (Regel 960 Pkt. 5.3 nennt nur
  „Touching of a buoy“; die Spalten sind dieselben).
- **P3 Tor 1 auf der Rückfahrt**: zwei Zeilen mit je einem Schalter je Boje (Felder `t1b`, `t1c`), die zweite
  „2. Durchfahrt (Speedrunde)“ an ihrem Platz nach Sp. 2 – kein Zähler 0–2, weil der Bogen zwei Spalten hat.
- **P4 Punkte je Berührung** fest 5 (`bojenPunkte`, Test gegen `direktpunkte` beider Regelwerke); Zellwert = Punkte
  („5“, Zähler „10“), wie auf dem Papier.
- **P5 Zähler** höchstens `bojenZaehlerMax` (9) Tipps je Feld; zurück nur über „− letzte zurück“.
- **P6 Fahrtfolge**: Zeilen nach FAHRWEG, nicht nach den Spalten des Bogens; Katalog-Abschnitte an ihrem Platz
  (Einfahrt Tor 5 zwischen Tor 5 hin und rück, zählt zum Hinweg; MüB nach Tor 1 R, zum Rückweg). Parallel: Folge der
  Spalten, Boje 5 (Wende) zum Hinweg.
- **P7 Seiten nach Blick**: zwei Knopfspalten in der Reihenfolge der Unterspalten auf dem Bogen dieser Liste (die
  Kurzform ordnet sie nach `blick`); Einzelboje in der Spalte ihrer Seite, Speedboje und Parallel-Bojen 1–5 volle
  Breite. Beschriftung = Kopf der Unterspalte wie auf dem Bogen (Beschriftungsschema wirkt von selbst).
- **P8 Umschalter Hinweg/Rückweg** erst bei mehr als `bojenZeilenEineSeite` (7) Zeilen (Halte + Codes) der Klasse;
  wechselt nie von selbst; neuer Start auf „Hinweg“, ein Start mit Entwurf auf seiner letzten Seite; Zahl der
  Einträge je Seite am Reiter.
- **P9 Disq.** immer ins Disq.-Feld der Liste (jede Bojen-Liste hat eines); kein „an welcher Boje?“, das Gerät
  schreibt nie Buchstaben in Bojenzellen.
- **P10 Klassenwechsel**: andere Halte als beim zuvor gezeigten Start → `klassenWechselMs` (2 s) Band „Klasse n –
  andere Halte“ über der Mitte, ohne Knöpfe zu verschieben.
- **P11 Probe** mit Bojen-Schritten (Schalter, zurück, ggf. Zähler, ggf. Umschalter, Fehlerfrei) an der Klasse mit den
  meisten Zeilen; Katalog-Teile gemischter Listen übt sie nicht.
- **P12 Übung**: Tor 1/3/5, Tor 2/4/5, Parcours mit Start/Ziel; unter UIM Parallelslalom Racecourse A nur als Maske
  (ohne Paar, ohne Attempt-Wechsel).
- **P13 Fehlerfrei** auf Bojen-Listen = Zeile ohne Zellen wie W3; „Abschicken · n Pkt.“ zählt Bojen und Codes.
- **P14 Texte** in Zuletzt, Korrektur und Prüfansicht: „Tor 1 H L: 5 · Tor 5 H R: 10“ (Kopf wie auf dem Bogen);
  Punkte in der Prüfansicht auch bei Bojen.
- **P15 Sicht**: `MaskenFeld.boje` (Halt, Weg, Folge, Titel, Unterspalte, Spalte, Zähler, Durchfahrt), nur Bogentexte;
  LISTEN_SICHT_FASSUNG 4.
- **P16 „Nicht vorbeigekommen“** (G15): unter „Mehr“ mit Rückfrage, Zeile ohne Zellen mit `n`, setzt den Haken und ein
  Kennzeichen im Stand (Matrix „⊘“ gelb, „Papier ansehen“, kein Rückstand), nicht am Vorsteg und im Steg-Ablegen (dort
  X); spätere Werte heben es auf. LISTEN_SICHT_FASSUNG 5.
- **P17 Startnummer** auf Bojen-Listen 80 px (Platz für die Zeilen); sonst wie W3.

Beim Bau W4.2 (21.11.2026, noch zu bestätigen; WKR_ANNAHMEN `probeLinkerKnopf` … `uebungListenDesRegelwerks`):

- **Q1 Probe**: erster Schritt = linker Knopf der ersten zweibojigen Zeile (gate135 „Tor 1 · H R“ – §5.3 nennt die
  Regel „linker Knopf“, das Beispiel „H L“ widerspricht ihr; es gilt die Regel). Nach dem Zähler-Schritt heißt der
  letzte Schritt „Abschicken“ (die Berührungen stehen noch im Entwurf).
- **Q2 Klassenwechsel-Band** unter der Starterkarte über dem Anfang der Mitte (absolut): Nummer bleibt lesbar, nichts
  rutscht, Tipps auf dem Band fängt es ab; nicht beim ersten Start, nicht in der Korrektur.
- **Q3 Zähler am Höchstwert**: „höchstens 9×“ steht dauerhaft im Knopf statt einer kurzen Meldung (die verschöbe).
- **Q4 Seite je Start und Teil** im Gedächtnis der Maske (gedaechtnis.ts `wege`, nur Arbeitsspeicher); eine Korrektur
  beginnt auf „Hinweg“.
- **Q5 Beschriftung**: Boje ohne Unterspalte (Speedboje, Parallel 1–5) „Berührt“; in Texten die 2. Durchfahrt mit
  „(2. Durchf.)“; Texte in der Folge der Maske.
- **Q6 Ohne Umschalter** beide Wege untereinander mit Kopfzeilen HINWEG/RÜCKWEG.
- **Q7 Übung**: nur Listen des gewählten Regelwerks (Parallelslalom nur UIM, hasParallel); Wechsel auf DM → Tor 5.

Beim Bau W4.3 (21.11.2026, noch zu bestätigen; WKR_ANNAHMEN `nichtVorbei` … `nichtVorbeiUebung`):

- **R1 Wo es nicht gilt**: dort, wo X gilt (`xListen`/`xTeil`, F5) – Vorsteg und Steg-Ablegen; ein Gerät für den
  ganzen Steg schickt es nur mit Teil `an`, die Maske bietet es nur im Reiter „Anlegen“ an. Eigener Code
  `nv-nicht-erlaubt` (nicht `teil-fremd`), damit das Gerät den Grund als Satz zeigen kann.
- **R2 Nur direkt**: Das Kennzeichen entsteht nur, wenn die Zeile direkt übernommen wird. Wird sie Rückfrage (Start nicht
  gezeigt) oder Vorschlag (Papier, abgeschlossen), entscheidet der Bediener nur über den Haken.
- **R3 Aufheben**: jede spätere Zeile desselben Starts und Teils ohne `n` (auch eine leere Korrektur „doch vorbei,
  fehlerfrei“ – das Gerät schickt sie dafür auch ohne geänderte Werte; eine ganze Steg-Zeile hebt auch das Anlegen auf)
  und eigene Werte der Liste in der Zelle, gleich auf welchem Weg (reducer.ts nach jeder Änderung von `eingaben`, am
  Steg nur die Felder des Anlegens). Der Haken bleibt.
- **R4 Matrix**: Zellstand `nv` nach Rückfrage und Vorschlag, vor dem Haken; „⊘“ mit dem Wort „nicht vorbei“, gelb
  über `--rueckstand`; am Steg Anlegen ⊘ + Ablegen ✓ = ⊘, sonst ½. In der Erfassung „Papier ansehen“ (am Steg an den
  Zellen des Anlegens). Kein Rückstand, die Start-Freigabe warnt nicht.
- **R5 Abschluss**: Der Bedienrechner nennt je Abschluss die Startnummern mit Kennzeichen in diesem Punkt (gelesen,
  nicht im Abschluss gespeichert – das Kennzeichen kann später fallen); die Prüfansicht des Geräts zählt sie aus dem
  eigenen Ausgang („1 nicht vorbeigekommen: 27“, Zeile „⊘ nicht vorbeigekommen“ ohne Punkte).
- **R6 Angebot am Gerät**: nur beim gezeigten Start, nicht in der Korrektur und nicht in der Probe; es verwirft einen
  Entwurf dieses Starts; danach dasselbe Overlay wie beim Abschicken. Eine Korrektur einer ⊘-Zeile beginnt leer
  (Dialog: alt „⊘ nicht vorbeigekommen“ → neu).
- **R7 Verlauf**: ein Bündel nur aus ⊘-Zeilen heißt `wkrNichtVorbei`, gemischte bleiben „Werte vom Gerät“.
- **R8 Übung**: wie echt (Zuletzt, Prüfansicht, erledigt den Start), keine Beispiel-Rückfrage auf einer ⊘-Zeile.

## 11. Stand nach W4.3 (21.11.2026)

W4 ist gebaut, nur gegen den nachgebauten Server und ohne echte Bildschirme geprüft – Feldtest offen
([feldtest.md](feldtest.md) „Bojen-Maske (W4)“). Gebaut in W4.3:

- **Kern**: wkr/zeile.ts (GeraeteZeile.n, Code `nv-nicht-erlaubt`, auch in geraete/transport/protokoll.ts ABLEHNUNGEN),
  wkr/nichtVorbei.ts (Schlüssel `${lauf}|${starter}` bzw. `|an`, Aufheben bei eigenen Werten), types/wkr.ts
  WkrZeile.nichtVorbei/WkrStand.nichtVorbei, state/reducer/wkr.ts (setzen, aufheben, wkrOhneLaeufe/wkrNurStarter,
  normalisiereWkr), state/reducer.ts (Nachbearbeitung), lib/verlauf.ts `wkrNichtVorbei`, wkr/lage.ts (Zelle `nv`,
  Marken, ListenAbschluss.nichtVorbei), wkr/sicht.ts LISTEN_SICHT_FASSUNG 5.
- **Gerät**: geraete/erfassen.ts und geraete/uebung.ts (MaskenZeile.nv, Zuletzt/Prüfansicht `nv`, Korrektur hebt auf),
  components/wkr/WkrMehr.vue (Knopf + Rückfrage), WkrMaske.vue (`nichtVorbeiNr`, `nichtVorbei()`, Texte),
  WkrAbschluss.vue (Summe, `data-nv`); i18n `wkr.geraet.nichtVorbei*`, `wkr.geraet.abschluss.nichtVorbei`,
  `geraete.ablehnung.nv-nicht-erlaubt`.
- **Bedienrechner**: components/betrieb/WkrMatrix.vue (⊘ mit Wort, Legende), WkrListeBedienung.vue (Abschluss),
  VerlaufPanel.vue, styles/app.css `.wkr-mzelle[data-zelle='nv']`, `.wkr-mzelle-wort`; i18n `betrieb.wkr.zelle.nv*`,
  `betrieb.wkr.abschluss.nichtVorbei`, `history.what.wkrNichtVorbei`. Erfassung „Papier ansehen“ ohne eigene Änderung
  (zeilenMarken).
- **Tests**: wkr/zeile.test.ts, state/reducer/wkr.test.ts, state/migrate.test.ts, lib/verlauf.test.ts, wkr/lage.test.ts,
  wkr/sicht.test.ts (F17), views/BetriebWkr.test.ts, src/GeraetWkr.test.ts „Nicht vorbeigekommen (W4.3)“,
  geraete/uebung.test.ts.
- **Doku**: CLAUDE.md (Wurzel, src/wkr, src/geraete, src/components, src/state), docs/betrieb.md („Bojen“),
  docs/feldtest.md („Bojen-Maske (W4)“), docs/entscheidungen.md (W4, P1–P17/Q1–Q7/R1–R8 noch zu bestätigen),
  docs/vorschlag-wkr-erfassung.md (Stand, §7, §11).

Offen nach W4: Feldtest (Bojen-Punkte, zwei Boote im Parcours, Seiten bei Blick rechts/links, Klasse 7 auf kleinem
Handy), Bestätigung der Auslegungen P1–P17, Q1–Q7, R1–R8, S1–S5; W5 (Pad quer, Bild, zwei Listen, Racecourse A|B,
Knoten, Zeit).

## 12. Prüfbefunde W4 (21.11.2026)

Acht Befunde, alle geprüft und behoben; Auslegungen S1–S5 datiert in `WKR_ANNAHMEN` (noch zu bestätigen).

| Befund | Behoben |
|---|---|
| „601 öffnen“ fand in Lauf 2 die gesendete Zeile aus Lauf 1 (Korrektur des falschen Laufs) | WkrMaske `oeffneHinweis` sucht nur Zeilen des laufenden Punkts (S2 `pruefenNurLaufenderPunkt`); Test GeraetWkr „in Lauf 2“ |
| ⊘ ging bei Rückfrage/Vorschlag still verloren, Eingang zeigte „fehlerfrei“ bzw. `erfasst@…: 1` | WkrRueckfrage/WkrVorschlag tragen `nichtVorbei` und `teil` (normalisiereWkr); Eingang „⊘ nicht vorbeigekommen“ (`data-teil="wkr-nv"`); „Gerät übernehmen“/„Übernehmen“ setzt es (R2 neu gefasst) |
| Leere Zeile als Vorschlag hob ⊘ schon beim Eingang auf, Verwerfen stellte nichts her | Aufheben nur, wo die Zeile gilt: direkt, bzw. bei der Entscheidung für das Gerät (R3 neu gefasst, reducer/wkr.ts `nvWirkung`); Test „verwerfen lässt ⊘ stehen“ |
| Tor-5-Stand lief bei 360 px aus dem Knopf („Berührungen“, „9× = 45 · höchstens 9×“) | „0×“ statt „Berührungen“; Stand umbrechbar, Zahl `nowrap`, „höchstens 9×“ eigene Zeile, `clamp(14px, 4.5vw, 18px)` (S4) – Feldtest bei 360 px mit Zähler 9 bleibt |
| Band `hinweis-unbekannt` blieb stehen | weg beim ersten gezeigten Start, Abschicken, „Nicht vorbeigekommen“, Korrektur; Knopf „Gesehen“ (S3); Test „987 öffnen in der Ruhe“ |
| Matrix-Zelle `nv` hell nur ~3,2:1 | Tokens `--rueckstand-text` (#92400e, dunkel #fbbf24) und `--rueckstand-soft`; Gelb nur Rand/Fläche, Wort 0.75em, 600 |
| Doppeltipp auf einen Bojen-Schalter nahm die Berührung still weg | Prellschutz je Feld in WkrMaske `tippeBojeKnopf`, `bojenSchalterPrellMs` 400 (S1); Zähler unverändert |
| „Bitte Nr. prüfen“ mit „601 öffnen“ schob alle Knöpfe um ~100 px | Hinweis liegt wie „Keine Bestätigung“ über dem Kopf (`.wkr-kopf-ueber`, `.wkr-kopf-hinweis` z-index 3; S5) |

Verworfen: keiner.
