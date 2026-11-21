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
} as const
