# Betrieb am Wettkampfort

Was Auswerter vor und während eines Wettkampfs wissen sollten:
ohne Internet arbeiten, neue Fassungen, Sicherung und Verlauf – und der Gerätebetrieb, der als einziger Teil ins Netz geht.
Schritt für Schritt: [Ablauf am Wettkampftag](#ablauf-am-wettkampftag); Feldtest der Geräte: [feldtest.md](feldtest.md).
Was die App fachlich kann: [funktionen.md](funktionen.md).
Wie der Offline-Speicher gebaut ist: [technik.md](technik.md#offline-speicher).

## Inhalt

- [Ohne Internet](#ohne-internet)
- [Vor dem Wettkampf (mit Netz)](#vor-dem-wettkampf-mit-netz)
- [Neue Fassung](#neue-fassung)
- [Daten behalten](#daten-behalten)
- [Zwei Speicher gegen den harten Abbruch](#zwei-speicher-gegen-den-harten-abbruch)
- [Verlauf](#verlauf)
- [Grenzen](#grenzen)
- [Die Ein-Datei-Fassung](#die-ein-datei-fassung)
- [Gerätebetrieb](#gerätebetrieb)
- [Ablauf am Wettkampftag](#ablauf-am-wettkampftag)

## Ohne Internet

Am Wettkampfort gibt es oft kein Netz.
Alcatraz lädt im Betrieb nichts nach; die Daten liegen im Browser.
Die einzige Ausnahme ist der [Gerätebetrieb](#gerätebetrieb) – und auch der erst, wenn ihn jemand einschaltet.
Damit auch **Neuladen, ein neuer Tab und ein Neustart des Browsers** ohne Netz gehen,
legt die Pages-Fassung beim ersten Aufruf einen Offline-Speicher für das Programm an (Service Worker).
Alle Dateien – Seite, Programm, Gestaltung, Bilder und die Ein-Datei-Fassung – liegen danach auf dem Gerät.

**Was ohne Netz geht:** alles – jede Ansicht, Drucken, Sicherung herunter- und einspielen,
auch das Herunterladen der Ein-Datei-Fassung, die Anzeigetafel und die Zuschauerliste im zweiten Fenster.
Netz brauchen nur die Suche nach einer neuen Fassung und der Gerätebetrieb (Anzeigetafel und Zuschauer auf anderen Geräten).

## Vor dem Wettkampf (mit Netz)

1. Die Seite auf dem Auswertungsrechner einmal öffnen –
   in dem Browser und unter der Adresse, die am Wettkampftag benutzt werden.
2. Warten, bis in der Fußzeile bzw. unter „Einstellungen → Ohne Internet“ **„Offline bereit“** steht.
   Steht dort „Neue Fassung verfügbar“: jetzt „Update“ drücken, nicht erst am Wettkampftag.
3. Zur Probe das Netz trennen und die Seite neu laden.
4. Eine Sicherung herunterladen („Einstellungen → Dateien“) – und während des Wettkampfs immer wieder.

Reißt die Verbindung beim ersten Laden ab, versucht Alcatraz es nach 5 und nach 30 Sekunden noch einmal.
Hilft das nicht, steht „Kein Offline-Speicher“ da – mit dem Knopf „Erneut versuchen“.
„wird vorbereitet“ heißt also immer, dass wirklich noch geladen wird.

## Neue Fassung

- Sie wird nie mitten im Wettkampf untergeschoben.
  Ein Wettkampf geht über zwei bis vier Tage, und der Rechner wird zwischendurch neu gestartet.
- Der Browser sieht beim Öffnen oder Neuladen der Seite nach (und auf „Nach neuer Fassung suchen“).
  Er lädt eine neue Fassung vollständig im Hintergrund in einen eigenen Speicher.
- Solange **Starter** eingetragen sind, bleibt die laufende Fassung –
  über Neuladen, neue Tabs, das Schließen aller Fenster und einen Neustart von Browser oder Rechner hinweg,
  auch ohne Netz.
- Liegt die neue Fassung vollständig bereit, erscheint in der Kopfzeile vor „Einstellungen“ der Knopf **„Update“**.
  Denselben gibt es unter „Einstellungen → Ohne Internet“.
  Dort steht auch, welche Fassung läuft und welche bereitliegt:
  der Zeitpunkt des Builds mit Sekunden, damit zwei Builds derselben Minute zu unterscheiden sind.
- „Update“ legt den Stand zuerst im Verlauf ab („vor dem Update auf …“), schaltet um und lädt dieses Fenster neu.
  Andere offene Fenster laden nicht von selbst neu, sondern zeigen einen Hinweis.
- Ist der Stand **leer**, übernimmt Alcatraz eine bereitliegende Fassung beim Öffnen von selbst.
  Als leer gilt: keine Starter (vor dem Anlegen, nach „Alles zurücksetzen“; `standLeer` in `src/lib/eingaben.ts`).
- Die Daten im Browser bleiben in jedem Fall unverändert.

## Daten behalten

Sobald Starter vorhanden sind, bittet Alcatraz den Browser, die Daten dieser Seite nicht von sich aus zu löschen
(`navigator.storage.persist()`, höchstens einmal am Tag; von Hand unter „Ohne Internet“).
Ob er zugesagt hat, steht dort.
Der eigentliche Schutz bleibt die **Sicherungsdatei** –
auch die Zusage schützt nicht davor, dass jemand die Browserdaten löscht.

## Zwei Speicher gegen den harten Abbruch

Der Browser schreibt den `localStorage` gebündelt und mit Verzögerung auf die Platte.
Wird das Fenster ordentlich geschlossen, geht nichts verloren.
Bei einem harten Abbruch – Absturz, leerer Akku, Stromausfall – fehlten bisher die letzten Eingaben,
ohne dass die Anwendung es merkte.
In Chromium gemessen: alles aus der letzten Sekunde, unter Last bis zu rund einer Minute.

- Deshalb geht jede Änderung zusätzlich in einen **zweiten Speicher**, eine IndexedDB desselben Browsers.
- Dort ist sie nach wenigen Millisekunden abgeschlossen.
  Gemessen bei 336 Startern mit allen Eingaben: im Mittel 5 ms, höchstens 26 ms; bei pausenlosem Tippen höchstens 47 ms.
- Beim Start vergleicht Alcatraz beide Speicher und nimmt den neueren Stand.
  War es der zweite, steht oben **„Nach einem Abbruch wiederhergestellt … bitte die zuletzt erfassten Werte prüfen“**
  mit dem Zeitpunkt des Stands.
- Der Test dazu: zehn Eingaben tippen, die elfte, und den Browser 0, 50, 200 und 1000 ms danach mit `SIGKILL` beenden.
  Ohne zweiten Speicher fehlten jedes Mal alle elf, mit ihm keine.
  Geprüft ist das Beenden des Browsers.
  Bei einem Stromausfall kommt es zusätzlich darauf an, dass das Betriebssystem geschrieben hat;
  der zweite Speicher verlangt das vom Browser ausdrücklich („durability: strict“).

Das Tippen bremst das nicht:

- Der zweite Speicher bekommt den Text, der für den ersten ohnehin gebildet wird, und schreibt im Hintergrund.
- Es läuft immer nur ein Schreibvorgang; kommen währenddessen weitere Änderungen, wartet nur die jüngste.
- Wird die Seite verborgen oder verlassen, geht auch sie sofort hinaus.
- Mehrere Fenster vertragen sich wie bisher (ein Fenster übernimmt den Stand des anderen).
  Aus dem zweiten Speicher wird nur beim Start gelesen, nie im laufenden Betrieb.
- Dabei gilt immer der ganze Stand des Fensters, das zuletzt geschrieben hat.
  Abwechselnd in mehreren Fenstern zu arbeiten ist unbedenklich,
  aber **nicht in zwei Fenstern im selben Augenblick erfassen**:
  Tippen zwei Fenster innerhalb weniger Millisekunden, kann die Eingabe des einen fehlen.
  Im Test war das nur mit erzwungenem Gleichlauf auszulösen; von Hand hat immer nur ein Fenster die Tastatur.

Gibt es keine IndexedDB (privates Fenster mancher Browser, sehr alte Browser, gesperrter Speicher),
läuft Alcatraz wie bisher mit dem `localStorage` allein und sagt das unter „Dateien“ und „Ohne Internet“.
Dann gilt weiter: nach einem Absturz die zuletzt erfassten Starter gegen die Zettel prüfen.
Beide Speicher liegen im selben Browser auf demselben Gerät.
Gegen ein verlorenes oder defektes Gerät und gegen gelöschte Browserdaten hilft weiterhin nur die **Sicherungsdatei**.

## Verlauf

- Der zweite Speicher hält die letzten Stände vor („Einstellungen → Dateien → Verlauf“).
  Jeder Eintrag hat Zeitpunkt und das, was sich geändert hat:
  „Eingabe Klasse 4, 2. Lauf · 17 Änderungen“, „12 Starter importiert“, „Aufbau gewechselt“.
- Gleichartige Änderungen kurz nacheinander sind ein Eintrag
  (bis zu einer Pause von zwei Minuten, höchstens zehn Minuten lang).
- Jeder Stand lässt sich wiederherstellen.
  Der jetzige geht dabei nicht verloren; er steht dann selbst im Verlauf, man kommt also wieder nach vorn.
- **„Stand merken“** legt den jetzigen Stand unter einem Namen ab („vor dem Test“).
  Gemerkte Stände bleiben, bis man sie löscht; die übrigen weichen neueren (höchstens 100, höchstens 30 Tage alt).
- Ein Stand mit 336 Startern und allen Eingaben belegt in Chromium rund 50 bis 100 kB auf der Platte,
  100 Stände also rund 5 bis 10 MB.
- Logos stehen in jedem Stand mit: zusammen höchstens rund 0,3 MB je Stand, bei 100 Ständen also bis zu rund 30 MB
  mehr; übliche Logos deutlich weniger.
- Der Verlauf enthält Namen und Ergebnisse.
  Er liegt nur auf diesem Gerät, steht in keiner Sicherung und keiner Vorlage, und „Alles zurücksetzen“ löscht ihn mit.
  Scheitert das Löschen im zweiten Speicher ausnahmsweise, holt es die nächste Änderung oder der nächste Start nach.

## Grenzen

Der Offline-Speicher gilt je Browser und Adresse.
Im privaten Fenster mancher Browser, ohne https oder wenn der Browser ihn ablehnt, steht „Kein Offline-Speicher“ da.
Die Anwendung läuft dann wie bisher, lässt sich ohne Netz aber nicht neu laden.
Der Entwicklungsserver (`npm run dev`) legt keinen an.

## Die Ein-Datei-Fassung

Die Ein-Datei-Fassung (`alcatraz.html`) gibt es unter „Ohne Internet“ zum Herunterladen,
oder man baut sie mit `npm run build:single`.
Sie läuft per Doppelklick vom Stick, braucht nie ein Netz und bekommt keine neue Fassung,
solange niemand die Datei ersetzt.
Sie hat ihren **eigenen Datenspeicher**: Stände wandern zwischen Pages-Fassung und Datei –
und zwischen zwei Kopien der Datei an verschiedenen Orten – nur über eine Sicherung.

## Gerätebetrieb

Anzeigetafel und Zuschauerliste lassen sich auch auf anderen Geräten zeigen – einem Bildschirm am Steg, einem Tablet,
den Handys der Zuschauer (Etappe E6 des Plans vom 16.11.2026). Dafür gibt es zwei **Lese-Links** mit QR-Code, ohne
Anmeldung und ohne Kopplung: wer den Link hat, kann lesen, aber nichts ändern. Seit E7 kann ein gekoppeltes Handy
außerdem die Start-Freigabe bedienen ([unten](#start-freigabe-vom-handy-koppeln)).

**Nichts geht von selbst hinaus.** Solange niemand unter „Betrieb → Geräte“ auf **„Gerätebetrieb einschalten“** drückt,
baut Alcatraz keine Verbindung zu irgendeinem Server auf (dafür gibt es einen eigenen Test). Eingeschaltet gilt:

- **Was über den Server geht:** Startnummer, Name (nach der Einstellung „Namen“ der Anzeigetafel, Vorgabe wie der
  Aushang der Wertungslisten), Herkunft und Klasse der Starter, die Folge der Starts mit Zeitpunkten, Meldungen und der
  Name der Veranstaltung. Alles verschlüsselt und vom Bedienrechner signiert.
- **Was nie hinausgeht:** Geburtsdatum, Gewicht, Geschlecht, erfasste Werte, Abmeldungen, Logos, die Sicherung –
  überhaupt nie der Stand der Veranstaltung, nur eine zugeschnittene Sicht.
- **Der Server** ist ein fremder ntfy-Server (Vorgabe `ntfy.adminforge.de`, ehrenamtlich betrieben, ohne Zusage;
  änderbar unter „Einstellungen → Geräte“, reist mit Vorlage und Sicherung). Sein Betreiber sieht keine Inhalte, wohl
  aber Zeitpunkte, Größen und IP-Adressen.

Am Bedienrechner (Reiter „Betrieb“, Unterreiter „Geräte“):

- **Zwei Links:** „Anzeigetafel“ (für einen Bildschirm; die Tafel wie im zweiten Fenster, ohne Logos) und
  „Zuschauer“ (die Zuschauerliste fürs Handy). Je Link ein QR-Code, „Link kopieren“ und „Öffnen“ zum Ausprobieren.
  Läuft der Bedienrechner als Ein-Datei-Fassung von `file://`, führen die Links zur App auf GitHub Pages.
- **Fingerabdruck:** steht am Bedienrechner und auf jedem Gerät. Gleich heißt: Das Gerät zeigt wirklich diesen
  Bedienrechner – ein unterwegs ausgetauschter Link fiele hier auf. Deshalb QR-Codes möglichst vor Ort aushängen.
- **„Zuschauer-Link erneuern“** (mit Rückfrage), wenn ein Link in falsche Hände geraten ist: Der alte bekommt nichts
  mehr, die Anzeigetafel merkt nichts.
- **Verbindung:** verbunden, gestört (es wird neu verbunden), „zu viele Anfragen“ (der Server bremst; es geht nach einer
  Pause weiter) oder keine. Auf den anderen Unterreitern steht sie oben im Kopf.
- **Mehrere Fenster:** Mit dem Server spricht nur ein Fenster des Bedienrechners; die anderen zeigen dieselben Links und
  die Verbindung, ihre Knöpfe wirken über das führende Fenster. Schließt es, übernimmt ein anderes.
- **Der Raum bleibt offen**, auch über Neuladen und Neustart, bis **„Raum beenden“** (mit Rückfrage). Dann bekommen die
  Geräte die Meldung „Raum beendet“ und löschen, was sie zeigen; ohne Netz geschieht das auf den Geräten erst nach
  36 Stunden. Eine andere Veranstaltung im Browser trennt nur; der Raum gilt wieder, wenn sie zurückkommt.
- **Ein anderer Server** in den Einstellungen gilt erst für einen neuen Raum: Raum beenden, neu einschalten, neue Links
  aushängen.

Auf dem Gerät:

- Es zeigt die Anzeigetafel bzw. die Zuschauerliste, sobald der Bedienrechner etwas schickt; davor „Warte auf den
  Bedienrechner …“. Nach dem Neuladen steht sofort das zuletzt Gesehene da, auch ohne Netz.
- Über der Anzeigetafel erscheint die Leiste (Verbindung, Fingerabdruck, Vollbild, „Raum verlassen“) mit der Maus oder
  einer Berührung – und immer, wenn etwas nicht stimmt. Taste F oder Doppelklick schaltet Vollbild.
- „Seit“ und „ca. in“ rechnet das Gerät mit der Uhr des Bedienrechners (der Abstand der Uhren wird mitgemessen).
- **Raum verlassen** löscht alles, was das Gerät vom Bedienrechner hat. Was es zeigte, verfällt ohnehin 36 Stunden nach
  der letzten Nachricht.
- **Fassungen:** Bedienrechner und Geräte müssen dieselbe Fassung haben. Ist der Bedienrechner älter (etwa eine alte
  Datei auf dem Stick), steht auf dem Gerät „Bedienrechner aktualisieren“; ist er neuer, holt sich das Gerät die neue
  Fassung selbst. Sonst lädt ein Gerät nie von selbst neu.

### Start-Freigabe vom Handy (Koppeln)

Seit Etappe E7 (20.11.2026) bedient ein **gekoppeltes** Handy oder Tablet die Start-Freigabe – mit denselben Knöpfen
wie am Bedienrechner („Nächster Start“, „Lauf N beginnen“, Zurückstellen, Meldung, Einsteigen …), aber nur für die
Parcours, die der Bedienrechner ihm gibt. „Betrieb zurücksetzen“, Einstellungen und alles außerhalb des Betriebs
bleiben am Bedienrechner. Entschieden und angewandt wird immer am Bedienrechner; das Handy schickt nur Wünsche.

Am Bedienrechner (Betrieb → Geräte, unter den Lese-Links):

- **Für das nächste Gerät freigeben:** die Parcours (unter UIM auch den Parallelslalom) ankreuzen; bei nur einem
  Parcours ist er vorgewählt.
- **„QR-Code zeigen“** (der Hauptweg): Das Handy scannt ihn vom Bildschirm und ist sofort gekoppelt, ohne etwas zu tippen – kein Code nötig. Der Code
  wechselt alle 30 Sekunden (der vorige gilt noch 30 Sekunden, ein Foto taugt also kaum) und schließt sich nach
  höchstens 10 Minuten.
- **„Anderer Weg: Geräte-Code über Funk“** (zugeklappt, seit dem Feldtest 21.11.2026): darin „Geräte-Code ausgeben“
  (6 Zeichen, 5 Minuten gültig, für **ein** Gerät – für Handys, die den Bildschirm nicht sehen) und der **Koppel-Link**
  mit QR-Code und „Link kopieren“, den das Handy vorab braucht; den Code sagt man über Funk durch. Der Koppel-Link
  allein zeigt nur, was auf der Anzeigetafel steht – wer ihn statt des QR-Codes scannt, wird nach einem Code gefragt;
  das Handy sagt dann, wo der QR-Code zum Koppeln zu finden ist.
- **Gekoppelte Geräte:** je Gerät der Name (änderbar), die Parcours seiner Start-Freigabe (Häkchen – wirkt sofort auf
  dem Gerät), gekoppelt seit und „zuletzt gehört“. Ein Gerät meldet sich nur, wenn es schaltet oder neu startet;
  „zuletzt gehört“ sagt also nicht, ob es gerade verbunden ist.
- **„Entziehen“** (mit Rückfrage): Das Gerät kann nichts mehr schalten, zeigt aber weiter, wer im Boot sitzt und wer
  als Nächstes kommt. Wieder koppeln geht mit einem neuen Code.

Auf dem Handy (`#/koppeln/…`, danach `#/geraet`):

- Nach dem QR-Code oder dem Code steht die Start-Freigabe der eigenen Parcours da, für schmale Bildschirme mit großen
  Knöpfen. Der Koppel-Link verschwindet dabei aus der Adresse; neu laden oder später wieder öffnen über `#/geraet`.
- Nach jedem Druck sind alle Knöpfe gesperrt („Wird gesendet …“), bis der Bedienrechner bestätigt; nach 10 Sekunden
  ohne Bestätigung steht „Verbindung prüfen“ da, gesendet wird weiter (mit wachsendem Abstand, höchstens alle
  5 Minuten – schont das Kontingent). Ein doppelter Druck schaltet nie zweimal. Nach dem Neuladen meldet sich das
  Handy selbst beim Bedienrechner („Verbinde …“); die Knöpfe bleiben dabei frei.
  Lehnt der Bedienrechner ab (anderer Parcours, inzwischen entzogen) oder war jemand schneller, steht das als Satz da.
- Auf einen falschen oder abgelaufenen Code antwortet niemand: Nach 15 Sekunden „Keine Antwort“ und das Formular
  wieder. Ein schon benutzter Code wird abgelehnt. Scheitert ein gescannter QR-Code, ihn noch einmal scannen.
- War ein Handy beim Entziehen aus (auch länger als die 12 Stunden, die der Server Nachrichten hält), erfährt es den
  Entzug beim nächsten Start.
- **„Gerät entkoppeln“** löscht Kopplung und Schlüssel auf dem Handy. In der Geräteliste des Bedienrechners steht es
  weiter, bis es dort entzogen wird.
- Bei Ausfall des Bedienrechners übernimmt kein Ersatzrechner die Kopplungen (Entscheidung F4): neuer Raum, Links
  neu aushängen, Handys neu koppeln.

Grenzen: Ohne Internet am Steg stehen alle fremden Geräte; die Anzeigetafel im zweiten Fenster geht immer.
Ein Hotspot teilt sich das [Kontingent](#kontingent-des-servers) des Servers. Mit echten Handys (iPhone, Android
im Hintergrund) und dem echten Server ist der Gerätebetrieb noch nicht im Feld geprüft – dafür gibt es die
Checkliste [feldtest.md](feldtest.md) (Etappe E8).
Wie es gebaut ist: [technik.md](technik.md#gerätebetrieb-sicherheitsmodell).

### Bildschirm wach halten

Seit E8 (20.11.2026) bittet Alcatraz den Browser, den Bildschirm nicht abzuschalten (Screen Wake Lock): im zweiten
Fenster der Anzeigetafel und der Zuschauerliste immer, auf einem Gerät mit Lese-Link oder Start-Freigabe, solange es
verbunden ist (nicht mehr nach „Raum beendet“ oder „Raum verlassen“). Kommt die Seite aus dem Hintergrund zurück,
fragt sie erneut.

Nicht jeder Browser macht mit: iPhones erst ab iOS 16.4, nie unter `http://` oder `file://`, im Energiesparmodus oft
nicht. Dann steht auf dem Gerät leise **„Bildschirm kann ausgehen – Gerät eingesteckt lassen und die Bildschirmsperre
ausschalten“** (über der Anzeigetafel nur, wenn die Leiste zu sehen ist). Abhilfe: in den Systemeinstellungen die
automatische Sperre ausschalten und das Gerät ans Ladekabel. Ob es auf echten Geräten wirkt, prüft der
[Feldtest](feldtest.md).

### Alle Geräte neu laden

**„Alle Geräte neu laden“** (Betrieb → Geräte, neben „Raum beenden“, mit Rückfrage) schickt allen verbundenen Geräten –
Anzeigetafel, Zuschauer-Handys und gekoppelten Start-Freigaben – den Befehl, sich die neueste Fassung der App zu holen
bzw. neu zu laden. Die Anzeige ist dabei einige Sekunden weg; gekoppelte Handys bleiben gekoppelt.

- Jeder Befehl wirkt auf einem Gerät nur einmal (keine Neulade-Schleife), und nur, wenn er höchstens 10 Minuten alt
  ist: Ein Gerät, das binnen 10 Minuten wieder verbunden ist oder dann erst einen Link öffnet, lädt noch nach; eines,
  das länger weg war, nicht – dort bei Bedarf von Hand neu laden.
- Ohne Verbindung am Bedienrechner sendet der Knopf nichts („Keine Verbindung zum Server – nichts gesendet“), auch
  nicht später, wenn die Verbindung zurückkommt – sonst lüden alle Geräte zur Unzeit neu. Dann erneut drücken.
- **Nach einem Update** des Bedienrechners bietet Betrieb → Geräte den Knopf als Hinweis an („Dieser Bedienrechner
  läuft mit einer neuen Fassung …“); „Nicht nötig“ blendet ihn aus. Geräte, die neuer als der Bedienrechner sind,
  zeigen ohnehin „Bedienrechner aktualisieren“; ältere holen sich die neue Fassung beim nächsten Kontakt selbst.

### Kontingent des Servers

Öffentliche ntfy-Server erlauben ohne Konto nur eine bestimmte Zahl Nachrichten je Tag und Internetanschluss
(IP-Adresse). Abgefragt über `/v1/account` (November 2026): **ntfy.adminforge.de 17 280**, ntfy.sh 250. Alcatraz
kennt diese beiden Grenzen; bei einem anderen Server zählt es nur und warnt, sobald der Server bremst (21.11.2026).

- Betrieb → Geräte zeigt **„Heute an den Server: n Nachrichten (m Anfragen insgesamt)“** – gezählt am Bedienrechner,
  je Kalendertag. Die Handys zählen sich nicht mit, teilen aber über einen gemeinsamen Hotspot dieselbe IP-Adresse.
- Ab 80 % oder sobald der Server heute gebremst hat („zu viele Anfragen“), erscheint eine Warnung mit „Zuletzt
  gebremst um …“. Gebremst heißt: Nachrichten kommen verspätet an, es geht nach einer Pause weiter.
- **Überschlag:** Ein Wettkampftag mit 120 Startern und zwei Läufen braucht etwa 600 Nachrichten, mit Start-Freigabe vom
  Handy etwa 850 – weit unter 17 280 (adminforge), aber zu viel für ntfy.sh. Der Feldtest misst nach. Der Plan
  vom 16.11. nannte 1.000–3.000 (Zahlen eines Prototyps mit halbstündlichen Vollständen und Bestätigungen je
  Änderung); Alcatraz sendet Vollstände nur stündlich, und Lese-Geräte senden nichts zurück.
- Sparen: Gerätebetrieb erst einschalten, wenn er gebraucht wird; den Raum abends beenden; Lese-Links nur dort, wo
  sie nötig sind – die Anzeigetafel am zweiten Monitor kostet nichts.

### WKR-Erfassung (W1 Kern, W2 Bedienrechner, W3 Handy-Maske „Knöpfe“, W4 Bojen)

Stand 21.11.2026: Der **Kern** der digitalen Erfassung durch die Wettkampfrichter, die **Oberfläche am
Bedienrechner** (W2) und die **Maske auf dem Handy** für Steg, Tor 5, Mann-über-Bord und Vorsteg (W3, unten) sind
gebaut und gegen den nachgebauten Server geprüft – noch **ohne Feldtest** ([feldtest.md](feldtest.md#wkr-maske-auf-dem-handy-w3)).
Seit W4 (21.11.2026) haben auch die Listen mit Bojen ihre Maske (unten „Bojen“); Listen mit Zeit oder Knoten
bleiben auf Papier (W5). Was gilt (Plan
[plan-wkr-w1.md](plan-wkr-w1.md), Vorschlag [vorschlag-wkr-erfassung.md](vorschlag-wkr-erfassung.md)):

- Ein Gerät bekommt beim Koppeln **eine Liste** (Pad höchstens zwei; am Steg auch nur Ablegen oder Anlegen). Damit
  wird die Liste „digital“, und das Gerät liest über eine eigene verschlüsselte Gruppe die **Sicht der Liste**:
  gezeigte Starts mit Startnummer und Klasse (nie Namen), Maske je Klasse, eigene Rückfragen, Hinweise.
- Zeilen gehen über die Erfassung in die Werte – genau wie Abtippen: leere Zelle → übernommen, belegte Zelle mit
  anderem Wert → **Rückfrage** am Bedienrechner, nie still überschrieben. Bestätigt wird gesammelt über die Sicht
  der Liste (je Zeile eine Nachricht hin, eine Sicht zurück); nach einem Funkloch gehen die wartenden Zeilen als eine
  Nachricht. Wartende Zeilen liegen nur auf dem Gerät (36 h), Herkunft ◆ nur am Bedienrechner, nie in der Sicherung.
- Das Gerät kann die Liste pausieren oder abmelden (dann gehen offene und neu gezeigte Starts aufs Papier) und mit
  „Liste abschließen“ samt WKR-Namen den Lauf quittieren; spätere Korrekturen werden Vorschläge.
- Ein Gerät mit Liste meldet sich nach 60 s Stille mit einem Lebenszeichen (Akku, wartende Zeilen) – nur während ein
  Lauf läuft. Fürs Kontingent: etwa zwei Nachrichten je Zeile und Gerät.

Am Bedienrechner (W2, gebaut 21.11.2026, Plan [plan-wkr-w2.md](plan-wkr-w2.md); Auslegungen bestätigt 21.11.2026):

- **Betrieb → WKR**: Matrix Listen × gezeigte Starts (✓ erfasst, ½ ein Steg-Teil, ○ offen, ○! überfällig, ! Rückfrage,
  V Vorschlag, P Papier, ✕ nicht gestartet), je Liste das Gerät mit Ampel (● gehört, ◐ still, ✕ weg, grau ohne Lauf).
  Je Liste: Erfassung Gerät/Papier/beides, Pausieren/Abmelden/Weiter (am Steg je Teil), **„Papier ab Start …“** (ab
  dort wird vom Bogen abgetippt, das Gerät bekommt den Hinweis), „Bitte Nr. prüfen“, Abschlüsse ansehen und lösen.
  Darunter der **Eingang**: Rückfragen (Gerät übernehmen oder behalten) und Vorschläge (übernehmen oder verwerfen).
- **Erfassung**: ◆ an Werten vom Gerät; ▭ „Papier ansehen“ an Zeilen bzw. Zellen, für die der Bogen gebraucht wird;
  wer einen Gerätewert überschreibt, wird einmal gefragt.
- **Start-Freigabe**: eine Zeile mit dem Stand jeder Liste – großes Zeichen nach Erfassungsstand: ✓ fertig, ⧗ wartet n
  (der WKR hat n gezeigte Starts noch nicht abgeschickt), ✕ Gerät weg, ▭ Papier; klein dahinter die Verbindung
  (● gehört, ◐ still, ○ ruht), „n im Gerät“ für Zeilen unterwegs, ! Rückfrage. Sind bei einer Liste mindestens so viele
  Starts offen wie eingestellt (Einstellungen → Startfolge, Vorgabe 1 seit dem Feldtest 21.11.2026), steht der
  Rückstand über „Als Nächstes“ mit gelbem Rand, und vor jedem Zeigen fragt „Trotzdem weiter?“ mit Liste und
  Startnummern („Mann-über-Bord hat 604 noch nicht abgeschickt.“) – gesperrt wird nie; fällt ein Gerät aus, „Trotzdem
  weiter“ und unter Betrieb → WKR „Papier ab“. „Nur warnen“ und eine höhere Zahl (etwa für Tor 5 mit mehreren Booten
  auf dem Wasser) in den Einstellungen.
  Klick auf die Zeile führt zu Betrieb → WKR. Pausierte und abgemeldete Listen zählen nicht.
  **Geplant** (Nutzer 21.11.2026, noch nicht gebaut): Die Start-Freigabe richtet sich nur nach dem **Parcours** – Steg
  und Vorsteg laufen autark und halten nie auf. Statt der Rückfrage ab einem offenen Start eine **Parcours-Ampel** je
  Parcours, siehe [Ablauf am Wettkampftag](#während-des-wettkampfs).
- **Freigabe-Handy**: dieselbe Zeile, ohne Werte und ohne Gerätenamen, über eine eigene verschlüsselte Gruppe – nie
  auf Anzeigetafel oder Zuschauerliste. Schon gekoppelte Handys bekommen sie ohne neues Koppeln.

Auf dem Handy (W3, gebaut 21.11.2026, Plan [plan-wkr-w3.md](plan-wkr-w3.md); Auslegungen am 21.11.2026 beantwortet –
bestätigt bis auf G1, G3, G6, G11, G13, G15, J1–J3, K7, L3, L4, M5, die der Nutzer anders will, plan-wkr-w3.md §15):

- **Gerät für eine Liste koppeln**: Betrieb → Geräte → „Koppeln“: unter „WKR-Liste“ die Liste wählen (Parcours bzw.
  Racecourse; Listen mit Zeit oder Knoten tragen „Maske folgt – Papier“), am Steg „ganz / nur Ablegen / nur Anlegen“, dann QR-Code
  zeigen oder Geräte-Code ausgeben wie bei der Start-Freigabe. In der Geräteliste lässt sich die Liste je Gerät ändern
  (Handy eine, Pad höchstens zwei). Aus Betrieb → WKR führt „Gerät koppeln“ an einer Liste ohne Gerät direkt dorthin.
- **Probe**: Nach dem ersten Empfang der Liste zeigt das Handy einmal je Raum und Liste die Probe mit dem Start „P“ –
  Code tippen, „− letzte zurück“, „Fehlerfrei ✓“ (Vorsteg: zweimal X, „Abbrechen“, „In Ordnung ✓“). Dabei springt die
  Maske weiter wie im Ernst (2 s „gesendet“, Blitz, 1 s gesperrt). Es wird **nichts gesendet**; „Überspringen“ geht
  immer, „Mehr → Probe“ wiederholt sie.
- **Erfassen**: Startnummer groß, nie ein Name. Hauptknopf „Fehlerfrei ✓“, mit Einträgen „Abschicken · n Pkt.“;
  Disq. getrennt (zweiter Tipp setzt). Nach dem Abschicken bleibt die Nummer 2 s mit „● gesendet“ stehen, dann Blitz
  (und Vibration, wo es sie gibt) – 1 s lang nimmt die Maske nichts an (Schutz gegen Doppeltipp). Korrektur über
  „Zuletzt“; „Rückgängig“ 6 s.
- **Liste abschließen**: Sobald der eigene Lauf vorbei ist, erscheint das Band „… ist vorbei – Liste abschließen?“
  mit dem Zweck „Unterschrift für den Lauf – alle Klassen dieses Laufs auf dieser Liste; ersetzt die Unterschrift auf
  dem Bogen“. Nur dort – „Mehr → Liste abschließen“ gibt es seit 21.11.2026 nicht mehr (W3-40). Läuft der Lauf noch
  (ein Boot unterwegs, Starts kommen noch, Parcours-Ampel rot), fragt das Handy „1. Lauf läuft noch (604 unterwegs) –
  trotzdem abschließen?“ (R6-10). Die Prüfansicht zeigt „n abgeschickt, n offen: …, n X: …“ und alle eigenen Zeilen
  (Tipp öffnet die Korrektur); Name des Wettkampfrichters eintragen (vorbelegt mit dem letzten), bei offenen Starts
  „Rest auf Papier“ ankreuzen. Danach gehen Korrekturen nur noch als Vorschlag. Am Steg mit Teil schließt das Handy
  nur seinen Teil.
- **Mehr → Ansicht**: Sonne (Vorgabe, schwarz auf weiß), Hell, Dunkel; Linkshand spiegelt den Fuß. Geplant (Nutzer
  21.11.2026): Vorgabe ist der Hell/Dunkel-Modus des Handys, Sonne bleibt wählbar. **Sprache**: die der
  Liste, umschaltbar; unter DM wechseln nur die Bedientexte, unter UIM auch Codes und Titel. Gemerkt auf dem Gerät.
- **Übung**: „Üben ohne Verbindung“ im Koppel-Formular (oder Adresse `#/uebung`): Regelwerk DM/UIM und Liste wählen,
  dann dieselbe Maske mit erfundenen Starts – kein Netz, kein Bedienrechner, Kopf dauerhaft „ÜBUNG“. Gut für die
  Einweisung am Vortag; gespeichert wird nur die Ansicht.

Bojen (W4, gebaut 21.11.2026, Plan [plan-wkr-w4.md](plan-wkr-w4.md); Auslegungen am 21.11.2026 beantwortet –
bestätigt bis auf P9/U2, P10/Q2 und die Form von „Nicht vorbeigekommen“, plan-wkr-w4.md §14):

- **Bojen-Maske** für Tor 1/3/5, Tor 2/4/5, Parcours mit Start/Ziel, die Listen der Aufbauten und unter UIM den
  Parallelslalom: je Halt eine Zeile in Fahrtfolge, die beiden Bojen eines Tores nebeneinander so, wie sie auf dem
  Bogen stehen (R/L, Land/See …). Ein Tipp = eine Berührung (5), zweiter Tipp nimmt sie weg; die Torbojen von Tor 5
  zählen jede Berührung (höchstens 9). Tor 1 auf der Rückfahrt hat zwei Zeilen (2. Durchfahrt = Speedrunde). Disq.
  geht immer ins Disq.-Feld. Hat eine Klasse mehr als sieben Zeilen, teilt ein Umschalter „HINWEG · n | RÜCKWEG · n“ –
  er wechselt nie von selbst; wechselt die Klasse, steht 2 s „Klasse n – andere Halte“. Reihenfolge unter Mehr →
  Ansicht → „Bojen“ (22.11.2026, je Gerät und Liste gemerkt): „Rückweg gedreht“ (Vorgabe, der Rückweg in derselben
  Folge wie der Hinweg – Ziel, Tor 1, Tor 3, Tor 5), „Fahrtfolge“ (Rückweg Tor 5 … Ziel, wie das Boot fährt) oder
  „Alles untereinander“ (ein Reiter ohne Umschalter).
- **Nicht vorbeigekommen** (Mehr → „⊘ Nicht vorbeigekommen“, große Rückfrage „23 ist hier nicht vorbeigekommen? Es
  wird nichts eingetragen.“): für ein Boot, das vorher aufgegeben hat. Am Bedienrechner hat der Start damit den Haken
  (kein Rückstand, die Start-Freigabe wartet nicht), in der Matrix steht gelb „⊘ nicht vorbei“, in der Erfassung
  „Papier ansehen“; ein X ist es nicht. Am Vorsteg und im Steg-Ablegen gibt es das nicht – dort heißt es X. Wer sich
  geirrt hat, korrigiert über „Zuletzt“ (auch „fehlerfrei“); eingetippte Werte am Bedienrechner heben es ebenso auf.
  Die Prüfansicht beim Abschluss zählt „n nicht vorbeigekommen: …“, Betrieb → WKR nennt es beim Abschluss.
- **Geplant** (Nutzer 21.11.2026, noch nicht gebaut): „Nicht vorbeigekommen“ wird Disq. J (Parcours verlassen bzw.
  falscher Parcours) statt ⊘; bei einer Disq. fragt die Maske immer nach Boje bzw. Tor, und eine Bojenzelle kann
  Punkte und Buchstaben zugleich tragen („5 J“); das Band „Klasse n – andere Halte“ nur beim ersten Start einer neuen
  Klasse, mit der Parcours-Zeichnung beim Hochwischen.

## Ablauf am Wettkampftag

Für die Person am Bedienrechner, Schritt für Schritt. Ohne Gerätebetrieb entfallen alle Punkte zu Handys und Server.

### Vorher (am Vortag, mit Netz)

1. Fassung aktuell: Bedienrechner öffnen, „Offline bereit“ abwarten, ein bereitliegendes „Update“ jetzt einspielen
   ([Neue Fassung](#neue-fassung)) – nicht am Wettkampftag.
2. Server prüfen: „Einstellungen → Geräte“ (leer = Vorgabe `ntfy.adminforge.de`). Ein anderer Server gilt erst für
   einen neuen Raum.
3. Probelauf: Gerätebetrieb einschalten, je einen Lese-Link und ein Handy koppeln, einige Starts freigeben, die
   Anzeige des Kontingents ansehen, Raum beenden. Besser gleich der [Feldtest](feldtest.md).
4. Handys und Tablets: geladen, Ladekabel/Powerbank dabei, Bildschirmsperre aus, aktueller Browser (Chrome auf Android,
   Safari ab iOS 16.4). Kein privates Fenster – darin gehen Kopplung und Gesehenes beim Schließen verloren.
5. Eine Sicherung herunterladen.

### Aufbau

1. Bedienrechner starten, Alcatraz öffnen, Betrieb-Reiter.
2. Anzeigetafel: am zweiten Monitor über „Anzeigetafel öffnen“ (Taste F = Vollbild; geht ohne Netz) oder auf einem
   eigenen Bildschirm über den Lese-Link „Anzeigetafel“.
3. Gerätebetrieb einschalten (Betrieb → Geräte). Erst jetzt geht etwas ins Netz.
4. Zuschauer-QR-Code ausdrucken oder am Bildschirm zeigen und **vor Ort** aushängen; Fingerabdruck auf einem Handy
   gegen den des Bedienrechners prüfen.
5. Handys für die Start-Freigabe koppeln: Parcours (Bereiche) ankreuzen, „QR-Code zeigen“ und scannen lassen – oder
   „Geräte-Code ausgeben“ und über Funk durchsagen. Jedem Gerät in der Liste einen Namen geben („Steg A“).
6. Mit digitaler WKR-Erfassung: je Wettkampfrichter ein Handy mit seiner Liste koppeln
   ([WKR-Erfassung](#wkr-erfassung-w1-kern-w2-bedienrechner-w3-handy-maske-knöpfe-w4-bojen)); die Probe am Handy gleich
   gemeinsam durchtippen. Wer vorher üben will: „Üben ohne Verbindung“.

### Während des Wettkampfs

- Start-Freigabe am Bedienrechner oder vom Handy; auf dem Handy erst weiterdrücken, wenn „Wird gesendet …“
  verschwunden ist (bis dahin sind die Knöpfe gesperrt).
- Mit digitaler WKR-Erfassung: Zeile über „Als Nächstes“ im Blick behalten; rot = Gerät weg oder Rückfrage → Betrieb →
  WKR (Rückfragen entscheiden, notfalls „Papier ab Start …“). Am Laufende schließt jeder Wettkampfrichter seine Liste
  am Handy ab (Band „Liste abschließen“); Abschlüsse stehen unter Betrieb → WKR.
- **Parcours-Ampel** (gebaut 21.11.2026, Nutzer P-03; Auslegungen AM1–AM10 noch zu bestätigen): Die Start-Freigabe
  bezieht sich immer auf den Parcours, nie auf Steg oder Vorsteg – deren Wettkampfrichter arbeiten autark, auf sie
  wird nie gewartet (sie stehen weiter mit ✓/⧗ in der Leiste, lösen aber nie „Trotzdem weiter?“ aus). Die Ampel steht
  nur, wenn mindestens eine Parcours-Liste digital erfasst wird (Tore, Bojen, Tor 5, Mann-über-Bord,
  Parcoursüberwachung, Start/Ziel und – seit 22.11.2026, R7-01 – Zeit; nicht Steg, Vorsteg, Knoten). Auch die
  Zeit-Liste hält die Ampel also auf rot, bis ihre Zeit (oder „keine Zeit“) abgeschickt ist.
  1. „Nächster Start“ stellt die Anzeigetafel um; alle Parcours-WKR sehen den Starter, die Ampel ist **● grün „Start
     frei“**. Solange sie grün ist, zählt dieser Start nirgends als offen – fährt er nicht los, fragt nichts.
  2. Fährt er durch das Start/Ziel-Tor: **„Durchs Start-Tor“** tippen (versehentlich: „Doch nicht durch“). Die Ampel
     wird auch von selbst **● rot**, sobald ein Parcours-WKR für ihn etwas abschickt. Rot bleibt sie, auch wenn er den
     Parcours schon wieder verlassen hat; daneben steht, welche Listen noch fehlen.
  3. Haben alle digitalen Parcours-Listen abgeschickt: **● frei** – der Nächste kann. „Nächster Start“ bei rot fragt
     „Trotzdem weiter?“ (nie gesperrt); Papier, pausierte und abgemeldete Listen halten nichts auf.
  4. **Auto-Modus** (Einstellungen → Startfolge, Vorgabe aus): Ist jede Parcours-Liste digital und hat ein Gerät, zählt
     die Start-Freigabe bei „frei“ 3 Sekunden herunter („Anhalten“ hält bis zum nächsten Start) und zeigt dann den
     Nächsten des laufenden Laufs. Nie von selbst: einen neuen Lauf beginnen, Nachzuholende oder Zurückgestellte,
     bei offener Rückfrage, bei Meldung „Pause“/„Störung“, nach „Zurück“. Fehlt an einer Liste das Gerät, steht dort
     „Auto aus: … ohne Gerät oder auf Papier“. Den Countdown führt der Bedienrechner, der die Verbindung hält.
  5. Die Parcours-WKR sehen in der Starterkarte einen kleinen Punkt „Start frei“ bzw. „im Parcours“. Anzeigetafel und
     Zuschauerliste zeigen keine Ampel.
- Verbindung lesen: „verbunden“ ist gut; „gestört – verbindet neu“ und „zu viele Anfragen – weiter nach einer Pause“
  lösen sich meist von selbst; „keine Verbindung“ länger als einige Minuten → [Störungen](#störungen).
- Kontingent ab und zu ansehen; bei Warnung sparsamer schalten (siehe [Kontingent](#kontingent-des-servers)).
- Gerät verloren oder in falschen Händen: in der Geräteliste **„Entziehen“**. Zuschauer-Link verbreitet, wo er nicht
  hin soll: „Zuschauer-Link erneuern“ und neu aushängen.
- Bedienrechner neu laden oder neu starten schadet nicht: Der Raum bleibt offen, Geräte und Handys verbinden sich
  wieder. Ein zweites Fenster am Bedienrechner ist erlaubt; mit dem Server spricht nur eines.
- Update während des Wettkampfs nur in einer Pause. Danach **„Alle Geräte neu laden“**.
- Zwischendurch eine Sicherung herunterladen.

### Störungen

- **Kein Netz:** Am Bedienrechner weiterarbeiten – Start-Freigabe, Erfassung und Listen brauchen kein Netz. Die
  Anzeigetafel am zweiten Monitor läuft weiter. Geräte zeigen den zuletzt gesehenen Stand mit gestörter Verbindung und
  holen nach, sobald das Netz zurück ist. Handys der Start-Freigabe können solange nicht schalten.
- **Server bremst** („zu viele Anfragen“): abwarten, es geht weiter; Nachrichten kommen verspätet. Hält es an:
  Start-Freigabe am Bedienrechner, Anzeigetafel am zweiten Monitor.
- **Handy schläft ein** oder war im Hintergrund: Bildschirm an, Seite nach vorn holen – es verbindet neu und holt den
  Stand. Hilft das nicht, neu laden; die Kopplung bleibt. Gegen das Einschlafen: Ladekabel, Bildschirmsperre aus.
- **Gerät zeigt „Bedienrechner aktualisieren“:** Der Bedienrechner läuft mit einer älteren Fassung (etwa als Datei vom
  Stick) – dort aktualisieren oder das Gerät mit derselben Fassung betreiben.
- **Bedienrechner fällt aus:** Ersatzrechner mit der letzten Sicherung (sonst „Einsteigen ab …“), neuer Raum, Links
  neu aushängen, Handys neu koppeln.

### Ende

1. **„Raum beenden“** – die Geräte löschen, was sie zeigen, und die Verbindung endet. Bei mehreren Tagen kann der
   Raum über Nacht offen bleiben; ohne Änderungen kostet er wenig (je Link ein Vollstand in der Stunde).
2. Eine Sicherung herunterladen und getrennt vom Bedienrechner aufbewahren.
3. Beobachtungen zum Gerätebetrieb (Abbrüche, Bremsen, Kontingent am Abend) notieren – siehe
   [feldtest.md](feldtest.md#was-danach-zu-melden-ist).
