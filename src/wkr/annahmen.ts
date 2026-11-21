// Auslegungen der digitalen WKR-Erfassung (Etappe W1) – an EINER Stelle, nach dem Muster von BETRIEB_ANNAHMEN und
// PARALLEL_ANNAHMEN. Grundlage: docs/vorschlag-wkr-erfassung.md (§12, Antworten des Nutzers vom 21.11.2026 auf F1–F17)
// und docs/plan-wkr-w1.md §9. Was mit „noch zu bestätigen“ markiert ist, hat der Nutzer noch nicht gesehen. Die
// Werte, die der Code liest, sind hier umstellbar; die übrigen Einträge halten fest, wie der Code gebaut ist.

import type { ListenTeil } from '../lib/eingaben'

/** Die Spalten (Spalten-Keys des Bogens, `Feld.zelle`) eines Teils einer Liste. */
export interface ListenTeile {
  ab: readonly string[]
  an: readonly string[]
  /** Spalten, die beide Teile beschreiben: Disq.-Buchstaben werden vereinigt, Bemerkungen angehängt. */
  gemeinsam: readonly string[]
}

export const WKR_ANNAHMEN = {
  /**
   * (Plan §9.1) Übernahmeregel: Ein Wert vom Gerät wird übernommen, wenn der Stand gleich `vorher` (das, was das
   * Gerät dort erwartet; beim ersten Mal leer) oder gleich dem neuen Wert ist. Sonst bleibt der Stand und es entsteht
   * eine Rückfrage – nie still überschrieben. Hat der Bediener eine vom Gerät gesetzte Zelle geleert, ist das eine
   * Rückfrage, keine leere Zelle. 21.11.2026, noch zu bestätigen.
   */
  uebernahmeNurVorher: true,
  /**
   * (Plan §9.3) Zeilen zu nicht gezeigten Starts (auch die ohne Netz geschätzten) werden ganz zur Rückfrage (Grund
   * `start`), nie still übernommen. Ausnahme: der Vorsteg sieht die nächsten freien Starts schon vor dem Zeigen
   * (Vorschlag §2). 21.11.2026, noch zu bestätigen.
   */
  nichtGezeigtRueckfrage: true,
  /**
   * (Plan §9.4, F16) Steg in zwei Teilen: Ablegen und Anlegen schicken getrennt, je mit Teilhaken
   * (`erfasst.ab@steg`, `erfasst.an@steg`); beide zusammen setzen `erfasst@steg`. Die Teile sind die Spalten
   * `fehlerAB`/`fehlerAN` (Spalten-Keys aus config/aufbauten/gemeinsam.yaml, die Feld-Kennungen sind die Kataloge);
   * Disq. und Bemerkung gehören beiden (Disq. vereinigt, Bemerkung mit „; “ angehängt, nie ersetzt). Die
   * Anlegen-Schlange sind alle gezeigten Starts ohne Anlegen-Haken, auch wenn das Ablegen auf Papier ist.
   * 21.11.2026, noch zu bestätigen.
   */
  teile: { steg: { ab: ['fehlerAB'], an: ['fehlerAN'], gemeinsam: ['disq', 'bemerkung'] } } as Readonly<Record<string, ListenTeile>>,
  /**
   * (F5, 21.11.2026 bestätigt) Ein X „nicht gestartet“ vom Gerät nur am Steg (Teil Ablegen – ein Gerät für den
   * ganzen Steg darf es auch, nur nicht in der Spalte des Anlegens) und am Vorsteg. Sonst lehnt der Bedienrechner die
   * Zeile ab (`x-nicht-erlaubt`).
   */
  xListen: ['steg', 'vorsteg'] as readonly string[],
  /** Der Teil, in dem am Steg das X erlaubt ist (F5). */
  xTeil: 'ab' as ListenTeil,
  /**
   * (Plan §9.5, F1) Pausieren und Abmelden gelten für die Liste, nicht für ein Gerät. P („Papier“) = die Starts,
   * die beim Pausieren offen waren, und alle, die während der Pause gezeigt wurden. 21.11.2026, noch zu bestätigen.
   */
  pauseJeListe: true,
  /**
   * (Plan §9.5 mit F16, Prüfbefund 21.11.2026) Am Steg mit Teil-Kopplung pausiert bzw. meldet ein Teil-Gerät nur
   * SEINEN Teil ab (WkrListe.teile): Das andere Handy erfasst weiter, P gilt nur für diesen Teil. Ein Gerät für den
   * ganzen Steg und der Bedienrechner wirken auf die ganze Liste. Sonst wartete die Freigabe auf einen Teil, der
   * längst auf Papier ist – gegen F1. 21.11.2026, noch zu bestätigen.
   */
  pauseJeTeil: true,
  /**
   * (Plan §9.6) Modus: Eine Liste ohne Eintrag ist Papier; das erste „digital“ (oder „beides“) setzt `seit`. Die
   * Schlange beginnt erst dort – ältere Starts tippt man vom Bogen ab. Ein Wechsel von Papier zurück auf digital
   * setzt `seit` neu. Zeilen einer Liste auf Papier (oder ohne Eintrag) werden Vorschläge. 21.11.2026, noch zu
   * bestätigen.
   */
  ohneEintragPapier: true,
  /**
   * (Plan §9.7, F7, F8) Abschluss je Liste und Punkt (Lauf bzw. Runde), mit Namen des Wettkampfrichters – die
   * digitale Unterschrift. Er wird angenommen, wenn nichts mehr offen ist oder „Rest auf Papier“ gewählt ist; sonst
   * ändert er nichts. Weicht die geprüfte Fassung des Geräts vom Stand ab, wird das je Start vermerkt (W2 zeigt es),
   * ohne Sperre. Danach werden Korrekturen vom Gerät zu Vorschlägen. 21.11.2026, noch zu bestätigen.
   * Prüfbefunde 21.11.2026: Am Steg je Teil (eigener Eintrag `punkt|ab`/`punkt|an`, wkr/abschluss.ts) – der Abschluss
   * des Ablegens macht Zeilen des Anlegens nicht zu Vorschlägen und überschreibt nie dessen Unterschrift; die ganze
   * Liste gilt mit beiden Teilen als abgeschlossen. Nur für einen Punkt, der im Bereich begonnen hat. Starts, die mit
   * „Rest auf Papier“ aufs Papier gingen, und der abgeschlossene Punkt fehlen danach in der Schlange.
   */
  abschlussJePunkt: true,
  /**
   * (F11, Prüfbefund 21.11.2026) Die Sicht der Liste ist EIN Inhalt der Listen-Gruppe: `steht` einer Rückfrage,
   * Ablehnungen und Hinweise sieht jedes Gerät DERSELBEN Liste (am Steg auch das des anderen Teils), nie ein Gerät
   * einer anderen Liste oder der Tafel. Es sind dieselben Wettkampfrichter derselben Liste; eine eigene Nachricht je
   * Gerät (d-Thema) kostete Kontingent. 21.11.2026, noch zu bestätigen.
   */
  rueckfrageInListe: true,
  /**
   * Listen, die die nächsten Starts schon vor dem Zeigen sehen (Vorschlag §2: „Vorsteg sieht die nächsten Starts schon
   * vor dem Zeigen“): so viele freie, wie die Zuschauerliste am und vor dem Steg zählt (`anzeige.amSteg + vorSteg`).
   * Ihre Zeilen gelten als gezeigt. 21.11.2026.
   */
  vorabListen: ['vorsteg'] as readonly string[],
  /**
   * Ein Start, dessen Klasse die Liste nicht hat (MüB erst ab Klasse 4), steht in der Schlange grau als „entfällt“
   * – nur solange er der zuletzt gezeigte Start des Bereichs ist; mit dem nächsten Start schließt er sich von
   * selbst (Vorschlag §2). Beim Bau von W1.1, 21.11.2026, noch zu bestätigen.
   */
  entfaelltNurAktuell: true,
  /**
   * (Plan §9.9) Knoten und andere Listen ohne Lauf erst mit W5: W1 kennt nur Listen mit Lauf
   * (wkr/liste.ts `listenDerVeranstaltung`).
   */
  listenOhneLaufErstW5: true,
  /**
   * Vorsteg mit „Versuche direkt nacheinander“: Die Zeile gilt für jeden Versuch – wie in der Erfassungstabelle
   * (lib/erfassung.ts `zeilenSchluesselAlle`). Geprüft wird gegen den ersten Versuch, geschrieben in alle.
   */
  vorstegAlleVersuche: true,
  /** (Plan §9.11) Zahlen: Bündel ≤ 8 Zeilen, Schlange ≤ 12, „danach“ ≤ 5, „zuletzt“ ≤ 20 Zeilen je Gerät. */
  buendel: 8,
  schlange: 12,
  danach: 5,
  zuletzt: 20,
  /** (Plan §9.11) Lebenszeichen nach so vielen Sekunden Stille (nur mit Liste und laufendem Punkt). */
  lebenszeichenSek: 60,
  /** Höchstlänge eines Textwerts vom Gerät (Bemerkung), wie in der Erfassungstabelle getrimmt. */
  textMax: 200,
  /** Höchstlänge des Namens beim Abschluss (Plan §5). */
  nameMax: 60,
  /** (Plan §6, F7) Modus beim ersten Koppeln einer Liste – nur wenn sie noch keinen Eintrag hat. */
  modusBeimKoppeln: 'digital',

  // --- W2 Bedienrechner (docs/plan-wkr-w2.md §9, 21.11.2026, alle noch zu bestätigen) ----------------------------
  /**
   * (A1) Der Unterreiter im Betrieb heißt „WKR“ (englisch „Race officials“), nicht „Erfassung“ – das ist schon der
   * Hauptreiter zum Abtippen; zwei Dinge mit demselben Namen führen am Wettkampftag zu „wo war das noch?“.
   */
  unterreiterWkr: true,
  /**
   * (A2) Die Matrix zeigt die letzten `matrixStarts` gezeigten Starts des laufenden Punkts, umschaltbar auf alle des
   * Punkts – bei 60 Startern passt kein ganzer Lauf in die Breite, und was älter ist und ✓ hat, braucht niemand.
   */
  matrixStarts: 12,
  /**
   * (A3) Läuft im Bereich kein Punkt, „ruht“ jedes Gerät (grau) statt ✕: Die Geräte schicken nur während eines Laufs
   * Lebenszeichen (W1, Kontingent); in der Mittagspause würde sonst nach 5 min jedes Handy rot – ein Fehlalarm.
   */
  ruhtOhnePunkt: true,
  /**
   * (A4, F4) Rückstand = offene gezeigte Starts der Liste (Schlange ohne Vorsteg-Vorschau und „entfällt“); gewarnt wird
   * bei MEHR als R (`anzeige.wkrRueckstand`, Vorgabe `rueckstandVorgabe`). Am Steg mit Teil-Geräten zählt der Teil, der
   * weiter zurück ist. Pausiert, abgemeldet und Papier zählen nie (F1) – sonst wäre Pausieren sinnlos. Mit 2–3 Booten
   * auf dem Wasser sind 2 offene Starts für Tor 5 und Anlegen normal.
   */
  rueckstandVorgabe: 2,
  /** Grenzen von R in der Einstellung (SettingsView `#betrieb`). */
  rueckstandMin: 1,
  rueckstandMax: 20,
  /**
   * (A5, F4) „Papier ansehen“ an der Zeile in der Erfassung, wenn der Start auf Papier ging (Pause, „Papier ab“, Rest
   * auf Papier, vor `seit`), überfällig ist (mehr als R jüngere gezeigte Starts derselben Liste dahinter) oder offen,
   * während jedes Gerät der Liste `weg` ist; an der Zelle, wenn nur ein Steg-Teil fehlt (dessen Spalten) oder genau
   * dort eine Rückfrage steht. „Beides“ wie digital; eine Liste ohne Eintrag oder auf Papier bekommt keine Marken (dort
   * ist der Bogen ohnehin die Quelle). Ein gerade erst gezeigter Start ist noch nicht verdächtig.
   * Beim Bau 21.11.2026 dazu: Ist kein Gerät der Liste bekannt (Raum zu, Bedienfenster ohne Register), zählt „offen“
   * nicht als „weg“ – ohne Angaben lässt sich nicht urteilen, sonst wäre jede offene Zeile markiert.
   */
  papierAnsehen: true,
  /**
   * (A6, §8 Vorrang 5, §7) Zeilen zu Starts, die schon aufs Papier gingen (papierStarts der Liste bzw. des Teils),
   * werden Vorschlag `papier` – nicht still übernommen, nicht verworfen: Ein wiederbelebtes Handy schriebe sonst still
   * in schon abgetippte Zeilen. Beim Bau 21.11.2026 dazu: Eine ganze Zeile einer geteilten Liste (Steg ohne Teil)
   * wird es schon, wenn EIN Teil den Start auf Papier hat (wie beim Abschluss, `zeileAbgeschlossen`).
   */
  papierStartVorschlag: true,
  /** (A7) Überschreiben eines Gerätewerts beim Abtippen fragt einmal je Zelle, solange sie den Fokus hat. */
  ueberschreibenEinmalJeFokus: true,
  /** (A8, F4) „nachfragen“ gilt für jedes Zeigen (Nächster Start und „Anderen Starter wählen“); gesperrt wird nie. */
  nachfragenJedesZeigen: true,
  /**
   * (A9, F17) Auf dem Freigabe-Handy nur Listenname, Ampel, Zahl und Startnummern der offenen Starts, keine
   * Gerätenamen, keine Werte – in einer eigenen Gruppe, nicht in der Sicht der Anzeigetafel.
   */
  freigabeOhneNamen: true,
  /**
   * (A10) „Papier ab Start …“ meldet die Liste (bzw. den Steg-Teil) ab: Status `abgemeldet`, die Pause beginnt mit der
   * Zeit, zu der der Start gezeigt wurde (sonst jetzt), P = die Schlange ab diesem Start, die Startnummer steht im
   * Stand (`WkrPause.ab`). „Weiter digital“ gilt ab dem nächsten gezeigten Start – rückwirkend würden Starts, die schon
   * vom Bogen abgetippt werden, wieder vom Gerät erwartet. Beim Bau 21.11.2026 dazu: Ist die Liste schon pausiert
   * oder abgemeldet, bekommt die offene Pause das `ab` und die Starts ab dort dazu (keine zweite Pause).
   */
  papierAbMeldetAb: true,
  /** (A11) ⧗ („laut Gerät abgeschickt“) nur als Zahl wartender Zeilen je Gerät, nicht je Zelle – das Lebenszeichen trägt nur die Zahl. */
  wartendNurZahl: true,
  /** (A12) Eine getrennte Kontingentanzeige der Erfassung erst mit dem Feldtest; die Gesamtzählung (E8) warnt weiter. */
  kontingentErfassungErstFeldtest: true,
  /** (A13, Vorschlag §6.1) Gerätezustand: ● unter `ampelStillSek`, ◐ bis `ampelWegSek`, ✕ darüber; Akku nur, wo gemeldet. */
  ampelStillSek: 90,
  ampelWegSek: 300,
  // --- W2.2 Matrix und Eingang, beim Bau 21.11.2026 (noch zu bestätigen) ------------------------------------------
  /**
   * (B1) Unterreiter in der Folge Start-Freigabe, Startliste, WKR, Geräte (Adresse `#/betrieb/wkr`, englisch
   * `#/operation/officials` – „race-officials“ heißt schon die WKR-Liste unter „Lists“). Der Zähler „WKR: ! n“ im
   * Kopf jedes Unterreiters zählt ALLE offenen Rückfragen (alle Parcours); Vorschläge nicht – sie warten ohne Eile.
   */
  zaehlerNurRueckfragen: true,
  /**
   * (B2) Der Bediener kann den Modus jeder Liste jederzeit umstellen, auch ohne gekoppeltes Gerät (F1: „immer
   * wählbar“; papier → digital setzt `seit` wie beim ersten Koppeln). Pausieren/Abmelden/Weiter und „Papier ab“ gibt
   * es nur bei „digital“ oder „beides“ – auf Papier gibt es nichts zu pausieren.
   */
  modusOhneGeraet: true,
  /**
   * (B3) „Weiter digital“ schickt den Geräten der Liste immer den Hinweis `weiter-digital` – nach „Papier ab“ wie nach
   * Pausieren/Abmelden –, damit auf dem Handy nicht „Papier ab Nr.“ stehen bleibt. Hinweise („Papier ab“, „Bitte
   * Nr. prüfen“) gehen nur bei offenem Raum hinaus; ohne Raum ändert „Papier ab“ nur den Stand.
   */
  weiterMitHinweis: true,
  /** (B4) „Papier ab Start …“ wählt unter den gezeigten Starts der Matrix-Spalten; vorgewählt ist der zuletzt gezeigte. */
  papierAbVorgabeLetzter: true,
  /**
   * (B5) Die Karte einer Matrix-Zelle zeigt nur belegte Felder (mit ◆ nur, solange der Gerätewert unverändert steht,
   * geraete/wkrEingang.ts herkunftGilt). Ein Gerät, das es im Register nicht mehr gibt, heißt im Eingang
   * „entkoppeltes Gerät“ (F10: im Stand steht nie ein Name).
   */
  karteNurBelegte: true,
  /**
   * (B6) `zuletzt gehört` zieht das Führungsfenster höchstens alle 5 s nach (geraete/host.ts ZULETZT_NACHZIEHEN_MS,
   * nach echter Zeit): Die Ampel kennt Stufen von 90 s und 5 min, schneller muss die Oberfläche nicht folgen.
   */
  zuletztGedrosselt: true,
  // --- W2.3 Erfassung: ◆ und „Papier ansehen“, beim Bau 21.11.2026 (noch zu bestätigen) ---------------------------
  /**
   * (C1) ◆ steht an JEDER Zelle, deren Wert noch der vom Gerät ist – auch wenn das Feld auf mehreren Listen steht
   * (gemeinsame Felder); der Titel nennt die Liste des Geräts. Marken („Papier ansehen“, Rückfrage) dagegen nur für die
   * Liste des Bogens. Ohne Host (kein Bedienfenster) weder ◆ noch Marken noch Nachfrage.
   */
  rauteJedeListe: true,
  /**
   * (C2) Die Nachfrage vor dem Ersetzen eines Gerätewerts (Vorrang 3) kommt bei der ersten Änderung, auch beim Leeren
   * der Zelle; der Haken „abgetippt“ und „leere Zeilen bestätigen“ fragen nicht (sie ändern keinen Gerätewert). Die
   * Antwort „Ersetzen“ gilt, bis die Zelle den Fokus verliert (A7); „Behalten“ stellt den Wert zurück. Zeitfelder
   * bekommen danach den Fokus nicht zurück (sie markierten ihren Inhalt, die nächste Ziffer überschriebe ihn).
   * Geändert nach den Prüfbefunden 21.11.2026 (E4): Bei Zeitfeldern schreibt „Ersetzen“ nichts – nur Freigabe und
   * Fokus zurück; „Behalten“ wie bisher ohne Fokus.
   */
  ersetzenFragtErsteAenderung: true,
  /**
   * (C3) Gezählt („n Zeilen: Papier ansehen“) wird jede Zeile mit Marke an der Zeile ODER an einer Zelle (Steg-Teil);
   * Rückfragen stehen getrennt daneben mit dem Verweis auf Betrieb → WKR des Bereichs (dort wird entschieden, nicht in
   * der Erfassung – ein Tippen in die Zelle entscheidet die Rückfrage nicht).
   */
  papierZahlMitZellen: true,
  /** (C4) Die Erfassung rechnet „Gerät weg“ (A5) mit einer Uhr im 30-s-Takt – die Ampel kennt Stufen von 90 s und 5 min. */
  erfassungUhrSek: 30,
  // --- W2.4 Start-Freigabe und Freigabe-Handy, beim Bau 21.11.2026 (noch zu bestätigen) ---------------------------
  /**
   * (D1) Die Geräteleiste der Start-Freigabe nennt JEDE Liste des Bereichs, sobald eine einen Eintrag hat – Listen
   * ohne Eintrag als ▭ (Papier). Je Liste: schlechteste Ampel ihrer Geräte, „n offen“ bzw. ✓, ⧗ wartende Zeilen, „!“
   * bei offener Rückfrage. Rot (und einmal hervorgehoben, wenn es neu so wird) bei ✕ oder „!“; kein Ton, kein Dialog.
   * Den Rückstand je Steg-Teil zeigt die Matrix, nicht die Leiste (½ wäre am Steg-Handy ohne Spalten unverständlich).
   */
  leisteAlleListen: true,
  /**
   * (D2) Die Freigabe-Sicht trägt über A9 hinaus nur zwei abgeleitete Angaben: die ZAHL offener Rückfragen (für „!“) und
   * `warnt` (am Host gerechnet, damit Handy und Bedienrechner dieselbe Grenze R anwenden). Keine Startnummer einer
   * Rückfrage, kein „Papier ab“, keine Abschlüsse.
   */
  freigabeRueckfragenNurZahl: true,
  /**
   * (D3) Die Listennamen der Freigabe-Sicht stehen in der Sprache der Anzeigetafel (wie Parcours- und Klassennamen der
   * Start-Freigabe), am Bedienrechner in der Sprache der Oberfläche (wie die Matrix).
   */
  freigabeTitelTafelSprache: true,
  /**
   * (D4) Ohne Zustandsänderung rechnet das Führungsfenster die Freigabe-Sicht alle `freigabeTaktSek` neu (die Ampel
   * altert mit der Uhr); gesendet wird nur bei geändertem Inhalt. Ein Bereich, dessen Listen alle ohne Eintrag sind,
   * schickt nichts, solange noch nichts hinausging.
   */
  freigabeTaktSek: 15,
  /**
   * (D5) „Nachfragen“ (F4, A8) fragt in der Start-Freigabe vor JEDEM Zeigen, solange eine Liste des Bereichs warnt –
   * auch aus „Anderen Starter wählen“, aus den Zurückgestellten und Nachzuholenden. „Lauf beginnen“, „Zurück“ und
   * Zurückstellen fragen nicht (sie zeigen keinen neuen Start). Am Handy genauso, sobald die Freigabe-Sicht dort ist.
   */
  nachfragenVorJedemZeigen: true,
  // --- Prüfbefunde W2, 21.11.2026 (noch zu bestätigen) --------------------------------------------------------------
  /**
   * (E1) „Erledigt“ für Zellstand, Rückstand und „Papier ansehen“ (wkr/lage.ts): Haken ODER eigene Werte der Liste –
   * wie lib/erfassung.ts zeileErfasst; am Steg je Teil nur die Felder des Teils (gemeinsame Disq./Bemerkung zählen
   * nicht, wie bei der Prüfsumme). Wer vom Bogen abtippt, setzt den Haken nicht – sonst bliebe ▭ stehen und die
   * Warnung käme vor jedem Start. Die Schlange der Geräte (schlange.ts) bleibt beim Haken: Ein Wert, den der Bediener
   * in einer offenen Zeile tippt (etwa eine Disq. nach Protest), nähme dem WKR sonst die Zeile weg; was das Gerät
   * danach schickt, prüft die Übernahme gegen `vorher` (gleich → nichts, anders → Rückfrage).
   */
  abgetipptErledigt: true,
  /**
   * (E2) ◆ auch nach einer Entscheidung im Eingang: „Gerät übernehmen“ (Rückfrage; bei `vereinige` der vereinigte
   * Wert) und „Übernehmen“ (Vorschlag) schreiben die Herkunft – nur, wo danach der Gerätewert steht; Gerätename aus
   * dem Register, sonst „entkoppeltes Gerät“ (geraete/host.ts merkeEntscheid, Vorschlag §5/§6.2).
   */
  rauteNachEntscheid: true,
  /**
   * (E3) Hinweise „Papier ab“ und „weiter digital“ gehen am Steg mit Teil nur an die Geräte dieses Teils und an
   * Geräte ohne Teil (F16); „Papier ab“ nennt im Parallelslalom die Startnummer der eigenen Seite, bei leerer Seite
   * keine. Die Auswahl „Papier ab Start …“ hält die Wahl des Bedieners, auch wenn ihr Start aus den Matrix-Spalten
   * fällt (erst ein neuer Punkt räumt sie); ungewählt folgt sie dem zuletzt gezeigten.
   */
  hinweisJeTeil: true,
  /**
   * (E4) Die Freigabe „Ersetzen“ (A7) gilt nur für den Gerätewert, nach dem gefragt wurde (Zeit des
   * Herkunftseintrags): Kommt ein neuer Gerätewert in die Zelle, fragt die nächste Eingabe wieder. Rückfragen zu
   * nicht gezeigten Starts (Grund `start`) bekommen in der Erfassung ebenfalls „!“.
   */
  freigabeJeGeraetewert: true,
  // --- W3 Handy-Maske „Knöpfe“ (docs/plan-wkr-w3.md §9, G1–G16, 21.11.2026 beim Planen, alle noch zu bestätigen) ---
  /** (G1) Sonnenmodus (schwarz auf weiß, hoher Kontrast) ist Vorgabe jedes WKR-Geräts; Hell/Dunkel wählbar, gemerkt je Gerät. */
  sonneVorgabe: true,
  /**
   * (G2) Masken nur für Listen, deren Felder alle Katalog, Disq. oder Text sind (Steg, Vorsteg, Tor 5, Tor 5 +
   * Parcours ohne Bojen, MüB) – erkannt an den Feldarten (wkr/maske.ts maskenArt), nicht an der Listen-ID: eigene
   * Aufbauten gelten so von selbst. Listen mit Bojen, Zeit oder Punkten sind `spaeter` (W4/W5).
   */
  maskeNachFeldarten: true,
  /** (G3, F15) Handy eine Liste, Pad zwei – nur als Hinweis am Bedienrechner; erzwungen bleibt LISTEN_JE_GERAET = 2. */
  handyEineListe: true,
  /** (G4, F14) Maskenvorgabe `maske`/`fest` an der Aufgabe; in W3 nur `knoepfe`, ohne Wahl – nur Anzeige. */
  maskeVorgabeNurKnoepfe: true,
  /**
   * (G5) Doppeltipp-Schutz: Nach dem Abschicken bleibt die Startnummer `weiterNachMs` mit „● gesendet“ stehen, dann
   * wechselt sie (Blitz, Vibration), und `sperreMs` lang nimmt die Maske KEINE Eingabe an – auch Codes und Disq.,
   * nicht nur den Hauptknopf (ein Tropfen auf „Code 1“ ist so schlimm wie auf „Fehlerfrei“).
   */
  weiterNachMs: 2000,
  sperreMs: 1000,
  /** (§5.2) Ohne Quittung nach so vielen ms im Kopf „Keine Bestätigung – Verbindung prüfen“ – nie gesperrt. */
  ohneQuittungMs: 10_000,
  /** (§5.6) Ohne Verbindung ab so vielen Sekunden „Länger weg? Papierbogen ab Nr. x“. */
  papierHinweisSek: 300,
  /** (G6) Codes „ab Klasse n“ bleiben drückbar – die Kataloge tragen die Klasse nur als Text (ein YAML-Feld `abKlasse` käme später). */
  codesAlleKlassen: true,
  /** (G7) Suche nach Startnummer nur in Schlange, „danach“ und „Zuletzt“; eine Nummer außerhalb wird nicht angeboten. */
  sucheNurBekannte: true,
  /**
   * (G8) „Rückgängig“ `rueckgaengigMs` nach dem Abschicken: Wartet die Zeile noch im Ausgang, holt sie
   * geraete/erfassen.ts holeZurueck zurück (Werte wieder im Entwurf); ist sie schon unterwegs, öffnet der Knopf die
   * Korrektur – kein automatisches Hinterherschicken.
   */
  rueckgaengigMs: 6000,
  /** (§5.5) Die Leiste „Zuletzt“ zeigt die letzten so vielen eigenen Zeilen (die Liste dahinter bis `zuletzt`). */
  zuletztLeiste: 5,
  /**
   * (G9, F13) Sprache der Maske: Vorgabe die der Liste, `de+en` → `de` (zwei Zeilen je Knopf kosten Platz im
   * Daumenbereich). Umschalten wechselt Bedientexte immer, Kataloge und Titel nur, wenn die Sicht `andere` trägt –
   * also das Regelwerk beide Sprachen hat (UIM; DM hat kein Englisch).
   */
  spracheDerListe: true,
  /** (G10) Probe beim Einrichten einmal je Raum und Liste, überspringbar; nichts geht an den Bedienrechner. */
  probeJeRaumUndListe: true,
  /** (G11, F8) WKR-Name nur beim Abschluss, kein „WKR wechseln“ in W3 – wer übernimmt, schließt mit seinem Namen ab. */
  nameNurBeimAbschluss: true,
  /** (G12) Der zuletzt eingegebene WKR-Name ist vorbelegt (Geräteablage), gelöscht mit „Raum verlassen“/Entkoppeln. */
  nameVorbelegt: true,
  /**
   * (G13) Übung ohne Netz: erfundene Starts 1–20 ohne Namen in den Klassen des Regelwerks, Quittung nach
   * `uebungQuittungMs`, eine Beispiel-Rückfrage beim `uebungRueckfrageBei`. Start; erreichbar ohne Kopplung; nichts außer
   * der Ansicht wird abgelegt. Alle `uebungTaktSek` rückt ein neuer Start nach (wie vom Steg gezeigt).
   */
  uebungQuittungMs: 300,
  uebungRueckfrageBei: 5,
  uebungStarts: 20,
  uebungTaktSek: 30,
  /** (G14) Liste ohne Maske: Das Gerät sagt „Papier“ und bietet „Pausieren“ an; der Bedienrechner kennzeichnet sie beim Koppeln. */
  ohneMaskePapier: true,
  /** (G15) „Nicht vorbeigekommen“ erst mit W4 (Protokoll, Reducer, Matrix); bis dahin Bemerkung oder nichts schicken. */
  nichtVorbeigekommenErstW4: true,
  /** (G16) Band „Liste abschließen“, sobald der eigene Punkt nicht mehr läuft und nicht abgeschlossen ist; unter „Mehr“ immer. */
  abschlussBand: true,
  // --- W3.1 beim Bau, 21.11.2026 (noch zu bestätigen) ------------------------------------------------------------
  /**
   * (H1) Ein Disq.-Buchstabe in der Maske ist ein Schalter (zweiter Tipp nimmt ihn wieder heraus) und steht im
   * Disq.-Feld in Tipp-Reihenfolge („A, X“ – so lässt sanitizeDisq ihn unverändert); hat die Liste kein eigenes
   * Disq.-Feld, gehen die Buchstaben in das erste Code-Feld des Teils (normalizeCodeCell sortiert sie dort).
   */
  disqAlsSchalter: true,
  /**
   * (H2) Ein Code-Tipp zählt +1 („2x20“); „− letzte zurück“ nimmt den letzten Tipp – Code ODER Disq. – zurück, der
   * Text der Bemerkung zählt nicht als Tipp (er hat sein eigenes Feld).
   */
  zurueckLetzterTipp: true,
  /**
   * (H3) Schlange je Steg-Teil auf dem Gerät: Eine eigene Zeile nimmt den Start nur aus der Schlange IHRES Teils
   * (eine Zeile ohne Teil aus beiden); ein Gerät für den ganzen Steg behält den Start in der gemeinsamen Schlange,
   * bis beide Teile erledigt sind (eigene Zeile oder `teile` der Sicht).
   */
  schlangeJeTeil: true,
  /**
   * (H4) Entwürfe liegen im Ausgang (36 h, gehen mit „Raum verlassen“), je Liste, Start und Teil; `schicke` räumt den
   * Entwurf dieses Starts und Teils. Nach dem Entzug bleiben sie lesbar (zum Übertragen aufs Papier).
   */
  entwurfImAusgang: true,
  /** (H5) Die Übungs-Sicht nimmt die Sprache des Regelwerks (DM deutsch, UIM englisch) wie eine echte Liste. */
  uebungSpracheRegelwerk: true,
  // --- W3.2 Bedienrechner: Liste zuweisen (beim Bau 21.11.2026, J1–J5, alle noch zu bestätigen) ---
  /**
   * (J1) „Maske folgt – Papier“ beim Zuweisen (wkr/maske.ts listeMitMaske): eine Liste hat in W3 eine Maske, wenn
   * JEDE Klasse der Starter, die sie hat, nur Katalog/Disq./Text trägt; ohne Starter zählen alle Klassen der Liste.
   */
  maskeNachStarterKlassen: true,
  /**
   * (J2) Der Hinweis „Handy: eine Liste“ (G3) richtet sich nach dem Gerätenamen: Das Register kennt keine Geräteart,
   * der Name ist aber bis zum Umbenennen die übersetzte Art (geraete.name.iphone / android-handy, de oder en).
   * Ein umbenanntes Handy bekommt den allgemeinen Hinweis „Handy eine, Pad höchstens zwei“.
   */
  handyNachName: true,
  /**
   * (J3) Mit nur einem Parcours ist die Start-Freigabe beim Koppeln vorgewählt (wie seit E7) – aber nur, solange keine
   * WKR-Liste gewählt ist: Ein Handy für eine Liste bekommt die Freigabe nur, wenn man sie ausdrücklich anhakt.
   */
  freigabeVorwahlOhneListe: true,
  /** (J4) Beim Koppeln genau eine Liste (oder keine); eine zweite gibt erst die Geräteliste (F15, Pad). Teil: Vorgabe „ganz“. */
  koppelnEineListe: true,
  /**
   * (J5) Verweis „Gerät koppeln“ in der Matrix an jeder Liste ohne Gerät – auch ohne offenen Raum (er führt dann zu
   * „Gerätebetrieb einschalten“) und auch bei Listen ohne Maske (dort steht beim Koppeln „Maske folgt – Papier“).
   */
  koppelnVerweisImmer: true,
  // --- W3.3 Handy-Maske „Knöpfe“ mit Rahmen (beim Bau 21.11.2026, K1–K9, alle noch zu bestätigen) ---
  /**
   * (K1) Disq. auf dem Handy: Der erste Tipp merkt den Buchstaben nur vor („noch einmal tippen“), der zweite setzt ihn;
   * ein gesetzter geht mit EINEM Tipp wieder heraus. X fragt danach noch einmal groß (F5). components/wkr/WkrDisq.vue.
   */
  disqZweiterTipp: true,
  /**
   * (K2) Gesperrt (inert + Prüfung in jedem Tipp) ist die Mitte samt Ausweichen und der Fuß während der ganzen
   * `weiterNachMs` + `sperreMs` – auch während „● gesendet“, nicht erst nach dem Wechsel (sonst landete ein Tipp auf
   * dem schon gesendeten Start). „Zuletzt“, „Rückgängig“ und die Bänder liegen außerhalb; eine Korrektur oder
   * „Rückgängig“ beendet den Takt.
   */
  sperreAuchGesendet: true,
  /**
   * (K3) Nach dem Entzug bleibt die Erfassung des Geräts offen (kein stop), damit nicht abgeschickte Entwürfe lesbar
   * bleiben (§5.6 „auf Papier übertragen“); sie schickt dann nichts mehr (erfassen.ts ohneListen). Gestoppt wird beim
   * Unmount, beim Entkoppeln und wenn GeraetFreigabe ein anderes Gerät öffnet.
   */
  erfassungBleibtNachEntzug: true,
  /** (K4) Der Entwurf geht bei JEDEM Tipp in den Ausgang (nicht erst beim Wechsel) – so überlebt er auch ein Neuladen mitten im Start. */
  entwurfJeTipp: true,
  /**
   * (K5) Pausiert/abgemeldet zeigt statt ausgegrauter Codes nur das große Band „Papierbogen gilt“ mit „Weiter digital“
   * (Zuletzt bleibt für Korrekturen) – ausgegraute Knöpfe verleiten in der Sonne zum Tippen.
   */
  pauseOhneKnoepfe: true,
  /** (K6) Gerät mit Start-Freigabe UND Liste: unten Reiter „Freigabe“ / Listenname, Vorgabe „Freigabe“ (Steg b vor Steg a). */
  reiterFreigabeZuerst: true,
  /** (K7) „So lassen“ an einer Rückfrage/Ablehnung legt das Band nur auf dem Gerät weg – keine Nachricht; der Bediener entscheidet ohnehin. */
  soLassenNurLokal: true,
  /**
   * (K8) Ziffernfeld der Suche mit einer Taste je Buchstaben vor den bekannten Startnummern (Schlange, „danach“,
   * „Zuletzt“): „E“ (E01), unter UIM auch „D“ (Dolphin-Präfix, AppState.dolphinPraefix) – Prüfbefund W3 21.11.2026,
   * vorher nur „E“. Verglichen wird ohne führende Nullen und ohne Groß/Klein („e1“ = „E01“, „d3“ = „D03“). Gesucht wird
   * in Schlange und „danach“ des gewählten Teils, dann in „Zuletzt“.
   */
  sucheMitE: true,
  /**
   * (K9) Hauptknopf mit Einträgen: „Abschicken · 5 Pkt. · Disq. P“ (Punkte nur der Codes, Disq. als Buchstaben), nur
   * Disq.: „Abschicken · Disq. A“; am Steg „Abschicken Ablegen · …“. Die Maske spricht die Sprache der Liste (tIn),
   * die Reiter der Freigabe die des Geräts.
   */
  hauptknopfMitDisq: true,
  // --- W3.4 Abschluss, Ansicht, Probe, Übung (beim Bau 21.11.2026, L1–L9, alle noch zu bestätigen) ---
  /**
   * (L1) Korrektur aus der Prüfansicht („Liste abschließen“) nur für Starts, deren neueste eigene Zeile noch in
   * „Zuletzt“ steht (≤ `zuletzt` Zeilen) – der Kern korrigiert über die Zeilennummer. Ältere Zeilen stehen nur zum Lesen da.
   */
  pruefKorrekturNurZuletzt: true,
  /**
   * (L2) Band „Liste abschließen“ (G16) konkret: der letzte eigene Punkt (neueste eigene Zeile) ist nicht der laufende
   * der Sicht – der nächste Lauf begann mit dem Zeigen seines ersten Starts – oder Schlange und „danach“ sind leer;
   * nicht bei Papier-Modus, abgeschlossenem Punkt (am Steg des eigenen Teils) oder eigenem Abschluss unterwegs/angenommen.
   */
  abschlussBandRegel: true,
  /** (L3) „Mehr → Liste abschließen“ nimmt den Punkt des Bands, sonst den laufenden, sonst den letzten eigenen. */
  abschlussPunktWahl: true,
  /**
   * (L4) Der WKR-Name wird beim Abschicken des Abschlusses gemerkt (auch wenn der Bedienrechner ihn ablehnt) – in der
   * Übung nie (dort bleibt nur die Ansicht, G13).
   */
  nameBeimAbschicken: true,
  /**
   * (L5) Sprache: Die Wahl der Sprache der Liste heißt „keine eigene Wahl“ (das Gerät folgt dann der Liste); eine
   * andere Wahl gilt für alle Listen des Geräts. Zweisprachige Liste (`de+en`): Vorgabe deutsch (G9).
   */
  spracheListeOhneWahl: true,
  /**
   * (L6) Probe nur, wenn die Liste eine Maske hat (wkr/maske.ts probeMaske – erste Klasse mit Maske); Steg ganz übt
   * das Ablegen; Vorsteg ohne X nur „In Ordnung“. Übersprungen zählt als erledigt. In der Übung kommt sie nie von
   * selbst, nur über „Mehr → Probe“ (und wird dort nicht abgelegt).
   */
  probeNurMitMaske: true,
  /**
   * (L7) Übung: Adresse `#/uebung` in jeder Sprache gleich (fest im Koppel-Formular); die Wahl spricht die Sprache der
   * Geräte-Oberfläche, die Maske die des Regelwerks (H5). Verweis auch ohne Kopplung („Kein Gerät“/„entkoppelt“);
   * „Übung verlassen“ führt zur Wahl zurück, „Zum Koppeln“ nach `#/geraet`.
   */
  uebungAdresseFest: true,
  /** (L8) „Mehr“ steht auch in Zuständen ohne Arbeit (außer „Verbinde …“): Ansicht, Sprache, Probe, Abschluss bleiben erreichbar. */
  mehrAuchInRuhe: true,
  /** (L9) Eine eigene Zeile ohne Eintrag mehr im Ausgang gilt in der Prüfansicht als „✓ übernommen“ (nur Quittiertes verlässt ihn). */
  pruefOhneStufeUebernommen: true,
  // --- Prüfbefunde W3 (21.11.2026, M1–M6, alle noch zu bestätigen) ---
  /**
   * (M1) Gemeinsame Felder des Stegs (Disq., Bemerkung) merkt das Gerät je Teil: `vorher` einer Zeile eines Teils kommt
   * für sie nur aus Zeilen DIESES Teils; leer und ohne eigenes `vorher` gehen sie gar nicht hinaus. Am Bedienrechner
   * vereinigt `vereinige` (Disq. nur dazu, Wegfall = Rückfrage `entfernt`). Der Stand ohne Teil (Prüfsumme, Prüfansicht
   * des ganzen Stegs) vereinigt beide Teile wie der Bedienrechner. Vorher löschte ein Gerät für den ganzen Steg mit
   * „Anlegen OK ✓“ still die Disq. und Bemerkung seines Ablegens.
   */
  gemeinsameFelderJeTeil: true,
  /**
   * (M2) Korrektur: Entwurf und „alt“ im Dialog aus dem eigenen Stand des Starts und Teils (Kern `stand(z)`), nie aus
   * den Zellen der Zeile – Korrekturzeilen tragen nur das Geänderte.
   */
  korrekturAusStand: true,
  /**
   * (M3) Ein vorgemerkter Disq.-Buchstabe (K1) gilt nur für diesen Start und Teil (WkrDisq je Start neu); in der Sperre
   * nach dem Abschicken merkt ein Tipp nichts vor.
   */
  disqVormerkenJeStart: true,
  /**
   * (M4) Bedienung über den Neuaufbau der Maske hinweg (Reiter Freigabe ↔ Liste, zwei Listen): „getrennt seit“ und
   * „wartend seit“ zählt der Kern (Wanduhr), „So lassen“ und „behalten“ hält ein Gedächtnis je Quelle und Liste im
   * Arbeitsspeicher (components/wkr/gedaechtnis.ts) – nach dem Neuladen der Seite kommen sie wieder.
   */
  gedaechtnisUeberReiter: true,
  /**
   * (M5) Bildschirm: Der Fuß mit dem Hauptknopf klebt unten (sticky); „Rückgängig“ steht in der Zeile der Leiste
   * „Zuletzt“ (feste Höhe), „Keine Bestätigung“ legt sich über den Kopf – was ohne Tipp kommt und geht, verschiebt die
   * Codes nicht. Das rote „Keine Verbindung“, Hinweise des Bedienrechners, verwaiste Entwürfe und das Abschluss-Band
   * stehen weiter im Fluss (selten, und sie brauchen ihre Knöpfe). Auf niedrigen Bildschirmen (≤ 700 px hoch) ist die
   * Startnummer 80 px statt 96 px groß.
   */
  bildschirmOhneNachrutschen: true,
  /**
   * (M6) Entwürfe nach dem Entzug: mit Titel und Bereich der Liste, Steg-Teil und Feldüberschriften, wie die Sicht sie
   * beim Ablegen nannte (im Ausgang mitgemerkt, `papier`) – nie ein Name.
   */
  entwurfFuersPapier: true,
} as const
