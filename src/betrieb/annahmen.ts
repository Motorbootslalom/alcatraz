// Auslegungen des Betriebs am Wettkampftag (Anzeigetafel, Start-Freigabe) – an EINER Stelle, nach dem
// Muster von PARALLEL_ANNAHMEN (lib/parallelErgebnis.ts). Weder das DM-Reglement noch Regel 960 regeln
// den Ablauf am Steg; was hier steht, ist Organisation nach dem Plan zur Übernahme der Tafel vom
// 16.11.2026 (§7 „Auslegungen“, Nummern in Klammern). Vom Nutzer am 16.11.2026 bestätigt („Deine Annahmen zur
// Tafel usw. sind hiermit bestätigt“, docs/entscheidungen.md „Betrieb und Offline“); was danach dazukommt, steht
// mit eigenem Datum da. Die Werte, die der Code liest, sind hier umstellbar;
// die übrigen Einträge halten fest, wie der Code gebaut ist, damit es nur eine Stelle zum Nachlesen gibt.

export const BETRIEB_ANNAHMEN = {
  /**
   * (1) Die Folge der Starts wird abgeleitet (Verzahnung, Läufe; betrieb/folge.ts) und nie
   * gespeichert. Ein Start heißt nach dem, was ihn ausmacht (StartRef: Starter und Lauf), nie nach
   * seiner Stelle. Abweichungen (ab E2) stehen als Schnappschuss der ganzen Folge im Betrieb. 16.11.2026.
   */
  folgeAbgeleitet: true,
  /**
   * (2) Betrieb nur mit festgeschriebener Verzahnung bzw. Runde: Erst dann stehen Startnummern und
   * Folge fest – sinngemäß wie der Druck der WKR-Bögen (Entscheidung des Nutzers vom 15.11.2026).
   * Gesperrt sind „Lauf beginnen“ und „Start zeigen“; Zurück, Meldungen und Zurücksetzen gehen
   * immer (state/reducer/betrieb.ts). 16.11.2026.
   */
  nurFestgeschrieben: true,
  /**
   * (3) „Nicht gestartet“ heißt allein: ein X in einer Disq-Zelle des Laufs. Ein Start mit X entfällt;
   * wird das X von Hand entfernt, ist er wieder da. Die Liste `abgemeldet` filtert nicht – sie ist
   * Buchführung des Abmeldens (lib/abmeldung.ts). `false` hieße: Wer in `abgemeldet` steht, entfällt
   * auch ohne X. 16.11.2026.
   * Welche Zelle zählt: jede Disq-Zelle des Laufs, am Steg ODER am Vorsteg, auch neben anderen Codes –
   * dieselbe Frage wie Wertung und Erfassung (lib/erfassung.ts `nichtGestartet`, lib/ergebnis.ts).
   * Grund: Entscheidung des Nutzers vom 13.11.2026 „X bei Steg oder Vorsteg“ (docs/entscheidungen.md);
   * der Plan nannte nur die Zelle, in die das Abmelden das X schreibt (`abmeldeZiel`, meist am Steg).
   * So führt die Anzeigetafel nie einen Starter als Nächsten, den die Wertung als nicht gestartet
   * führt. Geändert nach der Prüfung von E1, 16.11.2026 – noch zu bestätigen.
   */
  abgemeldetNurDurchX: true,
  /**
   * (4) Parallelslalom (ab E4): Eine Seite mit X oder Dummy wird leer gezeigt; der Start entfällt nur
   * bei `startEntfaellt` (planung/parallel.ts) oder wenn beide Seiten ein X haben – der Gegner fährt
   * (lib/abmeldung.ts, Halbfinale und Finale). 16.11.2026.
   */
  parallelLeereSeite: true,
  /**
   * (5) Die Knoten kommen nicht auf die Anzeigetafel: Ihre Liste hat keinen Lauf, und es gibt keinen
   * Start dafür. Gebaut: Die Folge kennt nur Läufe (`programm`), das X zählt nur auf Listen mit
   * Lauf. 16.11.2026.
   */
  knotenNichtAufTafel: true,
  /**
   * (6) Nachzügler – Nachmeldung, entferntes X, verpasster Lauf –, deren Stelle vor dem Zeiger
   * (dem spätesten erledigten Start) liegt, sind „nachzuholen“: nie von selbst der Nächste, die
   * Bedienung zeigt sie gezielt (E1) oder reiht sie ein (E2). `false` hieße: Sie stehen vorn in
   * der offenen Folge und sind sofort der Nächste. 16.11.2026.
   */
  nachzueglerNachzuholen: true,
  /**
   * (9) „Versuche direkt nacheinander“: ein einziger Punkt `lauf:1`, seine Starts je Versuch
   * starterweise hintereinander (wie die WKR-Bögen, lib/wkrListen.ts `stapel = 1`). Die Kennungen
   * der Punkte bleiben so stabil, wenn der Schalter oder die Zahl der Läufe sich ändert. 16.11.2026.
   */
  versucheNacheinanderEinPunkt: true,
  /**
   * (10) Begonnene Punkte sind eine Menge, kein „bis“: Eine Wiederholung (Re-run) wird erst nach
   * späteren Runden festgeschrieben und ordnet sich davor ein – ein „bis“ gäbe sie ungefragt frei.
   * Die Oberfläche bietet nur den nächsten nicht begonnenen Punkt an. 16.11.2026.
   */
  begonnenAlsMenge: true,
  /**
   * (8, Teil E1) Freigegeben wird nach Punkt, nicht nach Stelle: Der Nächste ist der erste offene
   * Start, dessen Punkt begonnen ist. 16.11.2026.
   */
  freigabeNachPunkt: true,
  /**
   * (zu 6 und 9) Den Zeiger schiebt nur ein erledigter Start eines begonnenen Punkts. Fall: „Versuche
   * nacheinander“ wird mitten in Lauf 1 ausgeschaltet; ein schon gefahrener zweiter Versuch steht dann
   * im Block von Lauf 2, der noch nicht begonnen ist. Zählte er, wären alle, die in Lauf 1 noch nicht
   * dran waren, „nachzuholen“, und Lauf 1 hieße zu Ende. So geht Lauf 1 weiter; der zweite Versuch
   * bleibt erledigt. Beginnt Lauf 2, zählt er mit – was von Lauf 1 dann noch offen ist und vor ihm
   * steht, wird nachzuholen. Nach der Prüfung von E1, 16.11.2026.
   */
  zeigerNurBegonnene: true,
  /**
   * (11) Am Ende eines Punkts bleibt die Anzeigetafel auf dem letzten Starter stehen, bis der nächste
   * Punkt beginnt und dessen erster Start gezeigt wird. 16.11.2026.
   */
  endeBleibtStehen: true,
  /**
   * (13) Kein X von der Anzeigetafel: Der Betrieb schreibt nie in `eingaben` (Entscheidung des Nutzers
   * vom 13.11.2026: X bei Steg oder Vorsteg). Betriebs-Actions ändern keine Wertungsliste. 16.11.2026.
   */
  keinXVonDerTafel: true,
  /**
   * (14) Logos zeigt nur die Anzeigetafel am Bedienrechner; entfernte Anzeigen (E6) bekommen keine,
   * weil der Vollstand sonst bei jedem Einstieg die Bilder trüge. Vorgabe von
   * `sichtOeffentlich(stand, { logos })`. 16.11.2026.
   */
  logosNurLokal: true,
  /**
   * (15) Speicherorte: `betrieb` in der Sicherung, nicht in der Vorlage – eine Vorlage hängt den
   * hiesigen auf ihre Parcours um; „Verlauf wiederherstellen“ behält den jetzigen Betrieb; „Werte
   * löschen“ lässt ihn stehen; `anzeige` reist mit der Vorlage, außer der Kopfzeile
   * (persistenz/backup.ts, components/VerlaufPanel.vue). 16.11.2026.
   * Der jetzige Betrieb bleibt beim Wiederherstellen nur innerhalb derselben Veranstaltung (gleiche
   * `kennung`); ein Eintrag einer anderen bringt seinen eigenen mit – sonst gälten deren Läufe als
   * begonnen und ihre Meldung stünde auf der Tafel. Nach der Prüfung von E1, 16.11.2026.
   */
  speicherorte: true,
  /**
   * (16) Die Anzeigetafel spricht wie die Listen die Sprache des Regelwerks (DM deutsch, UIM
   * englisch), als Einstellung änderbar (`anzeige.sprache`). 16.11.2026.
   */
  spracheVorgabe: 'regelwerk' as 'regelwerk' | 'de' | 'en',
  /**
   * (17) Wo was hingehört: Start-Freigabe, Koppeln und Geräteliste im Reiter „Betrieb“; Anzeigetafel,
   * Startfolge, Startabstände und Verbindung als Einstellungen (views/SettingsView.vue) – Einstellungen
   * gehören nicht in die Fachansichten (Entscheidung des Nutzers vom 12.11.2026). 16.11.2026.
   */
  wohin: true,
  /**
   * F6 (Empfehlung, offen): Eine öffentliche Regel für Namen auf Anzeigetafel und Zuschauerliste –
   * Vorgabe wie der Aushang der Wertungslisten (lib/namen.ts), nie ein Geburtsdatum. 16.11.2026.
   */
  namenVorgabe: 'aushang' as 'aushang' | 'voll' | 'kurz' | 'ohne',
  /**
   * Herkunft auf der Anzeigetafel: ausgeschrieben wie im Tafel-Prototyp (Verein in voller Länge,
   * die Zeile schrumpft, statt abgeschnitten zu werden). Die Wertungslisten nehmen das Kürzel – auf
   * Papier zählt die Spaltenbreite, auf der Tafel die Lesbarkeit aus der Entfernung. 16.11.2026.
   */
  herkunftVorgabe: 'lang' as 'lang' | 'kurz',
  /**
   * Start-Freigabe und Anzeigetafel lesen dieselbe öffentliche Sicht (sicht.ts), auch am Bedienrechner – ein
   * Satz Komponenten für lokal und später entfernt (Plan §4). Folge: Mit „Namen: ohne“ zeigt auch die
   * Start-Freigabe keine Namen; angesagt wird ohnehin nach Startnummer. 16.11.2026.
   */
  freigabeLiestSicht: true,
  /**
   * (19) Begriffe: „Anzeigetafel“ (im Code `anzeige`), denn „Tafel“ ist das Aushangbrett
   * (docs/entscheidungen.md); „Start-Freigabe“ = Steg (b), „Steg-Erfassung“ = Steg (a); „Lauf N
   * beginnen“. Englisch vorläufig „display board“, „start release“, „begin attempt N“ – gegen das
   * Rulebook zu prüfen. 16.11.2026.
   */
  begriffe: true,
} as const
