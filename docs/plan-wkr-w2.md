# Plan W2 „Bedienrechner“ der digitalen WKR-Erfassung

Stand 21.11.2026 (Scheiben 1–4 gebaut: „Lage und Stand“, „Matrix und Eingang“, „Erfassung“, „Start-Freigabe und Freigabe-Handy“; Prüfbefunde dazu behoben, §10; Auslegungen §9 und §10 vom Nutzer bestätigt 21.11.2026) · Grundlage:
[vorschlag-wkr-erfassung.md](vorschlag-wkr-erfassung.md) §5 (Herkunft ◆), §6 (Matrix, Geräteleiste, Warnung), §7
(Sonderfälle), §8 (Papier und Vorrang), §11 W2, §12 (F1, F4, F5, F10, F12, F17) und der gebaute Kern W1
([plan-wkr-w1.md](plan-wkr-w1.md); Code `src/wkr/`, `state/reducer/wkr.ts`, `types/wkr.ts`, `geraete/host.ts`,
`geraete/wkrEingang.ts`, `geraete/wkrGruppen.ts`, `geraete/erfassen.ts`). Antworten des Nutzers:
[entscheidungen.md](entscheidungen.md) „Digitale WKR-Erfassung“.

## 1. Ziel und Grenzen

W1 hat den Weg „Gerät → Bedienrechner → Erfassung“ gebaut, aber **nichts davon ist am Bedienrechner zu sehen oder zu
bedienen**: Rückfragen und Vorschläge liegen im Stand, die Herkunft ◆ in der Ablage, Modus/Status je Liste lassen sich
nur vom Gerät oder beim Koppeln setzen. W2 macht das am Bedienrechner sichtbar und bedienbar:

1. **Unterreiter „WKR“ im Betrieb** (Code `wkr`): Matrix Listen × Starts mit zwei Ampeln (*Gerät gehört?* /
   *Zeile da?*), je Liste die Bedienung (Modus, Pausieren/Abmelden/Weiter, „Papier ab Start …“, Hinweis an die
   Geräte, Abschluss ansehen und lösen) und der **Eingang** (Rückfragen: Gerät übernehmen/behalten; Vorschläge:
   übernehmen/verwerfen).
2. **Erfassung**: Zeichen ◆ an Zellen mit Gerätewert (Tooltip Gerät, Liste, Uhrzeit), X vom Gerät hervorgehoben (F5),
   Markierung **„Papier ansehen“** an Zeile bzw. Zelle (F4), Nachfrage beim Überschreiben eines Gerätewerts (§8 Vorrang 3).
3. **Start-Freigabe**: Geräteleiste je digitaler Liste und Rückstandszeile über „Nächster Start“; Einstellung R und
   „warnen/nachfragen“ in SettingsView `#betrieb`; dieselbe Zeile auf dem **Freigabe-Handy** – ohne Werte, und
   **nicht** über die öffentliche Sicht (§2, Missverständnis-Gefahr).

Nicht in W2: Masken am Gerät, „Nicht vorbeigekommen“, Doppeltipp-Schutz (W3/W4); Maske je Gerät vorgeben (F14, kommt
mit den Masken W3, die Geräteliste aus E7 bleibt sonst unverändert); Laufzettel mit „ab welchem Start vom Papier
abtippen“ (§8 letzter Punkt – nach dem Feldtest); getrennte Kontingentanzeige der Erfassung (§9 A12); Matrix-Markierung
„zurückgestellt, Werte vorhanden“ (§7, braucht Feldtest-Erfahrung); Knoten/Zeit-Listen (W5).

## 2. Was wohin gehört (und was nicht)

| Angabe | Ort | Warum |
|---|---|---|
| Lage einer Liste: Zellstand je Start, Rückstand, offene Rückfragen/Vorschläge, Abschluss | **neu, rein** `src/wkr/lage.ts` (abgeleitet aus AppState + Geräteangaben als einfache Daten) | eine Stelle für Matrix, Geräteleiste, Warnung, Erfassung und Freigabe-Handy; `src/wkr/` bleibt ohne geraete/ |
| Gerätezustand (zuletzt gehört, wartend, Akku, Name, Aufgaben) | wie W1: Register im Raum (`RegisterEintrag`), gelesen über `GeraeteHost.raum` | gerätelokal; die Lage bekommt nur `{id, name, listen, zuletzt, wartend?, akku?}` hineingereicht |
| Herkunft ◆, abgelehnte Zeilen | wie W1: `alcatraz.geraete.herkunft` / `.wkr`; **neu**: reaktiv über `GeraeteHost.herkunft`/`.eingang` | F10; jedes Bedienfenster soll ◆ sehen, nicht nur das Führungsfenster |
| R (Rückstand ab), warnen/nachfragen | **neu** `AppState.anzeige.wkrRueckstand`, `.wkrWarnung` (SET_ANZEIGE, normalisiereAnzeige) | dieselbe Gruppe wie „Am Steg/Vor Steg“ unter „Startfolge im Betrieb“; Einstellung nur in SettingsView |
| „Papier ab Start …“ | **neu** `WkrPause.ab` (refKey) + Action `WKR_PAPIER_AB` | P-Menge und Anzeige „Papier ab 15“ aus EINEM Eintrag; Rückfall in migrate |
| Gewählter Bereich, „alle Starts des Laufs“, aufgeklappter Eingang | lib/merken.ts (`betrieb.wkr.*`) | Bedienauswahl, nicht AppState |
| Rückstand für das Freigabe-Handy | **neue Gruppe je Bereich** `f…` mit der Freigabe-Sicht (`src/wkr/freigabe.ts`) | ko liest auch die Anzeigetafel (F17); Werte nie, Startnummern offen und Listennamen ja |

**Warum nicht in die öffentliche Sicht:** Der Auftrag sagt „auf dem Freigabe-Handy nur aus öffentlicher Sicht ohne
Werte“. Das Freigabe-Handy liest heute dieselbe Gruppe `ko` wie die Anzeigetafel, und deren Lese-Link (QR) kann jeder
haben, der vor der Tafel steht. Stünde der Rückstand in `ko`, könnte ihn jedes Tafelgerät lesen – gegen F17 („nichts
davon auf der Anzeigetafel“). Darum: **wertfrei wie die öffentliche Sicht, aber in einer eigenen verschlüsselten
Gruppe**, die nur Geräte mit der Aufgabe „Start-Freigabe“ für diesen Bereich lesen. Der Test aus W1 (`sichtOeffentlich`
und `sichtZuschauer` gleich vor/nach Zeilen) bleibt und bekommt die neuen Actions dazu.

## 3. Reine Logik `src/wkr/lage.ts` (neu)

```ts
/** Was ein Gerät der Liste zur Lage beiträgt – vom Host als einfache Daten (Register), nichts aus geraete/. */
interface GeraetAngabe { id: string; name: string; listen: { liste: string; teil?: ListenTeil }[]; zuletzt: number; wartend?: number; akku?: number }

type Ampel = 'gehoert' | 'still' | 'weg' | 'ruht'                // ● ◐ ✕ und „kein Punkt läuft“ (grau, A3)
type Zelle = 'ok' | 'halb' | 'offen' | 'ueberfaellig' | 'rueckfrage' | 'vorschlag' | 'entfaellt' | 'papier' | 'x' | 'vorab'
//          ✓      ½        ○         ○! (gelb)       !              V            –           P        ✕    (Vorsteg)

interface ListenLage {
  liste: string; titel: string; typeId: string; teile?: Record<'ab'|'an', { status: WkrStatus }>
  modus: WkrModus | null                                   // null = kein Eintrag = Papier (WKR_ANNAHMEN.ohneEintragPapier)
  status: WkrStatus; papierAb: string | null                // Startnummer aus WkrPause.ab der offenen Pause
  geraete: { id: string; name: string; teil?: ListenTeil; ampel: Ampel; seitMs: number; wartend?: number; akku?: number }[]
  zellen: Record<string /* refKey */, { zelle: Zelle; teile?: { ab: Zelle; an: Zelle } }>
  rueckstand: { zahl: number; von: string; bis: string } | null  // Startnummern, nur digitale aktive Listen
  warnt: boolean                                            // zahl > R und nicht pausiert/abgemeldet/Papier (F1)
  rueckfragen: number; vorschlaege: number
  abschluss: { punkt: PunktId; teil?: ListenTeil; name: string; zeit: number; abweichend: string[]; papier: string[] }[]
}
function erfassungsLage(stand, konfig, bereich, geraete: GeraetAngabe[], jetzt: number, starts?: 'punkt' | 'alle'): { starts: MatrixStart[]; listen: ListenLage[] }
function zeilenMarken(stand, konfig, liste, laeufe): Map<`${lauf}|${starter}`, { marke: 'papier-ansehen' | 'rueckfrage' | null; zellen: Record<feld, 'papier-ansehen' | 'rueckfrage'> }>
function rueckstandZeile(lagen: ListenLage[]): { warnt: boolean; teile: { titel: string; von: string; bis: string; geraet: Ampel; wartend?: number }[] }
```

- **Spalten der Matrix** = gezeigte Starts des laufenden Punkts im Bereich (`betriebVon().gezeigt`, Punkt über
  `punktVonRef`), die letzten `WKR_ANNAHMEN.matrixStarts` (12), umschaltbar auf alle des Punkts; im Parallelslalom ist
  jede Liste je Racecourse eine eigene Zeile (A und B), die Spalte ist das Paar.
- **Zellstand** aus dem, was W1 schon führt, Vorrang von oben nach unten: X im Lauf → `x`; Klasse ohne Liste →
  `entfaellt`; offene Rückfrage dieser Liste zum Start → `rueckfrage`; Vorschlag → `vorschlag`; Haken der Liste →
  `ok`; nur ein Teilhaken am Steg → `halb` (mit `teile`); in `papierStarts`/`abschlussPapier` oder vor `seit` oder
  Liste auf Papier → `papier`; in der Schlange → `offen` bzw. `ueberfaellig`, wenn mehr als R jüngere gezeigte Starts
  derselben Liste dahinter liegen. **Keine Wiederholung der Schlangenregeln**: `lage.ts` ruft `schlange()`,
  `papierStarts()`, `abschluss.ts` – nie liest es `wkr.abschluss` direkt (CLAUDE.md-Falle).
- **Rückstand** = Zahl der Starts in `schlange(stand, liste)` ohne `vorab`/`entfaellt`; am Steg mit zwei Teil-Geräten
  das Maximum der beiden Teile (A4). Pausierte, abgemeldete Listen und Papier zählen nie (F1) – das ergibt sich schon
  daraus, dass ihre Schlange leer ist; geprüft wird es trotzdem eigens im Test.
- **Ampel** je Gerät aus `jetzt − zuletzt`: < 90 s gehört, < 5 min still, sonst weg (`WKR_ANNAHMEN.ampelStillSek`,
  `ampelWegSek`). Läuft im Bereich kein Punkt, ist jedes Gerät `ruht` (A3) – die Geräte schicken dann kein
  Lebenszeichen (W1: nur mit laufendem Punkt), ✕ wäre ein Fehlalarm.
- **Papier ansehen** (`zeilenMarken`) für jede Zeile einer Liste mit Eintrag (digital/beides), deren Zellstand
  `papier`, `ueberfaellig` oder `offen` bei Gerät `weg` ist; Zelle statt Zeile, wo nur ein Teil fehlt (`halb`: die
  Spalten des fehlenden Teils aus `WKR_ANNAHMEN.teile`) bzw. wo eine Rückfrage auf genau dieser Zelle steht (A5).
- `listeVonBogen(bogen, stand)` in `wkr/liste.ts` (neu): Manövrieren `{bereich: parcoursId, typeId, racecourse: null}`,
  Parallel über `RACECOURSE_PARCOURS` rückwärts. Bögen ohne Liste (Knoten) → `null`, keine Marken.

## 4. Stand und Actions (Reducer `state/reducer/wkr.ts`)

| Neu/geändert | Wirkung |
|---|---|
| `WkrPause.ab?: string` (refKey) | die Pause kam von „Papier ab Start …“; `papierAb` in der Lage. migrate: `liesPause` nimmt `ab` nur als gültige Ref |
| `WKR_PAPIER_AB { liste, ref, teil? }` | Bediener: Status `abgemeldet`, Pause `{von: Zeit, zu der `ref` gezeigt wurde (sonst jetzt), bis: null, ab: ref, papier: Starts der Schlange ab ref}`. Ohne Eintrag oder bei Papier: nichts. Danach „Weiter digital“ = `WKR_LISTE {status: 'aktiv'}` (wie heute) |
| `WKR_ZEILEN`: Start in P-Menge | **neu**: Zeile zu einem Start aus `papierStarts(liste, teil)` wird **Vorschlag** `papier` statt Übernahme (§8 Vorrang 5, §7 „kommt das alte Gerät wieder …“; A6). Die W1-Tests zu Pause/P prüfen und ggf. anpassen |
| `SET_ANZEIGE` + `normalisiereAnzeige` | `wkrRueckstand` (ganze Zahl 1–20, Vorgabe 2, F4) und `wkrWarnung: 'warnen' \| 'nachfragen'` (Vorgabe `warnen`) |
| Verlauf | `wkrPapierAb` in `lib/verlauf.ts` ARTEN; Texte `history.what.wkrPapierAb` de+en |

Unverändert genutzt: `WKR_RUECKFRAGE`, `WKR_VORSCHLAG`, `WKR_LISTE` (Modus, Status, `teil`), `WKR_ABSCHLUSS_LOESEN`
(war in W1 für W2 vorbereitet). Der Bediener wirkt mit `WKR_LISTE` ohne `teil` auf die ganze Liste, mit `teil` auf
einen Teil des Stegs (gibt es schon, braucht einen Eintrag – den gibt es, sobald ein Gerät gekoppelt war).

## 5. Host (geraete/host.ts) – nur Lesen dazu, außer der Freigabe-Gruppe

- `GeraeteHost.herkunft: ShallowRef<WkrHerkunft>` und `.eingang: ShallowRef<WkrEingang>`: gelesen beim Start, bei
  jedem eigenen Schreiben und beim storage-Ereignis auf `ABLAGE.herkunft`/`ABLAGE.wkr` (andere Fenster). Ohne Raum
  trotzdem lesbar (◆ bleibt nach „Raum beenden“, W1 §9.2) – **ohne** Verbindung, Fensterbus oder Schloss
  (`src/main.geraete.test.ts` bleibt grün; Test dazu).
- `raum.geraete[].zuletzt` muss im Führungsfenster nach `beruehre`/Lebenszeichen nachgezogen werden (heute nur beim
  Begrüßen, Z. 563): gedrosselt `setzeInfo(t.raumJetzt())` höchstens alle 5 s – sonst zeigt die Ampel im
  Führungsfenster ein lebendes Gerät als ✕. In den anderen Fenstern kommt es über das storage-Ereignis.
- **Freigabe-Gruppe je Bereich** (Scheibe 4): `wkrGruppen.ts gruppeDerFreigabe(bereich)` = `'f' + FNV-1a hex8`;
  `gruppenFuer` nimmt sie für jede Aufgabe `startfreigabe` dazu; `gruppenNachAufgaben`/`setzeAufgaben` legen sie an
  und schicken den Schlüssel (wie bei den Listen). Schon gekoppelte Freigabe-Handys bekommen den Schlüssel beim
  nächsten Start des Hosts (`schickeSchluessel`, wie bei neuen Listen) – kein neues Koppeln. `verteile` zusätzlich je
  Freigabe-Gruppe mit Geräten `sichtFreigabe(…)` (gesammelt, nach Inhalt verglichen, also nur bei Änderung – Kontingent).
  PROTOKOLL_FASSUNG bleibt 2 (Gruppen sind allgemein, ältere Geräte kennen die Gruppe nicht und lesen sie nicht);
  innen `fv: 1` (`FREIGABE_SICHT_FASSUNG`).
- `src/wkr/freigabe.ts sichtFreigabe(lage, R, warnung)` → `{fv, bereich, warnung: 'warnen'|'nachfragen', listen:
  [{titel, ampel, status, offen: Zahl, von, bis, wartend?}]}` – Feld für Feld gebaut, **nie** Werte, Namen von
  Startern oder Geräten, Herkunft, Gewicht, Geburtsdatum, Geschlecht, WKR-Namen (Positivliste im Test wie sicht.test.ts).
  Gerätenamen bleiben weg (A9): Das Handy am Steg braucht „MüB ✕“, nicht „Handy von …“.

## 6. Oberfläche

### 6.1 Betrieb → „WKR“ (Unterreiter `wkr`, `lib/adressen.ts` betrieb: `wkr`, englisch `officials`)

```
[ Parcours 1 | Parcours 2 ]                          1. Lauf · Im Boot 17   [ ✓ nur dieser Lauf ▾ alle Starts ]
Liste        Gerät                  13  14  15  16  17   Stand                Bedienung
Steg         ● Steg-Handy · vor 5 s ✓   ✓   ✓   ½   ½    Anlegen 16 offen      [Modus][⏸][⏏][Papier ab …][Hinweis][…]
Tor 2/4/5    ◐ Handy Süd · 2 min    ✓   ✓   ○!  ○!  ○    3 offen, 2 warten (Gerät)
MüB          ✕ Handy MüB · 9 min    ✓   –   P   P   ○    Papier ab 15
Parcours     ▭ Papier                                    Bogen
Legende (aufklappbar) · Abschlüsse: Tor 1/3/5 – 1. Lauf: abgeschlossen von <Name>, 14:20 (2 abweichend: 23, 41) [lösen]
EINGANG  Rückfragen (1)  ·  Vorschläge (0)
  Start 14 · Tor 5 · 1. Lauf · Gerät „Handy T5“ 10:44
     Einfahrt Tor 5: Gerät 2x1 · steht 1        [ Gerät übernehmen ] [ behalten ]
```

- Komponenten (alle in `components/betrieb/`, lesen den Store – Bedienrechner): `WkrMatrix.vue` (Tabelle, Legende,
  Bereichswahl, Klick auf Zelle → kleine Karte mit Werten der Zeile in Oberflächensprache, ◆, bei `!` direkt die
  Rückfrage), `WkrListeBedienung.vue` (je Liste; Modus als drei Knöpfe – nie `change` eines `<select>`; Pausieren/
  Abmelden/Weiter, am Steg je Teil; „Papier ab Start …“ = Auswahl der gezeigten Starts + eigener Knopf, schickt dazu
  `hinweis(liste, 'papier', startNr)`; „Weiter digital“ schickt `weiter-digital`; Hinweis „Bitte Nr. prüfen“ mit
  Startnummer; Abschlüsse mit „Abschluss lösen“ hinter AppDialog), `WkrEingang.vue` (Rückfragen je Zeile gruppiert,
  Knöpfe je Zelle und „alle: Gerät“/„alle: behalten“ je Zeile; Grund als Satz: Zelle anders belegt / Start war nicht
  gezeigt / Buchstabe fiele weg; X vom Gerät rot mit „nicht gestartet“ (F5); Vorschläge mit Grund
  „Liste abgeschlossen“/„Papier“; Gerätename aus dem Register über `geraetVonZeile`, sonst „entkoppeltes Gerät“ – im
  Stand steht nie ein Name, F10).
- Ohne Raum: Matrix trotzdem (zeigt Lücken beim Abtippen, Vorschlag §6.1), Gerätespalte „—“; Listen ohne Eintrag als
  ▭ Papier. Ohne festgeschriebene Verzahnung derselbe Hinweis wie die anderen Unterreiter.
- Klick auf ein Gerät → Unterreiter `geraete` (Geräteliste E7). Kopf des Betriebs: neben „Geräte: ●“ ein Zähler
  „WKR: ! 1“, wenn Rückfragen offen sind.
- Uhr `useUhr(5000)` nur in diesem Zweig (Ampel); Auswahl über `merke('betrieb.wkr.bereich')`,
  `merke('betrieb.wkr.alle')`.

### 6.2 Erfassung (`components/erfassung/ErfassungTabelle.vue`)

- Liste des Bogens über `listeVonBogen`; Marken über `zeilenMarken`, Herkunft über `useGeraeteHost()?.herkunft`
  und `herkunftGilt` (◆ nur, solange der Wert gleich ist). **v-memo** bekommt Marke und ◆ der Zeile mit (sonst
  bleibt eine Zeile nach Übernahme vom Gerät ohne Zeichen stehen).
- ◆ klein oben rechts in der Zelle, `title` „Tor 1/3/5 · Handy Nord · 10:42“ (Uhrzeit mit `uhrzeitText`, nie mm/dd);
  X vom Gerät zusätzlich mit Rahmen (F5).
- „Papier ansehen“: Zeichen ▭ vor der Startnummer mit Text im `title` und in einer Zeile unter dem Kopf („3 Zeilen:
  Papier ansehen“), Zelle mit gestricheltem Rand, wenn nur ein Teil fehlt; Rückfrage → „!“ mit Verweis auf
  Betrieb → WKR. Farben nur über bestehende Tokens (Bildschirm, keine Druckliste).
- **Vorrang 3**: Erste Änderung einer Zelle mit gültigem ◆ fragt über den vorhandenen `frage`-Weg (wie beim
  verdeckten X): „Wert vom Gerät (Handy Nord, 10:42: 10) ersetzen?“ – [ersetzen] [behalten]. Die Antwort gilt für die
  Zelle, solange sie den Fokus hat (A7).

### 6.3 Start-Freigabe (Bedienrechner und Handy)

- `StartFreigabe.vue` bekommt eine **optionale** Prop `erfassung?: FreigabeErfassung` (reine Daten, keine Store-
  Abhängigkeit – die Komponente läuft auch auf dem Handy). Leiste immer, sobald eine Liste des Bereichs einen Eintrag
  hat: `● Steg ½16 · ◐ T2/4/5 ⧗2 · ✕ MüB 4 offen · ▭ Parcours`; ein Feld, das neu auf ✕ oder `!` geht, wird einmal
  hervorgehoben und bleibt rot (kein Ton, kein Dialog). Darüber bei `warnt` die Rückstandszeile und gelber Rand um
  „Nächster Start“.
- „nachfragen“: `naechsterStart()` und `zeige()` (auch „Anderen Starter wählen“, A8) öffnen bei `warnt` einen
  AppDialog „Trotzdem freigeben?“; nie gesperrt (F4).
- Bedienrechner: BetriebView baut `erfassung` je Bereich aus `erfassungsLage`; Klick auf die Leiste → Unterreiter
  `wkr` mit Wahl des Bereichs (lib/adressen.ts drittes Segment `wahl`).
- Handy: `GeraetFreigabe.vue` liest die Freigabe-Sicht seiner Bereiche aus `gekoppelt.ts` (neu: Sicht der
  Freigabe-Gruppe neben `ko`, wie `erfassen.ts` die Listen-Gruppe liest) und reicht sie als `erfassung` durch.

### 6.4 Einstellungen (SettingsView `#betrieb`)

`data-feld="betrieb-wkr-rueckstand"` (Zahl 1–20) und `betrieb-wkr-warnung` (zwei Optionsfelder „nur warnen“ /
„nachfragen“) unter „Startfolge im Betrieb“, Texte `listopt.betrieb.wkr*` in de/+en/listenoptionen.ts, Hinweis: „Es
wird nie gesperrt – ein stilles Handy hielte sonst den Wettkampf an.“ Unter DM und UIM gleich (kein Parallel-Sonderfall).

## 7. Scheiben (nacheinander baubar, jede mit grünen Tests)

1. **Lage und Stand (rein)** – `wkr/lage.ts`, `wkr/liste.ts listeVonBogen`, WKR_ANNAHMEN (Zahlen und Auslegungen §9),
   `WkrPause.ab`, `WKR_PAPIER_AB`, P-Starts → Vorschlag, migrate, Verlauf, `anzeige.wkrRueckstand/wkrWarnung` +
   SettingsView `#betrieb` + i18n. Tests: `wkr/lage.test.ts` (jeder Zellstand, Vorrang, Steg ½ je Teil, Parallel A/B,
   Rückstand mit R, pausiert/abgemeldet/Papier ohne Warnung, Ampel-Grenzen mit fester Uhr, `ruht`, Marken je
   Zeile/Zelle), `state/reducer/wkr.test.ts` (Papier ab, Zeile in P → Vorschlag, Referenz unverändert,
   Determinismus), `state/migrate.test.ts`, SettingsView.test.ts, i18n.
   **Gebaut 21.11.2026.** Abweichungen beim Bau: `listeVonBogen(bogen, konfig)` statt `(bogen, stand)` (braucht nur
   die Positionen); `zeilenMarken` nimmt dazu `geraete`/`jetzt` (für „offen bei Gerät weg“) – ohne Geräte zählt
   „offen“ nie als verdächtig (A5); MatrixStart trägt `nummern` (Paar: beide Seiten); `ListenLage.racecourse`;
   Abschlüsse mit Startnummern statt Kennungen; „Papier“ = gezeigt, ohne Haken, nicht in der Schlange (keine eigene
   Papier-Regel); Zeilen einer ganzen Steg-Zeile werden schon Vorschlag, wenn EIN Teil den Start in P hat (A6);
   WKR_PAPIER_AB auf eine schon offene Pause ergänzt sie statt eine zweite zu öffnen (A10).
2. **Matrix und Eingang** – Host `herkunft`/`eingang` reaktiv, `zuletzt` im Führungsfenster nachziehen, Unterreiter
   `wkr` (adressen, BetriebView, i18n `betrieb.wkr.*`), WkrMatrix, WkrListeBedienung, WkrEingang. Tests:
   `views/BetriebWkr.test.ts` (Matrix aus Beispielstand, Rückfrage entscheiden → eingaben + Haken, Vorschlag,
   Modus/Pause/Papier ab mit Hinweis an den Host-Doppel, Abschluss lösen mit Dialog, ohne Raum), `geraete/host.test.ts`
   (herkunft ohne Raum: kein Netz; storage-Ereignis), `wkr.test.ts` Ende zu Ende: Gerät schickt, Matrix zeigt ✓.
   **Gebaut 21.11.2026.** Abweichungen beim Bau: Gerätedaten für die Lage über `geraete/register.ts geraetAngaben`
   (Register → GeraetAngabe); die Bereichswahl kann auch über die Adresse kommen (`#/betrieb/wkr/<parcours>`, für
   Scheibe 4 vorbereitet); `zuletzt` wurde schon vorher nach jeder Nachricht gesetzt – jetzt gedrosselt auf ≤ 5 s
   (ZULETZT_NACHZIEHEN_MS); „Bitte Nr. prüfen“ nur bei offenem Raum. Neue Auslegungen B1–B6 in WKR_ANNAHMEN.
3. **Erfassung: ◆ und „Papier ansehen“** – ErfassungTabelle (Marken, ◆, X vom Gerät, v-memo, Nachfrage Vorrang 3),
   Kopfzeile mit Zahl. Tests: `views/ErfassungWkr.test.ts` (◆ erscheint/verschwindet bei Änderung, Tooltip ohne
   mm/dd, Papier-ansehen-Zeile und -Zelle am Steg, Nachfrage beim Überschreiben, ohne Host keine Zeichen),
   ErfassungView.test.ts unverändert grün (Leistung: v-memo).
   **Gebaut 21.11.2026.** Abweichungen beim Bau: Stile in styles/erfassung.css (dort stehen alle `erf-*`, Farben
   `--blatt-*` wie die Tabelle), nicht app.css; ◆ an jeder Zelle mit gültiger Herkunft, auch von einer anderen Liste
   (gemeinsame Felder, C1); v-memo über einen Text je Zeile (Marke, Zellmarken, ◆-Titel), damit die neue Map je Rechnung
   nicht jede Zeile neu zeichnet; Uhr im 30-s-Takt nur mit Host (C4); während einer offenen Frage schreibt die Tabelle
   nichts (das Verlassen des Feldes brächte die Eingabe sonst an der Frage vorbei); Zeitfelder bekommen nach der Frage
   den Fokus nicht zurück (C2). Neue Auslegungen C1–C4 in WKR_ANNAHMEN.
4. **Start-Freigabe und Freigabe-Handy** – Prop `erfassung` in StartFreigabe, Leiste, Warnzeile, Dialog
   „nachfragen“; BetriebView-Anbindung; `wkr/freigabe.ts`, Freigabe-Gruppe (wkrGruppen, register, host verteilen,
   Schlüssel an Bestandsgeräte), gekoppelt.ts + GeraetFreigabe. Tests: views/Betrieb.test.ts (Leiste, warnen,
   nachfragen, nie gesperrt), `wkr/freigabe.test.ts` (Positivliste, keine Werte/Namen), `geraete/wkr.test.ts`
   (Handy bekommt Rückstand; Tafel-Gerät liest die Gruppe nicht; `sichtOeffentlich`/`sichtZuschauer` unverändert bei
   allen WKR-Actions – F17), Verkehr: Freigabe-Sicht nur bei Änderung; src/GeraetKoppeln.test.ts (Leiste auf dem
   Handy). Danach Doku: `src/wkr/CLAUDE.md`, `geraete/CLAUDE.md`, `components/CLAUDE.md`, `views/CLAUDE.md`,
   Wurzel-Karte „Wo ändere ich“, docs/betrieb.md (Ablauf: Matrix, Papier ab, Rückfragen), entscheidungen.md, Stand im
   Vorschlag.
   **Gebaut 21.11.2026.** Abweichungen beim Bau: `sichtFreigabe(bereich, lagen, warnung)` statt `(lage, R, warnung)` –
   R steckt schon in `ListenLage.warnt`; die Sicht trägt dazu `stand` (Papier = kein Eintrag oder Modus Papier),
   `rueckfragen` (Zahl) und `warnt` (D2); `liesFreigabe` prüft auf dem Gerät. Listennamen in der Sprache der
   Anzeigetafel (D3). Der Host rechnet die Sicht zusätzlich im Koppel-Takt alle 15 s neu (die Ampel altert ohne
   Nachricht, D4) und sendet einen Bereich ohne Listen-Eintrag gar nicht erst. Bestandsgeräte bekommen die Gruppe beim
   Start des Führungsfensters (`ergaenzeGruppen`) und ohnehin bei ihrer Selbstanmeldung. Die Nachfrage greift über
   einen Wrapper um `sende` (auch BetriebsFolge und Einreihen-Listen), nicht bei „Lauf beginnen“/„Zurück“/
   Zurückstellen (D5). Klick auf die Leiste setzt Unterreiter und Bereich direkt (gleiches Ergebnis wie die Adresse
   `#/betrieb/wkr/<parcours>`). Tests der Start-Freigabe in views/BetriebWkr.test.ts (Host-Doppel und Beispielstand
   lagen dort schon), F17 über alle WKR-Actions in wkr/sicht.test.ts neben dem W1-Test. Neue Auslegungen D1–D5.

Nach jeder Scheibe `npx vue-tsc -b`, gezielte Tests, `npx vitest run src/i18n`; am Ende `npm run test:leise`.

## 8. Risiken

- **W1-Verhalten ändert sich** an einer Stelle (A6: Zeilen zu P-Starts werden Vorschlag). Bewusst, weil §8 Vorrang 5 es
  verlangt; die W1-Tests „Pause/P“ zeigen, ob etwas darauf baute.
- **Leistung der Erfassung**: Marken je Bogen einmal rechnen (Map), nicht je Zelle; `schlange()` je Liste einmal.
- **Führungsfenster und Ampel**: ohne Nachziehen von `zuletzt` stimmt die Ampel nur in den anderen Fenstern (§5).
- **Freigabe-Gruppe für schon gekoppelte Handys**: Ohne den Schlüssel bleibt die Leiste dort leer (kein Fehler);
  Test „Bestandsgerät bekommt den Schlüssel“.

## 9. Auslegungen W2 (21.11.2026, bestätigt 21.11.2026) – mit Hintergrund

Der Nutzer hat alle Auslegungen W2 (Fragen W2-01…W2-30: A1–A13, B1–B6, C1–C4, D1–D5, E1–E4) am 21.11.2026 mit
„passt“ bestätigt. A4 gilt in der nach dem Feldtest geänderten Fassung (Warnung AB R, Vorgabe R = 1, „nachfragen“;
WKR_ANNAHMEN N8).

Alle kommen datiert in `WKR_ANNAHMEN` (`src/wkr/annahmen.ts`), Zahlen dort umstellbar.

- **A1 Name des Unterreiters „WKR“** (englisch „Race officials“), nicht „Erfassung“. *Hintergrund:* Der Vorschlag
  sagt „Betrieb → neuer Unterreiter Erfassung“, aber „Erfassung“ ist schon ein Hauptreiter (Abtippen). Zwei Dinge mit
  demselben Namen führen am Wettkampftag zu „wo war das noch?“.
- **A2 Matrix zeigt die letzten 12 gezeigten Starts des laufenden Punkts**, umschaltbar auf alle. *Hintergrund:* Bei
  60 Startern passt kein ganzer Lauf in die Breite; was älter ist und ✓ hat, braucht niemand.
- **A3 Ohne laufenden Punkt „ruht“ jedes Gerät (grau)** statt ✕. *Hintergrund:* Die Geräte schicken nur während eines
  Laufs Lebenszeichen (W1, Kontingent). In der Mittagspause würde sonst nach 5 min jedes Handy rot – ein Fehlalarm,
  den man sich abgewöhnt.
- **A4 Rückstand = offene gezeigte Starts der Liste** (Schlange ohne Vorsteg-Vorschau und „entfällt“), Warnung bei
  mehr als R (Vorgabe 2). Am Steg mit zwei Handys zählt der Teil, der weiter zurück ist. *Hintergrund:* Mit 2–3 Booten
  auf dem Wasser sind für Tor 5 und Anlegen 2 offene Starts normal; erst darüber stimmt etwas nicht. „Pausiert“,
  „abgemeldet“ und „Papier“ zählen nie (F1) – sonst wäre Pausieren sinnlos.
- **A5 „Papier ansehen“** an der Zeile, wenn der Start auf Papier ging (Pause, „Papier ab“, Rest auf Papier), überfällig
  ist oder das Gerät seit über 5 min weg ist; an der Zelle, wenn nur ein Steg-Teil fehlt oder genau dort eine Rückfrage
  steht. Bei „beides“ dieselben Regeln. *Hintergrund:* F4 will sehen, „ab welchem Start der Papierbogen wichtig ist“.
  Ein Start, der gerade erst gezeigt wurde, ist noch nicht verdächtig – sonst wäre fast jede Zeile markiert.
- **A6 Zeilen zu Starts, die schon auf Papier gingen, werden Vorschlag** (nicht still übernommen, nicht verworfen).
  *Hintergrund:* §8 „Papier ab Start … macht die Liste ab dort zum Papier: Gerätezeilen danach werden zu Vorschlägen“
  und §7 „kommt das alte Gerät wieder, gehen seine wartenden Zeilen als Rückfrage ein, nie still“. W1 machte das nur
  für die ganze Liste auf Papier; ein wiederbelebtes Handy hätte sonst still in schon abgetippte Zeilen geschrieben.
- **A7 Überschreiben eines Gerätewerts beim Abtippen fragt einmal je Zelle** (solange sie den Fokus hat).
  *Hintergrund:* Vorrang 3 verlangt die Nachfrage; die Tabelle schreibt aber bei jedem Tastendruck. Ohne „einmal je
  Fokus“ käme die Frage bei jeder Ziffer.
- **A8 „nachfragen“ gilt für jedes Zeigen** (Nächster Start und „Anderen Starter wählen“), „warnen“ nur als Zeile.
  *Hintergrund:* Sonst ließe sich die Nachfrage mit dem anderen Knopf umgehen. Gesperrt wird nie (F4).
- **A9 Auf dem Freigabe-Handy nur Listenname, Ampel, Zahl und Startnummern der offenen Starts**, keine Gerätenamen,
  keine Werte – über eine eigene Gruppe, nicht über die Sicht der Anzeigetafel (§2). *Hintergrund:* „Aus öffentlicher
  Sicht“ lässt sich zweifach lesen; die Tafel-Gruppe würde den Rückstand jedem Tafelgerät zeigen (F17).
- **A10 „Papier ab Start …“ meldet die Liste ab** (Status „abgemeldet“, mit Startnummer im Stand) und schickt dem
  Gerät den Hinweis „Papier ab Nr. x“; „Weiter digital“ gilt ab dem nächsten gezeigten Start. *Hintergrund:* „Ab Start …
  wieder digital“ rückwirkend hieße, dass Starts, die schon vom Bogen abgetippt werden, doch wieder vom Gerät erwartet
  würden – das verwirrt beide Seiten.
- **A11 ⧗ („laut Gerät abgeschickt“) nur als Zahl im Stand** („2 warten im Gerät“), nicht je Zelle. *Hintergrund:* Das
  Lebenszeichen trägt nur die Zahl wartender Zeilen, nicht welche Starts. Je Zelle bräuchte eine Protokolländerung –
  erst, wenn der Feldtest zeigt, dass die Zahl nicht reicht.
- **A12 Getrennte Kontingentanzeige der Erfassung erst mit dem Feldtest.** *Hintergrund:* W1 §8 hatte sie für W2
  angekündigt; sinnvoll ist sie erst mit echten Zahlen vom Wasser, die Gesamtzählung (E8) warnt weiterhin.
- **A13 Gerätezustand: ● unter 90 s, ◐ bis 5 min, ✕ darüber**, wie im Vorschlag §6.1; Akku nur, wo das Gerät ihn meldet.

Beim Bau von Scheibe 4 dazu (21.11.2026, bestätigt 21.11.2026, `WKR_ANNAHMEN` D1–D5):

- **D1 Leiste mit allen Listen des Bereichs**, sobald eine einen Eintrag hat (ohne Eintrag ▭); rot bei ✕ oder „!“.
  *Hintergrund:* Am Steg soll man auf einen Blick sehen, welche Listen vom Bogen kommen – sonst fragt jemand „wo ist
  die MüB?“. Den Rückstand je Steg-Teil (½) zeigt nur die Matrix; auf dem Handy wäre ½ ohne Spalten unverständlich.
- **D2 Rückfragen nur als Zahl und `warnt` in der Freigabe-Sicht**. *Hintergrund:* „!“ braucht keine Startnummer;
  entschieden wird am Bedienrechner. `warnt` rechnet der Host, damit Handy und Bedienrechner dieselbe Grenze R nehmen.
- **D3 Listennamen auf dem Handy in der Sprache der Anzeigetafel** (wie Parcours und Klassen der Start-Freigabe), am
  Bedienrechner in der Sprache der Oberfläche (wie die Matrix).
- **D4 Neuberechnung alle 15 s, gesendet nur bei Änderung**. *Hintergrund:* Ein Gerät, das schweigt, schickt keine
  Nachricht – ohne Takt bliebe es auf dem Handy grün. Ein Bereich ohne digitale Liste kostet keine Nachricht.
- **D5 Nachfrage vor jedem Zeigen, nicht bei „Lauf beginnen“, „Zurück“, Zurückstellen**. *Hintergrund:* Nur das
  Zeigen holt den nächsten Starter aufs Wasser; die anderen Griffe ändern nichts an der Last der WKR.

## 10. Prüfbefunde W2 (21.11.2026) – behoben, Auslegungen E1–E4 bestätigt 21.11.2026

Zwei Prüfer fanden 14 Befunde (zwei davon doppelt), 13 behoben, keiner verworfen; `WKR_ANNAHMEN` E1–E4.

- **E1 Abgetippt zählt als erledigt.** Was der Bediener vom Bogen tippt, setzt den Haken „abgetippt“ nicht (die
  Checkbox sperrt bei Werten). Bisher blieb deshalb ▭ „Papier ansehen“ stehen, bei „beides“ warnte der Rückstand
  dauerhaft und „nachfragen“ fragte vor jedem Start. Jetzt zählen in `wkr/lage.ts` eigene Werte der Liste wie der
  Haken (wie `zeileErfasst`); am Steg je Teil nur dessen Felder, gemeinsame (Disq., Bemerkung) nicht. *Hintergrund:*
  Die Schlange der Geräte bleibt beim Haken – tippt der Bediener in einer offenen Zeile etwa eine Disq. nach einem
  Protest, soll der WKR seine Zeile trotzdem noch schicken können; was dann kommt, prüft die Übernahme gegen `vorher`.
- **E2 ◆ auch nach „Gerät übernehmen“ und „Übernehmen“ (Vorschlag).** Gerade die strittigen Werte zeigten kein ◆,
  und beim Überschreiben fehlte die Nachfrage. Jetzt schreibt der Eingang die Herkunft (`host.merkeEntscheid`), nur wo
  danach der Gerätewert steht.
- **E3 Hinweise je Steg-Teil, richtige Nummer im Parallelslalom, Wahl „Papier ab“ bleibt.** „Papier ab“ und
  „Weiter“ des Ablegens gingen auch ans Handy des Anlegens (F16 verletzt); die Liste von Racecourse B bekam die
  Startnummer der Seite A; die Auswahl sprang beim nächsten gezeigten Start unbemerkt auf den neuesten. *Hintergrund:*
  Ein „Papier ab 15“ auf dem falschen Handy kann einen WKR zum Aufhören bewegen, der weiter erfassen soll.
- **E4 Nachfrage beim Überschreiben eines Gerätewerts.** Bei Zeitfeldern speicherte „Ersetzen“ den ersten
  Tastendruck als ganze Zeit („1“ statt „1:23,45“). Jetzt schreibt „Ersetzen“ dort nichts, gibt frei und den Fokus
  zurück; die ganze Zeit wird neu getippt. Die Freigabe gilt nur für den Gerätewert, nach dem gefragt wurde – ein
  neuer Gerätewert fragt wieder. Rückfragen zu nicht gezeigten Starts (Grund `start`) zeigen in der Erfassung „!“.
- Ohne eigene Auslegung behoben: Stilklassen der Matrix kollidierten mit der WKR-Einteilung (`.wkr-mtabelle`,
  `.wkr-mzelle`, `.wkr-warnt-text`; Rand der Start-Freigabe `.betrieb-naechster--rueckstand`); der 15-s-Takt der
  Freigabe-Sicht sendet nach „Raum beenden“ nichts mehr; englisch „attempt“ statt „heat“ für den Lauf und „in the
  boat“; Kommentar von PARALLEL_ANORDNUNGEN wieder an seinem Platz. Tests: lage.test.ts, freigabe.test.ts (Rückstand
  ohne abgetippten Start), BetriebWkr.test.ts (Steg-Teile, Parallelslalom B, Wahl bleibt, ◆ nach Entscheid),
  ErfassungWkr.test.ts (▭ verschwindet, „!“ bei `start`, Zeitfeld), host.test.ts, wkr.test.ts (Hinweis je Teil).
