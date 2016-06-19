# Alcatraz
Alcatraz ist eine browserbasierte Software für die Auswertung von Wettkämpfen beim Motorbootslalom bzw. Schlauchbootslalom (International: UIM Formula Future)

Ich habe seit 1995 die Auswertungen der Wettkämpfe beim Landesverband Motorbootsport Brandenburg gemacht. Damals noch auf Basis von Excel und VBA. Zwischen jedem Wettkampf habe ich das "Programm" Stück für Stück erweitert. Als ich 2003/2004 aus zeitlichen Gründen nicht mehr teilnehmen konnte, blieb auch die Entwicklung dazu liegen.

Seit 2008 bin ich wieder aktiv dabei. In der Zwischenzeit hatte Volker ein eigenes Programm (auch auf Excel Basis) entwickelt. Beide Programme haben viele Gemeinsamkeiten und unterschiedliche Vorteile. Zusammen haben sie aber den Nachteil, dass sie nur mit Excel unter Windows laufen. Auch mit der aktuellen Version für Mac OS X laufen sie nicht.

Da ich persönlich weder mit Windows noch mit Mac gern arbeite, wächst in mir der Wunsch, nach einer vom Betriebssystem unabhängigen Lösung. Aus diesem Grund, soll Alcatraz im Browser laufen. Auch ohne aktive Internetverbindung...

## Warum der Name Alcatraz?
Alcatraz ist die Bezeichnung für eine Wettkampfrichter Position. Bei dieser Postion stehen zwei Boote hinter Tor 5 quer zum Parcours. Ein Wettkampfrichter meinte dann sehr beschreibend, dass man sich auf dieser Postion wie auf Alcatraz (eine früher als Gefängnis genutzte Insel in der Bucht von San Francisco) fühle.

## Was soll das ganze Kosten?
Nichts...

Das Programm wird hier mit dem gesamten Quelltext als [freie Software](http://fsfe.org/about/basics/freesoftware.de.html) veröffentlicht.

In den meisten Landesverbänden wurden von fleißigen Helfern Programme für die Auswertung geschrieben und gehütet wie ein Staatsgeheimnis. Ich glaube nicht, dass das der richtige Weg ist. Ich glaube, es bringt mehr, wenn jeder seine Erfahrung mit einbringen kann um ein Stück Software zu schaffen,was jeder nutzen kann und auch nutzen möchte.
Gemeinsam kann man oft mehr erreichen.

## Worin woll Alcatraz geschrieben werden?
Ich würde das Frontend gern als "Browserapp" mit [Angular](https://angular.io/) (nicht AngularJS) schreiben. Etwas später soll noch ein Backend in [go](https://golang.org/) hinzukommen. Das Backend ist dann für die Verbindung mit der Zeitnahme, intelligente Bojen, Pads der Wettkampfrichter und was uns noch so einfällt, zuständig.

## Wie sieht der Zeitplan aus?
Die ersten Ideen, die Auswertung von Excel zu entkoppeln hatte ich schon 2003. Bis vor wenigen Jahren hatte ich nach einer passenden Basis (Programmiersprache/Framework) gesucht und mir Ideen dazu aufgeschrieben. Nun fange ich an, diese Ideen zu dokumentieren und die ersten auch zu implementieren.

Ich hoffe, dass ich hiermit Interesse bei anderen Entwicklern (egal welches Level) wecke und die Software nicht allein entwickle und nutze. Mit etwas Hilfe, wird sich dann bestimmt auch ein Zeitplan erstellen lassen. Aktuell gibt es diesen jedoch nicht.

## Was soll Alcatraz alles können?
Hier nur eine grob sortierte Auflistung der meisten Ideen:

- [ ] Verzahnung (Starter 1 Klasse 1, Starter 2 Klasse 4, Starter 3 Klasse 1, ...)
- [ ] Ansicht für Wettkampfrichter
  - [ ] Login und Rechtemodel...
  - [ ] Nächster Start wird erst freigegeben, wenn alle Wettkampfrichter den Lauf abgenickt haben
  - [ ] Startnummer und Klasse muss sich vor jedem Start aktualisieren
  - [ ] Starterseite
    - [ ] Anzeige von Informationen wie Startnummer, Name, Klasse und Lauf
    - [ ] Aufgeteilt nach 'Im Boot', 'Am Steg', 'Vor Steg'
    - [ ] Starter Zahl in den Bereichen Konfigurierbar (1 im Boot, 2 am Steg, 2 vor Steg)
    - [ ] Reihenfolge, je nach Berechtigung, änderbar
    - [ ] Unterschiedliche Farben für Klasse und Lauf
    - [ ] Starter rutschen automatisch hoch nach abgeschlossenen Lauf
    - [ ] Zeitplan (Pausen, Feierabend etc) bei der Sortierung
    - [ ] Ungefähre Berechnung der Zeit bis zum Start/Vorsteg
- [ ] Gedruckte WKR Listen
  - [ ] Verzahnung auf einer Liste (kein Blattwechsel immer wieder, sondern von oben nach unten auszufüllen) (optional)
  - [ ] leichte Grau- oder Farbtöne für andere Klassen
    - [ ] Schikane (und andere nicht angefahrende Beobachtungspunkte bei kleineren Klassen auf verzahnten Listen ausgrauen
  - [ ] Auch mehere Klassen auf einer Seite (Konfigurierbar)
    - Bei Clubmeisterschaften oder kleinen Wettkämpfen mit nur 1-2 Starter pro Klasse, macht eine eigene Liste kein Sinn
  - [ ] Übertragung von Listen in das Programm mit gleicher Ansicht (Browserformular und Beobachtungsliste sind identisch)
    - Weniger fehleranfällig und einfache Kontrolle
  - [ ] Lauf kann erst 'abgeschlossen' werden, wenn alle Beobachtungslisten eingetragen & kontrolliert wurden
    - [ ] 4 Augenprinzip. Kontrolle muss mit einem anderen Wettkampfrichter/Benutzer erfolgen
- [ ] Support für 'Spaßstarter'
    - Ältere Starter fahren in jüngeren Klasse (Zustätzlich zum eigentlichen Lauf)
    - Mit auf den Listen und bei der Erfassung
    - Mit im Aushang
    - Nicht in die Endwertung, aber mit Info für die Siegerehrung (Differenz zum eigentlichen Startet etc)
- [ ] Bei Clubmeisterschaft den Verein nicht anzeigen
- [ ] Regel als Set hinterlegen (Deutsche Meisterschaftsregeln)
- [ ] Regeln für die Veranstaltung auf Basis der DM Regeln
  - Regeln können deaktiviert oder überschrieben werden
- [ ] Verstöße werden mit Kürzel (A, B, C usw.) angegeben und Dargestellt
- [ ] Zeiten können im Format 1,2345 und 83,45 statt 1:23:45 eingegeben werden
  - Umrechnung erfolgt für die Anzeige automatisch
- [ ] Jede Berührung, jeder Starfpunkt wird einzeln erfasst und ist auch im Aushang entsprechend dargestellt
- [ ] Vorsteg Listen
  - Zum Laufabhaken und ggf. Punkte, wegen Schwimmestes auf dem Steg ausgezogen
- [ ] 3 Extra Zeilen unter Beobachtungslisten
- [ ] Aushanglisten
  - [ ] Spätstarter (die nicht in der regulären Verzahnung fahren) werden oben (1. Platz) Angezeigt
  - [ ] Fehlerpunkte != Bojenberührungen werden als Buchstaben angezeigt
    - Buchstaben über das gesamte Programm gleich
    - Nur die Buchstaben, die in der Aushangliste aufgeführt werden, werden als (optionale) Tabelle darunter angezeigt
