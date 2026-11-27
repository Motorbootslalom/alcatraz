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
   * Beim Bau von E4 (16.11.2026, noch zu bestätigen): „Leer“ ist eine Seite mit Dummy, mit gelöschtem Starter
   * (startEntfaellt zählt ihn als Dummy) oder mit X in einer Disq-Zelle dieses Attempts auf einer Liste des
   * Parallelslaloms – dieselbe Frage wie Erfassung und Wertung. Der Start entfällt, wenn BEIDE Seiten leer sind;
   * das schließt startEntfaellt und das doppelte X ein und ebenso einen Dummy gegen ein X (dort fährt niemand –
   * die Regel oben nennt den Fall nicht). Die Sicht sagt nicht, warum eine Seite leer ist (`null`): Abmeldungen
   * gehören nicht in die Sicht.
   * Nach der Prüfung von E4 (16.11.2026, vom Nutzer zu bestätigen): Die Kennung eines Paares in der öffentlichen
   * Sicht (Anzeigetafel, Start-Freigabe, ab E6 Geräte des Veranstalters) trägt weiter die IDs laut Plan, auch die
   * einer leeren Seite – „Nächster Start“ schickt sie als `vorher`, und sie darf sich nicht ändern, wenn ein X
   * gesetzt oder ein Starter gelöscht wird (Kritik K8). Die Zuschauersicht (öffentlicher Link) bildet ihre Kennung
   * dagegen nur aus dem, was sie zeigt (`sichtZuschauer`): Dort verrät keine Kennung, wer auf einer leeren Seite
   * gestanden hätte.
   */
  parallelLeereSeite: true,
  /**
   * (zu 4, 10) Parallelslalom: je festgeschriebener Runde ein Punkt (`runde:<runde>`) in der Folge von
   * vergleicheRunden; eine Runde ohne festgeschriebenen Plan steht nicht im Programm. Seit 21.11.2026 (Auftrag des
   * Nutzers: Kleines Finale und Finale „4 in sich geschlossene Listen/Auswertungen“) ist das Kleine Finale ein
   * eigener Punkt `runde:small` und steht VOR `runde:final` (Entscheidung vom 15.11.2026: zuerst gefahren); die
   * Tafel nennt die Runde („Small final · Attempt 1“). Folge: Nach dem Kleinen Finale muss im Betrieb „Finale
   * beginnen“ gedrückt werden – wie bei jedem Punkt. BESTÄTIGT vom Nutzer 24.11.2026 (Frage vom 21.11.2026, ob das
   * Finale ohne Klick anschließen soll): „Beim Parallel sind die einzelnen Stufen einzeln mit beginnen
   * freizuschalten.“ – der Klick bleibt, für jede Runde.
   * Unabhängig davon, beim Bau von E4 (16.11.2026) – noch zu bestätigen (die Antwort vom 24.11.2026 betrifft nur
   * den Klick): Betrieb im Bereich ist möglich, sobald eine Runde festgeschrieben ist, unabhängig von der Sperre
   * der Verzahnung (die Runden nach dem Vorlauf stehen außerhalb davon, der Vorlauf bleibt an erfasste Werte
   * gebunden).
   */
  parallelRundenAlsPunkte: true,
  /**
   * (zu 10, 6 und 8) Im Parallelslalom laufen die Runden je Klasse für sich: Halbfinale, Kleines Finale, Finale und Re-runs werden
   * je Klasse festgeschrieben (planung/parallelRunden.ts `mitKlasse`, neue Klassen ans Ende des Plans), also stehen
   * Klassen zugleich in verschiedenen Runden. Deshalb gilt dort je Runde: „Nachzuholen“ ist ein Start nur, wenn
   * hinter ihm ein Start DERSELBEN Runde erledigt ist (nicht einer einer späteren Runde), und „hinter den Zeiger“
   * (gezielt zeigen, „Als Nächster“, „Einsteigen ab …“) heißt hinter das zuletzt Erledigte seiner Runde; „Ans Ende der
   * Runde“ geht nie vor dieses. Sonst würde ein Re-run, der nach dem ersten gezeigten Halbfinal-Start festgeschrieben
   * wird, sofort „nachzuholen“ und käme nach „Re-run beginnen“ nie von selbst dran; ebenso das Halbfinale einer
   * Klasse, deren Re-run die Finals einer anderen abwarten musste. Die laufende Runde (Tafel „Semi-finals“,
   * Zuschauerliste) ist die des Nächsten, ohne ihn die des Starts im Boot, sonst die zuletzt begonnene – nicht die
   * im Programm späteste begonnene. Nach der Prüfung von E4, 16.11.2026 – vom Nutzer zu bestätigen.
   */
  parallelRundenFuerSich: true,
  /**
   * (zu `parallelRundenFuerSich`) Ein Paar im Boot fährt seinen anderen Attempt, bevor eine ANDERE Runde drankommt –
   * wenn er im Plan direkt dahinter steht (Runden nach dem Vorlauf; im Vorlauf ist keine Runde davor):
   * Wird eine frühere Runde begonnen („Re-run beginnen“ nach dem 1. Attempt eines Halbfinal-Paares) oder eine
   * frühere Runde einer Klasse festgeschrieben, während eine andere schon in den Finals ist, stünde deren Start in
   * der Folge der Runden vorn und unterbräche das Paar zwischen seinen Attempts (Tausch von Boot und Racecourse,
   * Regel 960 Pkt. 4.4). Innerhalb derselben Runde gilt die Folge, wie sie steht – „Als Nächster“ und „Einsteigen
   * ab …“ sind dort bewusste Entscheidungen am Steg; gezielt zeigen geht immer. Nach der Prüfung von E4, 16.11.2026 –
   * vom Nutzer zu bestätigen.
   */
  parallelPaarZuEnde: true,
  /**
   * (zu B-3, B-4) Im Parallelslalom ist ein Paar die Einheit: „Zurückstellen“ stellt auch die übrigen offenen
   * Attempts desselben Paares in derselben Runde zurück, „Einreihen“ holt die zurückgestellten bzw. nachzuholenden
   * Attempts des Paares mit, in der Folge der Attempts. Sonst führe nach einem zurückgestellten 1. Attempt der
   * 2. desselben Paares – vor dem 1. und mit einem Paar, das nicht bereit ist (Regel 960, Pkt. 4.4: der frühere
   * Start ist der 1. Attempt). Gezielt zeigen geht wie im Manövrieren für jeden offenen Start; dort prüft der
   * Betrieb die Folge der Attempts nicht – das ist eine bewusste Entscheidung am Steg. Beim Bau von E4,
   * 16.11.2026 – noch zu bestätigen.
   * Nach der Prüfung von E4 (16.11.2026, vom Nutzer zu bestätigen): Gezielt gezeigt holt ein Attempt auch den
   * offenen Attempt seines Paares direkt hinter sich, der im Plan direkt dahinter steht (Halbfinale, Finals, Re-runs:
   * planung/parallelRunden.ts `mitKlasse`) – sonst käme nach einem gezielt gezeigten 1. Attempt erst ein Paar, das in
   * der Folge davor stand. Im Vorlauf wechseln die Blöcke zwischen den Attempts die Bootstypen; dort bleibt der Plan.
   */
  parallelPaarAlsEinheit: true,
  /**
   * (zu B-9, B-10, S-4, S-6, V-5, V-7) Im Parallelslalom gibt der festgeschriebene Plan die Folge vor: Paare
   * nach Klasse, Blöcke im Wechsel der Bootstypen, Tausch von Boot und Racecourse zum 2. Attempt. Es gibt keine
   * Spuren der Verzahnung, an denen sich „Boot fehlt“, „Andere Klassen vorziehen“, „Klasse vorziehen“ oder
   * „Verzahnung beim Verschieben halten“ ausrichten könnten. Diese Schritte und das Verschieben (Menü und Ziehen
   * in der Startliste) sind dort gesperrt – der Reducer ändert nichts, die Start-Freigabe zeigt einen Hinweis.
   * Ist ein Paar nicht bereit: zurückstellen und einreihen (`parallelPaarAlsEinheit`). Zeigen, Zurück,
   * Meldungen, Runde beginnen und „Einsteigen ab …“ (Runde, Klasse) gehen. Beim Bau von E4, 16.11.2026 – noch
   * zu bestätigen.
   */
  parallelOhneUmstellen: true,
  /**
   * (zu 12) Im Parallelslalom keine Prognose: Seine Starts werden nicht gemessen, und Startliste und
   * Zuschauerliste zeigen dort Folge und Gruppen (Am Steg, Vor Steg) ohne „ca. in“. Gründe: Die Abstände je
   * Klasse gelten dem Manövrieren – Paarstarts haben einen anderen Takt (zwei Boote zugleich, kurzer Racecourse,
   * Tausch von Boot und Racecourse zum 2. Attempt) und verzerrten dessen Mittel für den Rest des Tags; ein
   * eigener Abstand des Parallelslaloms bräuchte eine Vorgabe, die weder Regel 960 noch die Messdaten des
   * Prototyps hergeben, und bis zur dritten Messung gäbe es ohnehin keine Zahl – bei wenigen Dutzend Starts je
   * Runde kaum je eine. Später möglich: ein eigener gemessener Abstand des Bereichs. Beim Bau von E4,
   * 16.11.2026 – noch zu bestätigen.
   */
  parallelOhnePrognose: true,
  /**
   * Die gemeinsame Anzeigetafel (`anzeige.bereiche` leer = automatisch) zeigt alle Parcours und den Parallelslalom
   * erst, wenn dort eine Runde begonnen ist: Am Tag des Manövrierens bliebe sonst ein Drittel der Tafel auf
   * „bereit“. Eine eigene Tafel nur für ihn gibt es über „Eigene Anzeigetafel“ (`#/anzeige/parallel`), ausdrücklich
   * wählen lässt er sich in den Einstellungen. `false`: Er steht immer auf der gemeinsamen Tafel. Beim Bau von E4,
   * 16.11.2026 – noch zu bestätigen.
   */
  parallelAufDerTafel: true as boolean,
  /**
   * Die Lage von Racecourse A und B (`anzeige.parallelAnordnung`: A oder B links, A oder B oben – Entscheidung des
   * Nutzers vom 16.11.2026, „standortabhängig“) gilt nur für die Anzeigetafel, die das Publikum sieht. Die
   * Start-Freigabe, die Startliste im Betrieb und die Zuschauerliste bleiben bei A vor B: Am Steg und auf dem Handy
   * liest man sie wie die Listen der race officials, den Laufzettel und die Startlisten (überall A vor B), nicht vom
   * Ufer aus. Die Zeile „davor“ der Tafel nennt das Paar in der Folge der Seiten auf der Tafel (links bzw. oben
   * zuerst) – so steht jede Nummer auf derselben Seite wie eben noch im Boot. Beim Bau, 16.11.2026 – noch zu bestätigen.
   */
  parallelAnordnungNurTafel: true,
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
   * Auch beim Neu-Verzahnen (Klasse aussetzen, zurück, vorziehen) bleiben die Versuche eines Starters
   * beisammen – gewoben wird je Starter (betrieb/schritte.ts `webe`). Nach der Prüfung von E2, 16.11.2026.
   */
  versucheNacheinanderEinPunkt: true,
  /**
   * (zu 9) Hat ein Starter mit „Versuche nacheinander“ schon einen Versuch gefahren, fährt er die übrigen zu
   * Ende: Neu-Verzahnen lässt sie, wo sie sind (direkt hinter ihm) – außer sein Boot fehlt, dann kommen sie mit
   * der Klasse ans Ende. Nach der Prüfung von E2, 16.11.2026 – noch zu bestätigen.
   */
  angebrochenFaehrtZuEnde: true,
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
   * (7) Ausgesetzte Klasse („Boot fehlt“, V-5/L-7): Ihre Starts fahren nicht und stehen am Ende ihres
   * Punkts, gekennzeichnet, ohne Wartezeit. Mit „Andere Klassen vorziehen“ rückt die nächste Klasse
   * derselben Spur auf ihre Plätze (der Rest der begonnenen Punkte wird neu verzahnt); ohne schließen sich
   * nur die Lücken. Kommt das Boot zurück, wird der Rest des Punkts mit ihr neu verzahnt; spätere Punkte
   * bleiben auf der Verzahnung. Plan §7 Nr. 7, 16.11.2026 (betrieb/schritte.ts `webeNeu`).
   */
  ausgesetztAnsPunktende: true,
  /**
   * (8, Teil E2) Gezielt zeigen darf die Bedienung jeden Start, der nicht erledigt und nicht entfallen ist –
   * auch einen eines nicht begonnenen Punkts (B-5, S-4). Plan §7 Nr. 8, 16.11.2026.
   * Ausgelegt beim Bau von E2 (16.11.2026, noch zu bestätigen): auch einen zurückgestellten (er ist dann
   * nicht mehr zurückgestellt) und einen der „Boot fehlt“-Klasse (die Klasse setzt weiter aus). Ein anderer
   * als der Nächste rückt in der Folge hinter den Zeiger bzw. hinter den Start im Boot – dorthin, wo er
   * gefahren ist (B-7, wie showSlot im Prototyp); der Nächste bleibt der, der es vorher war.
   */
  zeigenJederOffene: true,
  /**
   * (zu 6 und 8) „Nachzuholen“ ist ein Start erst, wenn sein Punkt begonnen ist und hinter ihm schon ein
   * Start SEINES oder eines späteren begonnenen Punkts erledigt ist – nicht schon, weil er vor dem Zeiger
   * steht. Ohne Umstellungen ist das dasselbe. Fall: Der dritte Lauf eines Starters wurde mitten in Lauf 2
   * gesetzt und dort übergangen; er wartet auf seinen Punkt, und beginnt Lauf 3, ist er als Erster dran (S-9:
   * maßgeblich ist der Lauf, nicht die Stelle). `false` hieße: alles vor dem Zeiger ist nachzuholen – er
   * käme nie von selbst. Beim Bau von E2, 16.11.2026 – noch zu bestätigen.
   */
  nichtBegonneneWarten: true,
  /**
   * (zu 7) Ein Start einer ausgesetzten Klasse heißt „Boot fehlt“, gleich wo er steht – auch wenn der Zeiger
   * an ihm vorbeigezogen ist; er ist kein Nachzügler. Kommt das Boot zurück, werden diese Starts in den Rest
   * ihres Punkts eingewoben, solange der Punkt hinter dem Zeiger noch offene Starts hat. Ist der Punkt schon
   * vorbei (Lauf 2 läuft, das Boot fehlte bis zum Ende von Lauf 1), werden sie „nachzuholen“ – wie ein
   * verpasster Lauf, die Bedienung reiht sie ein. Beim Bau von E2, 16.11.2026 – noch zu bestätigen.
   * „Vorbei“ heißt: Der Zeiger steht schon im Block eines späteren Punkts. Stockt der Lauf nur (hinter dem
   * Zeiger ist nichts mehr offen, aber in diesem Lauf wurde zuletzt gefahren), kommen sie direkt hinter den
   * Zeiger und sind wieder frei (V-5: „der Rest des Laufs wird erneut mit ihr verzahnt“). Nach der Prüfung
   * von E2, 16.11.2026.
   */
  bootFehltVorNachzuholen: true,
  /**
   * (zu 1, 7 und V-7) Die Folge zerfällt in Blöcke, je Punkt einen, in der Folge des Programms; ein Start, den
   * die Bedienung in einen anderen Lauf gesetzt hat (eingereiht, verschoben, gezielt gezeigt), ist dort Gast
   * (betrieb/schritte.ts `bloecke`). Neu verzahnt wird nur, was im Block seines Punkts steht – Gäste und
   * hinausgesetzte Starts bleiben an ihrer Stelle; „ans Ende des Laufs“ und „vor/nach Lauf n“ zielen auf
   * Blockgrenzen. Grenze: Ein Start eines späteren Laufs genau am Ende des vorigen ist der Stelle nach der
   * erste seines Laufs (er wartet ohnehin auf ihn, S-9); beginnt der Lauf mit fehlendem Boot, wird er mit
   * verzahnt und bleibt der erste seiner Klasse. Nach der Prüfung von E2, 16.11.2026 – noch zu bestätigen.
   */
  bloeckeJePunkt: true,
  /**
   * (zu V-7) „Verzahnung beim Verschieben halten“ wirkt innerhalb eines Blocks: Dort rutscht die Spur mit.
   * Geht ein Start in einen anderen Lauf (S-4, S-6: „den dritten ans Ende von Lauf 2“, „vor Lauf 3“), wird er
   * genau ans Ziel gesetzt – die rutschende Spur schöbe sonst fremde Starts über die Laufgrenze, und das Ziel
   * würde verfehlt. Im Lauf, den er verlässt, und an der Grenze können dann zwei Starts derselben Spur
   * aufeinander folgen; das ist auch ohne Halten nicht zu vermeiden. Nach der Prüfung von E2, 16.11.2026 –
   * noch zu bestätigen.
   */
  haltenImBlock: true,
  /**
   * (zu 1) Der Schnappschuss trägt nur die umgestellten Punkte: Ein Lauf, den der Betrieb nicht angefasst hat,
   * folgt weiter der Verzahnung – auch einer, die gelöst, geändert und wieder festgeschrieben wird, wie die
   * WKR-Bögen. Umgestellte Läufe behalten ihre Folge (`sicht.abweichend` sagt es). Nach der Prüfung von E2,
   * 16.11.2026 – noch zu bestätigen (betrieb/schritte.ts `schnappschuss`).
   */
  unberuehrtePunkteFolgenVerzahnung: true,
  /**
   * (zu B-9, B-10) „Klassen · Boot fehlt“ an der Start-Freigabe gilt dem laufenden Lauf, solange dort noch
   * Starts frei sind oder auf ihr Boot warten – auch wenn gerade ein Nachzügler eines früheren Laufs als
   * Nächster eingereiht ist. Erst danach dem Punkt des Nächsten bzw. dem nächsten Lauf (betrieb/folge.ts
   * `arbeitsPunkt`). Nach der Prüfung von E2, 16.11.2026 – noch zu bestätigen.
   */
  klassenImLaufendenPunkt: true,
  /**
   * „Andere Klassen vorziehen“ ist anfangs an – wie im Tafel-Prototyp (`pullForward: true`): Fällt ein Boot
   * aus, bleibt der Wechsel zwischen den Spuren erhalten, ohne dass am Steg erst ein Schalter gesucht werden
   * muss. Beim Bau von E2, 16.11.2026 – noch zu bestätigen (`false`: anfangs schließen sich nur die Lücken).
   */
  vorziehenVorgabe: true as boolean,
  /**
   * (zu B-4) „Ans Ende des Laufs einreihen“: hinter den letzten Start des eigenen Punkts; ist der schon
   * vorbei (ein verpasster Lauf 1, während Lauf 2 läuft), ans Ende des laufenden Punkts – dort kommt er
   * wirklich dran (S-4: „den zweiten vor Beginn von Lauf 3“). Beim Bau von E2, 16.11.2026 – noch zu bestätigen.
   */
  einreihenEndeLaufend: true,
  /**
   * (zu 2) Auch die Schritte der Etappe E2 – zurückstellen, einreihen, Klasse aussetzen, vorziehen,
   * verschieben, einsteigen – gehen nur mit festgeschriebener Verzahnung: Sie legen eine Folge fest, und
   * die steht erst dann. Ohne Festschreiben (oder wieder gelöst) ändern sie nichts; „Zurück“, Meldungen
   * und Zurücksetzen gehen weiter. Beim Bau von E2, 16.11.2026 – noch zu bestätigen.
   */
  schritteNurFestgeschrieben: true,
  /**
   * (zu B-10) Eine Klasse, die unter den fahrenden Klassen ihre Spur für sich hat, lässt sich nicht
   * vorziehen (Lastenheft B-10: „ihre Plätze gehören ihr ohnehin alle“). Der Prototyp ließ in diesem Fall
   * stattdessen die andere Spur beginnen; das geht hier über das Vorziehen einer Klasse der anderen Spur.
   * Beim Bau von E2, 16.11.2026 – noch zu bestätigen.
   */
  alleinAufDerSpurFest: true,
  /**
   * (zu B-8) Meldungsvorlagen erscheinen in der Sprache der Anzeigetafel (wie alles, was dort steht),
   * beschriftet in der Sprache der Oberfläche; `{veranstaltung}` wird der Name der Veranstaltung, ohne
   * Namen ein allgemeines Wort. Texte nach dem Tafel-Prototyp (data/messages.ts, aus der bisherigen
   * Word-Lösung). Beim Bau von E2, 16.11.2026 – noch zu bestätigen.
   */
  vorlagenInTafelSprache: true,
  /**
   * (zu B-10, S-6) An der Start-Freigabe wird mit Knöpfen umgestellt, nicht gezogen (das Lastenheft nennt Drag
   * & Drop): „Vorziehen“ macht eine Klasse zur nächsten (BETRIEB_KLASSE_VOR vor die erste fahrende, umgestellt
   * nur innerhalb der Spuren); ein Start wird über ein Menü verschoben – vorziehen (vor den Nächsten), ans Ende
   * des Laufs, vor/nach Lauf n. Am Laptop am Steg ist ein Klick der sicherere Griff, ein Fehlgriff beim Ziehen
   * stellte die Folge vor Zuschauern um. Gezogen wird in der Startliste im Betrieb (E3, `ziehenInDerStartliste`);
   * Klassen werden nirgends gezogen. Beim Bau der Oberfläche von E2, 16.11.2026 – noch zu bestätigen
   * (components/betrieb/KlassenAussetzen.vue, BetriebsFolge.vue).
   */
  knoepfeStattZiehen: true,
  /**
   * (zu S-4, S-6) In der Startliste im Betrieb (components/betrieb/StartListe.vue) lässt sich ein offener Start ziehen:
   * Abgelegt auf einem anderen offenen Start heißt nach oben gezogen „vor ihn“, nach unten gezogen „hinter ihn“ –
   * BETRIEB_VERSCHIEBEN `{ vor }` bzw. `{ nach }`, also genau die Regeln des Menüs „Verschieben …“ (betrieb/schritte.ts
   * `verschiebe`: Blöcke je Lauf, nie vor den Zeiger, mit „Verzahnung halten“ rutscht die Spur im Block mit – der
   * Start landet dann auf dem nächsten Platz seiner Spur, nicht immer genau am Ablageort). Nicht gezogen werden
   * „Boot fehlt“, zurückgestellte und nachzuholende (sie haben ihre Knöpfe); für die Tastatur steht daneben dasselbe
   * Menü. Ohne festgeschriebene Verzahnung ruht beides. Beim Bau der Oberfläche von E3, 16.11.2026 – noch zu bestätigen.
   */
  ziehenInDerStartliste: true,
  /**
   * „Einsteigen ab …“ fragt nicht nach: Ein früherer Einstieg nimmt einen zu späten zurück (betrieb/schritte.ts
   * `einsteigen`), und Rückfragen gibt es an der Start-Freigabe nur vor Unumkehrbarem bzw. vor „Lauf beginnen“
   * mit noch offenen Starts (E1). Der Prototyp fragte mit confirm(). Beim Bau der Oberfläche von E2,
   * 16.11.2026 – noch zu bestätigen (components/betrieb/EinsteigenAb.vue).
   * Der gewählte Start ist danach der Nächste, auch wenn nach einem zu späten Einstieg schon gezeigt wurde: Er
   * und alles, was mit ihm wieder offen ist, rücken hinter den Zeiger (state/reducer/betrieb.ts BETRIEB_AB).
   * Nach der Prüfung von E2, 16.11.2026.
   */
  einsteigenOhneRueckfrage: true,
  /**
   * (12) Startabstand und Prognose (E3, betrieb/prognose.ts; Lastenheft der Tafel L-2 bis L-7): Gemessen wird der
   * Abstand zweier aufeinanderfolgender Anzeigen eines Bereichs, zugeschlagen der Klasse des VORIGEN Starts – die
   * Zeit von seinem Erscheinen bis zum nächsten hat sein Lauf gekostet (wie der Prototyp, lib/timing.ts). Abstände
   * unter `kuerzester` (Durchklicken, Fehlklick) oder über `laengster` Sekunden (Pause, Störung, Mittag) zählen
   * nicht (L-4). Ab `ab` Messungen einer Klasse (über alle Bereiche) gilt ihr Mittel, sonst die Vorgabe
   * (config/catalog.ts startabstandOf: eigener Wert, Regelwerk, einstellungen.yaml – unter UIM die allgemeine).
   * Plan §7 Nr. 12, 16.11.2026. Beim Bau von E3 (16.11.2026, noch zu bestätigen): Unter `ab` Messungen wird nicht
   * gemischt (der Prototyp gewichtete Vorgabe und Messung) – „ab 3 Messungen der Messwert“ wörtlich.
   */
  prognoseMessung: { ab: 3, kuerzester: 30, laengster: 300 },
  /**
   * (zu 12) Was keine Messung ist – beim Bau von E3, 16.11.2026, noch zu bestätigen: „ohne Anzeige“ Erledigtes
   * (Einsteigen) hat keine Zeit; steht zwischen zwei gezeigten Starts in der Folge ein solcher, zählt ihr Abstand
   * nicht (er umfasste mehrere Läufe). Ebenso nicht, wenn der vorige Start inzwischen entfällt (X: kein Lauf
   * gefahren) oder sein Starter gelöscht ist (Klasse unbekannt). „Zurück“ nimmt den Start aus dem Verlauf und so
   * auch aus der Messung.
   */
  keineMessungOhneLauf: true,
  /**
   * (zu 12, L-4) Kein Abstand über eine Punktgrenze: Gehören zwei nacheinander gezeigte Starts zu verschiedenen
   * Punkten (letzter Start von Lauf 1 → erster von Lauf 2), steckt der Laufwechsel darin – „Lauf beginnen“, WKR-Bögen
   * tauschen, kurz durchatmen. Unter 300 s bliebe er sonst in der Messung und verzerrte das Mittel der Klasse des
   * letzten Starts für den Rest des Tags (Prüfung: 110 s je Start, 280 s über die Grenze → Mittel 144 s statt 110 s).
   * Wann der Punkt begonnen wurde, steht nicht im Stand; also zählt kein Abstand zwischen zwei Punkten – auch nicht
   * der zu einem nachzuholenden oder gezielt gezeigten Start eines anderen Punkts. Eine verworfene Messung schadet
   * nicht, eine verzerrte schon. Mit „Versuche nacheinander“ gibt es nur einen Punkt, dort greift das nie. Der
   * Prototyp maß über die Grenze. Nach der Prüfung von E3, 16.11.2026 – noch zu bestätigen.
   */
  keineMessungUeberPunktgrenze: true,
  /**
   * (zu 12, L-2, L-7) Eine Wartezeit bekommen nur die freigegebenen Starts – offen und im begonnenen Punkt –, in
   * ihrer Folge: Rest des Starts im Boot (Abstand seiner Klasse minus seit; nie unter 0), dann je Start der
   * Abstand seiner Klasse. Ohne Zahl bleiben „Boot fehlt“ (wann es zurück ist, weiß niemand), Starts nicht
   * begonnener Punkte (deren Beginn steht nicht fest: Mittag, Nacht), zurückgestellte und nachzuholende (sie
   * kommen nicht von selbst). Gerechnet wird auf dem Bildschirm mit seiner Uhr; die Sicht trägt nur die Abstände
   * und `seit` (Kritik K28). Beim Bau von E3, 16.11.2026 – noch zu bestätigen.
   */
  wartezeitNurFreigegebene: true,
  /**
   * (zu L-2, L-7) Steht auf der Anzeigetafel eines Bereichs eine Pause oder Störung – jede Meldung außer „Hinweis“,
   * also die, die dort den Starter verdrängt –, bekommen seine Starts keine Zahl: Startliste und Zuschauerliste
   * behalten Folge und Gruppen (Am Steg, Vor Steg), „ca. in“ und „zum Vorsteg in“ bleiben leer, die Meldung steht
   * darüber („Mittagspause bis 13:30“). Wie lange es dauert, weiß die Liste nicht; weiterzuzählen hieße, Zahlen zu
   * erfinden. Dieselbe Grenze wie auf der Tafel, mit Absicht: Auch Begrüßungen („Gleich geht's los“) stehen als
   * Pause – solange sie stehen, fährt niemand, und vor dem ersten Start wäre jede Zahl erfunden. Ein „Hinweis“
   * (Art info) hält nichts an. Ist die Meldung weg, rechnet die Liste vom Start im Boot weiter (sein Rest ist dann
   * meist 0: der Nächste „gleich“). Nach der Prüfung von E3, 16.11.2026 – noch zu bestätigen
   * (betrieb/prognose.ts `bereichAngehalten`).
   */
  keineZahlBeiPause: true,
  /**
   * (zu 12, docs/stand.md „Zeit bis zum Vorsteg“) Am Vorsteg muss ein Starter sein, sobald er zu den nächsten
   * `amSteg + vorSteg` Starts gehört – also wenn der Start so viele Stellen vor ihm ins Boot geht: Zeit bis zum
   * Vorsteg = Wartezeit dieses Starts. Wer schon dazugehört, hat 0 (jetzt). Beim Bau von E3, 16.11.2026 – noch
   * zu bestätigen.
   */
  vorstegVorDenStegStarts: true,
  /**
   * (zu 12, L-6) „Messwerte als Vorgabe übernehmen“ (Einstellungen → Betrieb) übernimmt nur Klassen mit mindestens
   * `prognoseMessung.ab` Messungen – weniger sind auch für die Prognose zu wenig –, auf ganze Sekunden gerundet;
   * ein Wert gleich der Vorgabe wird kein eigener (der Stand hält nur Abweichungen, K24). Der Prototyp übernahm
   * schon ab einer Messung. Beim Bau von E3, 16.11.2026 – noch zu bestätigen.
   */
  vorgabeAbGenugMessungen: true,
  /**
   * Zuschauerliste (`#/zuschauer`, später der Zuschauer-Link): eine eigene, schmalere Sicht (betrieb/sicht.ts
   * `sichtZuschauer`, aus der öffentlichen abgeleitet). Sie trägt je Bereich nur den Start im Boot, die offene Folge
   * der begonnenen Punkte, deren „Boot fehlt“ und die Meldung – keine Bedienangaben (zur Wahl über alle Läufe,
   * zurückgestellt, nachzuholen, Einstiege, Klassen, Programm) und keine Logos. Grund: Der Link wird weitergegeben
   * (Minderjährige), und wer zurückgestellt ist, geht Zuschauer nichts an; Starter, die nur in Bedienangaben
   * vorkommen, stehen dann gar nicht darin. Beim Bau von E3, 16.11.2026 – noch zu bestätigen.
   */
  zuschauerSchmal: true,
  /**
   * (zu L-1, L-2, L-7) Die Zuschauerliste (components/zuschauer/ZuschauerListe.vue) gliedert je Parcours: „Im Boot“,
   * „Am Steg“ (die nächsten `amSteg`), „Vor Steg“ (die `vorSteg` danach), „Danach“, zuletzt „Boot fehlt“ ohne Zahl.
   * Wer am Steg oder vor Steg steht, bekommt keine „Zeit bis zum Vorsteg“ mehr (er ist schon da), die übrigen „ca. in“
   * und „zum Vorsteg in“. Der Klassenfilter blendet nur aus – Gruppe und Wartezeit zählen alle Klassen, sonst rückte
   * ein Starter scheinbar an den Steg. Unter einer Minute steht „gleich“, ab einer Stunde „1 h 05 min“. Die
   * Startliste im Betrieb zeigt dagegen die ganze Folge, auch nicht begonnene Läufe (ohne Zahl, L-2). Beim Bau der
   * Oberfläche von E3, 16.11.2026 – noch zu bestätigen.
   */
  zuschauerGruppen: true,
  /**
   * Team-Filter der Zuschauerliste (Feldtest 21.11.2026, Wunsch des Nutzers: „Es sollte aber auch ein Team-Filter
   * geben“). Auslegung beim Bau, bestätigt 21.11.2026 (Fragenseite P-10, P-11, P-12):
   * - Team = Herkunft der Veranstaltung, wie die Sicht sie nennt (Verein, Landesverband oder Nation nach `originMode`);
   *   Schlüssel ist ihr Klartext. Ohne Herkunft (Clubmeisterschaft, aus) oder mit nur einer gibt es keinen Filter.
   * - Mehrfachwahl, keine Wahl = „Alle“; UND mit dem Klassenfilter; ein Paar (Parallelslalom) passt, wenn eine Seite
   *   passt. Wie der Klassenfilter blendet er nur aus – Gruppe und Wartezeit zählen alle.
   * - Gemerkt je Bildschirm im localStorage (lib/merken.ts `dauerhaft`, Schlüssel `zuschauer.teams`), auf Lese-Link-
   *   Geräten genauso; nichts davon geht übers Netz oder in den Stand. Zugeklappt, solange nichts gewählt ist (lange
   *   Vereinslisten verdrängten am Handy die Starts).
   * Die Sicht bleibt unverändert (kein neues Feld, `sv` gleich) – die Herkunft stand schon darin.
   */
  zuschauerTeamFilter: true,
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
   * `sichtOeffentlich(stand, { logos })`. 16.11.2026. Umgesetzt in geraete/host.ts (E6).
   */
  logosNurLokal: true,
  /**
   * E6 (Gerätebetrieb, beim Bau 16.11.2026; bestätigt 26.11.2026, R11-15): Anzeigetafel- und Zuschauer-Link sind zwei
   * Gruppen mit eigenem Schlüssel, eigenen Nummern und eigenem Thema – `ko` (oA) trägt die öffentliche Sicht ohne
   * Logos, `kz` (oZ) die Zuschauersicht (`sichtZuschauer`). Der Plan (§5) sah eine Gruppe mit zwei Themen vor; die
   * schmalere Zuschauersicht kam erst mit E3. So trägt der Zuschauer-Link nur, was die Zuschauerliste zeigt, und sein
   * Schlüssel öffnet die Nachrichten der Anzeigetafel nicht. „Zuschauer-Link erneuern“ wechselt nur das Thema oZ
   * (Schlüssel und Nummern bleiben, der alte Link bekommt nichts mehr, die Anzeigetafel merkt nichts).
   */
  lesenJeLink: true,
  /**
   * E6 (beim Bau 16.11.2026; bestätigt 26.11.2026, R11-16): Der Uhrversatz eines Geräts („seit“, „ca. in“) ist der größte
   * Wert von „Sendezeit des Hosts minus Empfang“ über die letzten 20 frisch über das Abo gekommenen Nachrichten (die
   * Laufzeit ist nie negativ, der größte Wert liegt dem wahren Versatz am nächsten). Nachgeholtes aus der Abfrage zählt
   * nicht – ein Vollstand dort kann eine Stunde alt sein; bis zur ersten frischen Nachricht gilt 0 (geraete/geraet.ts).
   */
  uhrversatzFrisch: true,
  /**
   * E6 (beim Bau 16.11.2026; bestätigt 26.11.2026, R11-17): Wann der Gerätebetrieb endet. Nur „Raum beenden“ schickt das
   * signierte „Raum beendet“ an beide Links (Geräte löschen Sicht und Verbindung) – ohne Netz wird nach höchstens 8 s
   * ohne Meldung gelöscht, die Geräte löschen dann nach 36 h. Eine andere Veranstaltung (andere Kennung) trennt nur:
   * Der Raum bleibt liegen und gilt wieder, wenn die Veranstaltung zurückkommt; ein neu geöffneter Raum ersetzt ihn. Ein
   * anderer Server in den Einstellungen beendet den Raum nicht, sondern meldet `raum-anderer-server`, bis der Server
   * zurückgestellt oder der Raum beendet und neu geöffnet ist (geraete/host.ts).
   */
  raumEnde: true,
  /**
   * E6 (Entscheidung des Nutzers F7, 16.11.2026: Gerätebetrieb nur bei gleicher Fassung; Ausgestaltung beim Bau,
   * bestätigt 26.11.2026, R11-18: „gleiche Fassung“ = gleiche Form der Nachrichten): Ein Gerät lädt nur neu, wenn der Host signiert eine neuere Fassung spricht oder der Link eine
   * neuere Paket-Fassung trägt – je Fassung höchstens einmal in 10 Minuten (geraete/geraet.ts NEULADEN_SPERRE_MS),
   * danach bleibt „Update nötig“ stehen. Ist der Host älter: „Bedienrechner aktualisieren“, kein Neuladen.
   */
  fassungGleich: true,
  /**
   * E6, Oberfläche (beim Bau 16.11.2026; bestätigt 26.11.2026, R11-18 zu Pages und Selbst-Update, R11-19 zu Adresse,
   * Leiste und Rückfragen):
   * - Ein Lese-Link zeigt auf die Seite des Bedienrechners (ohne Anfrage und Anker), unter `file://` (Ein-Datei-Fassung)
   *   auf die App auf Pages (lib/build.ts PAGES_URL) – dort läuft oft eine neuere Fassung, dann sagt das Gerät
   *   „Bedienrechner aktualisieren“ (F7).
   * - Das Paket bleibt in der Adresse des Geräts (Abweichung von Plan §4, „per location.replace entfernen“): Lesezeichen
   *   und Neuladen brauchen es, das Gerät legt den Link-Text nicht ab. „Raum verlassen“ fragt erst und lässt `#/sehen`
   *   ohne Paket stehen.
   * - Über der Anzeigetafel eines Geräts steht die Leiste (Verbindung, Fingerabdruck, Vollbild, „Raum verlassen“) nur
   *   mit dem Mauszeiger bzw. nach einer Berührung – und immer, wenn die Verbindung nicht steht oder die Fassung nicht
   *   passt; unter der Zuschauerliste immer.
   * - Ein Gerät hat den Offline-Speicher, übernimmt eine neue Fassung aber nie von selbst – nur gezielt, wenn der
   *   Bedienrechner eine neuere spricht (lib/offline.ts holeNeueFassung, geht das nicht: Neuladen).
   * - „Zuschauer-Link erneuern“ und „Raum beenden“ fragen erst; „Gerätebetrieb einschalten“ nicht – der Text davor sagt,
   *   was dann über welchen Server geht.
   */
  leseLinkOberflaeche: true,
  /**
   * E7, Rechte der Start-Freigabe (Entscheidung F5 vom 16.11.2026; Ausgestaltung beim Bau 20.11.2026 – vom Nutzer zu
   * bestätigen): Positivliste geraete/aufgaben.ts STARTFREIGABE_ACTIONS = alle BETRIEB_* außer ZURUECKSETZEN, nur in
   * den Bereichen der Aufgabe, und nur Bereiche, die es im Stand gibt. Eine Meldung an ALLE Bereiche (`'*'`) darf kein
   * Gerät – auch eines mit allen Bereichen nicht: Sie schriebe auch auf Bereiche, die später dazukommen. Das Gerät
   * prüft dieselbe Liste nur, um Knöpfe zu sperren; maßgeblich ist der Host (Register, nie die Behauptung des Geräts).
   */
  startfreigabeRechte: true,
  /**
   * E7, Koppeln (Lastenheft der Tafel P-3/P-4; beim Bau 20.11.2026 – vom Nutzer zu bestätigen):
   * - Geräte-Code (6 Zeichen, 5 min, EIN Gerät) braucht auf dem Handy den **Koppel-Link** (`#/koppeln/<paket>`: alles
   *   des Anzeigetafel-Links plus der öffentliche Box-Schlüssel des Hosts). Der Link wird vorab verteilt, der Code kommt
   *   über Funk. Thema H(oA ‖ 'koppeln' ‖ code); ein Code gilt nur auf seinem Thema.
   * - QR-Code: Paket mit Token (30 s, der vorige noch 30 s Gnade – Prüfung E7: langsames erstes Laden) und dem
   *   ZUFÄLLIGEN Thema der QR-Sitzung; die Sitzung bleibt höchstens 10 Minuten offen (geraete/koppeln.ts
   *   QR_SITZUNG_MS), damit kein vergessenes Fenster ewig dreht. Scheitert ein gescannter Code, sagt das Gerät
   *   „noch einmal scannen“ (geraete.freigabe.qrNochmal).
   * - Ohne Antwort wiederholt ein Gerät mit wachsendem Abstand (10 s, 20 s, … höchstens 5 min; transport.ts
   *   wiederholAbstand) – ein vergessenes Handy mit falschem Code verbraucht so kaum Kontingent am gemeinsamen Hotspot.
   *   Die Anmeldung wird dabei nicht verworfen: Eine späte Antwort koppelt noch (Prüfung E7, 20.11.2026).
   * - Abgelaufene Koppel-Themen liest der Host noch 2 Minuten (KOPPEL_NACHLAUF_MS): Ein eben gekoppeltes Gerät, dessen
   *   `willkommen` verloren ging, meldet sich dort noch einmal und wird erneut begrüßt.
   * - Bestätigt 26.11.2026 (R11-21): Der Geräte-Code gilt 5 min, danach antwortet der Host noch 2 min mit „abgelaufen“,
   *   später gar nicht mehr (das Gerät zeigt nach 15 s „Keine Antwort“, wie bei einem Tippfehler); beim QR-Code heißt
   *   nur der vorige Wert „abgelaufen“, ältere „Der Code stimmt nicht.“, jeweils mit „noch einmal scannen“.
   * - Hingenommen: Der Betreiber des ntfy-Servers sieht oA und das Koppel-Thema und könnte den 6-stelligen Code
   *   zurückrechnen (≈ 6·10⁸ Versuche). Ihm fehlt der Box-Schlüssel des Hosts (steht nur im Koppel-Link), der Code gilt
   *   5 Minuten für ein Gerät, und ein fremdes Gerät stünde in der Geräteliste.
   */
  koppelnZeiten: true,
  /**
   * E7, gekoppelte Geräte (beim Bau 20.11.2026 – vom Nutzer zu bestätigen):
   * - Ein bekanntes Gerät (ID UND Schlüssel im Register) meldet sich nach jedem Start selbst an (P-7) und bekommt seine
   *   jetzigen Rechte. Rechte ändert der Bedienrechner in der Geräteliste (wirkt sofort). Ein neuer gültiger Code, über
   *   sein Koppel-Thema eingegeben, setzt auch für ein schon gebundenes Gerät die Rechte des Codes (der Bedienrechner
   *   hat sie so ausgegeben; Fall: `willkommen` ging verloren, das Gerät steht noch auf „koppelt“ und bekommt einen
   *   neuen Code) – Name und ID bleiben (geraete/koppelEntscheid.ts; Prüfung E7, 20.11.2026). Ein Gerät, das schon
   *   „gekoppelt“ ist, zeigt kein Code-Formular und meldet sich ohne Code an: Seine Rechte bleiben.
   * - Ein entzogenes Gerät liest die öffentliche Sicht weiter (K14) und kann mit einem neuen Code wieder gekoppelt
   *   werden (derselbe Schlüssel – der Host hatte ihn aus dem Register genommen).
   * - Schreibfenster: Jedes `pointerdown`/`keydown` in einem Fenster mit vollem Store gilt als Bedienung (geraete/host.ts);
   *   Geräte-Actions wendet das zuletzt bediente Fenster an, nach 1 s ohne Antwort das Führungsfenster.
   */
  gekoppelteGeraete: true,
  /**
   * E7, Oberfläche (beim Bau 20.11.2026 – vom Nutzer zu bestätigen):
   * - Keine Rückfrage „Gerät annehmen?“ am Bedienrechner: Gültiger Code bzw. QR-Token koppelt sofort mit den Rechten,
   *   die beim Ausgeben gewählt waren (components/betrieb/GeraeteKoppeln.vue). Den Code gibt nur, wer am Bedienrechner
   *   sitzt; ein fremdes Gerät stünde sofort in der Geräteliste und lässt sich entziehen.
   * - Ein gescannter QR-Code koppelt auf dem Handy ohne weitere Eingabe mit dem vorgeschlagenen Namen („iPhone“; der
   *   Host macht ihn eindeutig, umbenennen am Bedienrechner); der Token gälte nach 30 s + 30 s ohnehin nicht mehr.
   * - Ein einziger Bereich (ein Parcours) war für das nächste Gerät vorgewählt – seit 21.11.2026 NICHT mehr (Nutzer, W3-26:
   *   die Start-Freigabe ist ein Recht wie die Listen und nie vorgewählt; WKR_ANNAHMEN.freigabeVorwahlOhneListe).
   * - Auf dem Gerät nur die EIGENEN Bereiche, mit derselben StartFreigabe wie am Bedienrechner, ohne „Meldung auf
   *   allen“; alle Knöpfe gesperrt, solange eine Action ohne Quittung ist (nicht nur der gedrückte – die Sicht kann
   *   sich bis dahin ändern); nach 10 s „Keine Bestätigung – Verbindung prüfen“.
   * - Geht die Führung zwischen Anwenden und Quittung verloren, hört das Handy „unverändert“, obwohl sein Druck gewirkt
   *   hat (er wirkt genau einmal, `letzteNr` erst nach dem Anwenden). Gelöst nur über den Wortlaut „Nichts geändert –
   *   schon geschehen oder jemand anderes war schneller. Bitte die Anzeige prüfen.“ – bestätigt 26.11.2026 (R11-20).
   * - Auf eine Anmeldung mit falschem Code antwortet niemand (sein Thema hört der Host nicht): nach 15 s „Keine
   *   Antwort“ und das Formular wieder; eine neue Anmeldung ersetzt die alte in der Schlange (transport.ts
   *   verwirfAnmeldung).
   * - Entzogen: Das Gerät zeigt nur lesend, wer im Boot sitzt und wer als Nächstes (K14), nicht die Anzeigetafel.
   * - „Gerät entkoppeln“ löscht nur auf dem Gerät; der Host erfährt es nicht, das Gerät bleibt in seiner Liste, bis
   *   es dort entzogen wird.
   * - Die Geräteliste zeigt „zuletzt gehört“, nicht „verbunden“: Geräte senden keinen Herzschlag (Kontingent).
   */
  koppelnOberflaeche: true,
  /**
   * Feldtest 21.11.2026 (Befund 6, Auftrag des Nutzers): Der offen stehende Koppel-Link-QR (ohne Token) wurde statt des
   * QR-Codes zum Koppeln gescannt. Seitdem: „QR-Code zeigen“ ist der Hauptweg („scannen – fertig, kein Code nötig“);
   * Geräte-Code und Koppel-Link stehen zusammen im zugeklappten Weg „Anderer Weg: Geräte-Code über Funk“ (öffnet sich
   * beim Ausgeben eines Codes; der Koppel-Link wird erst bei offenem Weg gezeigt). Auf dem Handy mit Link ohne Token steht
   * über dem Code-Feld, wo der QR-Code zu finden ist. Auslegung: Aufgeklappt ist Bedienung ohne Merken (nach dem
   * Neuladen wieder zu) – bestätigt 21.11.2026 (Fragenseite P-13).
   */
  koppelnWege: true,
  /**
   * E8, Bildschirm wach halten (beim Bau 20.11.2026, bestätigt 26.11.2026, R11-22 – auch auf den Handys der Zuschauer;
   * lib/wachBleiben.ts): Wake Lock auf
   * jedem Gerät mit Lese-Link oder Start-Freigabe (GeraetApp, solange verbunden – nicht nach „Raum beendet“/„verlassen“)
   * und im zweiten Fenster für Anzeigetafel und Zuschauerliste. Neu angefordert, sobald die Seite wieder sichtbar ist.
   * Fehlt die API oder weist der Browser ab (iPhone vor iOS 16.4, http://, file://, Energiesparen), still; auf dem Gerät
   * nur ein leiser Satz in der Leiste („Bildschirm kann ausgehen …“) – über der Anzeigetafel nur mit Zeiger/Berührung.
   */
  wachBleiben: true,
  /**
   * E8, „Alle Geräte neu laden“ (beim Bau 20.11.2026, bestätigt 26.11.2026, R11-23):
   * - Signierte Gruppenmeldung `neu-laden` an `ko` und `kz` (gab es seit E5 im Protokoll; PROTOKOLL_FASSUNG blieb 1, 2 erst
   *   mit W1 – ältere Geräte überhören sie). Gekoppelte Handys lesen `ko` und laden mit.
   * - Das Gerät holt wie bei einer neueren Fassung des Hosts das Programm (lib/offline.ts holeNeueFassung, geht das
   *   nicht: location.reload) – je Befehl (Raum, Gruppe, Nummer) einmal, gemerkt in der Geräteablage VOR dem Laden;
   *   ohne Speicher gar nicht. Nur frische Befehle (höchstens 10 min alt, geraet.ts NEULADEN_BEFEHL_GUELTIG_MS): Ein
   *   Gerät, das Stunden aus war, lädt nicht nach.
   * - Rückfrage am Bedienrechner. Läuft der Bedienrechner mit einer anderen Fassung als zuletzt im Gerätebetrieb
   *   (Commit und Build-Zeit, gemerkt in der Host-Ablage), bietet Betrieb → Geräte den Knopf als Hinweis an („Nicht
   *   nötig“ blendet ihn aus). Ein neuer Raum merkt die laufende Fassung gleich.
   * - Ohne Verbindung geht der Befehl nicht hinaus, auch nicht später (Prüfung 21.11.2026): Der Knopf sendet nur bei
   *   stehender Verbindung (sonst „Keine Verbindung – nichts gesendet“), und eine Meldung, die trotzdem in der Schlange
   *   hängen bleibt (Abriss im selben Augenblick), verfällt nach 1 min (transport.ts NEULADEN_SENDEN_MS). Ein Gerät,
   *   das binnen 10 min nach dem Befehl wieder verbunden ist oder einen Link öffnet, lädt dagegen noch nach.
   */
  alleNeuLaden: true,
  /**
   * E8, Kontingent (beim Bau 20.11.2026; Grenzen vom Nutzer bestätigt 21.11.2026; geraete/kontingent.ts KONTINGENT,
   * tagesGrenze): Grenze je Server – ntfy.adminforge.de 17 280, ntfy.sh 250 Nachrichten je Tag und IP (abgefragt über
   * /v1/account, November 2026), andere Server unbekannt (nur zählen, warnen bei 429). Warnung ab 80 % oder sobald
   * der Server heute „zu viele Anfragen“ (429) gemeldet hat. Gezählt wird nur am Bedienrechner (Nachrichten = von ntfy
   * angenommene POSTs; Anfragen = alle POSTs, Abfragen, Anhänge, Abos), je lokalem Kalendertag, gerätelokal.
   * Überschlag: ein Wettkampftag erzeugt ≈ 600–850 Nachrichten – weit unter 17 280; ntfy.sh (250) reicht nicht.
   * Warnung ab 80 % und Zählen nur am Bedienrechner bestätigt 26.11.2026 (R11-24) – obwohl Geräte, die am selben
   * Hotspot selbst senden (Start-Freigabe, WKR-Geräte), beim Server mitzählen; der Überschlag enthält die digitale
   * WKR-Erfassung noch nicht (nicht gemessen).
   */
  kontingent: true,
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
  // --- Parcours-Ampel und Auto-Modus (Nutzer 21.11.2026, P-03/P-04; Plan docs/plan-antworten-runde3-6.md §3) ------
  /**
   * (AM6) Auto-Modus der Start-Freigabe („Es kann auch einen Auto-Modus geben, der automatisch weiterschaltet, wenn alle
   * WKR ihre Eintragung abgeschickt haben. Das klappt aber nur, wenn alle ein Gerät haben.“): Einstellung
   * `anzeige.wkrAuto`, Vorgabe aus. Wirksam nur, wenn im Bereich JEDE Parcours-Liste digital, aktiv und laut Register von
   * einem Gerät abgedeckt ist – sonst steht an der Start-Freigabe „Auto aus: … auf Papier“. Wird die Ampel `frei`,
   * zählt die Start-Freigabe sichtbar `autoVerzugSek` herunter (mit „Anhalten“), dann zeigt der Host den ersten offenen
   * Start des begonnenen Punkts (`naechster`). Nie automatisch: einen neuen Punkt beginnen, Nachzuholende oder
   * Zurückgestellte zeigen, bei offener Rückfrage oder offenem Vorschlag einer Liste des Bereichs, bei einer Meldung
   * „Pause“ oder „Störung“, nach „Zurück“ bzw. nach dem Neuladen (gezählt wird nur, wenn der Host die Ampel desselben
   * Starts vorher grün oder rot gesehen hat). Dispatch nur im Fenster mit der Führung (geraete/fuehrung.ts) über
   * dasselbe Schreibfenster wie die Geräte-Actions; die Entscheidung rein in wkr/ampel.ts autoSchritt.
   * 21.11.2026, noch zu bestätigen.
   * Bestätigt 22.11.2026 (R7-06 Einstellung, Vorgabe aus, 3 s mit „Anhalten“; R7-07 nie von selbst).
   */
  autoVorgabe: false,
  /** (AM6) Sekunden zwischen „frei“ und dem automatischen „Nächster Start“ – Zeit für „Anhalten“. 21.11.2026, noch zu bestätigen. */
  autoVerzugSek: 3,
  /**
   * (AM7) „Anhalten“ des Auto-Modus gilt bis zum nächsten gezeigten Start und liegt gerätelokal im Host (Arbeitsspeicher
   * des Führungsfensters), nie im AppState – vom Freigabe-Handy als Geräte-Nachricht `BETRIEB_AUTO_HALT` (keine
   * Reducer-Action, der Host fängt sie vor dem Schreibfenster ab). 21.11.2026, noch zu bestätigen.
   * Bestätigt 22.11.2026 (R7-08).
   */
  autoAnhaltenLokal: true,
  /**
   * (AM8) Keine Ampel auf Anzeigetafel und Zuschauerliste (F17: nichts aus der WKR-Erfassung auf öffentlichen Links;
   * die Tafel zeigt den Starter ohnehin erst ab grün). sichtOeffentlich/sichtZuschauer bleiben unverändert, `sv` 6.
   * 21.11.2026, noch zu bestätigen.
   * Bestätigt 22.11.2026 (R7-09).
   */
  keineAmpelAufTafel: true,
  // --- Wiederholung nach Ausfall (Nutzer 26.11.2026, R11-11) ---------------------------------------------------------
  // „Bei einem bestätigten Ausfall kommt es zu einer Wiederholung des Laufes. … Wenn der Ausfall Verschulden vom Starter
  // ist, dann ist es ein J Falscher Parcours.“ Auf Rückfrage entschieden (26.11.2026): von Hand einreihen, Werte werden
  // verworfen, ausgelöst am Bedienrechner. Gilt für das Manövrieren (DM und UIM); der Parallelslalom hat seinen eigenen
  // Re-run. „J bei Verschulden“ setzt der WKR an einer Boje – dafür baut die App nichts.
  /**
   * (WH1) Der abgebrochene Versuch bleibt im Verlauf der Anzeige (`gezeigt` mit `abgebrochen`: Tafel „davor“, Messung
   * nicht), zählt aber nicht als erledigt – der Start ist wieder offen, bis er erneut gezeigt wird (betrieb/folge.ts lage).
   * Die Werte leert eine eigene Action der Erfassung (WIEDERHOLUNG_AUSFALL, state/reducer/erfassung.ts) – der Betrieb
   * selbst schreibt nie in `eingaben`. 26.11.2026 (Nutzer: „Werden verworfen“).
   */
  wiederholungNichtErledigt: true,
  /**
   * (WH2) „Wiederholung offen“: Der Start fährt nie von selbst. Die Wettkampfleitung setzt ihn an der Start-Freigabe an
   * seine Stelle – „Als Nächster“, „Ans Ende des Laufs“ (BETRIEB_EINREIHEN) oder „Jetzt zeigen“ (BETRIEB_ZEIGEN); erst
   * dann zeigt ihn die Folge wieder. Einreihen und Zeigen gehen auch vom Freigabe-Handy (dieselben Actions).
   * 26.11.2026 (Nutzer: „Von Hand einreihen“).
   */
  wiederholungVonHand: true,
  /**
   * (WH3) Auslösen nur am Bedienrechner (Nutzer 26.11.2026: „Bedienrechner“), mit Rückfrage, die Startnummer, Lauf und
   * Folgen nennt; die Wahl sind die gezeigten, geltenden Starts der begonnenen Punkte, der jüngste zuerst, mit Suche nach
   * Startnummer (betrieb/sicht.ts `gefahren`, nur am Bedienrechner, nie auf der Leitung). Beim Bau 26.11.2026, noch zu
   * bestätigen: Das Freigabe-Handy löst nicht aus (WIEDERHOLUNG_AUSFALL steht nicht in der Positivliste
   * geraete/aufgaben.ts – es ist eine Action der Erfassung, keine des Betriebs).
   * Prüfbefund 27.11.2026: Starts abgemeldeter Starter stehen ausgegraut in der Wahl („abgemeldet – keine Wiederholung“,
   * WH10) – vorher bestätigte man die Rückfrage, und still geschah nichts. BetriebView gibt die Abmeldungen dazu; die
   * Sicht trägt sie nie.
   * Bestätigt 27.11.2026 (R12-18 (4)): In der Wahl stehen alle schon gezeigten, geltenden Starts der Läufe, die gerade
   * laufen, der zuletzt gezeigte oben; die ersten acht sofort, die übrigen über die Suche nach Startnummer; beim
   * Einsteigen mitten im Wettkampf ohne Anzeige Erledigte fehlen. Die Abgemeldeten ausgegraut: R12-18 (6). Weiter zu
   * bestätigen: dass das Freigabe-Handy nicht auslöst (nicht gefragt).
   */
  wiederholungNurBedienrechner: true,
  /**
   * (WH4) „Zurück“ nimmt einen abgebrochenen Versuch nicht zurück (er ist schon „verbraucht“). Wer sich vertan hat:
   * „Doch keine Wiederholung“ in der Liste „Wiederholung offen“ (nur am Bedienrechner), solange der Start nicht wieder
   * gezeigt ist – der zuletzt abgebrochene Versuch gilt wieder. Beim Bau 26.11.2026; dass „Zurück“ den Versuch nicht
   * nimmt und „Doch keine Wiederholung“ nur am Bedienrechner geht, ist weiter zu bestätigen (in R12-11 nur als
   * Hintergrund genannt, nicht gefragt).
   * Umgebaut nach dem Prüfbefund 27.11.2026: Vorher holte nur „Einstellungen → Verlauf“ die Werte zurück – und nahm
   * dabei alles seitdem Eingetragene mit; ohne das stand der Start erledigt, aber leer da, und die WKR-Geräte boten ihn
   * unter der alten Kennung nie wieder an (sie hielten ihre Zeile für übernommen). Jetzt ist „Doch keine Wiederholung“
   * eine Action der Erfassung (WIEDERHOLUNG_AUFHEBEN, state/reducer/erfassung.ts): Die beim Ausfall verworfenen Werte
   * (samt Haken und „keine Zeit“) liegen solange in WkrStand.verworfen und kommen zurück – nur in leere Zellen; was seit
   * dem Ausfall eingetragen wurde, bleibt. Rückfragen, Vorschläge und Papier-Vermerke von damals kommen nicht zurück.
   * Die Geräte haben damit wieder ihre Kennung und ihre Zeile; der Start ist erledigt (Haken).
   * Bestätigt 27.11.2026 (R12-11): Die alten Werte kommen nur in Felder, die jetzt leer sind (auch die Haken „Liste
   * erledigt“ und „keine Zeit“); was seit dem Ausfall eingetragen wurde, bleibt; offene Rückfragen und Vorschläge von
   * damals kommen nicht zurück. Nicht gefragt: die Papier-Vermerke (P der Pausen, `papier` der Abschlüsse).
   */
  wiederholungAufheben: true,
  /**
   * (WH5) Anzeigetafel und Zuschauerliste zeigen beim Start „Wiederholung“ (im Titel des Laufs: „1. Lauf · Wiederholung“)
   * – ohne Grund, ohne Werte; die Start-Freigabe ebenso. Der abgebrochene Versuch selbst bleibt dort ohne Kennzeichen
   * stehen, bis der nächste Start kommt. Beim Bau 26.11.2026, bestätigt 27.11.2026 (R12-12) – ebenso das Englische
   * „Repeat“ („Attempt 1 · Repeat“, „Repeat (breakdown) …“, „Repeat pending“, „No repeat after all“), nie „Re-run“: So
   * heißt in Regel 960 die Wiederholungsrunde des Parallelslaloms, unter UIM können beide auf derselben Tafel stehen.
   */
  wiederholungAufTafel: true,
  /**
   * (WH6) Mit „Versuche direkt nacheinander“ gilt die Zeile am Vorsteg für alle Versuche des Starters (wkr/liste.ts
   * startAufListe `weitere`): Sie bleibt bei der Wiederholung eines Versuchs stehen – das Boot fährt nicht noch einmal
   * durch die Vorsteg-Kontrolle. Alle anderen Listen dieses Versuchs werden geleert. Beim Bau 26.11.2026, bestätigt
   * 27.11.2026 (R12-13; die Rückfrage beim Auslösen sagt es).
   * Prüfbefund 27.11.2026, nachgezogen: Für diese Liste ist auch keine Geräte-Kennung veraltet (das Gerät darf seine
   * Zeile weiter korrigieren, eine verspätete gilt), P der Pausen und Abschlüsse bleiben, und die Erfassung zeigt dort
   * kein ↻ (es ist keine Zeile gestrichen).
   */
  wiederholungVorstegBleibt: true,
  /**
   * (WH7) WKR-Geräte bekommen die Wiederholung als neuen Start: eigene Kennung je Versuch (wkr/versuch.ts), sonst hielte
   * das Gerät ihn für schon geschickt. Eine späte Gerätezeile zum abgebrochenen Versuch (kam nach dem Leeren an) wird
   * abgelehnt (`versuch-abgebrochen`, das Gerät zeigt es) – nie still wieder eingefüllt und keine Rückfrage am
   * Bedienrechner: Ihre Werte gehören zu einem Versuch, den die Wettkampfleitung verworfen hat; auf dem Gerät bleiben sie
   * unter „Zuletzt“ lesbar. Beim Bau 26.11.2026, bestätigt 27.11.2026 (R12-14).
   * Prüfbefund 27.11.2026: Die Zeile trägt ihren Versuch (WkrZeile.versuch), und WKR_ZEILEN prüft ihn beim Anwenden
   * noch einmal – zwischen der Prüfung im Führungsfenster und dem Anwenden im Schreibfenster (zwei Fenster) konnte der
   * Ausfall dazwischenkommen. Ausnahme: die Vorsteg-Zeile mit „Versuche nacheinander“ (WH6) gilt für jeden Versuch –
   * dort ist keine Kennung veraltet (wkr/versuch.ts versuchVeraltetAuf). Bestätigt 27.11.2026 (R12-14) samt dem
   * seltenen Sonderfall: Kommt die Zeile genau beim Wechsel zwischen zwei Fenstern an, fehlt auf dem Gerät der Satz und
   * es zeigt ✓ – übernommen wird sie auch dann nicht.
   * Bestätigt 27.11.2026 (R12-16): Am Gerät ändert sich nichts – die alte Zeile bleibt unter „Zuletzt“ und in der
   * Übersicht beim Abschließen mit ✓ stehen (die Startnummer steht dann zweimal, die Wiederholung kommt als neuer
   * Start); für den Abschluss zählt sie nicht (WKR_ABSCHLUSS überspringt Prüfsummen veralteter Versuche).
   */
  wiederholungSpaeteZeileAblehnen: true,
  /**
   * (WH8) Beim Auslösen fallen Rückfragen, Vorschläge und „keine Zeit“ dieses Versuchs weg, der Start fällt aus „Papier“
   * (P) der Pausen und aus `papier`/`abweichend` der Abschlüsse. Ein schon abgeschlossener Lauf einer Liste bleibt
   * abgeschlossen: Die Zeile der Wiederholung wird dort ein Vorschlag „abgeschlossen“. Beim Bau 26.11.2026; der
   * abgeschlossene Lauf bestätigt 27.11.2026 (R12-15, unten), dass Rückfragen und Vorschläge wegfallen (und auch mit
   * „Doch keine Wiederholung“ nicht zurückkommen) mit R12-11. Nicht gefragt: P der Pausen und `papier`/`abweichend`.
   * Prüfbefund 27.11.2026: Vorher kam die Wiederholung auf einer Liste, die den Lauf schon abgeschlossen hatte, gar nicht
   * auf das Gerät (die Schlange ließ abgeschlossene Punkte aus) – die Zeile, die Vorschlag werden sollte, entstand nie,
   * und mit „Druck nach Modus“ fehlte oft auch der Bogen. Jetzt lässt wkr/schlange.ts eine Wiederholung (ein geltender
   * Versuch nach einem abgebrochenen) auch in einem abgeschlossenen Punkt durch – anders als jeden anderen Start nach
   * dem Abschluss; was der Abschluss mit „Rest auf Papier“ nannte, bleibt Papier. Matrix und Rückstand zählen sie wie
   * einen offenen Start. Auslegung 27.11.2026, bestätigt 27.11.2026 (R12-15): Das Gerät bekommt die Wiederholung wieder
   * angeboten, die Eingabe kommt als Vorschlag „abgeschlossen“ an (ein Klick zum Annehmen), der Abschluss mit dem Namen
   * des WKR bleibt; in der Übersicht der WKR-Erfassung steht der Start bis dahin offen. Die Wiederholung löst den
   * Abschluss nicht.
   */
  wiederholungAbschlussBleibt: true,
  /**
   * (WH9) Ein abgebrochener Start im Boot hat keine Parcours-Ampel und keinen Auto-Modus (wkr/lage.ts durchfahrtVon);
   * eine Durchfahrt für ihn fällt weg. „Nächster Start“ geht von Hand. Beim Bau 26.11.2026, bestätigt 27.11.2026
   * (R12-18 (5)).
   */
  wiederholungOhneAmpel: true,
  /**
   * (WH10) Keine Wiederholung für einen abgemeldeten Starter (Disq. X kommt beim Abmelden in leere Läufe – geleert
   * stünde er sonst offen da) und keine im Parallelslalom (dort gilt der Re-run, lib/parallelErgebnis.ts). Beim Bau
   * 26.11.2026. Für Abgemeldete bestätigt 27.11.2026 (R12-18 (6)): ausgegraut in der Wahl mit „abgemeldet – keine
   * Wiederholung“; soll er doch fahren, nimmt die Leitung zuerst die Abmeldung zurück.
   */
  wiederholungNurManoevrieren: true,
} as const
