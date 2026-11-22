# Plan W3 „Handy, Katalog“ der digitalen WKR-Erfassung

Stand 21.11.2026 (Plan; W3.1–W3.4 gebaut 21.11.2026 – W3 vollständig, Feldtest offen; Auslegungen vom Nutzer am 21.11.2026 abends beantwortet, §15) · Grundlage: [vorschlag-wkr-erfassung.md](vorschlag-wkr-erfassung.md) §1
(Bedingungen am Wasser), §2 (Schlange), §3 (Rahmen), §4.1 (Familien, wer wählt), §4.3 (Tor 5, MüB), §4.4 (Steg a,
zweiteilig), §4.5 (Vorsteg), §5 (Abschicken, Korrektur, Abschluss), §7 (Sonderfälle), §11 W3, §12 (F1, F5, F6, F7,
F8, F13, F14, F15, F16) und der gebaute Kern: W1 ([plan-wkr-w1.md](plan-wkr-w1.md), `src/wkr/`,
`geraete/erfassen.ts`), W2 ([plan-wkr-w2.md](plan-wkr-w2.md), Bedienrechner). Antworten des Nutzers:
[entscheidungen.md](entscheidungen.md) „Digitale WKR-Erfassung“. Keine Rückfragen beim Bau: Auslegungen datiert in
`WKR_ANNAHMEN` (G1–G16, §9); beantwortet 21.11.2026 abends (§15).

## 1. Ziel und Grenzen

W1 hat den Weg Gerät → Bedienrechner gebaut, W2 die Seite des Bedienrechners. **Auf dem Handy gibt es aber noch
nichts zu tippen**: `geraete/erfassen.ts` ist ein Kern ohne Oberfläche, und der Bedienrechner kann einem Gerät noch
gar keine Liste geben (GeraeteKoppeln/GeraeteListe kennen nur Bereiche der Start-Freigabe; `art: 'liste'` entsteht
bisher nur in Tests). W3 liefert die erste echte Maske:

1. **Liste zuweisen** am Bedienrechner (Koppeln und Geräteliste: Liste × Parcours bzw. Racecourse, am Steg ganz / nur
   Ablegen / nur Anlegen) und die **Maskenvorgabe** (F14) als Feld der Aufgabe – soweit W3 sie braucht (§6).
2. **Rahmen** jeder Maske auf dem Handy (hochkant): Kopf (Liste · Bereich · Lauf, Verbindung, wartende Zeilen),
   Starterkarte (Startnummer riesig, Klasse, Lauf bzw. Attempt/Re-run, Boot – nie ein Name, F6), Ausweichen (zwei
   Nächste) und Suche nach Startnummer, Leiste „Zuletzt“ mit Korrektur, Hauptknopf „Fehlerfrei ✓“ → „Abschicken · n“,
   Disq getrennt, „− letzte zurück“, „Mehr“ (Bemerkung, Pausieren/Abmelden/Weiter, Liste abschließen, Ansicht, Probe,
   Sprache), Doppeltipp-Schutz, Zustände ohne Arbeit, Hinweise des Bedienrechners.
3. **Maske „Knöpfe“** für die Listen, deren Felder nur Katalog, Disq. und Bemerkung sind: **Steg** zweiteilig
   (Ablegen/Anlegen, = E9), **Tor 5** (auch „Tor 5 + Parcours“ ohne Bojen), **Mann-über-Bord**, **Vorsteg**.
4. **„Liste abschließen“** mit Prüfansicht aller eigenen Zeilen des Laufs und WKR-Name (F7, F8).
5. **Sonnenmodus** (Vorgabe), **Probe beim Einrichten**, **Übungsmodus** mit Beispieldaten ohne Netz.

**Nicht in W3** (mit Grund): Bojen-Masken und Listen mit Bojen/Zeit/Knoten (W4/W5 – sie zeigen in W3 einen klaren
Zustand „Maske folgt, bitte Papier“, §5.7); „Nicht vorbeigekommen“ (braucht Kennzeichen in Protokoll, Reducer und
Matrix – mit W4, G15); Pad quer, zwei Listen nebeneinander, Racecourse A|B in einer Steg-Maske (W5; ein Pad mit zwei
Listen bekommt in W3 nur Reiter je Liste); Bild- und Text-Maske und damit eine echte Maskenwahl (W5/W6); „WKR
wechseln“ (Name gilt je Abschluss, G11); Codes, die die Klasse nicht betreffen, grau (die Kataloge tragen „ab Klasse 4“
nur als Text, G6); getrennte Kontingentanzeige (W2 A12, Feldtest).

## 2. Was wohin gehört

| Angabe | Ort | Warum |
|---|---|---|
| Aufbau der Maske aus der Sicht (Teile, Codes, Disq, Bemerkung), Entwurf → Zellwerte, Punkte, Takt des Weiterspringens | **neu, rein** `src/wkr/maske.ts` | testbar ohne DOM; dieselbe Schreibweise wie die Erfassung (lib/codes.ts `normalizeCodeCell`) |
| Übungs-Sicht | **neu, rein** `src/wkr/uebung.ts` | Beispieldaten ohne AppState, ohne Store, ohne Netz; Masken-Teil mit `sicht.ts` geteilt |
| Zweite Sprache der Maske (F13) | `wkr/sicht.ts` ListenSicht `andere` (LISTEN_SICHT_FASSUNG 3) | Kataloge/Spaltenköpfe kommen vom Host; das Gerät kennt eigene Aufbauten nicht |
| Entwürfe, Startnummer je eigener Zeile, Schlange je Steg-Teil, Prüfansicht, Zurückholen | `geraete/erfassen.ts` (Ausgang `alcatraz.geraet.wkr`) | „Entwürfe gehen nie verloren“; gerätelokal, 36 h wie der Ausgang |
| Sonnen-/Hell-/Dunkelmodus, Hand (rechts/links), gewählte Sprache, letzter WKR-Name | **neu** ABLAGE `alcatraz.geraet.ansicht` | Vorliebe des Geräts, nie AppState |
| Probe erledigt (je Raum und Liste) | **neu** ABLAGE `alcatraz.geraet.probe` | verlasseRaum räumt ihn mit (neuer Raum = neue Probe) |
| Maskenvorgabe (F14) | `geraete/aufgaben.ts` ListenAufgabe `maske?` | gehört zur Aufgabe, die der Host ohnehin schickt (`aufgaben`, willkommen) |
| Oberfläche Gerät | **neu** `components/wkr/` + `styles/wkr-geraet.css`; Einbau in `GeraetFreigabe.vue` | GeraetFreigabe hält das GekoppelteGeraet schon (eine Wurzel, kein zweites Gerät) |
| Übungsmodus-Adresse | `lib/adressen.ts` VOLLBILDER `uebung` → main.ts → GeraetApp | ohne Kopplung erreichbar; ohne Store, ohne Netz (main.geraete.test.ts) |

## 3. Reine Logik

### 3.1 `src/wkr/maske.ts` (neu)

```ts
type MaskenArt = 'katalog' | 'vorsteg' | 'spaeter'           // spaeter = Bojen/Zeit/Knoten (W4/W5)
interface MaskenCode { code: string; text: string; punkte: number }
interface MaskenTeil { teil: 'ab' | 'an' | null; feld: string; titel: string; codes: MaskenCode[] }
interface MaskenAufbau {
  art: MaskenArt
  teile: MaskenTeil[]                     // Steg: [ab, an]; Tor 5 / MüB: [ein Teil]; Vorsteg: []
  disq: { feld: string; codes: { code: string; text: string }[] } | null   // X nur, wenn die Sicht es anbietet (F5)
  bemerkung: string | null                // Feld-Kennung
}
function maskeFuer(sicht: ListenSicht, klasse: ClassId, sprache?: 'liste' | 'andere'): MaskenAufbau | null  // null = entfällt
interface Entwurf { codes: Record<string /*feld*/, string[] /*Tipps in Reihenfolge*/>; disq: string[]; bemerkung: string }
function tippe(e, feld, code): Entwurf;  function zurueck(e): Entwurf   // „− letzte zurück“ = letzter Tipp/Disq
function zellenAus(e, aufbau, teil?): Record<string, string>          // „2x6, 20“; Disq-Feld „A, X“; nur eigener Teil + gemeinsam
function punkteVon(e, aufbau, teil?): number; function eintraege(e, teil?): number  // für „Abschicken · n“
function entwurfAus(zellen, aufbau): Entwurf                          // Korrektur: Zeile aus „Zuletzt“ wieder öffnen
type Takt = 'gesendet' | 'sperre' | 'frei'
function wechselTakt(gesendetUm: number | null, jetzt: number): Takt  // 0–2 s gesendet, 2–3 s sperre (WKR_ANNAHMEN)
```

- `art` aus den MaskenFeldern der Klasse: nur `code`/`disq`/`text` → `katalog` (mit Codes) bzw. `vorsteg` (nur
  Disq + Bemerkung); irgendein `buoy`/`time`/`points` → `spaeter`. Die Liste sagt es selbst – auch eigene Aufbauten.
- Zellwerte über `normalizeCodeCell` mit den Katalogcodes des Felds: Die Maske erzeugt **genau** den Wert, den
  `pruefeZeile → wertGilt` annimmt (Test: jede Kombination aus Tipps übersteht `wertGilt` unverändert).
- Disq am Steg in das gemeinsame Feld `disq@steg` (vereinigt am Host, W1); die Code-Spalten bekommen keine Buchstaben.
- **Fehlerfrei** = Zeile mit leeren Feldern des Teils (wie W1, `schicke` filtert leere ohne `vorher`): eigene
  Meldung, setzt den Haken. Nie „leeres Feld = fehlerfrei“.
- Takt: Nach dem Abschicken bleibt die Nummer `weiterNachMs` (2000) mit „● gesendet“ stehen; danach wechselt sie,
  und `sperreMs` (1000) lang nimmt die Maske **keine** Eingabe an (Hauptknopf, Codes, Disq). Uhr wird hineingereicht.

### 3.2 `src/wkr/sicht.ts` – zweite Sprache (F13) und geteilter Masken-Teil

- Den Block „Masken je Klasse“ als `maskenJeKlasse(konfig, sprachKonfig, typeId, klassen, xErlaubt)` herauslösen
  (Nutzer: `sichtListe`, `uebung.ts`).
- `ListenSicht.andere?: { sprache: 'de' | 'en'; titel: string; klassen: Record<ClassId, { titel; felder: { kennung;
  label; katalog?: {code; text}[]; disq?: {code; text}[] }[] | null }> }` – nur, wenn das Regelwerk die andere Sprache
  hat (`sprachen: [de, en]`, also UIM; DM hat kein Englisch). Punkte und Codes nur einmal (in `klassen`).
  **LISTEN_SICHT_FASSUNG = 3**; Positivliste in `sicht.test.ts` ergänzen (nur Texte, keine Werte, keine Namen).
- Bei `de+en` (zweisprachige Liste) zeigt das Gerät trotzdem nur eine Sprache, Vorgabe Deutsch (G9) – zwei Zeilen
  je Knopf kosten Platz im Daumenbereich.

### 3.3 `src/wkr/uebung.ts` (neu)

`uebungsSicht(regelwerk, typeId, sprache, jetzt)` → ListenSicht mit `lv`, Kataloge über `configFor` und
`maskenJeKlasse`, Schlange aus erfundenen Starts (Startnummern 1–20 in den Klassen des Regelwerks, Lauf 1, ein Boot
„Übung“ – keine Namen, nichts aus `src/data/`) und `uebungsSchritt(sicht, zeile)` → nächste Sicht (Start erledigt,
nächster rückt nach, alle 30 s ein neuer „gezeigter“ Start; seit 21.11.2026 kommt der nächste 2–6 s nach dem Abschicken, hin und wieder vorher, 30 s nur als Rückfall – WKR_ANNAHMEN Y1–Y3). Rein; der Gerät-seitige Übungs-Kern (§4.2) hält sie.

## 4. Gerätekern

### 4.1 `geraete/erfassen.ts` – Ergänzungen

| Neu | Wirkung |
|---|---|
| **Schlange je Teil** (`schlange` → `Record<liste, Record<'ganz'\|'ab'\|'an', SchlangenEintrag[]>>` oder eigenes `schlangeTeil(liste, teil)`) | Ein Gerät für den ganzen Steg: Abschicken des Ablegens nimmt den Start nur aus der Ablegen-Schlange; heute fällt er wegen `eigen` (nach `s`, ohne Teil) aus beiden. Anlegen = älteste ohne eigenes Anlegen und ohne `teile.an` |
| `AusZeile.sn` (Startnummer) | „Zuletzt“ und Prüfansicht zeigen die Nummer, auch wenn der Start nicht mehr in Schlange/danach steht |
| **Entwürfe** `entwurf(liste, s, teil?)`, `merkeEntwurf(…, zellen)`, `verwirfEntwurf` | im Ausgang abgelegt (36 h), weg nach `schicke`; Leiste „Entw. n“; erscheint wieder, wenn der Start oben steht; nach Entzug nur lesend (§7 „Gerät entzogen“) |
| `holeZurueck(z)` | nur solange die Zeile wartet (`nr === null`): aus dem Ausgang, Werte zurück, Entwurf wieder da. Schon unterwegs → die Oberfläche bietet „Korrigieren“ (G8) |
| `pruefung(liste, punkt, teil?)` | Prüfansicht: eigene Zeilen des Punkts (sn, Klasse, Zellen, Stufe), offene Starts der Schlange dieses Punkts (ohne `vorab`/`entfaellt`), X-Starts; nur aus Ausgang + Sicht, keine Werte anderer |
| `stop`, Raumwechsel | Entwürfe gehen mit `verlasseRaum` (gleiche Ablage) |

Unverändert: Bündeln, Lebenszeichen, Stufen, Korrektur (`korrigiere`, nach Abschluss Vorschlag), `schliesseAb`
(Prüfsumme nur Felder des eigenen Teils, Falle in `src/wkr/CLAUDE.md`).

### 4.2 Übungs-Kern `geraete/uebung.ts` (neu)

`oeffneUebung({regelwerk, typeId, teil?, sprache, uhr})` → dieselbe Schnittstelle wie `Erfassung` (Typ
`ErfassungsQuelle` = die Teile, die die Maske liest: listen, sichten, schlange, stufen, zuletzt, hinweise,
abschluesse, wartend, schicke, korrigiere, Entwürfe, pausiere …). Quittung nach 300 ms im Arbeitsspeicher, eine
Rückfrage beim 5. Start als Beispiel (G13). **Kein Transport, keine Ablage, kein Store** – Test wie
`main.geraete.test.ts`: `#/uebung` öffnet kein WebSocket und kein fetch.

### 4.3 Aufgabe und Ablage

- `aufgaben.ts`: `ListenAufgabe.maske?: 'knoepfe' | 'bild' | 'text'` und `fest?: true` (F14); `liesAufgaben` nimmt nur
  bekannte Werte. W3 kennt nur `knoepfe` – die Wahl am Bedienrechner zeigt sie als Text (G4).
- `ablage.ts`: `alcatraz.geraet.ansicht` `{ modus: 'sonne'|'hell'|'dunkel', hand: 'rechts'|'links', sprache?, name? }`
  (bleibt nach „Raum verlassen“ außer `name`, G12) und `alcatraz.geraet.probe` (Raum-Bezug + Listen, verlasseRaum
  räumt). Beide in ABLAGE, nie AppState (ablage.test.ts „nie in Sicherung/Vorlage“).

## 5. Oberfläche auf dem Handy (`components/wkr/`, `styles/wkr-geraet.css`)

Einbau: `GeraetFreigabe.vue` gekoppelt → hat das Gerät Listen-Aufgaben, `oeffneErfassung(geraet)` einmal je Gerät
(stop beim Unmount/Entzug) und **`WkrGeraet.vue`** zeigen. Mit Start-Freigabe UND Liste (Steg b + Steg a, §4.4)
unten zwei Reiter „Freigabe“ / Listenname; ohne Bereiche und ohne Listen wie heute „keine Bereiche“.

### 5.1 Aufteilung

```
WkrGeraet.vue        Wurzel je Gerät: Quelle (Erfassung | Übung), Reiter je Liste (Pad mit zwei Listen), Ansicht, Probe
 WkrKopf.vue         Liste · Bereich · Lauf/Attempt (invers bei Attempt 2/Re-run), Verbindung ●/○, ⧗ n, Hinweis-Band
 WkrStarterKarte.vue Startnummer riesig, Klasse, Boot, „geschätzt (ohne Verbindung)“, „noch nicht gezeigt“ (Vorsteg vorab)
 WkrAusweichen.vue   [41] [17] [Nr.] – zwei Nächste + Suche (Ziffernfeld, eigene große Tasten)
 WkrKnoepfe.vue      Katalog: je Code ein breiter Knopf (Code, Kurztext, Punkte, Zähler ×n)
 WkrStegReiter.vue   [ABLEGEN 23] [ANLEGEN 17 · 2] – wechselt nie von selbst; Teil-Gerät nur sein Reiter
 WkrVorsteg.vue      Riesenknopf „In Ordnung ✓“ (= Fehlerfrei), X und Disq
 WkrDisq.vue         Buchstaben dieser Position mit Kurztext, zweiter Tipp setzt; X mit großer Rückfrage (F5)
 WkrFuss.vue         „− letzte zurück“, [DISQ] links, Hauptknopf rechts (gespiegelt bei Linkshand)
 WkrZuletzt.vue      Leiste 12 ✓ 8 ✓ 30 ↑ ! Entw. 1 → Liste der letzten Zeilen, öffnen → Korrektur mit Rückfrage
 WkrMehr.vue         Bemerkung, Pausieren/Abmelden/Weiter, Liste abschließen, Ansicht, Sprache, Probe, Übung verlassen
 WkrAbschluss.vue    Prüfansicht + Name + „Liste abschließen“
 WkrProbe.vue        drei Schritte auf der echten Maske mit Start „Probe“, nichts wird gesendet
 WkrRuhe.vue         Zustände ohne Arbeit (§5.6)
```

### 5.2 Bedienregeln (gelten für jede Teil-Komponente, Test je Regel)

- Ziele ≥ 64 px hoch (Codes, Hauptknopf, Disq), nie unter 48 px (Reiter, Ausweichen, Zuletzt); Abstand ≥ 8 px;
  Disq ≥ 24 px vom Hauptknopf. Bedienung im unteren Drittel, oben nur Anzeige. Kein Wischen, kein langes Drücken als
  einziger Weg, kein [−][+] nebeneinander. `touch-action: manipulation` (kein Doppeltipp-Zoom).
- Bedeutung nie nur über Farbe: jede Stufe mit Zeichen und Wort (✓ übernommen, ↑ unterwegs, ! Rückfrage, ✗ abgelehnt,
  V Vorschlag).
- Hauptknopf: leer „Fehlerfrei ✓“, mit Einträgen „Abschicken · n Pkt.“ (Steg: „Ablegen OK ✓“ / „Abschicken Ablegen ·
  n“; Vorsteg: „In Ordnung ✓“). Nie zwei ähnliche Hauptknöpfe.
- Nach dem Abschicken `wechselTakt`: 2 s Nummer + „● gesendet“, dann Wechsel mit Vollflächen-Blitz und
  `navigator.vibrate(60)` (wo vorhanden; sonst nur Blitz), 1 s keine Eingabe (`inert` auf der Mitte und dem Fuß).
- Nie gesperrt bis zur Quittung; ohne Quittung nach 10 s im Kopf „Keine Bestätigung – Verbindung prüfen“.
- Keine Animationen außer dem Blitz (Akku); Wake Lock wie E8 (`lib/wachBleiben.ts`), solange die Maske offen ist.

### 5.3 Masken

- **Tor 5, MüB** (§4.3): Titel des Katalogs („Einfahrt Tor 5“), Codes in Katalogfolge; ein Tipp = +1 (Zähler rechts,
  Zelle „2x20“); Disq ins Disq-Feld der Liste. „Tor 5 + Parcours“ ohne Bojen ist dieselbe Maske (Parcoursfehler über
  Disq, §4.3); `tor5puems` (mit Start/Ziel-Bojen) ist `spaeter`.
- **Steg** (§4.4): zwei Reiter mit Zähler wartender Boote; Ablegen = Kopf der Ablegen-Schlange, Anlegen = ältestes
  ohne Anlegen. Jeder Teil schickt für sich (`MaskenZeile.teil`), Disq/Bemerkung gemeinsam (am Host vereinigt). X nur
  im Ablegen (Sicht bietet es nur dort an). Teil-gekoppelt: nur der eigene Reiter.
- **Vorsteg** (§4.5): Riesenknopf „In Ordnung ✓“, darunter X und Disq; Schlange mit `vorab` (noch nicht gezeigt).
  Gilt für alle Versuche (W1 `vorstegAlleVersuche`).
- **Klasse ohne Liste** (`felder: null`, `entfaellt`): grau „MüB entfällt (Klasse 2)“, keine Knöpfe; schließt sich
  von selbst (W1).
- **Liste mit Bojen/Zeit/Knoten** (`spaeter`): „Für diese Liste gibt es die Maske noch nicht – bitte auf dem
  Papierbogen erfassen“, dazu „Pausieren“-Angebot (G14).

### 5.4 Ausweichen, Suche, Entwürfe

- Oben steht der Kopf der Schlange (Teil). Daneben die nächsten zwei als Knöpfe; „Nr.“ öffnet ein eigenes Ziffernfeld.
  Gesucht wird in Schlange und „danach“ (gezeigte zuerst), dann in „Zuletzt“ (→ Korrektur). Nicht gefunden: „Nr. 23
  ist nicht in der Folge – trotzdem erfassen?“ wird **nicht** angeboten (der Host machte Rückfrage `start`; G7).
- Gewählter Start ≠ Kopf: Karte mit Rand „außer der Reihe“; nach dem Abschicken zurück zum Kopf.
- Wechsel ohne Abschicken: Entwurf bleibt (`merkeEntwurf`), Leiste „Entw. n“, beim nächsten Erscheinen wieder geladen.
  Start nach dem Zeigen zurückgestellt (verschwindet aus der Sicht): Entwurf „behalten / verwerfen“ einmal fragen.

### 5.5 Zuletzt und Korrektur (F7)

- Leiste mit den letzten 5 eigenen Zeilen (Nummer + Stufenzeichen), Tipp öffnet die Liste (≤ WKR_ANNAHMEN.zuletzt).
- Zeile öffnen → dieselbe Maske mit `entwurfAus(zellen)`, Kopf „Korrektur Start 23“; „Korrektur abschicken“ mit
  großer Rückfrage („Start 23, Tor 5: 1 → 1, 20?“, alte und neue Codes als Text). Nach dem Abschluss des Laufs heißt der
  Knopf „Als Vorschlag senden“ (Kern macht Vorschlag, F7).
- Rückfrage (`stufe: rueckfrage`): Band im Kopf „Bedienrechner: Start 23 steht dort anders (15)“ – `steht` nur dieser
  Zelle (F11); Korrigieren oder „so lassen“ (= gesehen, entscheidet der Bediener).
- Abgelehnt: Satz `geraete.ablehnung.<grund>`, Zeile bleibt zum Korrigieren.
- „Rückgängig“ 6 s nach dem Abschicken (kleiner Knopf im Band „● gesendet“): wartet die Zeile noch, `holeZurueck`;
  sonst öffnet er die Korrektur (G8).

### 5.6 Zustände ohne Arbeit

| Zustand | Anzeige |
|---|---|
| Kein Punkt läuft / Schlange leer | „Kein Boot unterwegs. Nächster Start: 21 (Kl. 5)“ aus `danach[0]`; Meldung der Start-Freigabe aus der öffentlichen Sicht (`ko`, Text wie auf der Tafel) |
| Warten auf die erste Sicht | „Verbinde mit dem Bedienrechner …“ |
| Getrennt | Kopf rot und dauerhaft: „Keine Verbindung seit 2 min – weiter erfassen, n Zeilen warten“; Schlange aus „danach“ mit „geschätzt“; ab `papierHinweisSek` (300) „Länger weg? Papierbogen ab Nr. x“ (x = erster nicht abgeschickter Start) |
| Pausiert / abgemeldet (eigener Teil) | großes Band „Pausiert – Papierbogen gilt“, Knopf „Weiter digital“; Codes ausgegraut |
| Liste auf Papier (Modus vom Bedienrechner) | „Der Bedienrechner hat diese Liste auf Papier gestellt“ – nichts zu tippen |
| Hinweis des Bedienrechners | groß im Kopf (pruefen „Bitte Nr. 23 prüfen/nachtragen“, papier, unterbrochen, weiter-digital), „Gesehen“ → `gesehen(id)` |
| Punkt abgeschlossen | „1. Lauf abgeschlossen ✓“, Korrekturen nur als Vorschlag |
| Entzogen | Kopf „Entzogen“; Entwürfe nur lesend mit „auf Papier übertragen“ (Liste mit Nummern und Codes) |
| Fremde Fassung der Sicht (`lv`) | wie heute „Bedienrechner aktualisieren“ / „Neu laden“ |

### 5.7 „Liste abschließen“ (F7, F8)

Unter „Mehr“, und als Band, sobald der laufende Punkt ruht oder der nächste begann und dieser Punkt nicht
abgeschlossen ist. Ansicht: oben „30 abgeschickt, 1 offen: 27, 1 X: 9“, darunter alle eigenen Zeilen des Punkts
(`pruefung`: Nummer, Klasse, Codes als Text, Punkte, Stufe), Tipp → Korrektur direkt aus der Übersicht. Unten
Feld „Name des Wettkampfrichters“ (vorbelegt aus der Ansicht-Ablage, G12), bei offenen Starts Schalter „Rest auf
Papier“ (Pflicht, sonst gesperrt mit Satz), Knopf „Liste abschließen“ → `schliesseAb`. Ergebnis aus `abschluesse`:
unterwegs / angenommen ✓ / abgelehnt `offen` („Es sind noch Starts offen …“). Steg-Teil schließt nur seinen Teil.

### 5.8 Ansicht, Sprache, Sonne

- **Sonnenmodus = Vorgabe** (G1): schwarz auf weiß, Ränder 3 px, Schrift ≥ 20 px, Startnummer ≥ 96 px, keine
  Grautöne unter 4,5 : 1 außer für „entfällt“ (dort mit Wort). Hell (App-Farben) und Dunkel wählbar unter „Mehr →
  Ansicht“; Linkshand spiegelt den Fuß. Farben als Tokens `--wkr-*` in `styles/wkr-geraet.css`, unabhängig von
  `prefers-color-scheme` (die Wahl auf dem Gerät gilt).
- **Sprache** (F13): Vorgabe die der Liste (`ListenSicht.sprache`, `de+en` → `de`); „Mehr → Sprache“ schaltet Bedientexte
  (`tIn`) und, wenn `andere` da ist, Kataloge/Titel um; gemerkt gerätelokal.

### 5.9 Probe und Übung

- **Probe beim Einrichten** (G10): Nach dem ersten Erhalt der Sicht einer Liste (je Raum und Liste einmal, Ablage
  `probe`) liegt über der Maske „Probe – nichts wird gesendet“ mit Start „P“ und drei Schritten: „Tippe Code <erster
  Code> an“ → „Tippe ‚− letzte zurück‘“ → „Tippe ‚Fehlerfrei‘“ (zeigt das Weiterspringen samt Sperre). Vorsteg: „In
  Ordnung“ und „X → Abbrechen“. „Überspringen“ immer da; „Mehr → Probe“ wiederholt.
- **Übungsmodus** (G13): `#/uebung` (VOLLBILDER `uebung`, main.ts → GeraetApp ohne Store) und „Üben ohne Verbindung“
  im Koppel-Formular. Auswahl Regelwerk (DM/UIM) × Liste (Steg, Steg nur Ablegen/Anlegen, Tor 5, MüB, Vorsteg), dann
  die echte Maske mit `oeffneUebung`. Kopf dauerhaft „ÜBUNG“ (eigene Farbe + Wort), Verbindung „ohne Netz (Übung)“.
  Nichts in die Ablage außer der Ansicht.

## 6. Bedienrechner: Liste zuweisen, Maske (F14)

- **GeraeteKoppeln.vue**: Wahl „Aufgabe für das nächste Gerät“: Start-Freigabe (Bereiche, wie heute) und/oder
  **WKR-Liste**: Auswahl aus `wkr/liste.ts listenDerVeranstaltung` (Titel in der Sprache der Oberfläche wie die
  Matrix, gruppiert nach Parcours/Racecourse; Listen ohne Maske in W3 mit Zusatz „(Maske folgt – Papier)“), am Steg
  „ganz / nur Ablegen / nur Anlegen“. Gemerkt `geraete.koppeln.liste` (lib/merken.ts). `fuerText` nennt Liste und Teil.
- **GeraeteListe.vue**: je Gerät Liste(n) ändern (höchstens 2, F15; Hinweis „Handy: eine“ bei Handy-Geräteart, G3),
  Teil, Anzeige „Maske: Knöpfe“ (G4). `setzeAufgaben` gibt es (Schlüssel der Listen-Gruppe, rotieren – W1).
- **WkrMatrix** (Betrieb → WKR): Liste ohne Gerät bekommt einen Verweis „Gerät koppeln“ → Betrieb → Geräte mit
  vorgewählter Liste (Adresse mit `wahl`, Muster `wahlFuerAdresse`).
- Maske: `ListenAufgabe.maske` wird gesetzt, sobald es mehr als eine Maske gibt (W4/W5); in W3 schickt der Host
  nichts Neues, das Gerät nimmt `knoepfe`. Kein neuer Stand, keine Action.

## 7. Scheiben (nacheinander baubar, jede mit grünen Tests)

1. **W3.1 Maske rein und Kern** – `wkr/maske.ts`, `wkr/uebung.ts`, `wkr/sicht.ts` (`maskenJeKlasse`, `andere`,
   LISTEN_SICHT_FASSUNG 3), `geraete/erfassen.ts` (Schlange je Teil, `sn`, Entwürfe, `holeZurueck`, `pruefung`,
   Typ `ErfassungsQuelle`), `geraete/uebung.ts`, `aufgaben.ts` (`maske`, `fest`), `ablage.ts` (`ansicht`, `probe`),
   WKR_ANNAHMEN G1–G16 mit Zahlen (`weiterNachMs` 2000, `sperreMs` 1000, `ohneQuittungMs` 10000, `papierHinweisSek`
   300, `rueckgaengigMs` 6000, `zuletztLeiste` 5). Tests: `wkr/maske.test.ts` (Aufbau je Position DM/UIM, Steg-Teile,
   X nur Ablegen/Vorsteg, jede Tipp-Folge → `wertGilt`, „2x6“, zurück, Punkte, entwurfAus rund, Takt-Grenzen,
   `spaeter` bei Bojen), `wkr/uebung.test.ts` (ohne Namen, `lv`, Schritt), `wkr/sicht.test.ts` (`andere` Positivliste,
   DM ohne `andere`), `geraete/erfassen`-Fälle in `geraete/wkr.test.ts` (Steg ganz: Ablegen nimmt nur Ablegen weg;
   Entwurf überlebt Neuladen und geht mit verlasseRaum; holeZurueck nur wartend; pruefung), `ablage.test.ts`,
   `aufgaben.test.ts`.
2. **W3.2 Bedienrechner: Liste zuweisen** – GeraeteKoppeln/GeraeteListe/WkrMatrix-Verweis, i18n `geraete.koppeln.liste*`,
   `geraete.liste.liste*`, `betrieb.wkr.koppeln`. Tests: `views/BetriebKoppeln.test.ts` (Code/QR mit Liste und Teil,
   Liste ändern → Host-Doppel `setzeAufgaben`, höchstens zwei), `views/BetriebWkr.test.ts` (Verweis), Ende zu Ende in
   `geraete/wkr.test.ts`: gekoppelt per Code mit Liste aus der Oberfläche → Sicht kommt an.
3. **W3.3 Handy-Maske „Knöpfe“ mit Rahmen** – `components/wkr/*` außer Abschluss/Probe, `styles/wkr-geraet.css`
   (Sonnenmodus schon als Vorgabe), Einbau in GeraetFreigabe (Reiter Freigabe/Liste), i18n `wkr.geraet.*` (neue
   Bereichsdatei `i18n/de|en/wkrGeraet.ts`, Präfix in i18n/CLAUDE.md). Tests: `src/GeraetWkr.test.ts` (happy-dom,
   nachgebauter ntfy wie GeraetKoppeln.test): Tor 5 Code tippen → Hauptknopf „Abschicken · 20“ → Erfassung am Host;
   Fehlerfrei → Haken; Doppeltipp innerhalb der Sperre wirkt nicht (Fake-Uhr); Steg zwei Reiter, Teil-Gerät nur
   einer, X nur Ablegen mit Rückfrage; Vorsteg „In Ordnung“, `vorab`; Ausweichen und Suche; Entwurf bleibt beim
   Wechsel; Zuletzt → Korrektur mit Rückfrage; Rückfrage-Band mit `steht`; Hinweis „gesehen“; getrennt → rot +
   „geschätzt“; pausiert/abgemeldet/weiter; Papier-Modus; entfällt; `spaeter`-Liste; entzogen; Ziele ≥ 48 px über
   `data-ziel` (happy-dom misst nicht – Klassen/CSS-Test in `styles/wkr-geraet.test.ts`, Muster blatt.test.ts);
   kein Name im DOM (Starter-Namen der Beispieldaten nie im Text).
4. **W3.4 Abschluss, Ansicht, Probe, Übung, Doku** – WkrAbschluss, WkrProbe, Ansicht/Sprache in WkrMehr, `#/uebung`
   (adressen VOLLBILDER, main.ts, GeraetApp), Link im Koppel-Formular. Tests: GeraetWkr.test.ts (Prüfansicht mit
   offen/X, Rest auf Papier Pflicht, Name, angenommen/abgelehnt `offen`, Steg-Teil; Sonne/Hell/Dunkel gemerkt;
   Sprache um (UIM mit `andere`, DM nur Bedientexte); Probe einmal je Raum+Liste, überspringen, nichts gesendet),
   `src/main.uebung.test.ts` (kein Store, kein WebSocket, kein fetch – wie main.geraete.test.ts), i18n. Doku:
   `src/wkr/CLAUDE.md`, `geraete/CLAUDE.md`, `components/CLAUDE.md` (Ordner `wkr/`), Wurzel-Karte („Wo ändere ich“:
   Handy-Maske, Übung), `docs/betrieb.md` (Gerät für eine Liste koppeln, Probe, Übung), `docs/feldtest.md` (Punkte
   Handschuh/Sonne/Doppeltipp), entscheidungen.md (G1–G16), Stand im Vorschlag und hier.

Nach jeder Scheibe `npx vue-tsc -b`, gezielte Tests (`npx vitest run src/wkr src/geraete/wkr src/GeraetWkr
src/views/BetriebKoppeln src/i18n`), am Ende `npm run test:leise`.

## 8. Risiken

- **Schlange je Teil ändert erfassen.ts-Verhalten** am ganzen Steg: Die W1-Tests „Steg AB/AN“ zeigen, ob etwas darauf
  baute; Teil-Geräte bleiben gleich.
- **LISTEN_SICHT_FASSUNG 3**: Geräte mit altem Programm zeigen „Bedienrechner/Gerät aktualisieren“ (wie E6/F7) –
  gewollt; Selbst-Update der Geräte gibt es (lib/offline.ts holeNeueFassung).
- **Größe der Sicht** mit `andere`: Kataloge zweimal Text (~2–3 kB). Patch-Differenzen bleiben klein (statisch);
  Inline-Grenze 4096 im Auge behalten (Test: Sicht Steg UIM mit 12 Starts als JSON < 4 kB komprimiert).
- **happy-dom misst keine Größen**: Mindestgrößen über CSS-Test und Feldtest, nicht über Layout.
- **iPhone ohne Vibration**: Blitz ist Pflicht, Vibration Zugabe (feldtest.md).

## 9. Auslegungen W3 (21.11.2026, beim Planen; beantwortet 21.11.2026 abends, §15) – datiert in `WKR_ANNAHMEN`

- **G1 Sonnenmodus ist Vorgabe** *(NICHT bestätigt – W3-01, P-18, §15)* auf jedem WKR-Gerät, Hell/Dunkel wählbar,
  gemerkt je Gerät (nicht je Raum).
- **G2 Masken nur für Listen aus Katalog/Disq./Bemerkung** *(bestätigt 21.11.2026, W3-02)* (Steg, Vorsteg, Tor 5,
  Tor 5 + Parcours ohne Bojen, MüB); erkannt an den Feldarten, nicht an der Listen-ID – eigene Aufbauten gelten so von selbst.
- **G3 Handy eine Liste, Pad zwei** *(NICHT bestätigt – W3-03, §15)* (F15) nur als Hinweis am Bedienrechner nach der
  Geräteart; erzwungen bleibt LISTEN_JE_GERAET = 2. Ein Gerät mit zwei Listen zeigt in W3 Reiter je Liste.
- **G4 Maskenvorgabe F14** *(bestätigt 21.11.2026, W3-04)*: Feld `maske`/`fest` an der Aufgabe, in W3 nur `knoepfe` –
  keine Wahl, nur Anzeige; die Wahl kommt, sobald es eine zweite Maske gibt.
- **G5 Doppeltipp-Schutz** *(bestätigt 21.11.2026, W3-05)*: 2 s „gesendet“, dann Wechsel mit Blitz/Vibration, 1 s keine
  Eingabe – auch für Codes und Disq, nicht nur den Hauptknopf (ein Tropfen auf „Code 1“ ist so schlimm wie auf
  „Fehlerfrei“).
- **G6 Codes „ab Klasse n“ bleiben drückbar** *(NICHT bestätigt – W3-07, §15)* (Text sagt es; die Kataloge haben keine
  Klassen-Angabe). Ein späteres YAML-Feld `abKlasse` würde sie grau machen.
- **G7 Suche** *(bestätigt 21.11.2026, W3-08)* nur in Schlange, „danach“ und „Zuletzt“; eine Nummer außerhalb wird nicht
  angeboten (der Host machte ohnehin Rückfrage `start`).
- **G8 Rückgängig 6 s** *(bestätigt 21.11.2026, W3-09)*: wartende Zeile zurückholen, sonst Korrektur öffnen (kein
  automatisches Hinterherschicken).
- **G9 Sprache** *(bestätigt 21.11.2026, W3-11)*: Vorgabe Sprache der Liste, `de+en` → `de`; Umschalten wechselt
  Bedientexte immer, Kataloge nur, wenn das Regelwerk beide Sprachen hat (UIM).
- **G10 Probe** *(bestätigt 21.11.2026, W3-12)* einmal je Raum und Liste, überspringbar, nichts geht an den
  Bedienrechner (er sieht die Probe nicht).
- **G11 WKR-Name** *(NICHT bestätigt – W3-13, §15)* nur beim Abschluss (F8), kein „WKR wechseln“ in W3 – wer übernimmt,
  schließt mit seinem Namen ab.
- **G12 Letzter WKR-Name** *(bestätigt 21.11.2026, W3-14)* vorbelegt aus der Geräteablage, gelöscht mit „Raum
  verlassen“/Entkoppeln.
- **G13 Übung** *(NICHT bestätigt – W3-15, §15)*: erfundene Starts 1–20 ohne Namen, Quittung nach 300 ms, eine
  Beispiel-Rückfrage; erreichbar ohne Kopplung; nichts außer der Ansicht wird abgelegt.
- **G14 Liste ohne Maske** *(bestätigt 21.11.2026, W3-16)*: das Gerät sagt „Papier“ und bietet „Pausieren“ an; der
  Bedienrechner kennzeichnet solche Listen beim Koppeln.
- **G15 „Nicht vorbeigekommen“ erst mit W4** *(NICHT bestätigt – W3-17, §15)* (braucht Protokoll-, Reducer- und
  Matrix-Änderung); bis dahin Bemerkung oder nichts schicken (Matrix zeigt offen).
- **G16 „Liste abschließen“-Band** *(bestätigt 21.11.2026, W3-18)* erscheint, sobald der eigene Punkt nicht mehr läuft
  und nicht abgeschlossen ist; der Knopf unter „Mehr“ gibt es immer.

## 10. Stand nach W3.1 (21.11.2026)

Gebaut: `wkr/maske.ts`, `wkr/uebung.ts`, `wkr/sicht.ts` (`maskenJeKlasse`, `maskenTexte`, `maskenSprachen`, `andere`,
LISTEN_SICHT_FASSUNG 3), `geraete/erfassen.ts` (Schlange je Teil + `schlangeTeil`, `sn`, Entwürfe, `holeZurueck`,
`pruefung`, `uebung`/`verbunden`/`entzogen`, Typ `ErfassungsQuelle`), `geraete/uebung.ts`, `aufgaben.ts` (`maske`,
`fest`, MASKEN_VORGABEN), `ablage.ts` (`ansicht`, `probe`), WKR_ANNAHMEN G1–G16 mit Zahlen.

Abweichungen vom Plan (beim Bau, alle in WKR_ANNAHMEN bzw. im Kopfkommentar datiert):

- Übung: Fortschritt in einem eigenen `UebungsStand` (`uebungsStand(regelwerk, typeId, sprache?)`,
  `uebungsSicht(stand)`, `uebungsSchritt(stand, zeile | null)`) statt `uebungsSicht(regelwerk, typeId, sprache, jetzt)` /
  `uebungsSchritt(sicht, zeile)` – die Sicht trägt weder Regelwerk noch Uhr. Kein Boot „Übung“ (wäre ein Text außerhalb
  von i18n; „ÜBUNG“ steht im Kopf). Ein Teil-Gerät erledigt in der Übung den anderen Teil gleich mit.
- Maske: `tippeDisq` (eigener Tipp für Disq., Schalter), `mitBemerkung`, `leererEntwurf`, `teileFuer`, `disqFuer`;
  `Entwurf.folge` für „− letzte zurück“; `eintraege(e)` ohne Aufbau (ein Entwurf gehört immer zu einem Teil);
  MaskenAufbau trägt zusätzlich `titel` (Klasse), MaskenTeil `buchstaben`, Disq.-Codes `nurIn` (X am Steg nur Ablegen).
- Sicht: bei zweisprachiger Liste (`de+en`) stehen die Masken (`klassen`) deutsch, `andere` englisch (G9); `andere`
  trägt auch `bereich`. Titel bleibt in der Sprache der Liste.
- Erfassung: `schlange` bleibt `Record<liste, Eintrag[]>` (ganz bzw. Teil der Aufgabe), dazu `schlangeTeil(liste,
  teil)`; Prüfansicht über die Werte je Start im Ausgang (überlebt die 20 letzten Zeilen).

Neue Auslegungen beim Bau (H1–H5, bestätigt 21.11.2026, W3-19…W3-23): H1 Disq. als Schalter, ohne Disq.-Feld ins erste
Code-Feld;
H2 „zurück“ = letzter Tipp (Code oder Disq.), Bemerkung zählt nicht; H3 Schlange je Steg-Teil auf dem Gerät; H4
Entwürfe im Ausgang (≤ 30 je Liste, nach Entzug lesbar); H5 Übung in der Sprache des Regelwerks. Befund: Die DM-Liste
„Parcours“ (nur Disq. + Bemerkung) bekommt nach G2 die Vorsteg-Maske („In Ordnung“, ohne X).

## 11. Stand nach W3.2 (21.11.2026)

Gebaut: `components/betrieb/wkrListenWahl.ts` (useListenWahl, istHandyName), GeraeteKoppeln.vue (Liste + Teil für das
nächste Gerät, Code/QR auch nur mit Liste, „Für“ nennt Freigabe und Liste), GeraeteListe.vue (je Gerät Teil, Liste
dazu/entfernen, höchstens LISTEN_JE_GERAET, Hinweise Handy/Pad, „Maske: Knöpfe“ bzw. „Maske folgt – Papier“),
WkrMatrix.vue (Verweis „Gerät koppeln“ → `#/betrieb/geraete/<liste>`, BetriebView beiWahl), `wkr/maske.ts`
listeMitMaske, i18n `geraete.koppeln.liste*`, `geraete.koppeln.fuerListe`, `geraete.liste.listen`,
`geraete.liste.liste*`, `betrieb.wkr.koppeln`. Tests: views/BetriebKoppeln.test.ts „W3.2“, views/BetriebWkr.test.ts
(Verweis), geraete/wkr.test.ts „W3.2“ (Ende zu Ende über GeraeteKoppeln), wkr/maske.test.ts (listeMitMaske).

Abweichungen: lib/adressen.ts blieb unverändert (das dritte Segment `wahl` trägt die Listen-Kennung schon, kodiert);
kein `wahlFuerAdresse` – nach dem Verweis steht nur der Reiter in der Adresse (die Wahl ist gemerkt). Überschrift und
Hinweis des Koppelns nennen jetzt beide Aufgaben; „Nichts freigegeben“ erst, wenn auch keine Liste da ist.

Neue Auslegungen beim Bau (J1–J5 in WKR_ANNAHMEN; J4, J5 bestätigt 21.11.2026, J1–J3 nicht – §15): J1 „Maske folgt“
nach den Klassen der Starter
(ohne Starter alle Klassen der Liste); J2 Handy am Gerätenamen erkannt (Register kennt keine Geräteart); J3 Freigabe
mit einem Parcours nur ohne Liste vorgewählt; J4 beim Koppeln eine Liste, Teil-Vorgabe „ganz“; J5 Verweis „Gerät
koppeln“ an jeder Liste ohne Gerät, auch ohne Raum und ohne Maske.

## 12. Stand nach W3.3 (21.11.2026)

Gebaut: `components/wkr/` – WkrGeraet (Wurzel, Ansicht aus der Geräteablage, Sprache der Liste über `texte.ts`
useWkrText/tIn, Reiter je Liste), **WkrMaske** (Arbeitsfläche je Liste: Steg-Teil, Schlange und gewählter Start,
Entwurf, Takt, Korrektur, Rückgängig, Suche, verwaiste Entwürfe, Ruhe-Zustände), WkrKopf, WkrStarterKarte,
WkrAusweichen, WkrKnoepfe, WkrStegReiter, WkrVorsteg, WkrDisq, WkrFuss, WkrZuletzt, WkrMehr, WkrRuhe;
`styles/wkr-geraet.css` (Tokens `--wkr-*`, Sonne Vorgabe, `data-ziel` gross/klein); Einbau in GeraetFreigabe.vue
(oeffneErfassung einmal je Gerät, Reiter „Freigabe“/Liste); i18n `wkr.geraet.*` (de/en `wkrGeraet.ts`, Unterpräfix in
i18n/teile.test.ts UNTERPRAEFIXE). Tests: `src/GeraetWkr.test.ts` (23 Fälle: Tor 5 → Erfassung, Fehlerfrei, Disq.,
Ausweichen/Suche, Entwurf, zurückgestellter Entwurf, Korrektur, Rückfrage-Band, Hinweis, getrennt/geschätzt/Papier ab,
Pause/Abmelden/Weiter, Papier-Modus, leer, entzogen, Steg ganz/Teil, Vorsteg vorab, entfällt, Liste mit Bojen,
Freigabe + Liste, Doppeltipp mit Fake-Uhr, Rückgängig, Linkshand), `styles/wkr-geraet.test.ts`.

Abweichungen vom Plan: zusätzliche Teile `WkrMaske.vue` (die Arbeitsfläche je Liste, sonst wäre WkrGeraet zu groß)
und `texte.ts`; der „Riesenknopf“ des Vorstegs ist der Hauptknopf im Fuß (Klasse `wkr-knopf--riesig`, nie zwei
Hauptknöpfe), WkrVorsteg zeigt X/Disq. direkt; Pause/Abmeldung zeigen statt ausgegrauter Knöpfe nur das Band (K5);
der Präfix `wkr.geraet` liegt als Unterpräfix neben `wkr` (listenoptionen.ts) – teile.test.ts kennt Unterpräfixe;
Wake Lock brauchte nichts Neues (GeraetApp hält den Bildschirm wach, solange GeraetFreigabe offen ist); nach dem
Entzug bleibt die Erfassung offen (K3, Entwürfe lesbar). Meldung der Start-Freigabe in „Kein Boot unterwegs“ kommt
aus der öffentlichen Sicht (GeraetFreigabe `meldungFuer`).

Neue Auslegungen beim Bau (K1–K9 in WKR_ANNAHMEN; bestätigt 21.11.2026 bis auf K7 – §15): K1 Disq. zweiter Tipp setzt,
einer nimmt
heraus; K2 gesperrt auch während „● gesendet“; K3 Erfassung bleibt nach Entzug offen; K4 Entwurf je Tipp abgelegt;
K5 Pause ohne Knöpfe; K6 Reiter „Freigabe“ zuerst; K7 „So lassen“ nur auf dem Gerät; K8 Suche mit Taste „E“, ohne
führende Nullen; K9 Hauptknopf „Abschicken · 5 Pkt. · Disq. P“.

## 13. Stand nach W3.4 (21.11.2026) – W3 fertig

Gebaut: **WkrAbschluss** (Prüfansicht aus `pruefung`: Summe „n abgeschickt, n offen: …, n X: …“, je Zeile Nummer,
Klasse, Codes als Text, Punkte, Stufe mit Zeichen und Wort, Tipp → Korrektur; Name des Wettkampfrichters vorbelegt aus
der Ansicht-Ablage, Pflicht; „Rest auf Papier“ Pflicht bei offenen Starts, sonst gesperrt mit Satz; `schliesseAb`,
Ergebnis unterwegs/angenommen/abgelehnt mit Grund; Steg-Teil nur der eigene Teil), Band „Liste abschließen“ in
WkrMaske (G16), **WkrMehr** mit „Liste abschließen“, Ansicht (Sonne/Hell/Dunkel, Linkshand), Sprache (de/en, F13/G9),
Probe, „Übung verlassen“; WkrGeraet merkt Ansicht/Sprache/Name (`schreibeAnsicht`, Name nicht in der Übung) und
öffnet die **Probe** (WkrProbe: Start „P“, drei Schritte auf denselben Teilen, Takt mit Sperre, nichts gesendet;
einmal je Raum und Liste über ablage.ts `probe`, `raum` von GeraetFreigabe); `wkr/maske.ts probeMaske`; **Übung**
`#/uebung` (lib/adressen.ts VOLLBILDER `uebung`, UEBUNG_ADRESSE; main.ts → GeraetApp ohne Store; WkrUebung: Wahl
Regelwerk × Liste, dann WkrGeraet mit `oeffneUebung`), Verweis „Üben ohne Verbindung“ im Koppel-Formular und ohne
Gerät; WkrDisq/WkrVorsteg melden `xNein` (Probe am Vorsteg); i18n `wkr.geraet.*` (Abschluss, Ansicht, Sprache, Probe,
Übung); Stile `.wkr-gruppe`, `.wkr-abschluss`, `.wkr-pruef-*`, `.wkr-schalter`, `.wkr-probe*`, `.wkr-uebung-*`.
Tests: src/GeraetWkr.test.ts „Liste abschließen“ (offen + Rest auf Papier + Name → angenommen am Host, Name gemerkt;
Korrektur aus der Prüfansicht; Steg nur Anlegen → `lauf:1|an`; X und abgelehnt `offen`; Band nach dem Lauf, Name in der
Übung nicht gemerkt), „Ansicht und Sprache“ (gemerkt und wieder gelesen; UIM mit `andere`; DM nur Bedientexte),
„Probe“ (einmal je Raum+Liste, drei Schritte, nichts am Host, nach Neuladen nicht wieder, „Mehr → Probe“; Vorsteg mit
X → Abbrechen, Fake-Uhr), „Übung erreichbar“ (Verweis im Koppel-Formular); src/main.uebung.test.ts (kein Store, kein
WebSocket/fetch/XHR/EventSource, nur die Ansicht im Speicher); wkr/maske.test.ts probeMaske.

Abweichungen vom Plan: Die Wahl der Übung ist eine eigene Komponente `components/wkr/WkrUebung.vue` (statt in
GeraetApp), damit GeraetApp schmal bleibt und die Knopfregeln (styles/wkr-geraet.test.ts) auch für sie gelten. Die
Probe ersetzt die Maske (statt über ihr zu liegen) – dieselben Teile, aber ohne Quelle, so kann nichts gesendet
werden. Der Verweis „Üben ohne Verbindung“ steht auch auf „Kein Gerät gekoppelt“ und nach dem Entkoppeln. Die Wahl
der Übung spricht die Sprache der Geräte-Oberfläche. „Mehr“ gibt es auch in Zuständen ohne Arbeit.

Neue Auslegungen beim Bau (L1–L9 in WKR_ANNAHMEN; bestätigt 21.11.2026 bis auf L3, L4 – §15): L1 Korrektur aus der
Prüfansicht nur über
„Zuletzt“ (≤ 20 Zeilen); L2 Regel des Bands (letzter eigener Punkt ≠ laufender Punkt oder nichts mehr in Schlange und
„danach“; nicht bei Papier, abgeschlossen, eigenem Abschluss); L3 welcher Punkt unter „Mehr“; L4 Name beim Abschicken
gemerkt, in der Übung nie; L5 Sprache der Liste = keine eigene Wahl, Wahl gilt für alle Listen des Geräts; L6 Probe nur
mit Maske, Steg ganz übt Ablegen, in der Übung nur über „Mehr“; L7 Übungsadresse fest; L8 „Mehr“ auch ohne Arbeit;
L9 Zeile ohne Ausgang-Eintrag = übernommen.

## 14. Prüfbefunde W3 (21.11.2026)

Auslegungen M1–M6 bestätigt 21.11.2026 (W3-47…W3-52) bis auf M5 (W3-51, §15). Vierzehn Befunde geprüft; zwei waren
Doppel (gemeinsame Felder am Steg, Vormerken über den Startwechsel). Behoben:

- **Gerät für den ganzen Steg löschte Disq. und Bemerkung des Ablegens** (hoch): `zellenAus` schickt die gemeinsamen
  Felder auch leer, `vorher` kam aus den Werten des ganzen Starts, also `['disq@steg', '', 'A']` → am Bedienrechner
  `steht === vorher` → still gelöscht. Behoben im Kern (geraete/erfassen.ts): WerteEintrag.`wt` hält die gemeinsamen
  Felder je Teil; `vorher` einer Teil-Zeile kommt für sie nur aus Zeilen DIESES Teils, leer ohne eigenes `vorher` geht
  nichts hinaus; `w` vereinigt beide Teile wie der Bedienrechner (Prüfsumme, Prüfansicht ohne Teil). `zellenAus` blieb,
  wie es ist – sonst könnte eine Korrektur im Anlegen einen eigenen Buchstaben nicht mehr herausnehmen (M1).
- **Korrektur einer Korrekturzeile leerte unveränderte Felder** (hoch): neuer Kern `stand(z)` (Übung ebenso) = eigener
  Stand des Starts und Teils; WkrMaske baut Entwurf und „alt“ im Dialog daraus (`korrekturAlt`). Eine wartende Zeile
  nimmt beim Ändern nur Felder auf, die sich wirklich ändern (M2).
- **Vorgemerkter Disq.-Buchstabe galt für den nächsten Start** (mittel): WkrVorsteg/WkrDisq mit `:key` je Start, Teil
  und Korrektur; WkrDisq bekommt `gesperrt` und merkt in der Sperre nichts vor (M3).
- **„− letzte zurück“ nach dem Herausnehmen eines Buchstabens** (niedrig): Merker `#disq:<Buchstabe>` in `folge`.
- **Reiterwechsel verlor Bedienzustand** (mittel): `getrenntSeit`/`wartendSeit` zählt die Quelle (Kern und Übung,
  Wanduhr); „So lassen“ und „behalten“ in components/wkr/gedaechtnis.ts je Quelle und Liste (M4).
- **Hauptknopf unterhalb des Bildschirms, nachrutschende Codes** (mittel): `.wkr-unten` sticky mit eigenem Grund
  (über den Reitern von GeraetFreigabe: `.wkr-mit-reiter`, 64 px); „Rückgängig“ in der Zeile der Leiste „Zuletzt“
  (fest, Leiste schneidet ab statt umzubrechen), „Keine Bestätigung“ über dem Kopf (`.wkr-kopf-ueber`); Startnummer
  80 px bei ≤ 700 px Höhe (M5). Bleibt im Fluss: „Keine Verbindung“, Hinweis, verwaister Entwurf, Abschluss-Band.
- **Suche ohne „D“** (mittel): Buchstaben-Tasten aus den bekannten Startnummern (K8 ergänzt).
- **Entwürfe nach dem Entzug nur „Nr. Werte“** (mittel): Der Kern legt beim Ablegen `papier` {titel, bereich, felder}
  aus der Sicht dazu; WkrRuhe zeigt Liste · Bereich · Teil und „Überschrift: Wert“ (M6).
- **Gesetzte Disq. nie rot** (niedrig): `.wkr-knopf.wkr-disq-knopf--gesetzt`, nach der aria-pressed-Regel.
- **`#555` fest, im Dunkeln unlesbar** (niedrig): Token `--wkr-grau` (Dunkel `#aaaaaa`), Kontrast im Test.
- **Textlinks unter 48 px** (niedrig): „Zum Koppeln“ als `.wkr-knopf` `data-ziel="klein"` über `GERAET`,
  „Üben ohne Verbindung“ mindestens 48 px; der Stil-Test prüft auch `<a>`.
- **„Run {n}“** (niedrig): englisch „Attempt {n}“ wie bogenTexte().lauf.

Verworfen: keiner.

Tests: geraete/wkr.test.ts „Prüfbefunde W3“ (ganzer Steg: Ablegen mit Disq./Bemerkung, Anlegen fehlerfrei, beide
bleiben; zweiter Buchstabe im Anlegen vereinigt; Korrektur einer Korrekturzeile), wkr/maske.test.ts (zurück nach dem
Herausnehmen), src/GeraetWkr.test.ts (Vorsteg: Vormerken nicht über den Start, nicht in der Sperre; „So lassen“ nach
Neuaufbau; Entwürfe nach Entzug mit Überschrift), styles/wkr-geraet.test.ts (sticky, Rot, Grau-Kontrast, keine feste
Farbe, `<a>`).

## 15. Antworten des Nutzers 21.11.2026 abends (Runden 3–6 der Fragenseite)

Bestätigt mit „passt“ (in `WKR_ANNAHMEN` je Eintrag „bestätigt 21.11.2026 (Frage)“): G2, G4, G5, G7–G10, G12, G14, G16
(W3-02, -04, -05, -06, -08 … -12, -14, -16, -18), H1–H5 (W3-19 … -23), J4, J5 (W3-27, -28), K1–K6, K8, K9 (W3-29 … -34,
-36, -37), L1, L2, L5–L9 (W3-38, -39, -42 … -46), M1–M4, M6 (W3-47 … -50, -52); vom Feldtest N1–N3, N5–N7, N9, N10,
„ein Tab sendet“ (P-01, -02, -06 … -09, -14 … -17), N11–N13 (W4-01 … -03).

Anders entschieden (noch nicht umgesetzt, der Code gilt bis zum Umbau; Wortlaut in
[entscheidungen.md](entscheidungen.md) „Antworten 21.11.2026 abends (Runden 3–6)“):

- **G1/N4** (W3-01, P-18): Vorgabe ist der Hell/Dunkel-Modus des Geräts, der WKR wechselt jederzeit (auch Sonne).
- **G3/J2** (W3-03, W3-25): eine/zwei Listen nur Empfehlung, mehr erlaubt (Pad nebeneinander); die Geräteart meldet
  das Gerät beim Koppeln, der Bedienrechner speichert sie.
- **G6** (W3-07): Codes anderer Klassen ausgegraut, aber drückbar.
- **G11/L4** (W3-13, W3-41): WKR-Name aus der Einteilung der Veranstaltung, unter „Mehr“ änderbar, am Bedienrechner
  sichtbar, Hinweis bei Abweichung (übernehmen oder überschreiben).
- **G13** (W3-15): Übung bleibt, dazu „Übung beenden“ unter den Knöpfen und die Erklärung der Übungsstarts in der Übung.
- **G15** (W3-17): „nicht vorbeigekommen“ = Disq. J (Parcours verlassen bzw. falscher Parcours), kein eigenes ⊘.
- **J1** (W3-24): statt Antwort ein Befund – nach dem ersten Zuweisen einer Liste bleibt das Gerät auf „verbinde …“,
  bis man neu lädt; soll von selbst gehen und/oder per Knopf.
- **J3** (W3-26): Start-Freigabe beim Koppeln nie vorgewählt (ein Recht wie die Listen).
- **K7** (W3-35): „So lassen“ meldet sich am Bedienrechner.
- **L3** (W3-40): „Mehr → Liste abschließen“ herausnehmen oder den Zweck erklären.
- **M5** (W3-51): Umschalter Ablegen/Anlegen immer sichtbar, mit Zeichen „fertig/offen“ je Teil.
- **N8** (P-03, P-04): Start-Freigabe nur für den Parcours mit Ampel (siehe entscheidungen.md und betrieb.md).

Umgebaut 21.11.2026 (docs/plan-antworten-runde3-6.md §5, WKR_ANNAHMEN GF1–GF11, noch zu bestätigen): G1/N4 → „Wie
Gerät“ als Vorgabe (GF1); G3/J2 → bis vier Listen, Empfehlung nach der beim Koppeln gemeldeten Art, Pad quer
nebeneinander (GF7, GF8); G6 → ausgegraut über YAML `abKlasse` (GF2); G13 → Erklärung + „Übung beenden“ (GF4); G15 →
Disq. J (GF10, GF11); J1 → Nachholen nach neuem Gruppenschlüssel + „Neu verbinden“ (GF6); J3 → nie vorgewählt;
K7 → WKR_SO_LASSEN (GF5); M5 → Steg-Reiter immer mit ✓/Zahl (GF3). G11/L4 (WKR-Name) folgt in Scheibe 5.
