# Plan: Antworten der Runden 3–6 umsetzen (21.11.2026)

Grundlage: Antworten des Nutzers vom 21.11.2026 abends auf die Fragenseite (Runden 3–6), festgehalten in
[entscheidungen.md](entscheidungen.md) „Antworten 21.11.2026 abends (Runden 3–6)“ und je Eintrag in
`WKR_ANNAHMEN` (src/wkr/annahmen.ts, „NICHT bestätigt …“). Stand des Codes: Commit 404d7c6 plus die nicht
committeten Vermerke. Alle anderen Fragen der Runden 3–6 sind mit „passt“ bestätigt und brauchen nur den Vermerk
(schon gesetzt).

Neue Auslegungen tragen eine Kennung je Scheibe (AM, BZ, GF, WN, BS, CI), das Datum 21.11.2026 und „noch zu
bestätigen“ – im Code an genau einer Stelle (`WKR_ANNAHMEN`, `BETRIEB_ANNAHMEN`) und hier in §8 gesammelt. Keine
Rückfragen an den Nutzer während des Baus.

Feste Regeln für jede Scheibe: i18n de/ UND en/ (gleiche Platzhalter), Begriffe nach Regelbuch, Reducer rein (Zeit vom
Store, IDs vor dem dispatch), neue Felder in migrate() bzw. normalisiere…, Tafel/Zuschauer nur öffentliche Sicht,
nichts aus geraete/ im Reducer, kein Netz ohne Raum, Geräte ohne Store, Stil (ohne Semikolons, einfache
Anführungszeichen), Kommentare mit Warum + Datum. Lehren aus dem Handy-Test: kein Text abgeschnitten bei 360 px,
Maskenfarben nur `--wkr-*`, keine Maskenklassen in app.css, Tests ohne feste Pausen (`bis()`/`zeigt()`). Gezielt
testen; nach Typ-/i18n-Änderungen `npx vue-tsc -b` und `npx vitest run src/i18n`; volle Suite am Ende jeder Scheibe
(`npm run test:leise`). Nicht committen.

## 1 Reihenfolge

| # | Scheibe | Antworten | warum hier |
|---|---|---|---|
| 1 | CI-Probe-Test | (CI rot auf master, c6cb754) | Grundlage: Jede weitere Scheibe läuft dieselbe Suite; eine rote CI verdeckt neue Fehler. Klein. |
| 2 | Parcours-Ampel und Start-Freigabe | P-03, P-04, R6-10, W3-40 | Kern; ändert lage.ts/freigabe.ts, auf denen Gerät und Freigabe aufbauen. |
| 3 | Bojenzelle mit Punkten und Disq. | W4-12 (+ U1/U2/U4 umbauen) | Kern; Zellform, die Wertung, Erfassung und Handy teilen. Vor Scheibe 4, weil W3-17 (J) die Disq.-Wege nutzt. |
| 4 | Gerät-Feinschliff | P-18/W3-01, W3-07, W3-51, W3-15, W3-35, W3-24, W3-25, W3-03, W3-26, W4-13, W3-17, W4-07 | viele kleine Punkte an Maske, Koppeln, Register, Protokoll. |
| 5 | WKR-Namen aus der Veranstaltung | W3-13, W3-41 (L4) | braucht Protokoll und Register aus 4 (Geräteart, Nachricht ans Host). |
| 6 | Beispieldaten und Sortierung | R6-01, R6-02, S-01 | unabhängig, Bedienrechner. |

## 2 Scheibe 1 – CI-Probe-Test

Befund: CI auf master (c6cb754) rot – `src/GeraetWkr.test.ts` „Probe beim Einrichten (W3.4, G10) › einmal je Raum und
Liste …“: Nach dem Neuladen (`w2`, `#/geraet`) wartet `zeigt(() => ruhe && ruheArt(w2) !== 'warte')` 10 s vergeblich;
lokal isoliert grün.

Erste Prüfung beim Planen: `warte` setzt `WkrMaske.vue` (Zeile ~310), wenn für die Liste **keine Sicht** da ist
(`sichten[liste] === null`). Die Verbindungs-Karenz (`verbindeKarenzSek` 12, geraete/erfassen.ts) steuert nur die
Anzeige `verbinde`/`getrennt` und das Schätzen der Schlange, nicht `warte` – der Verdacht „Karenz hält warte“ trifft so
nicht zu. Wahrscheinlicher: Nach dem Neuladen kommt die Listen-Sicht erst, wenn der Host sie neu sendet (nur bei
Änderung bzw. im Takt, oder auf ein Hallo des Geräts) – unter Last (zwei Kerne, volle Suite) länger als 10 s.

Auftrag:
1. `bis()` (Testhilfe, Herkunft prüfen: GeraetWkr.test.ts bzw. geraete/testBrowser bzw. ntfy/testNtfy.ts) bekommt
   einen optionalen Text-Zustand: beim Zeitablauf wirft es mit `beschreibe()` (z. B. `ruheArt`, `verbindung`,
   Sichten je Liste vorhanden?, Zahl der Gruppen-Abos, letzte Nachrichtenart, Host-Verbindung, Uhrzeit seit Mount).
   `zeigt()` reicht das durch; die Probe-Stelle übergibt eine Beschreibung.
2. Ursache klären: Wie bekommt ein neu geladenes Gerät die Listen-Sicht (geraete/erfassen.ts nimmSicht; Host:
   wann sendet er `sicht` an `l…`-Gruppen – bei Änderung, im Takt `freigabeTaktSek`/Lebenszeichen, auf Hallo?). Lokal
   unter Last nachstellen (`npx vitest run src/GeraetWkr.test.ts --pool=forks --poolOptions.forks.singleFork` parallel
   zu einer Last, oder `taskset -c 0,1 npm run test:leise`).
3. Beheben an der Ursache, nicht am Warten: Wenn die Sicht nur im Takt kommt, schickt der Host sie sofort auf das
   Hallo/Lebenszeichen eines Geräts, das noch keine hat (oder das Gerät fragt sie an, die Sicht liegt abgelegt wie
   die der Lese-Links `sichtAblage`). Bleibt es eine Lastfrage, ist die Grenze von `bis()` begründet zu heben – mit
   Kommentar (Warum, Datum) und Zustandsausgabe.
4. Wenn die Karenz doch beteiligt ist (z. B. Schlange erst nach Karenz), im Test `verbindeKarenzSek` wie Zeile ~1194
   herabsetzen – nur mit Begründung.
Annahme CI1 (21.11.2026, noch zu bestätigen): Ein Gerät, das sich nach dem Neuladen meldet und für eine Liste keine
Sicht hat, bekommt sie sofort (nicht erst im Takt) – nur falls Punkt 3 das als Ursache bestätigt.

Tests: GeraetWkr.test.ts (die Stelle, dazu ein Test „nach dem Neuladen kommt die Sicht ohne Takt“), volle Suite zweimal.

## 3 Scheibe 2 – Parcours-Ampel und Start-Freigabe (P-03, P-04, R6-10, W3-40) – gebaut 21.11.2026

Nutzer (P-03): Die Freigabe bezieht sich nur auf den Parcours. Gezeigt → Tafel umgestellt, Parcours-WKR sehen den
Starter, Ampel **grün**. Durchfahrt Start/Ziel-Tor → **rot**, rot auch nach dem Verlassen, bis alle Parcours-WKR
abgeschickt haben; dann der Nächste. Auto-Modus, wenn alle ein Gerät haben. Steg/Vorsteg laufen autark.

### 3.1 Was ist eine Parcours-Liste (geprüft an den Aufbauten)

`gemeinsam.yaml`, `alcatraz.yaml`, `berlin.yaml`, `moewe.yaml`, `frontal.yaml`, `bawue.yaml`, `parallel.yaml`:

| Liste | Parcours? | Grund |
|---|---|---|
| `steg` (Ablegen/Anlegen), `vorsteg` | nein | Nutzer: „nie auf den Steg oder Vorsteg“ |
| `knoten` (`lauf: false`) | nein | kein Lauf; W5 |
| `zeit` (nur Zeitfelder) | nein (AM2) | Zeitnahme, keine Bewertung; Papier bis W5 – sonst gäbe es nie einen Auto-Modus |
| `moewezeit`, `bstartziel` (Zeit + Start/Ziel-Bojen) | ja | Bojen am Start/Ziel-Tor sind Bewertung; bis W5 Papier (Maske `spaeter`) → kein Auto-Modus in diesen Aufbauten |
| Tor-Listen (`gate135(os)`, `gate245(os)`, `brechts`, `blinks`, `moewe135/245`, `frontal…`, `bawue…`), `tor5`, `tor5pue`, `tor5puems`, `mueb`, `parcours`, `parcoursms` | ja | Bojen, Tor 5, Mann-über-Bord, Parcoursüberwachung |
| `parallelparcours` A und B | ja | Racecourse A/B als Paar |

Regel (AM1): an den Feldern erkannt, nicht an der ID (wie maskeNachFeldarten): Parcours-Liste = Liste mit Lauf, die
nicht geteilt ist (`teileVon` – Steg), nicht `einmalJeStarter` (Vorsteg) und mindestens ein Feld außer Zeit hat.
Eine Stelle: `wkr/liste.ts` `istParcoursListe(konfig, typeId)`; Test über alle Aufbauten mit der Tabelle oben.

### 3.2 Zustand und Ableitung

- **Gespeichert** wird nur, was ein Mensch auslöst: `BereichBetrieb.durchfahrt: { ref: string; zeit: number } | null`
  (types/betrieb.ts) – der Start, für den „Durchs Start-Tor“ getippt wurde. Action `BETRIEB_DURCHFAHRT { bereich,
  ref, an: boolean }` in state/reducer/betrieb.ts (Zeit setzt der Store; `ref` ≠ aktuell → unverändert, dieselbe
  Referenz). Fällt von selbst weg, sobald ein anderer Start gezeigt wird (bei BETRIEB_ZEIGEN/ZURUECK auf `null`).
  `normalisiereBereich` (migrate) mit Typprüfung, Rückfall `null`. In die Positivliste der Start-Freigabe
  (geraete/aufgaben.ts) aufnehmen. Verlauf: Art in lib/verlauf.ts nur, wenn ARTEN es verlangt (eher nicht: Betrieb).
- **Abgeleitet** (rein, `wkr/ampel.ts` neu, nutzt lage.ts): je Bereich
  `ampel: 'aus' | 'gruen' | 'rot' | 'frei'`:
  - `aus`: kein Start gezeigt, Bereich ohne laufenden Punkt, oder keine Parcours-Liste digital (alles Papier → wie
    heute keine Leiste; AM3).
  - `gruen`: gezeigter Start, noch nicht durch.
  - `rot`: Durchfahrt – gesetzt über `durchfahrt` ODER sobald irgendeine Parcours-Liste für diesen Start eine Zeile/
    einen Haken hat (AM4: Wer schon abschickt, hat ihn gesehen) – und noch mindestens eine digitale, aktive
    Parcours-Liste offen.
  - `frei`: durch und alle digitalen, aktiven Parcours-Listen haben für diesen und alle früheren Starts abgeschickt
    (Haken, X, P, „nicht vorbeigekommen“/J zählen als erledigt wie heute in `schlange()`).
  Papier-Listen und pausierte/abgemeldete zählen nicht (F1). Ein gerade gezeigter, noch nicht durchgefahrener Start
  zählt **nie** als offen (beantwortet P-03/P-04 – keine Rückfrage vor fast jedem „Nächster Start“).
- `ListenLage` (lage.ts) bekommt `parcours: boolean`; `warnt` und `rueckstandZeile` nur noch für Parcours-Listen, und
  der aktuelle Start zählt erst ab `rot`. Steg/Vorsteg bleiben in Matrix und Leiste sichtbar (Stand, ✓/⧗), warnen aber
  nie (Nutzer: „laufen autark“). Ersetzt N8 (`nachfrageAbEinem`) für Steg/Vorsteg; R und „nachfragen“ gelten für die
  Parcours-Listen weiter (AM5).

### 3.3 Bedienung

- Start-Freigabe (components/betrieb/StartFreigabe.vue, Bedienrechner und Freigabe-Handy gleich): großes Ampelzeichen
  am gezeigten Start (● grün „Start frei“ / ● rot „im Parcours – WKR tragen ein (n offen)“ / „frei – Nächster“), Knopf
  **„Durchs Start-Tor“** (nur bei grün; macht rot) mit „zurück“ (rot durch Knopf, noch keine Zeile → wieder grün).
  Rückfrage vor „Nächster Start“ nur, wenn die Ampel rot ist und nur mit den offenen Parcours-Listen („Tor 1/3/5 hat
  604 noch nicht abgeschickt – trotzdem weiter?“); bei grün (Starter fuhr nicht los) keine Rückfrage wegen dieses
  Starts, ältere offene Parcours-Starts weiter wie heute. Nie gesperrt (F4 bleibt).
- **Auto-Modus** (AM6): Einstellung `AnzeigeEinstellungen.wkrAuto: boolean` (Vorgabe aus), SettingsView `#betrieb`
  unter den WKR-Einstellungen, `SET_ANZEIGE`/`normalisiereAnzeige`, `listopt.betrieb.wkrAuto*` de+en. Wirksam nur,
  wenn im Bereich **jede** Parcours-Liste digital, aktiv und laut Register von einem Gerät abgedeckt ist; sonst zeigt
  die Start-Freigabe „Auto aus: Tor 2/4/5 auf Papier“. Bei `frei` zählt die Start-Freigabe sichtbar
  `autoVerzugSek` (3 s, BETRIEB_ANNAHMEN) herunter mit „Anhalten“ (hält bis zum nächsten Start), dann
  `BETRIEB_ZEIGEN` mit dem ersten offenen Start des **begonnenen** Punkts. Nie automatisch: neuer Punkt/Lauf
  beginnen, Nachzuholen, zurückgestellte, bei offener Rückfrage/Vorschlag, bei Meldung „Pause/Störung“, nach „Zurück“.
  Wer dispatcht: nur das Fenster mit der Führung (geraete/fuehrung.ts, dasselbe, das Geräte-Actions anwendet; Logik in
  geraete/host.ts oder einem kleinen `geraete/auto.ts`, die Entscheidung rein in `wkr/ampel.ts` `autoSchritt()`),
  Zeit/IDs vor dem dispatch. Das Freigabe-Handy zeigt Countdown und „Anhalten“ (Anhalten = Action an den Host,
  gerätelokaler Merker im Host, nicht im AppState – AM7).
- Parallelslalom (UIM): Ampel je Bereich `parallel`, Start = Paar; Parcours-Listen = `parallelparcours` A und B;
  rot, sobald eine Seite eine Zeile hat oder per Knopf; frei, wenn beide (besetzte) Seiten fertig; leere Seite zählt
  nicht.
- Anzeigetafel und Zuschauerliste: **keine** Ampel (AM8) – F17 (nichts aus der WKR-Erfassung auf der Tafel), die
  Tafel zeigt den Starter ohnehin erst ab grün; `sichtOeffentlich` und `sv` bleiben unverändert (Test in sicht.test.ts,
  dass kein Ampelfeld hineinkommt).
- Freigabe-Sicht (wkr/freigabe.ts): `fv` 2 mit `ampel`, `autoMoeglich`, `autoIn` (Sekunden oder null) und je Liste
  `parcours`; `liesFreigabe` Feld für Feld, alte Fassung → null. Positivliste-Test erweitern (keine Namen/Werte).
- WKR-Geräte (AM9): Listen-Sicht (wkr/sicht.ts, `LISTEN_SICHT_FASSUNG` 6) bekommt für Parcours-Listen `ampel` des
  gezeigten Starts; die Starterkarte zeigt einen kleinen Punkt grün/rot (Farben `--wkr-*`, Text daneben, 360 px ohne
  Abschneiden). Steg/Vorsteg: nichts.

### 3.4 R6-10 und W3-40 (Abschluss)

- R6-10: „Liste abschließen“ (Band und Prüfansicht, components/wkr/WkrAbschluss.vue) fragt **immer** nach, solange der
  Lauf noch läuft: Punkt ist der laufende des Bereichs und (Schlange oder „danach“ nicht leer oder ein Start dieses
  Punkts noch im Boot/Anlegen ausstehend (T2/T9) oder Ampel des Bereichs rot). Text: „Lauf n läuft noch (604 noch
  unterwegs) – trotzdem abschließen?“. Die Sicht des Geräts trägt dafür `laeuft: boolean` je Punkt (schon in
  LISTEN_SICHT_FASSUNG 6). T9 sonst unverändert. WKR_ANNAHMEN.stegAbschlussOhneImBoot nachziehen.
- W3-40 (AM10): „Mehr → Liste abschließen“ wird **herausgenommen**. Abschließen nur über das Band nach dem Lauf (G16,
  L2 bestätigt); das Band bekommt eine Erklärzeile „Unterschrift für Lauf n – alle Klassen dieses Laufs auf dieser
  Liste, ersetzt die Unterschrift auf dem Bogen“. L3 (`abschlussPunktWahl`) entfällt; Tests anpassen.

### 3.5 Dateien und Tests

wkr/liste.ts (istParcoursListe), wkr/ampel.ts (+test), wkr/lage.ts (parcours, warnt), wkr/freigabe.ts (fv 2),
wkr/sicht.ts (ampel, laeuft), types/betrieb.ts, state/reducer/betrieb.ts (+ reducer.ts case, normalisiereBereich,
normalisiereAnzeige wkrAuto), geraete/aufgaben.ts, geraete/host.ts bzw. auto.ts, components/betrieb/StartFreigabe.vue,
GeraetFreigabe.vue, components/wkr/WkrStarterKarte.vue, WkrAbschluss.vue, WkrMehr.vue, views/SettingsView.vue,
i18n betrieb.* / listopt.betrieb.* / wkr.geraet.* (de+en), WKR_ANNAHMEN (nachfrageAbEinem → AM5),
BETRIEB_ANNAHMEN (autoVerzugSek, AM6–AM8), docs/betrieb.md (Ablauf mit Ampel), docs/entscheidungen.md (P-03 als
gebaut). Tests: ampel.test.ts (grün/rot/frei, Papier, Pause, Parallel-Paar, aktueller Start nie offen bei grün),
lage.test.ts (Steg warnt nie), freigabe.test.ts, reducer-Test BETRIEB_DURCHFAHRT (rein, gleiche Referenz,
Wegfall bei ZEIGEN), StartFreigabe-Komponententest (Knopf, Rückfrage nur bei rot, Auto-Countdown mit Fake-Uhr,
Anhalten), GeraetWkr (Handy: Ampel in der Karte, Abschluss-Rückfrage), sicht.test.ts (keine Ampel in der Tafel),
main.geraete.test.ts unverändert grün.

## 4 Scheibe 3 – Bojenzelle mit Punkten und Disq.-Buchstabe (W4-12) – gebaut 21.11.2026

Nutzer: Boje/Tor bei Disq. immer nachfragen und in derselben Spalte eintragen; Fehlerpunkte (5) und Disq.-Grund
müssen in derselben Bojenzelle stehen können. 404d7c6 (U1/U2) ersetzt die Berührungen durch den Buchstaben – überholt.

- **Zellform** (BZ1): Ziffern, dann höchstens ein Buchstabe, ohne Leerzeichen gespeichert: `5`, `J`, `5J`, `10G`
  (Tor 5 Zähler). Anzeige in Erfassung/Wertungsliste ebenso (`5J`, schmal). Eingabe tolerant: `5 j`, `j5`, `5,J` →
  `5J`. Bestehende Werte (`5`, `J`) sind schon gültig – **keine Migration** nötig; migrate prüft nichts Neues
  (Test: alte Stände laden unverändert).
- `lib/disq.ts` `sanitizeBuoy(raw, allowed)` → Ziffern + erster erlaubter Buchstabe (`${ziffern}${buchstabe}`),
  Kommentar mit Datum; `lib/scoring.ts` `bojenWert(raw)` → `{ punkte, disq? }` aus beidem (heute: Buchstabe ⇒ 0
  Punkte). Alle Leser gehen über `bojenWert`: lib/ergebnis.ts `bewerte`, lib/scoring.ts `handleBuoy`,
  lib/erfassung.ts (disqsImLauf, zeilenHinweise: Hinweis `bojePunkte` nur auf den Ziffernteil), wkr/zeile.ts (X-Prüfung
  `=== NICHT_GESTARTET` – X nie mit Punkten: `5X` → Hinweis/abgelehnt, BZ2), lib/beispielwerte.ts (unverändert, nur
  prüfen). Wertung: Punkte zählen in die Summe, der Buchstabe disqualifiziert (wie heute je Lauf; die Punkte bleiben
  sichtbar, BZ3 – wie Fehlerpunkte neben einem Disq. in einer Code-Spalte).
- Erfassungstabelle (components/erfassung/ErfassungTabelle.vue ~440): Abtippen von `5J`; Breite der Bojenzelle prüfen
  (zwei Zeichen, Tor 5 drei); Hinweise.
- Bogen-Druck: WKR-Bögen sind leer (Papier) – nur prüfen, dass nirgends Werte gedruckt werden; Wertungslisten
  (components/ergebnis/*Blatt.vue, ergebnisText) zeigen Disq. weiter als „disq.“ in der Punktezelle; wo Fahrweg-Zellen
  einzeln erscheinen, `5J` ohne Umbruch.
- Handy-Bojen-Maske (wkr/maske.ts, components/wkr/WkrBojen.vue, WkrMaske.vue, WkrProbe.vue): „Disq. an Boje“ setzt den
  Buchstaben **zusätzlich**; Berührungen bleiben (U2 → `disqBojeErsetztPunkte: false`, umbenennen in
  `disqBojeMitPunkten`). Ohne Disq.-Modus nimmt eine Boje mit Buchstaben weiter Tipps an (Punkte), der Buchstabe
  bleibt. Herausnehmen nimmt nur den Buchstaben. `zellenAus`/`disqAnBojen` schreiben `${punkte}${buchstabe}`.
  Anzeige im Knopf: Punkte und Buchstabe nebeneinander (360 px, nichts abgeschnitten).
- **Boje bei Disq. immer abfragen** (BZ4): Auf Bojen-Listen führt der DISQ-Knopf zuerst zur Wahl „an welcher Boje/
  welchem Tor?“ (Bojen der Klasse in Fahrtfolge, dazu „keine Boje / ganzer Parcours“ für Disq. ohne Ort, z. B. Nicht
  vorbeigekommen, Ausrüstung) und dann zum Buchstaben dieser Zelle; „keine Boje“ schreibt ins Disq.-Feld. Damit
  verschwindet der getrennte Disq.-Modus-Knopf nicht, er wird der Einstieg. Katalog-Listen (Tor 5 ohne Bojen, MüB)
  bleiben wie gebaut.
- Probe (U4) und Übung auf die neue Bedienung umstellen (Schritt „Disq. an Boje“ mit Punkt UND Buchstabe).
- WKR-Zeile/Protokoll: Zellwert ist ein String – keine Protokolländerung; wkr/zeile.ts `wertGilt` über sanitizeBuoy
  nimmt `5J` an. Rückfragen/Übernahme (wkr/uebernahme.ts): abweichend heißt String-ungleich; ein Papierwert `5` und ein
  Gerätewert `5J` sind abweichend (Rückfrage), kein Zusammenführen (BZ5).
- WKR_ANNAHMEN: U1 Text, U2 ersetzt, P9/disqNieInBoje Kommentar, neue BZ1–BZ5. docs/entscheidungen.md W4-12 als gebaut.

Tests: disq.test (sanitizeBuoy-Tabelle), scoring/ergebnis.test (5J zählt 5 und disqualifiziert; 10G an Tor 5),
erfassung.test (Hinweise), ErfassungTabelle-Test (Abtippen), maske.test (Disq. behält Punkte, Herausnehmen),
WkrBojen-/GeraetWkr-Test (Disq. fragt Boje, „keine Boje“ → Disq.-Feld), zeile.test (5X abgelehnt), Übung.

## 5 Scheibe 4 – Gerät-Feinschliff – gebaut 21.11.2026

Abweichungen beim Bau (21.11.2026): W3-35 ohne neue Protokollart – „So lassen“ ist eine gewöhnliche Geräte-Action
(WKR_SO_LASSEN über die Positivliste, PROTOKOLL_FASSUNG bleibt 2); W3-07 ohne build.ts (nur die Maske braucht die
Klassen: config/catalog.ts codeKlassenOf, Bogen und Legende unverändert; uim-2026 hat keine Codes „ab Klasse“);
W3-24 im nachgebauten ntfy nicht nachstellbar (Tests grün) – behoben an der vermuteten Ursache (Nachholen nach jedem
neuen Gruppenschlüssel) plus Knopf; W3-25 `hallo.typ` freiwillig (keine neue Fassung), Art nur beim ersten Koppeln
übernommen. LISTEN_SICHT_FASSUNG 7 (`aus`, `bild`).

| Antwort | Umbau | Stellen |
|---|---|---|
| P-18, W3-01 | Vorgabe der Ansicht = System (`prefers-color-scheme` hell/dunkel); Sonne/Hell/Dunkel unter „Mehr → Ansicht“ jederzeit, gewählte Ansicht gemerkt je Gerät (`geraete/ablage.ts` liesAnsicht; ungemerkt = „wie Gerät“, folgt einem Wechsel des Systems live). `color-scheme` folgt der Maske, die Maske folgt dem System, solange nichts gewählt ist. Auswahl bekommt „Wie Gerät“ (GF1). Übung ebenso. | WKR_ANNAHMEN.sonneVorgabe → false, farbenNurMaske Teil N4; styles/wkr-geraet.css (Tokens `--wkr-*` je Modus); WkrMehr.vue; i18n wkr.geraet.ansicht.* |
| W3-07 | Codes, die laut Katalog in der Klasse nicht gelten, ausgegraut (Klasse `aus`, Farbe `--wkr-*`), drückbar, ohne Rückfrage (GF2). Neue YAML-Angabe je Code `abKlasse` (bzw. `klassen`) in den Katalogen von dm-2026/uim-2026 (aus den Texten „ab Klasse 3/4“ übernommen, Kommentar mit Beleg) → config/schema, validate, build, catalog; Sicht der Maske trägt `aus: true` je Code der Klasse. | regelwerke/*.yaml, config/validate.ts, config/catalog.ts, wkr/sicht.ts maskenJeKlasse, WkrKnoepfe.vue, WKR_ANNAHMEN.codesAlleKlassen → false |
| W3-51 | Gerät für den ganzen Steg: Umschalter Ablegen/Anlegen **immer** sichtbar (nicht nur bei Arbeit im anderen Teil), je Teil Zeichen ✓ (nichts offen) bzw. Zahl offener Starts (GF3); feste Höhe, keine Verschiebung (M5 sonst bleibt). | components/wkr/WkrStegReiter.vue, WkrMaske.vue, WKR_ANNAHMEN.bildschirmOhneNachrutschen |
| W3-15 | Übung: unter den Knöpfen (Bereich beim Hochziehen/Scrollen) „Übung beenden“ (zurück zur Übungswahl bzw. Startseite des Geräts, Entwürfe der Übung weg) und ein Erklärtext oben in der Übung: „Starts 1–20 ohne Namen in den Klassen des Regelwerks; Bestätigung kurz nach dem Senden; gelegentlich eine Rückfrage; die Starts kommen nach und nach“ (GF4, einklappbar, gemerkt je Gerät). | components/wkr/WkrUebung.vue, WkrGeraet.vue, geraete/uebung.ts, i18n wkr.uebung.* |
| W3-35 | „So lassen“ an Rückfrage/Ablehnung schickt eine Nachricht an den Host (neue Art im Protokoll, `PROTOKOLL_FASSUNG` prüfen, nur Zeilen-ID, kein Wert); der Host zeigt an der Rückfrage im Eingang „WKR: so lassen“ (Zeit), die Rückfrage bleibt offen, bis der Bediener entscheidet (GF5: als Feld an der Rückfrage im AppState, `soLassen: zeit`, weil die Rückfrage selbst dort lebt; Reducer-Action `WKR_SO_LASSEN`, Zeit vom Store; migrate prüft das Feld). | geraete/transport/protokoll.ts, geraete/erfassen.ts, geraete/host.ts, state/reducer/wkr.ts, components/betrieb/WkrEingang.vue, WKR_ANNAHMEN.soLassenNurLokal → false |
| W3-24 | Erste Liste auf einem Gerät ohne Liste: Das Gerät abonniert die neue Listen-Gruppe sofort, wenn neue Aufgaben ankommen (keine Neuladen-Pflicht); zusätzlich in „verbinde …“ nach `verbindeKarenzSek` ein Knopf „Neu verbinden“ (lädt den Transport bzw. die Seite neu) (GF6). Ursache zuerst im Test nachstellen (Gerät nur mit Freigabe bzw. ohne Aufgabe → Liste zuweisen). | geraete/geraet.ts / gekoppelt.ts / erfassen.ts (Gruppenabos bei Aufgabenwechsel), GeraetApp.vue, WkrRuhe.vue |
| W3-25 | Geräteart beim Koppeln: Das Gerät meldet `art: 'handy' \| 'pad' \| 'rechner'` (aus kurzer Seite des Bildschirms und Pointer, GF7) in der Koppel-Nachricht; der Host speichert sie im Register (gerätelokal, geraete/register.ts); die Geräteliste zeigt sie und ändert sie per Auswahl. J2 (Name) entfällt. | geraete/transport/protokoll.ts, gekoppelt.ts, register.ts, GeraeteListe.vue, WKR_ANNAHMEN.handyNachName → false |
| W3-03 | Listen je Gerät: `LISTEN_JE_GERAET` als Obergrenze 4 (GF8), Empfehlung (Handy 1, Pad 2) nur als Hinweis in GeraeteListe/wkrListenWahl nach der Art aus W3-25. Gerät mit mehr Listen: Reiter wie heute (scrollbar, Text nie abgeschnitten); auf dem Pad (≥ 1000 px quer) zwei Listen nebeneinander als zwei Spalten der Handy-Maske (T10-Regel erweitern) – mehr als zwei: Reiter. | geraete/aufgaben.ts, liesAufgaben, components/betrieb/wkrListenWahl.ts, WkrGeraet.vue, styles/wkr-geraet.css, WKR_ANNAHMEN.handyEineListe |
| W3-26 | Start-Freigabe beim Koppeln nie vorgewählt, auch nicht mit einem Parcours ohne Liste. | components/betrieb/GeraeteKoppeln.vue, WKR_ANNAHMEN.freigabeVorwahlOhneListe → false, BETRIEB_ANNAHMEN (E7-Vorwahl) nachziehen |
| W4-13 | Klassenwechsel-Band nur beim **ersten** Start einer neuen Klasse im Punkt (nicht bei jedem Wechsel zwischen verzahnten Klassen) (GF9); unter den Knöpfen (beim Hochwischen) die Parcours-Zeichnung der Liste und Klasse (Bild der Position bzw. `kurse.bilder` je Klasse; die Sicht trägt die Bild-ID, das Gerät lädt das gebündelte SVG aus src/assets/parcours, kein Netz) – auf Bojen-Listen und Tor-5/MüB-Listen mit Bild. | wkr/maske.ts (Wechsel-Regel), WKR_ANNAHMEN.klassenWechselMs (P10/Q2), wkr/sicht.ts (bild), components/wkr/WkrMaske.vue bzw. neues WkrParcoursBild.vue |
| W3-17 | „Nicht vorbeigekommen“ = Disq. **J** ins Disq.-Feld der Liste (Ablauf W4.3 bleibt: „Mehr“, nur gezeigter Start, Haken, Abschluss nennt die Nummern). Wo die Liste J nicht kennt (Steg-Anlegen; `bereiche: [parcours, mueb]`), bleibt das bisherige Kennzeichen ⊘ (GF10). Bestehende ⊘ auf J-Listen werden nicht in J umgeschrieben (Entwicklung, keine Abwärtskompatibilität nötig); sie bleiben lesbar und gelten weiter (GF11). Matrix: J = ✓ mit Disq.-Marke. | wkr/nichtVorbei.ts, state/reducer/wkr.ts, wkr/lage.ts, components/wkr/WkrMehr.vue, WKR_ANNAHMEN.nichtVorbei* |
| W4-07 | Regelwerke geprüft (beim Planen): dm-2026 `direktpunkte` 5 je Boje und Richtung bzw. je Berührung an Tor 5 (Reglement C5 b, c), uim-2026 „Touching of a buoy“ 5 – 10 Punkte stehen in keinem Regelwerk. Test: `WKR_ANNAHMEN.bojenPunkte` = Punkte der Regelwerke (Fehler, falls ein Regelwerk anders zählt); Kommentar in annahmen.ts „bestätigt 21.11.2026 (W4-07)“ mit Beleg. | wkr/annahmen.ts, regelwerke.test.ts bzw. bojen.test.ts |

Tests je Zeile (Komponente bzw. rein), Handy 360 × 640 und Pad im happy-dom-Test über Klassen/Attribute; Farben nur
`--wkr-*` (vorhandener Test, dass Maskenklassen nur in wkr-geraet.css stehen).

## 6 Scheibe 5 – WKR-Namen aus der Veranstaltung (W3-13, W3-41) – gebaut 21.11.2026

Abweichungen beim Bau (21.11.2026): Lebenszeichen trägt `namen` freiwillig (je Liste nur die Änderungen gegenüber der
Einteilung; PROTOKOLL_FASSUNG bleibt 2, wie `hallo.typ`), die Änderung geht sofort als Lebenszeichen hinaus (auch ohne
Stille/laufenden Punkt). Gerätelokal liegt der Name im Ausgang `alcatraz.geraet.wkr` (Raum-gebunden, weg mit „Raum
verlassen“). Übernimmt der Bedienrechner den Namen in die Einteilung, fällt die Abweichung auf dem Gerät von selbst (Sicht
bringt denselben Namen) – spätere Änderungen der Einteilung kommen wieder an. Ein beim Abschluss eingetippter Name wird
Name der Liste auf dem Gerät (WN3). Hinweis zusätzlich in Betrieb → WKR (WkrListeBedienung). L4 (`nameBeimAbschicken`)
bleibt als Rückfall G12 für Listen ohne Einteilung.


- Quelle: `AppState.einteilung` (Parcours × Liste → Name, Veranstaltung; Personenangabe: Sicherung ja, Vorlage nein).
  Parallelslalom: Kennungen A/B wie in types/betrieb.ts.
- Auf die Leitung (WN1, Datenschutz, noch zu bestätigen): nur der Name **der eigenen Liste** in der verschlüsselten
  Listen-Sicht (`wkr/sicht.ts`, Feld `wkrName`, LISTEN_SICHT_FASSUNG +1), nie in öffentlicher, Freigabe- oder
  Zuschauersicht (Positivliste-Tests). Teil-Geräte am Steg: derselbe Name (Einteilung kennt keine Teile).
- Gerät: Name vorbelegt aus der Sicht; unter „Mehr → Name“ jederzeit änderbar (gerätelokal gemerkt je Raum und Liste,
  G12 bleibt als Rückfall ohne Einteilung); der Abschluss nimmt den aktuellen Namen (G11/L4 entfallen). Ein geänderter
  Name geht als Nachricht an den Host (neue Protokollart oder Teil des Lebenszeichens – WN2: Lebenszeichen, damit er
  nach Abriss wiederkommt).
- Bedienrechner, Betrieb → WKR/Geräte (GeraeteListe/WkrListeBedienung): Name je Gerät und Liste; weicht er von der
  Einteilung ab, Hinweis „Name auf dem Gerät: … – Einteilung: …“ mit „In Veranstaltung übernehmen“ (dispatch der
  vorhandenen Einteilungs-Action, EventView) – sonst nichts; der WKR kann auf dem Gerät erneut überschreiben. Der Name
  vom Gerät liegt gerätelokal im Register (nie AppState), außer im Abschluss (wie heute).
- Leere Einteilung: Gerät fragt wie heute beim Abschluss nach dem Namen (WN3).
- Dateien: wkr/sicht.ts, geraete/erfassen.ts, protokoll.ts, register.ts, host.ts, components/wkr/WkrMehr.vue,
  WkrAbschluss.vue, components/betrieb/GeraeteListe.vue bzw. WkrListeBedienung.vue, i18n wkr.geraet.name.* /
  geraete.* / betrieb.wkr.*, WKR_ANNAHMEN.nameNurBeimAbschluss → false, L4. Tests: Sicht-Positivliste (Name nur in der
  eigenen Listen-Sicht), Gerät (Vorbelegung, Ändern, Abschluss), Host (Hinweis, übernehmen → einteilung geändert),
  Sicherung/Vorlage unverändert (backup.ts).

## 7 Scheibe 6 – Beispieldaten und Sortierung (R6-01, R6-02, S-01) – gebaut 21.11.2026

- S-01: `lib/reihenfolge.ts` `naechsteSortierung`: Klick 1 aufsteigend A→Z (Pfeil ↑), Klick 2 absteigend Z→A (↓),
  Klick 3 aus; andere Spalte beginnt bei A→Z. Aufsteigend = A→Z bzw. kleinster Wert zuerst (XS vor XL, Geburtsdatum die
  Ältesten zuerst), ohne Angabe weiter hinten (wie ordneNach). ClassSection/StartersView: Pfeile und `aria-sort`,
  Titel-Texte (i18n de+en). Tests reihenfolge.test.ts, ClassSection-Test. Kommentar „bestätigt 21.11.2026 (S-01)“.
- R6-01: Clubmeisterschaft = Meisterschaft ohne Vereine, mehrere Klassen auf einem Blatt. Beispielfeld der
  Clubmeisterschaft: Größe bleibt 10–20 (vom Nutzer genannt), **keine Herkunft** in den Beispielstartern (BS1, auch
  wenn die Veranstaltung noch eine Herkunft eingestellt hat? – Auslegung: Herkunft folgt der Veranstaltung wie bisher;
  die Clubmeisterschaft hat im EventView ohnehin keine Herkunft – prüfen, ob `originMode` bei `eventKind: 'club'`
  `none` ist; wenn nicht, folgt das Beispiel `none`). Prüfen, dass die Wertungslisten der Clubmeisterschaft mehrere
  Klassen auf einem Blatt zeigen (vorhandene Funktion; nur Test). Kommentare in domain/generate.ts beispielFeldArt.
- R6-02: „Starter je Klasse“ zurück: Die Gesamtzahl setzt eine **Vorgabe** je Klasse (verteileAufKlassen); jede Klasse
  hat ein eigenes Zahlfeld (0–999), änderbar; die Summe steht daneben. Knopf „neu ziehen“ heißt künftig „Vorschlag
  neu“ / „New suggestion“ (BS2) und setzt Gesamtzahl und Klassen neu; die Gesamtzahl ändern verteilt neu (überschreibt
  Klassenzahlen, BS3). Gemerkt in lib/merken.ts (`beispiel.klassen` mit Art), Wechsel der Art zieht neu (R6-03
  bestätigt). components/BeispieldatenPanel.vue, i18n demo.* (de+en, veranstaltung.ts). Tests BeispieldatenPanel.
- Gebaut: naechsteSortierung (Klick 1 `absteigend: false`), Titel starters.order.* (A→Z/Z→A), Tests reihenfolge +
  StartersView; generate.ts beispielHerkunft (BS1) – originMode wird bei `club` nur beim Wechsel auf „ohne“ gesetzt
  und lässt sich danach wieder ändern, daher die eigene Regel; „mehrere Klassen auf einem Blatt“ = gemeinsame
  WKR-Bögen (Test wkrListen.test.ts mit 15 Startern), Wertungslisten bleiben je Klasse; Panel mit Zahlfeld je
  Klasse, `demo.perClass.sum`, `demo.originNote.club`, merke `beispiel.klassen` {art, gesamt, klassen}; Tests in
  views/EventView.test.ts (dort liegen die Tests des Panels).

## 8 Neue Auslegungen (alle 21.11.2026, noch zu bestätigen)

**Antworten 22.11.2026 (Fragenseite Runde 7, R7-01 … R7-52):** Bestätigt mit „passt“: AM3 (R7-04), AM4 (R7-02, -03,
-11), AM5 (R7-05), AM6 (R7-06, -07), AM7 (R7-08), AM8 (R7-09), AM9 (R7-10), AM10 (R7-12), R6-10 Rückfrage beim
Abschluss (R7-13), BZ2–BZ5 (R7-15 … -17, -20), U1 (R7-18), U2 `disqBojeMitPunkten` (R7-19), U4 (R7-22), GF1–GF11
(R7-25 … -34), WN1–WN3 (R7-35 … -37), Z1–Z7 (R7-38 … -44), Y1 (R7-45, mit Zusatzwunsch: in der Übung andere Klassen
vorziehen können), Y2, Y3 (R7-46, -47), BS1 (R7-48), gemeinsame WKR-Bögen/Wertungslisten je Klasse (R7-49), BS2
(R7-50), P15 Sicht der Bojen (R7-52) – in `WKR_ANNAHMEN`/`BETRIEB_ANNAHMEN` je Eintrag „Bestätigt 22.11.2026 (Frage)“.
R7-23/R7-24 (V1/V2 „Wie der Parcours liegt“, Spiegeln/Tauschen) sind durch V3 überholt (entfernt 22.11.2026, R8-01 …
-07). Anders entschieden, noch nicht umgebaut ([entscheidungen.md](entscheidungen.md) „Antworten 22.11.2026 (Runden 7–8)“): **AM1/AM2** (R7-01, Zeit-Listen
zählen zur Ampel), **BZ1** (R7-14, mehrere Disq. je Boje, Anzeige mit Komma), **U3** (R7-21, langes Drücken bauen),
**BS3** (R7-51, Handeingaben je Klasse bleiben, Reset-Knopf). CI1 war nicht gefragt.

- CI1 Gerät ohne Sicht nach dem Neuladen bekommt sie sofort (nur wenn Ursache).
- AM1 Parcours-Liste an den Feldern erkannt (nicht Steg, nicht Vorsteg, mit Lauf, nicht nur Zeit). AM2 reine
  Zeit-Listen zählen nicht. AM3 Ampel aus, solange keine Parcours-Liste digital ist. AM4 Rot auch durch die erste
  Zeile einer Parcours-Liste zum gezeigten Start. AM5 Rückfrage vor „Nächster Start“ nur für Parcours-Listen und für
  den gezeigten Start erst ab rot; R und „nachfragen“ bleiben. AM6 Auto-Modus: Einstellung `wkrAuto` (aus), nur wenn
  jede Parcours-Liste digital, aktiv, mit Gerät; 3 s Countdown mit „Anhalten“; nie neuer Punkt, Nachzuholen,
  Zurückgestellte, offene Rückfragen, Pause/Störung. AM7 „Anhalten“ gerätelokal im Host. AM8 keine Ampel auf
  Anzeigetafel/Zuschauerliste, `sv` bleibt 6. AM9 kleine Ampel in der Starterkarte der Parcours-WKR. AM10 „Mehr →
  Liste abschließen“ entfällt, das Band erklärt den Zweck.
- BZ1 Zellform `5J` (Ziffern + ein Buchstabe). BZ2 X nie mit Punkten. BZ3 Punkte bleiben neben dem Disq. sichtbar.
  BZ4 Disq. auf Bojen-Listen fragt zuerst die Boje, „keine Boje“ → Disq.-Feld. BZ5 Papier `5` vs. Gerät `5J` =
  abweichend.
- GF1 „Wie Gerät“ als Ansicht, Vorgabe. GF2 Ausgegraute Codes ohne Rückfrage. GF3 Steg-Umschalter immer mit ✓/Zahl.
  GF4 Erklärtext der Übung einklappbar. GF5 „So lassen“ als Feld an der Rückfrage im AppState. GF6 Gruppenabo bei
  neuer Aufgabe + Knopf „Neu verbinden“. GF7 Geräteart aus Bildschirm/Pointer, am Bedienrechner änderbar. GF8 bis vier
  Listen je Gerät, Pad zwei nebeneinander. GF9 Band nur beim ersten Start einer Klasse im Punkt. GF10 J nur wo die
  Liste J kennt, sonst ⊘. GF11 alte ⊘ bleiben.
- WN1 WKR-Name nur in der eigenen Listen-Sicht. WN2 Name im Lebenszeichen. WN3 ohne Einteilung wie bisher.
- BS1 Beispiel der Clubmeisterschaft ohne Herkunft. BS2 „Vorschlag neu“ statt „neu ziehen“. BS3 Gesamtzahl ändern
  verteilt neu.
