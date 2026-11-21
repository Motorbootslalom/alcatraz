# src/betrieb – Betrieb am Wettkampftag (Anzeigetafel, Start-Freigabe)

Rein, ohne DOM und Store. Plan zur Übernahme der Tafel vom 16.11.2026 (Etappen E1–E8); E1 = Anzeigetafel im
zweiten Fenster und Start-Freigabe am Bedienrechner, nur Manövrieren, ohne Netz; E2 = Steuerung an der Start-Freigabe
(gezielt zeigen, zurückstellen/einreihen, Klasse aussetzen/vorziehen, verschieben, einsteigen); E3 = Startabstände,
Prognose („ca. in“, „Zeit bis zum Vorsteg“), Startliste im Betrieb, Zuschauerliste lokal; E4 = Parallelslalom (nur
UIM: Bereich `parallel`, Runden als Punkte, Paare A/B, ohne Prognose, ohne Umstellen). Begriffe:
„Anzeigetafel“ (Code `anzeige`), „Start-Freigabe“; „Tafel“ ist das Aushangbrett. Englisch vorläufig: display board,
start release.

## Dateien

- `annahmen.ts` – BETRIEB_ANNAHMEN: alle Auslegungen mit Datum, an EINER Stelle (Muster PARALLEL_ANNAHMEN).
- `folge.ts` – Kennungen (refKey/liesRef, istPunktId, laufPunkt), bereicheZumStand (alle bzw. `{anzeige:true}`),
  programm (lauf:1..n; „nacheinander“ nur lauf:1), abgeleiteteFolge (Verzahnung, Entfallene mit `entfaellt`),
  startfolge (= abgeleitet + Schnappschuss), spurenVon (Spur-Anordnung), lage (aktuell, vorig, Zeiger, offen, frei,
  nachzuholen, zurueckgestellt, bootFehlt, naechster, naechsterPunkt, arbeitsPunkt, abgeleitet, erledigt …).
  E4 Parallel: PARALLEL_BEREICH/istParallel, rundenPunkt/rundeVonPunkt, programm = festeRunden (vergleicheRunden),
  parallelFolge (Ref aus `fest.starts[i].a/b`, FolgeEintrag.paar mit aFaehrt/bFaehrt, entfällt = beide leer),
  bereichFest (eine Runde festgeschrieben), bereicheZumStand (UIM: dahinter; Tafel automatisch erst ab begonnener Runde).
- `schritte.ts` (E2) – rein auf der Folge (Vorbild TF lib/startlist.ts, neu geschrieben): bloecke/bloeckeIn (je
  Stelle der Lauf-Block; Gäste = Starts in einem fremden Block), abgleich (Schnappschuss über die abgeleitete Folge,
  Neues in den Block seines Punkts), schnappschuss (`null` = keine Abweichung; nur umgestellte Punkte), zeigerIn,
  hinterDenZeiger (auch mehrere), ansPunktende (Blockende), zielStelle/verschiebe (Spur rutscht nur im Block mit,
  V-7), webeNeu (reinterleave je Block und je Starter: Klasse aussetzen/zurück, startTrack),
  klassenNachNaechstemStart/klasseAllein/klasseVor (B-10), ersterStart/einsteigen (AB). Liefern Kennungen; den
  Stand macht state/reducer/betrieb.ts. E4: paarStarts (beide Attempts eines Paares einer Runde), ansPunktende
  nimmt auch mehrere Kennungen; im Parallelslalom gehen hinterDenZeiger/ansPunktende je Runde; planPartner.
- `meldungen.ts` (E2) – MELDUNGS_VORLAGEN (Gruppe, Kennung, Art), vorlagenText (Tafel-Sprache, `{veranstaltung}`),
  vorlagenTitel/gruppenTitel (Schlüssel für t()), vorlagenMeldung(sicht, vorlage). Texte: i18n `meldung.vorlage.*`.
- `sicht.ts` – sichtOeffentlich(stand, {logos}) → OeffentlicheSicht: die EINE Stelle für den Datenschutz-Zuschnitt;
  sichtZuschauer(sicht) → ZuschauerSicht (E3): daraus abgeleitet, schmaler (Im Boot, `frei`, „Boot fehlt“, Meldung).
  E4: SichtStart.paar {attempt, a, b} – leere Seite `null` ohne Grund; `starter` = erste Seite, die fährt; titel
  „Preliminary heat · Attempt 1“, „Small final · Attempt 1“; Bereichsname anzeige.parallel. sv 6 (21.11.2026): `finale`
  entfällt, das Kleine Finale ist eine eigene Runde.
  sv 5 (16.11.2026): `einst.parallelAnordnung` (Lage von A und B, `anzeige.parallelAnordnung`) – nur, wenn die Sicht
  den Bereich `parallel` hat (unter DM nicht einmal der Schlüssel); nicht in der Zuschauersicht.
- `prognose.ts` (E3, Vorbild TF lib/timing.ts) – Messung auf dem Stand: messungenIn/messungen (Abstand gehört dem
  vorigen Start; 30–300 s; nicht über „ohne Anzeige“, nicht über eine Punktgrenze, nicht bei X), klassenMessungen,
  genugGemessen (ab 3),
  startabstandImBetrieb (Mittel oder config/catalog.ts startabstandOf), startabstandZeilen (Einstellungen),
  messwerteAlsVorgabe (→ SET_ANZEIGE {abstaende}). Auf dem Bildschirm: freieFolge, wartezeiten(sicht, bereich,
  jetzt) → Map key → {art:'zeit', stelle, bisStart, bisVorsteg, steg} | {art:'angehalten', stelle, steg} (Pause/
  Störung auf der Tafel, bereichAngehalten) | bootFehlt | spaeter | ohne; seitSekunden, wartezeitAnzeige, mmss.
- Typen: types/betrieb.ts. Actions und Normalisierer: state/reducer/betrieb.ts. Nur-Lese-Store: state/leseStore.ts.
- Oberfläche (liest nur die Sicht): components/anzeige/ (AnzeigeTafel, AnzeigeBereich; styles/anzeige.css, lib/fit.ts),
  components/betrieb/ (StartFreigabe; E2: BetriebsFolge, EinreihenListe, KlassenAussetzen, MeldungWahl, EinsteigenAb;
  E3: StartListe; texte.ts mit ganzeFolge, verschiebeZiele, wartezeitText; E6: GeraeteRaum, LeseLink, GeraeteLage,
  fingerabdruckText), views/BetriebView.vue (Unterreiter `start`, `startliste`, E6 `geraete`), src/AnzeigeApp.vue,
  E6 src/GeraetApp.vue (Gerät mit Lese-Link: dieselbe AnzeigeTafel/ZuschauerListe aus der empfangenen Sicht; Logik
  src/geraete/, eigene Karte), E3: src/ZuschauerApp.vue + components/zuschauer/ZuschauerListe.vue
  (styles/zuschauer.css), lib/anzeigeFenster.ts (oeffneAnzeige/oeffneZuschauer, postMessage-Rückfall), lib/uhr.ts
  (useUhr: Takt des Bildschirms). Einstellungen: SettingsView `#anzeigetafel`, `#betrieb` (Startfolge:
  `verzahnungHalten`; E3: `amSteg`/`vorSteg`, Startabstände je Klasse, „Messwerte als Vorgabe übernehmen“).

## Abläufe

- Stand → lage(stand, bereich) → sichtOeffentlich → Anzeigetafel/Start-Freigabe (lesen nur die Sicht, schicken Actions).
- „Nächster Start“: BETRIEB_ZEIGEN {bereich, ref: sicht.offen[0].key, vorher: sicht.aktuell?.key ?? null}.
  „Anderen Starter wählen“ (BetriebsFolge): dieselbe Action mit einem Start aus `sicht.waehlbar` (die nächsten 12,
  ganze Folge mit „Boot fehlt“ am Punktende, Suche auch über zurueckgestellt/nachzuholen).
- Start-Freigabe → Action: „Zurückstellen“ = ZURUECKSTELLEN {ref: offen[0]}; Einreihen-Knöpfe = EINREIHEN; Menü
  „Verschieben …“ = VERSCHIEBEN {vor: offen[0]} (vorziehen), {nachPunkt: eigener} (ans Ende), {vor|nachPunkt} (Lauf n,
  aus `sicht.programm`); „Boot fehlt“ = AUSSETZEN; „Vorziehen“ einer Klasse = KLASSE_VOR {vor: erste fahrende};
  „Einsteigen ab …“ = AB {ref aus sicht.einstieg}; Vorlagen füllen nur den Entwurf, dann BETRIEB_MELDUNG.
- E2-Schritte (alle bedingt/idempotent, nur festgeschrieben): ZURUECKSTELLEN {ref}, EINREIHEN {ref, wo}, AUSSETZEN
  {klasse, an}, VORZIEHEN {an}, KLASSE_VOR {klasse, vor}, VERSCHIEBEN {ref, ziel: VerschiebeZiel}, AB {ref aus
  sicht.einstieg}. Umstellungen → lage → schritte.ts → neue Kennungsfolge → `reihenfolge` (Schnappschuss) oder null.
  Ohne Festschreiben sperrt die Start-Freigabe all das (`bereich.fest`); Zurück und Meldung gehen immer.
- Zweites Fenster: main.ts liest `#/anzeige[/<bereich>]` (lib/router.ts vollbild) VOR jedem Store → AnzeigeApp mit
  createLeseStore() → storage-Ereignis → lies() → Sicht nach JSON verglichen (shallowRef) → AnzeigeTafel. Rückfall:
  Bedienfenster stößt per postMessage an (verbindeAnzeigen in main.ts), die Tafel meldet sich beim opener.
  Zuschauerliste (E3) genauso: `#/zuschauer[/<bereich>]` (en `#/spectators`) → ZuschauerApp → sichtZuschauer(sicht…
  {logos:false}) nach JSON verglichen → ZuschauerListe(sicht, jetzt aus useUhr(5000)); Klassenfilter merke
  `zuschauer.klasse` (ueberNeuladen, sessionStorage), nur Klassen der gezeigten Bereiche (`#/zuschauer/<bereich>`).
- Startliste (E3): BetriebView `startliste` → je Bereich StartListe(sicht, bereich, jetzt aus useUhr(1000)) →
  wartezeiten() je Render. Ziehen auf einen offenen Start = BETRIEB_VERSCHIEBEN {vor} (nach oben) bzw. {nach} (nach
  unten), dazu das Menü „Verschieben …“ (verschiebeZiele, wie BetriebsFolge) – BETRIEB_ANNAHMEN.ziehenInDerStartliste.
- Parallelslalom (E4): BETRIEB_BEGINNEN {punkt: `runde:<runde>`}, ZEIGEN/ZURUECK/MELDUNG/AB wie sonst. ZURUECKSTELLEN
  nimmt die offenen Attempts des Paares mit, EINREIHEN und gezieltes ZEIGEN eines zurückgestellten holen die wartenden
  in Attempt-Folge mit (paarStarts). AUSSETZEN, VORZIEHEN, KLASSE_VOR, VERSCHIEBEN ändern dort nichts (umstellenErlaubt);
  die Start-Freigabe zeigt `data-hinweis="parallel"` statt KlassenAussetzen, kein „Verschieben …“, kein Ziehen.
- Startabstände (SettingsView `#betrieb`): startabstandZeilen (Vorgabe, eigen, gemessen, wirksam, quelle); Eingabe →
  SET_ANZEIGE {abstaende} nur mit Abweichungen (gleich Vorgabe/leer = weg, in Klassenfolge); Knopf =
  messwerteAlsVorgabe.

## Fallen

- Die Folge wird nie gespeichert: Gezeigtes hängt an Kennungen (Starter + Lauf), nicht an Stellen. Ein gezeigter
  Start kann aus der Folge fallen (Lauf entfällt, Starter gelöscht) – `aktuell.eintrag` ist dann `null`. Die Sicht
  trägt ihn trotzdem (`aktuell.key`, ohne Eintrag in `starter`): Sonst passte `vorher` nie und „Nächster Start“ hinge.
- Entfallen heißt allein: ein X in einer Disq-Zelle des Laufs, Steg oder Vorsteg (lib/erfassung.ts nichtGestartet,
  dieselbe Frage wie die Wertung); `abgemeldet` filtert nicht.
- „Nachzuholen“ = überholt: Punkt begonnen und dahinter ein Erledigtes seines oder eines späteren begonnenen Punkts
  (Parallelslalom: nur seiner Runde)
  (ohne Umstellung = vor dem Zeiger); nie von selbst der Nächste. Starts nicht begonnener Punkte warten, auch vor dem
  Zeiger (`nichtBegonneneWarten`, S-9). Den Zeiger schiebt nur Erledigtes begonnener Punkte (`zeigerNurBegonnene`).
- Einteilung in lage: zurückgestellt vor „Boot fehlt“ (Klasse ausgesetzt, gleich wo) vor nachzuholen vor offen.
- Schnappschuss nur bei Abweichung und nur der umgestellten Punkte (`schnappschuss` lässt weg, was der Abgleich genau
  so zurücklegt – geprüft durch Nachrechnen): Unberührte Läufe folgen einer später geänderten Verzahnung, umgestellte
  nicht – `sicht.abweichend` zeigt das an. Verzahnung und WKR-Bögen ändert der Betrieb nie.
- Blöcke (`bloecke`): je Punkt einer, in der Folge des Programms, mit möglichst vielen eigenen Starts; Gleichstand =
  der frühere (ein Gast an der Grenze gehört zum Block davor). Ein Start eines späteren Laufs genau an der Grenze ist
  der erste seines eigenen Blocks (BETRIEB_ANNAHMEN.bloeckeJePunkt).
- Neu weben (webeNeu) fasst je Punkt nur Offenes IM EIGENEN BLOCK hinter dem Zeiger an (nicht begonnener Punkt: der
  ganze Block); Gäste und Hinausgesetzte bleiben stehen. Gewoben wird je Starter (Versuche nacheinander bleiben
  beisammen; ein angefangener Starter fährt zu Ende); ausgesetzte Klassen ans Ende; mit Pausen nur, wenn im Block noch
  nichts erledigt ist. Boot zurück im stockenden Lauf: die Vorbeigezogenen hinter den Zeiger. Spätere Punkte bleiben.
- Verschieben mit „Verzahnung halten“: Spur rutscht nur innerhalb des Blocks; über eine Laufgrenze genau ans Ziel.
- arbeitsPunkt = der laufende, solange dort Starts frei sind oder ihr Boot fehlt (nicht der Punkt eines eingereihten
  Nachzüglers). Leere Bereiche entfallen im Stand (mitBereich), unbekannte Bereiche ändern nichts (schrittErlaubt).
- Sicht: nie Geburtsdatum, Gewicht, Geschlecht, Werte, Abmeldungen; nur vorkommende Starter. Neue Felder → sicht.test.ts
  (Schlüssel-Durchlauf) und `sv` hochzählen, wenn sich die Form ändert (sv 2 = E2, mit `programm`; sv 3 = E3, mit
  `abstaende` und `einst.amSteg/vorSteg`; sv 4 = E4, `SichtStart.paar`, Bereich `parallel`; sv 5 =
  `einst.parallelAnordnung`). Zeitunabhängig (K28): „seit“ und Wartezeiten rechnet der Bildschirm mit
  `jetzt + versatz` (prognose.ts), nie Reducer oder Sicht; `abstaende` ändert sich nur mit Gezeigtem/Einstellungen.
  Zuschauersicht: genaue Schlüssel im Test, auch verschachtelt (Start, Starter, Herkunft, Punkt, Meldung, Klasse) –
  sichtZuschauer baut jedes Objekt Feld für Feld neu, nie als Referenz; ein neues Feld dort ist eine bewusste
  Entscheidung (öffentlicher Link).
  Die offene Folge der begonnenen Punkte steht in der öffentlichen Sicht nicht doppelt: freieFolge = `waehlbar` mit
  begonnenem Punkt; die Zuschauersicht trägt sie als `frei`. `waehlbar` trägt alle offenen Starts aller Punkte –
  damit stehen fast alle Starter in `starter`. „Lauf stockt“ (nichts frei, aber zurückgestellt/„Boot fehlt“/nachzuholen in begonnenen Punkten) rechnet
  die Start-Freigabe aus der Sicht – der Lauf ist dann nicht zu Ende.
- planEvent wird je Planungsstand einmal gerechnet (WeakMap über parcoursList → starters, dazu boats/class4Small in
  folge.ts) – Stände nie verändern, immer neu anlegen.
- Texte der Tafel in deren Sprache (tIn(sicht.sprache), Bogentexte in der Sicht); Bedienung in der Oberflächensprache.
  Start-Freigabe zeigt Namen nach der öffentlichen Einstellung (`namen: 'ohne'` ⇒ auch dort keine).
- Schreib-Spione in Tests an der Instanz (`vi.spyOn(localStorage, 'setItem')`): localStorage ist dort eine eigene
  Klasse (test-setup.ts), ein Spion an Storage.prototype sieht nichts. Echter Start mit `#/anzeige`: src/main.test.ts.
- AnzeigeApp vergleicht die Sicht nach Inhalt – ohne `veranstaltung` (nur für die Vorlagen der Start-Freigabe): Ein
  neues Feld, das sich bei jeder Eingabe ändert, zeichnete die Tafel bei jedem Tastendruck neu (AnzeigeApp.test.ts
  „zwei Fenster“ fängt das, auch das Tippen des Namens bei eigener Kopfzeile).
- Uhr nur im Bildschirm (lib/uhr.ts useUhr): StartListe/ZuschauerListe bekommen `jetzt` als Prop (ab E6: Zeit des
  Hosts = eigene Uhr + Versatz), nie Store oder Sicht. BetriebView liest `jetzt` nur im Zweig der Startliste – sonst
  zeichnete die Start-Freigabe jede Sekunde neu. Die Zuschauerliste trägt keine Bedienangaben: Was sie zeigen soll,
  muss erst in sichtZuschauer (bewusste Entscheidung, Schlüssel-Test).
- Parallel (E4): Die Kennung eines Paares kommt aus `fest.starts` (Kritik K8) – nie aus loeseAuf/plan.heats (ein
  gelöschter Starter würde dort zum Dummy, die Kennung änderte sich, der Start käme wieder). Eine Seite ist leer bei
  Dummy, gelöschtem Starter oder X im Attempt (felderJeKennung mit parallelListen); entfällt nur, wenn beide leer sind.
  Runden je Klasse für sich (BETRIEB_ANNAHMEN.parallelRundenFuerSich, Prüfung E4): überholt nur Erledigtes DERSELBEN
  Runde; hinterDenZeiger/ansPunktende rechnen dort ab dem letzten Erledigten der eigenen Runde (nicht dem Zeiger, der
  in einer späteren Runde stehen kann); `laufend` = Runde des Nächsten, sonst des Starts im Boot, sonst zuletzt
  begonnen (`b.begonnen` in Folge des Beginnens). Ein Paar im Boot fährt vor einer ANDEREN Runde zu Ende
  (parallelPaarZuEnde: lage rückt seinen Attempt in `offen` vor). Gezieltes ZEIGEN holt den im Plan direkt folgenden
  Attempt mit (schritte.ts planPartner – nur nach dem Vorlauf; dort wechseln zwischen den Attempts die Bootstypen).
  Zuschauersicht: Kennung eines Paares nur aus `paar.a/b` (verrät keine leere Seite); die öffentliche trägt die IDs laut Plan.
  Das Kleine Finale ist seit 21.11.2026 ein eigener Punkt `runde:small` vor `runde:final` (eigener Plan; „Finale
  beginnen“ danach von Hand, BETRIEB_ANNAHMEN.parallelRundenAlsPunkte). Parallel misst nicht und hat keine Zahl
  (wartezeiten: `angehalten` mit Steg). Unter DM gibt es den Bereich nicht (bereichBekannt → hasParallel) – auch keine
  Texte; die `….runde`-Texte holt components/betrieb/texte.ts tBereich nur für `art: 'parallel'`.
- `einstieg` trägt Starts der Sicht (mit Starter, ohne Entfallene): „Weiter mit“ nennt auch einen schon „ohne Anzeige“
  erledigten. BETRIEB_AB setzt den gewählten Start und das mit ihm wieder Offene hinter den Zeiger, wenn danach schon
  gezeigt wurde – sonst überholte ihn das Gezeigte.

## Tests

`npx vitest run src/betrieb src/state/betrieb src/state/leseStore src/components/anzeige src/AnzeigeApp src/ZuschauerApp
src/main src/views/Betrieb src/lib/anzeigeFenster src/lib/fit src/planung/verzahnung`; E4 dazu src/views/SettingsView. Hilfen: testHilfen.ts betriebsStand,
festgeschrieben, zeigeNaechsten – nimmt `ref`/`vorher` aus der Sicht wie die Start-Freigabe; Starter e1/k1/e2/k2 auf
Parcours 1, v1/f1/v2 auf Parcours 2. E2: betrieb/schritte.test.ts mit eigener Hilfe `stand({E: 2, '1': 6 …}, {spuren,
laeufe})` (V-5-Beispiel, S-4/S-9, B-10, AB, Abgleich, WKR-Bögen unverändert). E3: betrieb/prognose.test.ts
(`laufend(lücken)` wie TF `running`, je fünf Starter E/1), Zuschauersicht in sicht.test.ts, startabstaende in
config/validate.test.ts und catalog.test.ts. Oberfläche E2: views/Betrieb.test.ts (`klassenStand`, `v5`; Abnahme:
außer `betrieb` ändert sich nichts). Oberfläche E3: views/Betrieb.test.ts „Startliste (E3)“ (Uhr per
vi.useFakeTimers({toFake: ['Date','setInterval','clearInterval']}); Ziehen per trigger dragstart/dragover/drop, Ergebnis
gleich reducer(BETRIEB_VERSCHIEBEN)), src/ZuschauerApp.test.ts (Gruppen, Wartezeiten, Datenschutz im HTML, Filter),
src/main.zuschauer.test.ts (echter Start `#/spectators`, schreibt nichts). Einstellungen: views/SettingsView.test.ts.
E4 (Parallel): betrieb/parallel.test.ts (Programm, Re-run nach gezeigtem Halbfinal-Start, Klassen in verschiedenen
Runden, K7/K8: gelöschter Starter, abgemeldete Seite im Halbfinale, Dummy gegen X, Kleines Finale vor Finale; Zuschauer-Kennung; Schritte: Paar als Einheit, Gesperrtes, Einsteigen; Sicht/Zuschauersicht feldweise; keine
Prognose; automatische Tafel), components/anzeige/AnzeigeParallel.test.ts (englische Tafel wie UimAushang: keine
deutschen Wörter; Spezifität der Seiten-Regeln gegen „gestapelt“ am CSS-Text – happy-dom rechnet kein CSS), views/Betrieb.test.ts „Parallelslalom (E4)“, ZuschauerApp.test.ts (Paar-Karten), SettingsView.test.ts
(Auswahl der Tafel, Lage von A und B nur unter UIM). Lage A/B (16.11.2026): AnzeigeParallel.test.ts „Lage von
Racecourse A und B“ (vier Varianten, Folge im DOM, `data-lage`, `untereinander`/`flach`, hochkant per
`happyDOM.setViewport`), sicht.test.ts „Fassung 5“. Hilfen: testHilfen.ts parallelStarter (`<klasse>-<n>`),
uimParallelStand (UIM, festgeschrieben: Dolphin 3, Klasse 1 6), fahreRunde.
