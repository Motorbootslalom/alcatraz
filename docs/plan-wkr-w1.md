# Plan W1 „Kern“ der digitalen WKR-Erfassung

Stand 21.11.2026 (W1.1–W1.4 gebaut, Prüfbefunde behoben – §10; Auslegungen §9/§10 vom Nutzer bestätigt 21.11.2026) · Grundlage: [vorschlag-wkr-erfassung.md](vorschlag-wkr-erfassung.md) (§2, §5, §6, §9, §10, §11 W1,
§12 Antworten F1–F17) und der Gerätebetrieb E5–E8 (`src/geraete/`, [betrieb.md](betrieb.md)). Gebaut und geprüft
**ohne echte Geräte und ohne Handy-Masken** (die kommen mit W3/W4): Prüfung über den nachgebauten ntfy
(`geraete/transport/ntfy/testNtfy.ts`) und einen Geräte-Kern ohne Oberfläche. Auslegungen (vom Nutzer am
21.11.2026 bestätigt) stehen datiert in §9 und als Kommentar in `src/wkr/annahmen.ts` (WKR_ANNAHMEN).

## 1. Ziel und Grenzen

W1 liefert den Weg „WKR-Gerät → Bedienrechner → Erfassung“ vollständig, aber ohne Masken und ohne Bedienrechner-
Oberfläche (Matrix, Rückfragen-Liste, ◆, Warnung: W2):

- Aufgabe `liste` (Rechte je Liste, am Steg je Teil AB/AN, F16), höchstens zwei Listen je Gerät (F15).
- Wertprüfung wie in der Erfassungstabelle (dieselben Sanierer), Übernahme mit `vorher`-Prüfung, Rückfrage statt
  Überschreiben, Doppelte wirken einmal, Disq. am Steg vereinigt.
- Schlange je Liste, abgeleitet aus derselben Lage wie die öffentliche Sicht (`betrieb/folge.ts lage`); eigene
  verschlüsselte Gruppe je Liste mit der **Sicht der Liste**; gesammelte Quittungen über diese Gruppe.
- Lebenszeichen, Pausieren/Abmelden/Weiter (F1), Korrektur bis „Liste abschließen“, danach Vorschlag (F7, F8),
  Rückkanal nur Codes, PROTOKOLL_FASSUNG 2.

Nicht in W1: Masken, Doppeltipp-Schutz, Entwürfe-Oberfläche, „Nicht vorbeigekommen“/„Keine Zeit“ (W3), Knoten und
Zeit-Listen am Gerät (W5), Matrix/◆-Anzeige/„Papier ansehen“/Warnung vor „Nächster Start“/„Papier ab …“-Bedienung (W2).

## 2. Was wohin gehört

| Angabe | Ort | Warum |
|---|---|---|
| Werte und Haken „erfasst“, Teilhaken Steg | `AppState.eingaben` (wie heute) | Erfassung bleibt der einzige Weg in die Werte |
| Rückfragen, Vorschläge | `AppState.wkr.rueckfragen/vorschlaege` (Sicherung ja, Vorlage nein) | offene Entscheidungen über Werte; jedes Fenster sieht sie über den Store; Reducer erzeugt sie rein |
| Modus/Status je Liste (digital/Papier/beides; aktiv/pausiert/abgemeldet; Pausen; `seit`) | `AppState.wkr.listen` (Sicherung ja, Vorlage nein) | bestimmt Schlange, P-Zellen und Rückstand; W2 stellt um |
| Abschluss je Liste und Punkt (WKR-Name, Zeit, abweichende Starts, Rest auf Papier) | `AppState.wkr.abschluss` (Sicherung ja, Vorlage nein) | digitale Unterschrift (F8), Personenangabe wie die Einteilung (§9) |
| **Herkunft ◆** je Zelle (Gerätename, Liste, Zeit, Wert) | gerätelokal am Bedienrechner: `alcatraz.geraete.herkunft` (ablage.ts, an `kennung` gebunden) | F10: nicht in der Sicherung; ◆ gilt nur, solange der Wert gleich ist |
| Gerätename je Übernahme | Verlauf (IndexedDB) über die Beschreibung der Action (`quelle.name`) | F10: „Verlauf am Bedienrechner“ |
| Abgelehnte Zeilen (Code), Hinweise (Rückkanal), Akku/wartend | gerätelokal am Bedienrechner: `alcatraz.geraete.wkr` | Gesprächsstand mit Geräten, nicht Veranstaltung |
| Ausgang, letzte Zeilen mit Werten (Korrektur), Zeilenzähler | gerätelokal auf dem Gerät: `alcatraz.geraet.wkr` | nie AppState; gelöscht mit verlasseRaum/36 h |
| Raum, Schlüssel, Gruppen je Liste, Register | wie heute (HostRaum) | unverändert |

Rückfragen und Vorschläge tragen **keinen Gerätenamen**, nur die zufällige Geräte-ID in ihrer Kennung (W2 schlägt den
Namen im Register nach). Nichts aus `geraete/` im Reducer: Typen in `types/wkr.ts`, Logik in `src/wkr/` (rein).

## 3. Neue Dateien und Typen

### 3.1 `src/wkr/` (neu, rein, ohne DOM, ohne geraete/) – mit eigener CLAUDE.md

- `annahmen.ts` – **WKR_ANNAHMEN** (einzige Stelle der Auslegungen, datiert): Übernahmeregel, Teil-Spalten des Stegs
  (`steg: { ab: ['fehlerAB'], an: ['fehlerAN'], gemeinsam: ['disq', 'bemerkung'] }`), X nur `steg`-AB und `vorsteg`
  (F5), Zahlen (Schlange ≤ 12, „danach“ ≤ 5, Bündel ≤ 8 Zeilen, Lebenszeichen nach 60 s Stille, „zuletzt“ ≤ 20 je
  Gerät), Listen ohne Lauf erst W5, Modus-Vorgabe beim ersten Koppeln.
- `liste.ts` – `ListenKennung` = `JSON.stringify(['l', bereich, typeId, racecourse | null])` (wie `refKey`, ohne
  Annahmen über IDs); `listenKennung`, `liesListe`, `listenDerVeranstaltung(stand, konfig)` (je Bereich × Liste der
  Veranstaltung, im Parallelslalom × Racecourse A/B; ohne Knoten), `teilVonFeld(typeId, kennung)`,
  `istHaken(kennung)` (`/^erfasst(\.(ab|an))?@/`), `teilHaken(typeId, teil)` → `erfasst.ab@steg`/`erfasst.an@steg`.
- `zeile.ts` – Zeile vom Gerät und ihre Prüfung:
  ```ts
  /** So schickt das Gerät eine Zeile (kurze Schlüssel, Leitung). */
  interface GeraeteZeile { z: number; s: string /* refKey */; t?: 'ab' | 'an'; k?: true /* Korrektur */; seite?: 'A' | 'B'
    c: [feld: string, wert: string, vorher: string][] }
  /** Was der Reducer bekommt (ref aufgelöst, Vorsteg auf alle Versuche, Haken). */
  interface WkrZeile { id: string /* `${geraetId}.${z}` */; ref: string; lauf: string; starter: string
    zellen: { feld: string; wert: string; vorher: string; vereinige?: true }[]; haken: string[]; gezeigt: boolean; korrektur: boolean }
  type ZeilenFehler = 'start-unbekannt' | 'feld-fremd' | 'wert-ungueltig' | 'x-nicht-erlaubt' | 'teil-fremd' | 'seite-anders'
  function pruefeZeile(stand, konfig, liste, teil | undefined, geraetId, zeile): WkrZeile | { fehler: ZeilenFehler }
  ```
  Prüft: Ref lesbar und Start im Bereich der Liste (Folge oder gezeigt), Klasse hat die Liste
  (`positionAllowsClass`), jedes Feld gehört zur Liste für die Klasse (`listenFelder` + Disq./Bemerkung der Liste),
  am Steg nur Felder des eigenen Teils plus gemeinsame, Wert unverändert nach `feld.gueltig` (Boje `sanitizeBuoy`,
  Code `normalizeCodeCell`, Disq `sanitizeDisq`, Punkte nur Ziffern, Zeit `parseTime` ≠ null, Text getrimmt ≤ 200),
  X nur Steg-AB/Vorsteg. Löst auf: Lauf-Schlüssel (`laufSchluessel`/`attemptSchluessel`), im Parallelslalom den
  Starter der eigenen Seite aus dem festen Plan (passt `seite` nicht: `seite-anders`), am Vorsteg mit „Versuche
  nacheinander“ alle Versuche (wie `ErfassungTabelle.zellenVon`), Haken (`erfasst@typeId` bzw. Teilhaken),
  `vereinige` für `disq@steg` und `bemerkung@steg`, `gezeigt` = Start ist im Betrieb gezeigt (Vorsteg: auch die nächsten).
- `schlange.ts` – `schlange(stand, liste, teil?)`: gezeigte Starts des Bereichs (`betriebVon().gezeigt`, Zeit ≥
  `wkr.listen[liste].seit`, nicht in einer Pause, nicht in `papier`), deren Liste (bzw. Teil) keinen Haken hat,
  älteste oben; Klasse ohne die Liste → `entfaellt: 'klasse'`; Start mit X im Lauf → fällt weg. Vorsteg: dazu die
  nächsten freien (`lage().frei`, amSteg + vorSteg). `danach(stand, liste)`: die nächsten freien als Schätzung für
  „ohne Netz“. `papierStarts(stand, liste)` (P): beim Pausieren Offene + während Pause/Abmeldung gezeigte.
- `uebernahme.ts` – reine Kernregel, vom Reducer benutzt: `wendeZeileAn(eingaben, zeile) → { eingaben, konflikte }`
  (Regel §4), `vereinigeDisq(aktuell, wert, vorher)`, `haengeAn(bemerkung, …)`, `zeilenPruefsumme(werte, felder)`.
- `sicht.ts` – **Sicht der Liste** (`sichtListe(stand, konfig, liste, extra)`; `LISTEN_SICHT_FASSUNG = 1`), Feld für
  Feld gebaut wie `sichtZuschauer` (keine Referenzen durchreichen):
  ```ts
  interface ListenSicht {
    lv: 1; liste: string; titel: string; bereich: string; sprache: Locale        // Listensprache (F13)
    modus: 'digital' | 'papier' | 'beides'; status: 'aktiv' | 'pausiert' | 'abgemeldet'
    punkt: { id: PunktId; titel: string } | null; abgeschlossen: PunktId[]
    schlange: ListenStart[]; danach: ListenStart[]
    klassen: Partial<Record<ClassId, { titel: string; felder: MaskenFeld[] | null }>>   // null = entfällt
    geraete: Record<string, { bis: number; rueckfragen: { z: string; feld: string; lauf: string; steht: string }[]
      abgelehnt: { z: string; grund: string }[]; hinweise: { id: number; code: Hinweis; startNr?: string }[]; abweichend?: string[] }>
  }
  interface ListenStart { key: string; startNr: string; klasse: ClassId; titel: string; lauf: string
    seite?: 'A' | 'B'; boot?: string; teile?: { ab: boolean; an: boolean }; entfaellt?: 'klasse' }
  interface MaskenFeld { kennung: string; kind: CellKind; label: string; teil?: 'ab' | 'an'
    katalog?: { code: string; punkte: number; text: string }[]; disq?: { code: string; text: string }[] }
  ```
  `extra` (vom Host): `bis` je Gerät (= `letzteNr` im Register), Abgelehntes, Hinweise. Rückfragen kommen aus
  `stand.wkr.rueckfragen` (nur dieser Liste, nur Geräte der Liste, mit `steht` = Wert genau dieser Zelle, F11).
  **Nie**: Name (F6), Herkunft, Geburtsdatum, Gewicht, Geschlecht, Werte anderer Listen, Summen, Wertung (§9, F17).

### 3.2 Typen und Stand

- `types/wkr.ts` (über `types.ts` exportiert):
  ```ts
  interface WkrStand {
    listen: Record<string, { modus: 'digital' | 'papier' | 'beides'; status: 'aktiv' | 'pausiert' | 'abgemeldet'
      seit: number; pausen: { von: number; bis: number | null; papier: string[] }[]
      teile?: { ab?: { status; pausen }; an?: { status; pausen } } }>   // nur Steg, je Teil (§10)
    rueckfragen: WkrRueckfrage[]; vorschlaege: WkrVorschlag[]
    // Schlüssel: Punkt bzw. `${punkt}|ab` / `${punkt}|an` (Steg je Teil, §10; wkr/abschluss.ts)
    abschluss: Record<string, Record<string, { name: string; zeit: number; abweichend: string[]; papier: string[] }>>
  }
  interface WkrRueckfrage { id: string; zeile: string; liste: string; ref: string; lauf: string; starter: string
    feld: string; wert: string; steht: string; grund: 'zelle' | 'start' | 'entfernt'
    vereinige?: { vorher: string }; zeit: number }   // vereinige: Grund `start` auf Disq./Bemerkung am Steg (§10)
  interface WkrVorschlag { id: string; liste: string; ref: string; lauf: string; starter: string
    zellen: { feld: string; wert: string }[]; grund: 'abgeschlossen' | 'papier'; zeit: number }
  ```
- `AppState.wkr: WkrStand` – `emptyState` (`reducer/veranstaltung.ts`), `migrate.ts` (`stand`: jede Liste, jede
  Rückfrage/jeder Vorschlag mit Typprüfung und Rückfall, Starter müssen existieren, sonst weg), `backup.ts`
  (`Template` ohne `wkr`), `CLEAR_EINGABEN`/`CLEAR_EINGABEN_TEIL` räumen Rückfragen/Vorschläge/Abschlüsse der
  gelöschten Läufe, `REMOVE_STARTER`/`CLEAR_*` die des Starters.
- Haken: `istHaken` ersetzt die fünf `startsWith('erfasst@')` (lib/listenStand.ts, lib/erfassung.ts,
  BeispieldatenPanel.vue) und wird in `verborgeneZellen`/`listeUmziehen` (lib/eingaben.ts) beachtet; Teilhaken
  zählen nie in die Wertung.

## 4. Actions (Reducer `state/reducer/wkr.ts`, case-Zeilen in `reducer.ts`)

Alle rein; IDs (`zeile.id`, Rückfrage-ID = `zeile.id|lauf|starter|feld`) und `zeit` (Store) kommen mit der Action.
Unverändert → dieselbe Referenz.

| Action | Wirkung |
|---|---|
| `WKR_ZEILEN { liste, quelle: { geraet, name }, zeilen: WkrZeile[] }` | je Zeile: Punkt abgeschlossen oder Modus `papier` → **Vorschlag**; Start nicht gezeigt → alle Zellen **Rückfrage** `start`; sonst je Zelle: `aktuell === wert` → nichts; `aktuell === vorher` → setzen; `vereinige` → Buchstaben von `wert∖vorher` dazu, Wegfall nur über Rückfrage `entfernt`; sonst Rückfrage `zelle` (Stand bleibt). Haken nur ohne Konflikt; beide Teilhaken → auch `erfasst@steg`. Eine neue Zeile desselben Geräts für dieselbe Zelle ersetzt dessen ältere Rückfrage. Zellen ungültiger Starter fallen weg (`gueltigeZellen`). |
| `WKR_RUECKFRAGE { id, wahl: 'geraet' \| 'behalten' }` | Gerätewert setzen bzw. Stand behalten; Rückfrage weg; letzte offene der Zeile → Haken. Mit `vereinige` (gemeinsame Steg-Zelle, Grund `start`): gegen das dann Stehende vereinigt |
| `WKR_VORSCHLAG { id, wahl: 'uebernehmen' \| 'verwerfen' }` | Zellen setzen (ohne Bedingung – der Bediener entscheidet) bzw. verwerfen |
| `WKR_LISTE { liste, modus?, status?, nurWennFehlt?, teil? }` | Modus/Status; `pausiert`/`abgemeldet` öffnet eine Pause mit `papier` = jetzige Schlange (`wkr/schlange.ts`), `aktiv` schließt sie (`bis` = zeit); erstes `digital` setzt `seit`. Mit `teil` (Steg-Teil-Gerät): nur Status/Pause dieses Teils |
| `WKR_ABSCHLUSS { liste, punkt, name, pruefsummen: Record<ref, string>, restPapier, teil? }` | speichert Abschluss (am Steg je Teil); nur für einen begonnenen Punkt; `abweichend` = Starts, deren Prüfsumme nicht zum Stand passt; offene Starts nur mit `restPapier` (dann `papier`, dazu P aus Pausen), sonst unverändert |
| `WKR_ABSCHLUSS_LOESEN { liste, punkt, teil? }` | für W2 (Bediener), schon im Reducer |

Verlauf (`lib/verlauf.ts` ARTEN/beschreibe): `eingabeGeraet` (mit Liste und `quelle.name`), `rueckfrage`,
`vorschlag`, `wkrListe`, `wkrAbschluss`; Texte `history.what.*` in i18n de/ und en/.

## 5. Rechte und Protokoll (geraete/)

- `aufgaben.ts`: `Aufgabe |= { art: 'liste'; liste: string; teil?: 'ab' | 'an' }` (liesAufgaben: höchstens zwei
  Listen, Teil nur bei `steg`). Positivliste `WKR_ACTIONS = ['WKR_ZEILEN', 'WKR_STATUS', 'WKR_ABSCHLUSS']` (Geräte-
  Arten, nicht Reducer-Actions). `erlaubteWkr(action, aufgaben, stand, konfig, geraet)` → fertige Reducer-Action
  (über `wkr/zeile.ts` übersetzt, `quelle` aus dem Register) oder Ablehnung je Zeile. Die Start-Freigabe bleibt wie sie
  ist; `erlaubteAction` verzweigt nach Art.
- `wkrGruppen.ts` (neu): `gruppeDerListe(liste)` = `'l' + 8 Hex` (FNV, passt zu `istGruppe`), `gruppenFuer(aufgaben)`.
- `transport/protokoll.ts`: **PROTOKOLL_FASSUNG = 2** (Kommentar: Ausnahme „Werte auf der Leitung“ F11, 21.11.2026 –
  nur g und die Listen-Gruppe, nie ko/kz). Neu in `GeraeteNachricht`: `{ art: 'lebenszeichen'; wartend: number;
  akku?: number }`, `{ art: 'gesehen'; hinweis: number }`; WKR-Arten laufen als `art: 'action'` mit `type`
  `WKR_ZEILEN` (`liste`, `zeilen: GeraeteZeile[]` ≤ 8), `WKR_STATUS` (`liste`, `status`), `WKR_ABSCHLUSS` (`liste`,
  `punkt`, `name` ≤ 60, `pruefsummen`, `restPapier`). ABLEHNUNGEN += `wert-ungueltig`, `start-unbekannt`,
  `feld-fremd`, `x-nicht-erlaubt`, `teil-fremd`, `seite-anders`, `offen` (Texte `geraete.ablehnung.*` de+en).
  `HINWEISE = ['pruefen', 'papier', 'unterbrochen', 'weiter-digital']` (Rückkanal, nur Codes + Startnummer).
- `transport/ntfy/transport.ts`: `HostTransport.quittiere(e, ergebnis, grund?, { still })` – `letzteNr` wie immer,
  aber keine direkte Quittung; `GeraetTransport.bestaetige(bisNr)` nimmt alles ≤ bisNr aus der Schlange (gesammelte
  Quittung aus der Listen-Sicht). Still nur, wenn das Gerät die Gruppe der Liste hat; sonst direkt wie bisher.
- `register.ts`: `gruppen` je Gerät aus den Aufgaben; `akku`, `wartend` (Lebenszeichen).
- `host.ts`:
  - Aufgaben mit Liste → `legeGruppeAn`, Schlüssel per `schluessel` an das Gerät, `WKR_LISTE {modus: digital,
    nurWennFehlt}` dispatchen; Liste entzogen → `rotiere(gruppe)` (wie Entzug).
  - `verteile` zusätzlich je Listen-Gruppe mit Geräten `sichtListe(…)` (gesammelt, nach Inhalt verglichen); ändert
    sich `letzteNr` eines Geräts, ändert sich die Sicht → das ist die gesammelte Quittung.
  - `nimmAn`: WKR-Action → `erlaubteWkr` → Ablehnungen in `alcatraz.geraete.wkr` → `reicheWeiter` (Schreibfenster) →
    Herkunft (`alcatraz.geraete.herkunft`, nur Zellen mit Stand = Wert) → `quittiere(still)` → `plane`. `lebenszeichen`
    → `beruehre` + akku/wartend; `gesehen` → Hinweis weg.
  - API `hinweis(liste, code, startNr?)` (über den Fensterbus wie die anderen Befehle).
- `ablage.ts`: `alcatraz.geraete.wkr`, `alcatraz.geraete.herkunft` (Host), `alcatraz.geraet.wkr` (Gerät) in ABLAGE;
  `verlasseRaum`/`pruefeRaum` räumen den Geräte-Schlüssel mit, eine andere `kennung` die Host-Schlüssel.
- `erfassen.ts` (neu, Gerät ohne Oberfläche, auf `gekoppelt.ts`): `oeffneErfassung(geraet)` → je eigener Liste
  `sicht` (ShallowRef), `schlange` (Sicht minus Unbestätigtes; ohne Verbindung aus `danach`, gekennzeichnet
  „geschätzt“), `stufen` je Zeile (unterwegs/übernommen/Rückfrage/abgelehnt/Vorschlag), `schicke(liste, zeile)`,
  `korrigiere(z, zellen)` (vorher = zuletzt gesendet; nach Abschluss des Punkts → wird Vorschlag), `pausiere`,
  `meldeAb`, `weiter`, `schliesseAb(liste, punkt, name, restPapier)`, `gesehen(hinweis)`. Ausgang bündelt: Liegt
  nichts Unbestätigtes beim Transport, gehen alle wartenden Zeilen (≤ 8) als eine Nachricht. Lebenszeichen nach
  60 s ohne Nachricht, nur mit Liste und laufendem Punkt.

## 6. Tests (alle ohne Netz, nachgebauter ntfy)

- `src/wkr/zeile.test.ts`: jede Zellart gültig/ungültig wie die Tabelle; X nur Steg-AB/Vorsteg; Teil-Grenzen; fremdes
  Feld; Klasse ohne Liste; Parallel: Seite aus dem Plan, `seite-anders`; Vorsteg auf alle Versuche.
- `src/wkr/schlange.test.ts`: Folge der gezeigten Starts, Haken schließt, Klasse ohne Liste „entfällt“, X fällt weg,
  `seit`, Pause/P-Menge, Steg-Teile getrennt, Vorsteg mit den nächsten, Parallel nur eigene Seite (leer → fehlt).
- `state/reducer/wkr.test.ts`: leer/gleich/vorher → übernommen; anders → Rückfrage, Stand bleibt; Doppel (gleiche
  Zeile zweimal) ändert nichts; Korrektur vor/nach Abschluss; Disq. vereinigt, Wegfall → Rückfrage; Haken nur ohne
  Konflikt, Teilhaken → ganzer Haken; Rückfrage/Vorschlag entscheiden; Pause/Weiter; Abschluss mit/ohne offene;
  Referenz unverändert; Determinismus (zweimal anwenden → gleiches Ergebnis).
- `state/migrate.test.ts` (+ backup): `wkr` kaputt → Rückfall; fremde Starter fallen weg; Vorlage ohne `wkr`.
- `src/wkr/sicht.test.ts`: Schlüssel-Positivliste (wie `sicht.test.ts`), kein Name/Herkunft/Gewicht/Geburtsdatum,
  keine Werte anderer Listen, `steht` nur bei eigener Rückfrage; Listensprache; F17: `sichtOeffentlich` und
  `sichtZuschauer` gleich vor/nach `WKR_ZEILEN` ohne X.
- `geraete/aufgaben.test.ts`: Liste/Teil/Höchstzahl, Positivliste, fremde Liste → `nicht-erlaubt`.
- `geraete/wkr.test.ts` (Ende zu Ende, Host + Gerätekern + testNtfy): koppeln mit Liste → Gruppe und Sicht kommen;
  Zeile → `eingaben` + Haken + Herkunft; belegte Zelle → Rückfrage, Gerät sieht `steht`; Wiederholung (gleiche nr)
  wirkt einmal; Funkloch: drei Zeilen → eine Nachricht; gesammelte Quittung ohne direkte Nachricht; Führungswechsel mit
  offener Zeile; Neuladen von Host und Gerät (Ausgang bleibt); Liste entzogen → neuer Schlüssel, altes Gerät liest
  nicht mehr; Lebenszeichen nur bei Stille (Fake-Uhr); Pause → Schlange leer, P-Menge; Abschluss → spätere Korrektur
  wird Vorschlag; Hinweis → gesehen; „Leitung“-Durchlauf über alle entschlüsselten Inhalte (verbotene Felder);
  Fassung 1 ↔ 2 wird nicht verstanden; Verkehr: je Zeile höchstens eine Gerätenachricht und eine Gruppennachricht.
- Unverändert grün: `src/main.geraete.test.ts` (kein Netz ohne Raum), E7-Tests (Start-Freigabe direkt quittiert).

## 7. Reihenfolge (Scheiben)

1. **Stand und Übernahme** (rein, ohne geraete/): `src/wkr/{annahmen,liste,zeile,schlange,uebernahme}.ts`,
   `types/wkr.ts`, `AppState.wkr`, Reducer, migrate, backup, Verlauf, `istHaken`.
2. **Sicht der Liste und Rechte**: `src/wkr/sicht.ts`, `geraete/aufgaben.ts` (Liste, `erlaubteWkr`),
   `geraete/wkrGruppen.ts`.
3. **Host und Leitung**: Protokoll 2, stille Quittung, Gruppen je Liste, Verteilen der Listen-Sicht, Annahme,
   Herkunft/Eingang in der Ablage, Hinweise, Lebenszeichen am Host; Tests mit einem nackten `GeraetTransport`.
4. **Gerätekern und Ende-zu-Ende**: `geraete/erfassen.ts`, Ablage des Geräts, Bündeln, Lebenszeichen, Korrektur,
   Abschluss; E2E-Tests; Doku (geraete/CLAUDE.md, src/wkr/CLAUDE.md, Wurzel-Karte, betrieb.md kurz,
   entscheidungen.md „gebaut“).

Nach jeder Scheibe: `npx vue-tsc -b`, gezielte Tests, zum Schluss `npm run test:leise`.

## 8. Verkehr (§10)

Je Zeile: eine Gerätenachricht (gebündelt nach Funkloch) und eine Gruppennachricht (Sicht der Liste, gesammelt
150 ms, mehrere Geräte/Zeilen zusammen) statt bisher Nachricht + direkter Quittung. Lebenszeichen nur bei Stille.
Listen ohne Änderung senden nichts (Vergleich nach Inhalt). Die Kontingent-Zählung (E8) bleibt; getrennte Anzeige der
Erfassung erst W2.

## 9. Auslegungen (21.11.2026, vom Nutzer bestätigt 21.11.2026: „passt“, Fragen W1-01…W1-15)

1. **Übernahmeregel**: übernommen wird, wenn der Stand gleich `vorher` (das, was das Gerät dort erwartet; beim ersten
   Mal leer) oder gleich dem neuen Wert ist. Hat der Bediener eine vom Gerät gesetzte Zelle geleert, ist das eine
   Rückfrage, keine leere Zelle.
2. **Herkunft (F10)** liegt gerätelokal am Bedienrechner (`alcatraz.geraete.herkunft`, bleibt nach „Raum beenden“,
   weg mit anderer Veranstaltung); der Gerätename steht im Verlauf. Rückfragen, Vorschläge, Status und Abschluss der
   Listen stehen im Stand und damit in der Sicherung, ohne Gerätenamen.
3. **Zeilen zu nicht gezeigten Starts** (auch die geschätzten ohne Netz) werden ganz zur Rückfrage, nie still übernommen.
4. **Steg**: Teilhaken `erfasst.ab@steg`/`erfasst.an@steg`, beide zusammen setzen `erfasst@steg`. Die Anlegen-Schlange
   sind alle gezeigten Starts ohne Anlegen-Haken (auch wenn das Ablegen auf Papier ist). Teile = Spalten
   `fehlerAB`/`fehlerAN` fest in WKR_ANNAHMEN. Die Bemerkung des zweiten Teils wird angehängt („; “), nie ersetzt.
5. **Pausieren/Abmelden gilt für die Liste**, nicht für ein Gerät. P = Starts, die beim Pausieren offen waren, und
   alle, die während der Pause gezeigt wurden. Ausnahme (§10): Ein Teil-Gerät am Steg pausiert nur seinen Teil
   (WKR_ANNAHMEN.pauseJeTeil).
6. **Modus**: Eine Liste ohne Eintrag ist Papier; das erste Koppeln setzt „digital“ ab jetzt (`seit`). Die Schlange
   beginnt erst dort – ältere Starts tippt man vom Bogen ab.
7. **Abschluss** gilt je Liste und Punkt (Lauf bzw. Runde), am Steg je Teil (§10), nur für begonnene Punkte. Weicht die geprüfte Fassung des
   Geräts vom Stand ab, wird das je Start vermerkt (W2 zeigt es), ohne Sperre. Offene Starts nur mit „Rest auf Papier“.
8. **Quittungen** kommen gesammelt über die Gruppe der Liste; eine direkte Quittung nur, wenn das Gerät die Gruppe
   (noch) nicht hat.
9. **Knoten und Zeit-Listen** am Gerät erst mit W5; W1 nimmt nur Listen mit Lauf an.
10. Das gekoppelte Gerät liest weiter die öffentliche Sicht `ko` (Meldungen, Lauf); Namen zeigt die WKR-Maske nicht (F6).
11. **Zahlen**: Bündel ≤ 8 Zeilen, Schlange ≤ 12, „danach“ ≤ 5, „zuletzt“ ≤ 20 Zeilen je Gerät, Lebenszeichen nach
    60 s Stille.

## 10. Prüfbefunde zu W1 (21.11.2026)

Behoben (Tests in `state/reducer/wkr.test.ts` „Steg je Teil“, `wkr/schlange.test.ts`, `geraete/wkr.test.ts` „Steg auf
zwei Geräten: AB schließt ab …“, `geraete/aufgaben.test.ts`, `state/migrate.test.ts`):

1. **Abschluss je Teil am Steg (F16):** eigener Eintrag `punkt|ab`/`punkt|an` (`wkr/abschluss.ts`). Schließt das
   Ablegen ab, gehen Zeilen des Anlegens weiter direkt durch; die Unterschrift des einen Teils überschreibt nie die des
   anderen; die ganze Liste gilt mit beiden Teilen als abgeschlossen. Eine ganze Zeile (Gerät ohne Teil) wird schon
   Vorschlag, wenn EIN Teil abgeschlossen ist. Sicht der Liste: `teile.{ab,an}.abgeschlossen` (LISTEN_SICHT_FASSUNG 2),
   das Gerät wertet nur seinen Teil (`erfassen.ts zuFuer`).
2. **„offen“ am Host** gemessen am eigenen Eintrag vorher/nachher bzw. `unveraendert`, nicht an „gibt es einen Eintrag“.
3. **Schlange nach „Rest auf Papier“:** Starts aus `abschluss.papier` und abgeschlossene Punkte fehlen.
4. **Pause/Abmelden je Teil:** WKR_STATUS eines Teil-Geräts wirkt nur auf seinen Teil (`WkrListe.teile`); das andere
   Handy erfasst weiter (F1 mit F16). WKR_ANNAHMEN.pauseJeTeil, bestätigt 21.11.2026.
5. **Rückfrage `start` auf gemeinsamen Steg-Zellen:** `vereinige: {vorher}`; „Gerätewert“ vereinigt mit dem, was dann
   steht (`wkr/uebernahme.ts vereinigt`) – der Buchstabe des anderen Teils bleibt.
6. **Abschluss nur für begonnene Punkte** (`punktBegonnen`, in `erlaubteWkr` → `nicht-erlaubt` und im Reducer);
   P aus Pausen steht mit im `papier` des Abschlusses (auch bei pausierter Liste).
7. **`steht` in der Sicht:** Die Doku sagte „nur für das auslösende Gerät“; tatsächlich lesen alle Geräte derselben
   Liste die Gruppe. Doku korrigiert (sicht.ts, protokoll.ts, CLAUDE.md), Auslegung WKR_ANNAHMEN.rueckfrageInListe
   (bestätigt 21.11.2026) – eine Nachricht je Gerät kostete Kontingent.
