# Betrieb am Wettkampfort

Was Auswerter vor und während eines Wettkampfs wissen sollten:
ohne Internet arbeiten, neue Fassungen, Sicherung und Verlauf.
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

## Ohne Internet

Am Wettkampfort gibt es oft kein Netz.
Alcatraz lädt im Betrieb nichts nach; die Daten liegen im Browser.
Damit auch **Neuladen, ein neuer Tab und ein Neustart des Browsers** ohne Netz gehen,
legt die Pages-Fassung beim ersten Aufruf einen Offline-Speicher für das Programm an (Service Worker).
Alle Dateien – Seite, Programm, Gestaltung, Bilder und die Ein-Datei-Fassung – liegen danach auf dem Gerät.

**Was ohne Netz geht:** alles – jede Ansicht, Drucken, Sicherung herunter- und einspielen,
auch das Herunterladen der Ein-Datei-Fassung.
Nur die Suche nach einer neuen Fassung braucht Netz.

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
