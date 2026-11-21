# Vorschlag: Digitale Erfassung durch die Wettkampfrichter

Stand: Fragen beantwortet 21.11.2026, W1 (Kern ohne Masken) gebaut 21.11.2026 nach [plan-wkr-w1.md](plan-wkr-w1.md), Prüfbefunde dazu behoben (plan-wkr-w1.md §10: Abschluss und Pause am Steg je Teil), W2 (Bedienrechner: Matrix, Eingang, ◆ und „Papier ansehen“, Geräteleiste und Rückstand in der Start-Freigabe und auf dem Freigabe-Handy) gebaut 21.11.2026 nach [plan-wkr-w2.md](plan-wkr-w2.md), Prüfbefunde dazu behoben (plan-wkr-w2.md §10: abgetippt zählt als erledigt, ◆ nach Entscheid, Hinweise je Steg-Teil, Zeitfelder), Auslegungen dort §9/§10 noch zu bestätigen (Entscheidungen §12, [entscheidungen.md](entscheidungen.md)) · baut auf dem Gerätebetrieb E5–E8 auf
([betrieb.md](betrieb.md): Raum, Koppeln per Code/QR, Rechte je Aufgabe und Bereich, Quittung) und füllt den Ausblick
E9 (Steg a), E11 (Wettkampfrichter je Parcours × Liste). Zusammengeführt aus drei Entwürfen (Blickwinkel „am Wasser“,
„Pad und Bild“, „System und Bediener“) und zwei Gutachten (Praxis, Machbarkeit im Code).

## Zusammenfassung

1. Ein Gerät wird für **eine Liste** gekoppelt (Position × Parcours bzw. Racecourse, z. B. „Tor 1/3/5 · Parcours 2“),
   auf dem Pad höchstens zwei. Es zeigt **nur den aktiven Starter**: den ältesten gezeigten Start, den diese Liste noch
   nicht abgeschickt hat. Dazu zwei Ausweichknöpfe und eine Suche nach Startnummer.
2. **Drei Maskenfamilien**: *Knöpfe* (Zeilen in Fahrtfolge, Katalogcodes mit Text), *Bild* (Parcours-Zeichnung, Boje
   antippen), *Text/Tabelle* (Zeile wie auf dem Bogen). Dazu Ziffernblock (Zeit) und Prüfliste (Knoten).
3. **Handy hoch**: Knöpfe als Vorgabe, eine Liste, alles Wichtige im Daumenbereich. **Pad quer**: Bild als Vorgabe für
   Bojen, daneben „Schlange / Zuletzt“; zwei Listen, Racecourse A + B, Tabelle für Geübte. Kein Einheitsdesign.
4. **„Fehlerfrei“ ist eine eigene Meldung**, nie ein leeres Feld. Ein Hauptknopf („Fehlerfrei“ → „Abschicken · 10“),
   Disq getrennt davon, mit Schutz gegen Doppeltipp beim Weiterspringen.
5. Bojen nach dem Reglement: **je Boje und Fahrtrichtung ein Schalter** (5 oder 0), **Torbojen von Tor 5 je Berührung
   ein Zähler** (sie stehen in den Listen Tor 1/3/5 und Tor 2/4/5; die Liste „Tor 5“ hat nur den Einfahrt-Katalog).
   Tor 1 wird auf der Rückfahrt mit der Speedrunde zweimal durchfahren: je Durchfahrt ein Schalter (F2, 21.11.2026).
6. Werte gehen als **eine Zeile je Start** an den Bedienrechner. Er prüft und übernimmt sie über die **Erfassung**
   (wie Abtippen), nie über den Betrieb. Belegte Zellen werden nie still überschrieben, sondern zur Rückfrage.
7. Das Gerät erfasst **ohne Netz weiter**; die Zeilen warten auf dem Gerät und gehen nach. Die Maske sperrt nie.
8. Der Bedienrechner sieht eine **Matrix Listen × Starts** mit zwei getrennten Ampeln: *Gerät verbunden?* und
   *Zeile abgeschickt?* In der Start-Freigabe steht immer eine Geräteleiste, über „Nächster Start“ eine Zeile mit
   Rückständen; **warnen, nicht sperren**.
9. **Papier bleibt Rückfall** je Liste („Papier ab Start …“), „Papier“ und „beides“ sind immer wählbar; das Gerät kann
   sich **pausieren** oder **abmelden**, dann wartet die Freigabe nicht darauf (F1, 21.11.2026). Vorrang: Der Bedienrechner gilt; Papier und Gerät, die
   sich widersprechen, landen als Rückfrage, nie still.
10. Aufs Gerät nur Startnummer, Klasse, Lauf/Attempt (ggf. Boot), die Maske und die eigenen Werte. Die Anzeigetafel zeigt
    davon nichts. Erste Etappe: Kern + Matrix + Steg/Tor 5/MüB am Handy, dann Feldtest, dann Bojen.

---

## 1. Rahmen

**Bedingungen am Wasser und was daraus folgt**

| Bedingung | Folge für jede Maske |
|---|---|
| Sonne, Blendung | Sonnenmodus als Vorgabe: schwarz auf weiß, dicke Ränder; nie Bedeutung nur über Farbe (immer Zeichen + Wort) |
| Nässe, Handschuhe | Ziele ≥ 64 px (12–15 mm), Abstand ≥ 8 px; kein Wischen, kein langes Drücken als einziger Weg; kein [−][+] dicht nebeneinander |
| eine Hand frei | Handy hoch, Bedienung im unteren Drittel, oben nur Anzeige |
| ein Start alle 30–60 s, 2–3 Boote gleichzeitig unterwegs | kein Pflichtdialog im Normalfall; ein Druck zum Abschicken; die Maske sperrt nie bis zur Quittung |
| laute Motoren | Vibration als Bestätigung (wo der Browser sie kann; iPhone: Aufblitzen), kein Ton |
| ehrenamtlich, wenig Übung | eine Liste je Gerät, Spalten wie der Bogen; nur Fehler, die an dieser Position möglich sind; Codes immer mit Kurztext; Probe und Übungsmodus |
| schlechter Mobilfunk | weiter erfassen ohne Netz, Zeilen warten auf dem Gerät; Quittungen gesammelt |
| Akku | Wake Lock nur bei offener Maske (gibt es seit E8), Lebenszeichen nur bei Stille, keine Animationen |
| Boote in falscher Reihenfolge, zurückgestellt, zweimal | „aktiv“ ist ein Vorschlag; Ausweichknöpfe und Nr.-Suche; Entwürfe gehen nie verloren |

**Feste Regeln der App, die hier gelten**

- Der **Bedienrechner ist die einzige Wahrheit**. Das Gerät liefert Vorschläge für Zellen, die der Bedienrechner prüft.
- **Der Betrieb schreibt nie in die Eingaben.** Werte vom Gerät laufen durch die Erfassung, wie Abtippen vom Bogen.
- **Begriffe** wie im Regelbuch: Wettkampfrichter (WKR), englisch race official, racecourse, attempt, re-run.
- **Nicht-Ziele (vorerst)**: Stoppen der Zeit am Handy; Wertung, Plätze oder Werte anderer Listen auf dem Gerät;
  Erfassen ohne Kopplung; Erfassen ohne Start-Freigabe (F3).

---

## 2. Der aktive Starter: eine Schlange je Liste

Am Wasser hat jede Position ihren eigenen „aktiven“ Starter. Das Boot, das am Steg ablegt, ist für Tor 5 und das
Anlegen noch gar nicht da:

```
Zeit →          Start 15 gezeigt     Start 16 gezeigt     Start 17 …
Steg Ablegen    [15]                 [16]                 [17]
Tor 1/3/5          [15]                 [16]
MüB                    [15]                 [16]
Tor 5                       [15]                 [16]
Steg Anlegen                    [15]                 [16]
```

Darum führt **jede Liste ihre eigene Schlange**: alle Starts des Bereichs, die die Start-Freigabe gezeigt hat und für die
diese Liste noch nichts abgeschickt hat, älteste oben. Oben = aktiv. Das ergibt sich rein aus dem, was der Bedienrechner
ohnehin weiß (gezeigte Starts minus Haken „erfasst“ der Liste); es braucht dafür keinen neuen Zustand.

- **Wer nichts abschickt, bleibt stehen.** Kein stilles Weiterspringen: Ein Rückstand bleibt sichtbar (Matrix, §6).
- **Falsche Reihenfolge**: Der WKR tippt auf die zweite Nummer in der Schlange oder sucht per Startnummer. Der Erste
  bleibt oben.
- **Klasse ohne diese Position** (MüB erst ab Klasse 4): Der Start steht grau mit „MüB entfällt (Klasse 2)“ und schließt
  sich von selbst. In der Matrix: „–“. Fehlen nur einzelne Halte (Speedboje 1 ab Klasse 5, Speedboje 2 und Tor 1 in der
  Speedrunde nur Klasse 7, Tor 1 zurück nicht bei Klasse 4), baut sich die Maske je Klasse ohne sie auf.
- **Vorsteg** sieht die nächsten Starts schon vor dem Zeigen („Zum Vorsteg“ aus der Prognose). Einzige Ausnahme.
- **Knoten** haben keine Folge: Auswahl über Startnummer oder „noch offen“.
- **Ohne Netz** schiebt das Gerät nach jedem Abschicken den nächsten aus der mitgelieferten Folge nach, gekennzeichnet
  „(geschätzt, ohne Verbindung)“. Passt die Zeile beim Abgleich nicht mehr (Start inzwischen umgestellt): Rückfrage am
  Bedienrechner, nie still.

---

## 3. Gemeinsamer Rahmen jeder Maske

Kopf und Fuß sind auf jedem Gerät gleich, nur die Mitte wechselt.

```
+--------------------------------------+
| ● verbunden   Tor 1/3/5 · Parcours 1 |  Kopf: Verbindung, Liste (fest), Lauf
| 1. Lauf                              |  rot und dauerhaft bei Störung
+--------------------------------------+
|     23          Klasse 3             |  aktiv: Startnummer RIESIG
|     Boot „Seepferd“                  |  (Bootskennung, wenn es Boote gibt)
|  danach:  [ 41 ]  [ 17 ]   [ Nr. ]   |  Ausweichen: 2 Nächste + Suche
+--------------------------------------+
|                                      |
|          ...  MITTE  ...             |  Knöpfe | Bild | Text | Ziffern | Prüfliste
|                                      |
+--------------------------------------+
| Zuletzt: 12 ✓  8 ✓  30 ↑   Entw. 1   |  ✓ übernommen  ↑ unterwegs  ! Rückfrage
+--------------------------------------+
|  [ DISQ ]        [  FEHLERFREI ✓   ] |  Daumenbereich; Hauptknopf heißt
|                                      |  „ABSCHICKEN · 10“, sobald etwas drin ist
+--------------------------------------+
```

- **Ein Hauptknopf**, breit, unten rechts (spiegelbar für Linkshänder). Leer heißt er „Fehlerfrei ✓“, mit Einträgen
  „Abschicken · 10 Pkt.“. Der WKR wählt nie zwischen zwei ähnlichen Knöpfen.
- **Disq** links unten, mindestens 24 px vom Hauptknopf entfernt; öffnet die Buchstaben dieser Position mit Kurztext,
  zweiter Tipp setzt. Bei einer Boje fragt es „an welcher Boje?“ (der Buchstabe ersetzt dort die Punkte).
- **Schutz beim Weiterspringen** (Pflicht): Nach dem Abschicken bleibt die Nummer 2 s mit „● gesendet“ stehen, dann
  wechselt sie mit Vollflächen-Blitz und Vibration. Die erste Sekunde danach nimmt keine Eingabe an, und „Fehlerfrei“
  für den neuen Starter ist erst nach dieser Pause drückbar. Sonst meldet ein Doppeltipp oder ein Wassertropfen den
  Nächsten fehlerfrei, und niemand merkt es.
- **„− letzte zurück“** statt eines Minus an jeder Zelle. Bis zum Abschicken; danach heißt es „Korrigieren“ (§5).
- **Mehr** (Menü „…“): Ansicht wechseln, „Nicht vorbeigekommen“, „offen in diesem Lauf“, Bemerkung, Sonnen-/Dunkelmodus,
  **„Pausieren“ / „Abmelden“** (F1, 21.11.2026; §8).
- **Zustände ohne Arbeit**:

```
+------------------------------+   +------------------------------+
| P2 · Tor 1/3/5             ● |   | P2 · Tor 1/3/5             ○ |
|                              |   | ⚠ KEINE VERBINDUNG seit 2 min|
|   Kein Boot unterwegs.       |   |  Weiter erfassen – 3 Zeilen  |
|   Nächster Start: 21 (Kl. 5) |   |  warten und gehen von selbst.|
|   Meldung: „Mittag bis 13:00“|   |  Länger weg? Papierbogen     |
|                              |   |  ab Nr. 24.                  |
+------------------------------+   +------------------------------+
```

---

## 4. Masken je Position und Gerät

Die Maske erzeugt genau die Zellwerte, die der WKR sonst auf den Bogen schreibt: Punkte in Bojenzellen (oder einen
Disq-Buchstaben), Fehlercodes aus dem Katalog der Spalte, Disq-Buchstaben aus den Bereichen der Position. Wertung,
Erfassung und Listen bleiben dadurch unverändert. Die Maske baut sich aus der Liste selbst (Spalten, Fahrweg, Blick,
Bojen-Seiten, Kataloge); eigene Aufbauten aus dem Assistenten gelten also ohne Zusatzarbeit. Der Bedienrechner schickt
sie fertig aufgelöst, das Gerät rechnet nichts selbst.

### 4.1 Die drei Familien im Überblick

| Familie | Kern | Handy hoch | Pad quer | gut für |
|---|---|---|---|---|
| **Knöpfe** | Zeilen in Fahrtfolge, Katalogcodes als breite Knöpfe mit Text | **Vorgabe** | ja | alle Positionen; wenig Übung |
| **Bild** | Parcours-Zeichnung aus Sicht des WKR, Boje antippen | Option (≤ 6 Bojen) | **Vorgabe** für Bojen | wer lieber „aufs Wasser zeigt“ |
| **Text/Tabelle** | Zeile des Bogens; auf dem Pad mit letzten 5 + nächsten 3 Zeilen | Option | Option für Geübte, Vorgabe Steg-Pad | Geübte, Pad mit Tastatur |
| Ziffernblock | eigene große Tasten, Lesart wie am Rechner („83,45“ oder „1,2345“ = 1:23,45) | **Vorgabe** Zeit | ja | Zeitnahme |
| Prüfliste | ✓ / ✗ je Feld, Abschicken erst wenn alles gesetzt | ja | **Vorgabe** Knoten | Knoten |

**Wer wählt**: Der Bedienrechner gibt die Maske je Gerät vor (in der Geräteliste, einmal zentral statt an zehn Handys).
Der WKR darf unter „Ansicht“ zu einer anderen erlaubten Maske wechseln, wenn der Bedienrechner das nicht festgelegt hat;
gemerkt wird das nur auf dem Gerät. Handy oder Pad erkennt das Gerät selbst an der Breite.

### 4.2 Bojen und Tore (Tor 1/3/5, Tor 2/4/5, Parcours …)

**Reglement** (F2, 21.11.2026 bestätigt): Eine Boje kann je Richtung nur einmal berührt werden → **Schalter** je Boje und
Richtung (berührt ja/nein, 5 oder 0), kein Zähler. Zweimal tippen nimmt die Berührung wieder weg. Ausnahmen:
- **Torbojen von Tor 5** zählen „je Boje und Berührung“ → **Zähler** (jeder Tipp +5, zurück nur über „− letzte zurück“).
- **Tor 1 auf der Rückfahrt** wird bei der Speedrunde zweimal durchfahren, also sind dort zwei Berührungen je Boje
  möglich. Der Fahrweg führt das schon als zwei Halte mit eigenen Spalten (`config/kurzform.ts` FAHRWEG: `t1b` „1 R“,
  `t1c` „1 R“ Speedrunde, heute nur Klasse 7). Die Maske zeigt darum **zwei Zeilen mit je einem Schalter je Boje**
  (eine je Durchfahrt), keinen Zähler: Jede Zeile füllt genau ihre Spalte wie auf dem Bogen.

Was eine Liste sieht, steht im Aufbau (Kurzform, `config/kurzform.ts` FAHRWEG): Tor 1/3/5 im Aufbau Alcatraz hat Start
und Ziel (je die eine Boje), Tor 1 und Tor 3 mit beiden Bojen, von Tor 5 nur **eine** Boje (hin und zurück), bei
Klasse 7 Speedboje 2 und Tor 1 in der Speedrunde.

**Handy hoch, Knöpfe (Vorgabe).** Je Halt eine Zeile in der Folge der Fahrt, Hin- und Rückweg getrennt, Seiten so
beschriftet und angeordnet, wie der WKR sie aus seinem Blick sieht (R/L, Land/See … nach Einstellung). Beispiel Klasse 7:

```
+--------------------------------------+
| ● Tor 1/3/5 · P1 · 1. Lauf           |
|   23   Kl. 7     danach [41][17][Nr.]|
+--------------------------------------+
|  HINWEG                              |
|  Start    [ R  · ]                   |
|  Tor 1    [ L  · ]   [ R ✔5 ]        |
|  Tor 3    [ L  · ]   [ R  · ]        |
|  Tor 5    [ R  · Berührungen  ]      |  Zähler: jeder Tipp +5
|  RÜCKWEG ----------------------------|
|  Tor 5    [ L  1× = 5 ]              |
|  Tor 3    [ L ✔5 ]   [ R  · ]        |
|  Tor 1    [ L  · ]   [ R  · ]        |  1. Durchfahrt (nicht bei Klasse 4)
|  Speed 2  [      ·      ]            |  (nur Klasse 7)
|  Tor 1    [ L  · ]   [ R  · ]  Sp.   |  2. Durchfahrt (Speedrunde, Kl. 7)
|  Ziel     [ L  · ]                   |
+--------------------------------------+
|  [ − letzte zurück ]                 |
|  [ DISQ ]       [ ABSCHICKEN · 15 ]  |
+--------------------------------------+
```

Ein gesetzter Knopf ist schwarz hinterlegt und trägt ✔ und die Punkte, der Zähler „n× = Punkte“. Bis etwa acht Halte
passt alles ohne Scrollen; bei mehr (Klasse 7: elf) teilt sich die Maske mit dem großen Umschalter Hinweg/Rückweg wie
auf dem Pad – nie scrollen, während das Boot fährt.

**Pad quer, Bild (Vorgabe).** Die Parcours-Zeichnung, gedreht wie der WKR am Ufer steht, Bojen der eigenen Position
kräftig, der Rest blass (dieselben Bilder wie im Aufbau-Assistenten). Rechts Schlange, Zuletzt und die Einträge im Klartext:

```
+--------------------------------------------------+---------------------------+
| ● Tor 1/3/5 · Parcours 1 · 1. Lauf               |  SCHLANGE                 |
|   23   Klasse 3                                   |  > 23  Kl.3  aktiv        |
|   [ HINWEG ]  [ rückweg ]   <- groß, umschaltbar |    41  Kl.5               |
|                                                  |    17  Kl.2  MüB –        |
|           Tor 5   (o)         .                  |  [ Nr. suchen ]           |
|                                                  |---------------------------|
|       Tor 3   (o)              (o)               |  ZULETZT                  |
|                                                  |   12 ✓ 0    8 ✓ 5         |
|    Tor 1   (O)5                   (o)            |   30 ↑ G (Tor 3 R)        |
|                                                  |---------------------------|
|               ^ Fahrt                            |  EINTRÄGE 23              |
|                                                  |   Tor 1 L hin   5         |
|                                                  |   Σ 5                     |
+--------------------------------------------------+---------------------------+
| [ − letzte zurück ]     [ DISQ ]                  [ ABSCHICKEN · 5 ]         |
+------------------------------------------------------------------------------+
```

- Blasse Bojen („.“) gehören einer anderen Liste und sind nicht antippbar; die Torboje von Tor 5 zählt je Tipp (Zähler).
- **Hin/Rück über einen großen Umschalter**, nicht über halbe Trefferflächen je Boje (mit Handschuhen zu klein). Er
  springt von selbst auf „Rückweg“, sobald an Tor 5 etwas getippt wurde, und lässt sich zurückstellen.
- **Trefferflächen ≥ 15 mm**, auch wenn die Boje im Bild kleiner ist; liegen Bojen eng, wird die Zeichnung entzerrt.
- Die **Eintragsliste im Klartext** ist die Kontrolle für Ungeübte: Was dort steht, wird abgeschickt.
- **Klassenwechsel**: Fährt der nächste Starter einen anderen Parcours (Speedrunde, Möwe), wechselt die Zeichnung, und
  „Klasse 7 – anderer Parcours“ steht 2 s groß darüber.

**Handy hoch, Bild (Option)**: derselbe Ausschnitt nur mit den Bojen der Position, Umschalter oben, Bojen größer als
maßstäblich. **Text/Tabelle**: die Bogenzeile mit Tastenlogik der Erfassung am Rechner (Tab, Enter); nur für Geübte.

### 4.3 Tor 5 und Mann-über-Bord (Katalog)

**Handy hoch, Knöpfe (Vorgabe).** Je Code ein breiter Knopf mit Code, Kurztext und Punkten, Zähler rechts. Codes, die
die Klasse nicht betreffen („ab Klasse 4“), stehen grau und lassen sich nicht drücken.

```
Tor 5                                    MüB (ab Klasse 4)
+--------------------------------------+ +--------------------------------------+
| ● Tor 5 · P1 · 1. Lauf               | | ● MüB · P1 · 1. Lauf                 |
|   23  Kl. 4   danach [41][17][Nr.]   | |   23  Kl. 5   danach [41][Nr.]       |
+--------------------------------------+ +--------------------------------------+
| Einfahrt Tor 5                       | | [ 13  kein Leerlauf            5 ]   |
| [ 1  nicht ganz eingefahren   20 ]   | | [ 14  Ring nicht beidh. geh.   5 ]x1 |
| [ 2  Schaltung durchger. (ab 4) 5 ]x1| | [ 15  Ring nicht beidh. aufg.  5 ]   |
| [ 20 2./3. Versuch             5 ]   | | [ 17  nicht aufgestoppt        5 ]   |
|                                      | | [ weitere Codes … ]                  |
+--------------------------------------+ +--------------------------------------+
| [ − letzte zurück ]                  | | [ − letzte zurück ]                  |
| [ DISQ ]        [ ABSCHICKEN · 5 ]   | | [ DISQ ]        [ ABSCHICKEN · 5 ]   |
+--------------------------------------+ +--------------------------------------+
```

- Ein Druck auf einen Code: +1 (Codes können mehrfach vorkommen; die Zelle bekommt die Schreibweise der Erfassung,
  etwa „2x6“).
- Die **Torbojen von Tor 5** gehören nicht hierher, sondern zu Tor 1/3/5 und Tor 2/4/5 (je eine Boje, §4.2).
- **Tor 5 + Parcoursüberwachung** (eine Person): Tor 5 wie oben, darunter der Fahrweg-Teil; Fehler des Parcours über Disq.
- **Pad quer**: Codes in zwei Spalten, rechts Schlange/Zuletzt wie beim Bild.

### 4.4 Steg, zweiteilig (Ablegen / Anlegen) – Steg a

Zwischen Ablegen und Anlegen desselben Boots liegen andere Boote. Darum **zwei Schlangen** und **zwei getrennt
abgeschickte Teile** derselben Zeile, jeder mit eigenem Haken („Ablegen erfasst“, „Anlegen erfasst“) und eigener Quittung.
Ablegen = das Boot, das gerade ablegt; Anlegen = das älteste Boot mit Ablegen, aber ohne Anlegen.

```
Handy hoch: zwei Reiter mit Zähler        Pad quer: nebeneinander (Vorgabe am Pad)
+--------------------------------------+  +---------------------------------------------+
| [ ABLEGEN 23 ] [ ANLEGEN 17 · 2 ]    |  | ABLEGEN              | ANLEGEN              |
+--------------------------------------+  | 23  Kl. 3            | 17  Kl. 2            |
|  23 · Kl. 3      danach [41][Nr.]    |  | [3  erneute Berühr.5]| [7  2./3. Versuch  5]|
+--------------------------------------+  | [4  Schlauch (ab 3)5]| [8  Leine außerh.  5]|
| [ 3  erneute Stegberührung    5 ]    |  | [5  Schaltung(ab 4)5]| [9  massiv        10]|
| [ 4  auf den Schlauch (ab 3)  5 ]    |  | [6  2./3. Versuch  5]| [11 rückwärts      5]|
| [ 5  Schaltung (ab 4)         5 ]    |  |                      | [12 kein Stillst. 10]|
| [ 6  2./3. Versuch            5 ]    |  | [ X nicht gestartet ]| [23 Schlauch(ab 3) 5]|
| [ X  nicht gestartet ]               |  | [DISQ] [ABLEGEN OK ✓]| [DISQ] [ANLEGEN OK ✓]|
| [ DISQ ]       [ ABLEGEN OK ✓ ]      |  | danach: 41  Nr.      | danach: 30  Nr.      |
+--------------------------------------+  +---------------------------------------------+
```

- Der Reiter zeigt, wie viele Boote warten („ANLEGEN 17 · 2“). Er wechselt **nicht** von selbst.
- **X (nicht gestartet)** nur im Teil Ablegen, mit großer Rückfrage („23 nicht gestartet? Zählt wie disqualifiziert und
  nimmt ihn aus der Startfolge.“). Auf dem Papier steht das X ebenfalls am Steg in „Disq.“. Am Bedienrechner wird ein X
  vom Gerät hervorgehoben (F5).
- Die Bemerkung gibt es nur auf dem Pad bzw. hinter „Mehr“.
- **Disq. und Bemerkung teilen sich beide Teile** (eine Zelle `disq@steg` auf dem Bogen). Ein Teil fügt seine Buchstaben
  hinzu („A“ vom Ablegen + „S“ vom Anlegen = „A, S“), ersetzt sie nie; eine Rückfrage gibt es nur, wenn ein Buchstabe
  wegfallen soll. Sonst würde das Anlegen jedes Disq. vom Ablegen als „Zelle anders belegt“ melden.
- **Zwei WKR am Steg** (einer Ablegen, einer Anlegen): Die Kopplung kann die Liste auf einen Teil beschränken; jeder
  hat dann nur seinen Reiter, die Zellen überschneiden sich nur in Disq./Bemerkung (Regel oben).
- Ein Handy der Start-Freigabe (Steg b) kann zusätzlich Steg a haben: unten zwei Reiter „Freigabe“ und „Steg“.
- **Parallelslalom**: Zwei Boote legen gleichzeitig ab (A und B). Die Steg-Maske zeigt dann je Teil zwei Spalten
  „A 204 | B 211“ mit je eigenem „OK“; auf dem Handy untereinander.

### 4.5 Vorsteg

Kontrolle Weste, Helm, Startnummer, Schuhe. Ein Riesenknopf **„In Ordnung ✓“**, daneben „X nicht gestartet“ und „Disq“.
Gilt für alle Versuche des Starters (wie heute in der Erfassung). Schlange = die nächsten Starts der Folge.

### 4.6 Knoten (Pad, am Tisch)

```
+------------------------------------------------------------------+
| Knoten   Nr. [ 2 3 _ ]   23 · Kl. 3               offen: 14 / 38 |
+------------------------------------------------------------------+
| Webleinstek    [ ✓ in Ordnung ]  [ ✗ Fehler · 5 ]                |
| Schotstek      [ ✓ in Ordnung ]  [ ✗ Fehler · 5 ]                |
| Palstek        [ ✓ in Ordnung ]  [ ✗ Fehler · 5 ]                |
| Kreuzknoten    [ ✓ in Ordnung ]  [ ✗ Fehler · 5 ]                |
| Klampe         [ ✓ in Ordnung ]  [ ✗ Fehler · 5 ]                |
+------------------------------------------------------------------+
|                         [ ABSCHICKEN · 5 ]                       |
+------------------------------------------------------------------+
```

Abschicken erst, wenn jeder Knoten ✓ oder ✗ hat. Punkte und Knoten aus dem Regelwerk. Am Handy dieselbe Prüfliste
untereinander, Starter über großen Ziffernblock.

### 4.7 Zeit (abgelesene Zeit eintippen)

```
Handy hoch                             Pad quer (Anlage + Stoppuhr nebeneinander)
+--------------------------------+     +---------------------------------------------+
| ● Zeit 2 (Stoppuhr) · 1. Lauf  |     | Zeit 1 (elektronisch)  | Zeit 2 (Stoppuhr)  |
|   23  Kl. 3   danach [41][Nr.] |     |  23 · Kl. 3            |  23 · Kl. 3        |
+--------------------------------+     |  [ 1:23,45 ]           |  [ 1:23,6_ ]       |
|          1:23,45               |     |  7 8 9  ,              |  7 8 9  ,          |
|     = 1 min 23,45 s            |     |  4 5 6  ⌫              |  4 5 6  ⌫          |
|   [ 7 ]   [ 8 ]   [ 9 ]        |     |  1 2 3  0              |  1 2 3  0          |
|   [ 4 ]   [ 5 ]   [ 6 ]        |     |  [ ABSCHICKEN ]        |  [ ABSCHICKEN ]    |
|   [ 1 ]   [ 2 ]   [ 3 ]        |     |------------------------+--------------------|
|   [ , ]   [ 0 ]   [ ⌫ ]        |     | Zuletzt: 12 1:31,02 ✓   8 1:19,88 ✓          |
| [ keine Zeit ] [ ABSCHICKEN ]  |     +---------------------------------------------+
+--------------------------------+
```

Eigene Tasten statt Systemtastatur, gleiche Lesart wie am Rechner (`lib/time.ts` parseTime: „83,45“ = Sekunden,
„1,2345“ = Minuten und Sekunden mit Hundertstel), Deutung groß darunter. „Keine Zeit“
(Anlage ausgefallen, nicht durchs Ziel) ist eine eigene Meldung mit Grund; die Zelle bleibt leer. Plausibilität prüft
der Bedienrechner. Stoppen am Handy gibt es nicht (F9).

### 4.8 Parallelslalom (UIM): Racecourse A und B

Ein Gerät gehört zu **einem** Racecourse und zeigt nur das Boot auf seiner Seite (die Seite wechselt im 2. Attempt; die
Maske zeigt einfach, wer jetzt auf A ist). Ist die eigene Seite leer (Dummy, X), erscheint der Start nicht. Englische
Begriffe: race official, racecourse, attempt, re-run.

```
Handy hoch, Racecourse A                 Pad quer, Race official zwischen den Bahnen
+--------------------------------+   +----------------- Quarterfinal · Attempt 1 · Pair 3/8 -----------------+
| ● Racecourse A · Quarterfinal  |   |  RACECOURSE A                     |  RACECOURSE B                      |
|   Attempt 1                    |   |  204 · Cl. 2                      |  211 · Cl. 2                       |
|   204   Cl. 2                  |   |   [picture A, buoys 1-5-1]        |   [picture B, mirrored]            |
+--------------------------------+   |   Σ 5     [DISQ]                  |   Σ 0     [DISQ]                   |
| Start   [ L · ]   [ R · ]      |   |   [ SUBMIT A · 5 ]                |   [ NO FAULTS B ✓ ]                |
| Buoy 1  [   · ]   Buoy 2 [ · ] |   +-----------------------------------+------------------------------------+
| Buoy 3  [   · ]   Buoy 4 [ · ] |
| Buoy 5  [  ✔5 ]                |
| Buoy 4  [   · ]   Buoy 3 [ · ] |
| Buoy 2  [   · ]   Buoy 1 [ · ] |
| Finish  [ L · ]   [ R · ]      |
| [ DISQ ]   [ SUBMIT · 5 ]      |
+--------------------------------+
```

Zwei Abschickknöpfe auf dem Pad, weil ein Boot früher fertig sein kann. Re-run = eigene Runde, groß „Re-run“ im Kopf.
Werte landen wie heute unter `parallel:<runde>/<attempt>`; den Racecourse leitet der Bedienrechner aus dem
festgeschriebenen Plan ab, das Gerät schickt ihn nur zur Prüfung mit (passt er nicht mehr: Rückfrage).

**Versuche direkt nacheinander** (UIM Manövrieren, Pkt. 4.3.2): Nach dem Abschicken von Attempt 1 steht **dieselbe
Nummer** wieder oben. Der Wechsel wird darum nicht an der Nummer, sondern am Kopf sichtbar: „23 · ATTEMPT 2“ in voller
Breite invers, mit derselben Sperrsekunde wie beim Starterwechsel.

### 4.9 Zwei Listen auf einem Pad

Erlaubt höchstens zwei (Tor 1/3/5 + Tor 2/4/5, Racecourse A + B, Steg a + Start-Freigabe). Jede Liste hat ihre eigene
aktive Nummer, also Reiter oder nebeneinander, nie ein gemeinsames Bild. Zwei Listen mit eigenem Takt (z. B. Steg + Tor)
lässt die Kopplung zu, warnt aber: „besser zwei Geräte“. Auf dem Handy immer genau eine.

---

## 5. Abschicken, Quittung, Korrektur

**Stufen einer Zeile** (auf dem Gerät und in der Matrix sichtbar):

```
Entwurf --Abschicken--> ↑ unterwegs --Quittung--> ✓ übernommen --"Liste abschließen"--> abgeschlossen
   ^                        |                         |
   |                (6 s Rückgängig)                  +-- ! Rückfrage am Bedienrechner (Zelle war anders belegt)
   +------ Korrigieren <------------------------------+-- ✗ abgelehnt (Grund als Satz)
```

- **Eine Zeile, ein Paket.** Je Start und Liste geht eine Zeile (Steg: zwei Teile). Jede Zelle trägt den Wert, den das
  Gerät dort erwartet („vorher“, beim ersten Abschicken leer).
- **Übernahme am Bedienrechner**: Ist die Zelle leer oder gleich, wird übernommen, mit Haken „erfasst“. Ist sie anders
  belegt (abgetippt, zweites Gerät, am Rechner geändert), bleibt der Stand und es entsteht eine **Rückfrage** im Eingang
  („Gerät sagt 10 · steht 15, von Hand 10:44 → [Gerät übernehmen] [behalten]“). Der Haken „erfasst“ kommt nur ohne offene
  Rückfrage. Nichts wird still überschrieben.
- **Doppelt angekommen** (Netz wackelt): Jede Zeile hat eine Nummer, sie wirkt nur einmal (wie die Start-Freigabe heute).
- **Rückgängig (6 s)**: holt die Zeile zurück, ist sie schon übernommen, geht automatisch eine Korrektur hinterher.
- **Entwürfe gehen nie verloren**: Wechselt der WKR das Boot, ohne abzuschicken, bleibt der Entwurf unter „Entw.“ und
  erscheint wieder, wenn der Starter oben steht.
- **Korrektur** (F7, 21.11.2026): Das Gerät zeigt zum Erfassen nur den aktiven Starter, die abgeschickten Zeilen bleiben
  aber unter **„Zuletzt“** erreichbar (die letzten 5–10, dahinter „alle dieses Laufs“). Zeile öffnen, ändern,
  „Korrektur abschicken“ mit großer Rückfrage („Start 23, Tor 1/3/5: 15 → 10?“). Direkt geht das nur bis **„Liste
  abschließen“**; danach sind Änderungen vom Gerät nur noch **Vorschläge**, die am Bedienrechner in einer Liste mit
  „Übernehmen / Verwerfen“ stehen.
- **„Liste abschließen“** am Ende eines Laufs auf dem Gerät: zeigt **alle Zeilen der Liste** dieses Laufs noch einmal
  zur Prüfung (Startnummer, Einträge, Summe; Korrektur direkt aus der Übersicht), oben „30 abgeschickt, 1 offen: 27,
  1 X: 9“, darunter Name des WKR und ein Knopf, der die Liste **als Ganzes quittiert**. Geht erst, wenn nichts offen
  ist oder „Rest auf Papier“ gewählt wurde. Das ist die digitale Unterschrift (F8).
- **Keine Sperre**: Anders als die Start-Freigabe am Handy wartet die WKR-Maske nie auf die Quittung. Ohne Quittung nach
  10 s steht im Kopf „Keine Bestätigung – Verbindung prüfen“, erfasst wird weiter. Nach einem Funkloch gehen wartende
  Zeilen gebündelt hinaus.
- **Herkunft**: An jeder Zelle der Erfassung am Bedienrechner zeigt ein kleines Zeichen ◆, dass der Wert von einem Gerät
  kam (Tooltip „Tor 1/3/5 Handy, 10:42“). Im Verlauf steht, welches Gerät was wann gesetzt hat (F10).

---

## 6. Was der Bedienrechner sieht

### 6.1 Erfassungs-Matrix (Betrieb → neuer Unterreiter „Erfassung“)

```
P2 · 1. Lauf                       Im Boot: 17   gezeigt 14:03:10       [ Nächster Start ▸ ]
+--------------+--------------------------+----+----+----+----+----+----------------+
| Liste        | Gerät                    | 13 | 14 | 15 | 16 | 17 | Stand          |
+--------------+--------------------------+----+----+----+----+----+----------------+
| Steg         | ● Steg-Handy  vor 5 s    | ✓  | ✓  | ✓  | ½  | ½  | Anlegen 16 off.|
| Tor 1/3/5    | ● Pad Nord    vor 8 s    | ✓  | ✓  | ✓  | ✓  | ○  | ok             |
| Tor 2/4/5    | ◐ Handy Süd   still 2 min| ✓  | ✓  | ⧗  | ⧗  | ○  | 2 warten im Ger|
| MüB          | ✕ Handy MüB   weg 9 min  | ✓  | –  | P  | P  | ○  | Papier ab 15   |
| Tor 5        | ● Handy T5    vor 3 s    | ✓  | !  | ✓  | ○  |    | ! Rückfrage 14 |
| Parcours     | ▭ Papier                 |    |    |    |    |    | Bogen          |
+--------------+--------------------------+----+----+----+----+----+----------------+
Zeile:  ✓ übernommen  ½ nur Ablegen  ○ offen  ⧗ laut Gerät abgeschickt, noch nicht da
        ! Rückfrage  – entfällt (Klasse)  P Papier  ▭ ganze Liste auf Papier
Gerät:  ● gehört < 90 s   ◐ still 90 s – 5 min   ✕ weg > 5 min / entzogen   (+ Akku, wo bekannt)
        ⏸ pausiert   ⏏ abgemeldet (F1: Papier übernimmt, kein Rückstand)
[ Rückfragen: 1 ]   [ Vorschläge: 0 ]   [ Papier ab … ]   [ Liste abgeschlossen: — ]
```

- **Zwei getrennte Ampeln**, wie gewünscht: links *Gerät verbunden?*, rechts je Start *Zeile da?* Ein Gerät kann
  verbunden sein und trotzdem nichts schicken (WKR abgelenkt), oder still sein und trotzdem alles abgeschickt haben (⧗).
- **„Verbunden“ heißt „zuletzt gehört“**: Jede Zeile zählt als Lebenszeichen; nur wenn ein Gerät 60 s nichts geschickt
  hat, meldet es sich kurz (mit „n warten“ und Akku, wo der Browser ihn verrät). ◐ heißt nicht kaputt – das Handy kann
  in der Tasche schlafen.
- **Überfällig**: Eine Zelle ○, die mehr als R Starts zurückliegt, wird gelb mit „!“.
- **Markierung in der Erfassung** (F4, 21.11.2026): Auch in der Erfassung am Bedienrechner trägt jede Zeile bzw. Zelle
  einer digitalen Liste, deren Gerätewert fehlt, im Rückstand ist oder in eine Pause fällt, ein Zeichen „Papier ansehen“.
  So sieht man beim Abtippen direkt, ab welchem Start der Papierbogen wichtig ist.
- **Pausiert / abgemeldet** (F1): Der WKR meldet sich auf dem Gerät kurz ab („Pausieren“, z. B. Toilette, Ablösung)
  oder ganz („Abmelden“); der Bediener kann es ebenso setzen. Die offenen Starts der Pause zeigen P (Papier übernimmt),
  die Liste zählt nicht als Rückstand; „Weiter“ auf dem Gerät setzt sie ab dem nächsten Start wieder digital.
- Klick auf eine Zelle: Werte, Herkunft, bei „!“ beide Fassungen mit „Gerät übernehmen / behalten“. Klick auf ein Gerät:
  Geräteliste aus E7 (umbenennen, Maske vorgeben, entziehen).
- **„Papier ab Start …“** je Liste: Zellen zeigen P, die Matrix mahnt nicht mehr, das Gerät zeigt „Papier ab Nr. x“, und
  die Erfassung weiß, welche Zeilen vom Bogen abzutippen sind. „Ab Start … wieder digital“ hebt es auf.
- Die Matrix entsteht nur am Bedienrechner und geht auf keine Leitung. Sie ist auch ohne Geräte nützlich: Sie zeigt
  Lücken beim Abtippen.

### 6.2 Geräteleiste und Warnung vor „Nächster Start“

„Direkt sehen“ heißt: nicht erst im Unterreiter. In der **Start-Freigabe am Bedienrechner** steht immer eine Leiste mit
einem Feld je digitaler Liste – Gerätezustand und offene Starts –, auch wenn alles gut ist:

```
  Geräte:  ● Steg ½16   ● T1/3/5 ✓   ◐ T2/4/5 ⧗2   ✕ MüB 4 offen   ● T5 !14   ▭ Parcours
```

Ein Klick führt in die Matrix (§6.1) auf genau diese Liste. Ändert sich ein Feld auf ✕ oder „!“, blinkt es einmal und
bleibt rot bis zur Abhilfe (Papier, Ersatzgerät, Rückfrage entschieden); kein Ton, kein Dialog.

Darüber die Warnung, sobald etwas zu weit zurückliegt – am Bedienrechner und auf dem Handy der Start-Freigabe (dort nur
Listenname und Rückstand, keine Werte):

```
  ! MüB hat 14–17 nicht abgeschickt (Gerät seit 9 min weg) · ⧗ Tor 2/4/5: 2 warten
  [══════════════════ Nächster Start ▸ ══════════════════]   (gelber Rand)
```

- Regel: eine digitale Liste liegt mehr als **R Starts** zurück (Vorgabe R = 2, Einstellungen → Betrieb). Pausierte,
  abgemeldete und auf Papier gesetzte Listen zählen nicht (F1); in der Leiste stehen sie als ⏸/⏏/▭ ohne Warnung.
- **Vorgabe: nur warnen.** Wählbar „nachfragen“ („Trotzdem freigeben?“). Eine echte Sperre hielte bei einem stillen
  Handy den ganzen Wettkampf an (F4, 21.11.2026 bestätigt; dazu die Markierung in der Erfassung, §6.1).

### 6.3 Anzeigetafel und Zuschauerliste

**Zeigen nichts davon** – keine Gerätezustände, keine Rückstände, keine Fehlerpunkte. Die öffentliche Sicht bleibt
unverändert; ein Test sichert, dass nichts aus der Erfassung dort landet. Der Auftrag nennt „Bediener/Tafel-Ansicht“:
Gemeint ist hier die Start-Freigabe (Geräteleiste, §6.2), nicht die öffentliche Anzeigetafel (F17).

---

## 7. Sonderfälle

| Fall | Verhalten |
|---|---|
| Boot kommt vor dem Vorgänger | Ausweichknopf oder Nr.-Suche; der Vorgänger bleibt oben |
| Start nach dem Zeigen zurückgestellt | verschwindet aus den Schlangen; ein Entwurf wird „behalten/verwerfen“ gefragt, behalten erscheint er wieder, wenn der Start neu gezeigt wird; schon übernommene Werte (z. B. Ablegen) bleiben, die Matrix markiert „zurückgestellt, Werte vorhanden“ |
| Starter fährt im selben Lauf noch einmal (Wiederholung durch den Schiedsrichter) | **dieselbe Zeile**: das Gerät zeigt „schon erfasst (5) – neue Fahrt?“; neue Werte nur als Korrektur, am Bedienrechner abzunicken; die erste Fahrt bleibt im Verlauf |
| Versuch 2 (UIM, Versuche nacheinander), Re-run | eigene Zeile, Zusatz „Attempt 2“ bzw. „Re-run“ groß im Kopf |
| „2./3. Versuch“ eines Elements | ist ein Fehlercode (6, 7, 20 …), keine Wiederholung |
| Klasse ohne diese Position | grau, „entfällt“, schließt von selbst |
| Boot kam nicht vorbei (vorher aufgegeben, Abbruch) | „Nicht vorbeigekommen“ unter „Mehr“: leere Zeile mit Kennzeichen, **kein X**; in der Matrix gelb |
| X (nicht gestartet) | nur Steg-Ablegen und Vorsteg, mit großer Rückfrage; nimmt den Start aus der Folge; am Bedienrechner hervorgehoben (F5) |
| Disq an anderer Position schon gesetzt | erfährt das Gerät nicht; der WKR erfasst weiter, was er sieht |
| Netz weg | weiter erfassen, Zeilen warten, Schlange geschätzt, roter Kopf; ab 5 min „Papierbogen ab Nr. x“ |
| Akku leer, Handy ins Wasser, mitten in der Fahrt | Matrix und Geräteleiste zeigen ✕ (nach 90 s ◐, nach 5 min ✕; der Bediener kann es sofort auf „Papier“ setzen); „Papier ab Start …“ ab dem ersten offenen Start; Ersatzgerät koppeln, es sieht sofort, was offen ist. Verloren sind nur Entwurf und noch nicht Abgeschicktes – der WKR schreibt den laufenden Start aus dem Gedächtnis auf den Bogen. Kommt das alte Gerät wieder, gehen seine wartenden Zeilen als Rückfrage ein, nie still |
| WKR wird abgelöst | „Mehr → WKR wechseln“: neuer Name ab jetzt, offene Entwürfe werden angezeigt und übergeben |
| zwei Geräte auf derselben Liste (Ersatz, Vier-Augen) | erlaubt; erste Zeile gilt, abweichende zweite wird Rückfrage; Hinweis in der Matrix |
| zwei WKR teilen sich eine Position (je eine Seite, Steg AB/AN) | Kopplung auf einen Teil der Liste beschränkt (Spalten, F16); Zellen getrennt, kein Konflikt; Disq. wird vereinigt (§4.4); die Matrix zeigt die Liste mit zwei Geräten und ½, bis beide Teile da sind |
| Versuche direkt nacheinander (UIM) | dieselbe Nummer bleibt oben, Kopf „Attempt 2“ invers (§4.8) |
| Parallel: zwei Starter gleichzeitig | je Racecourse ein Gerät bzw. auf dem Pad zwei Spalten mit eigenem Abschicken; das Paar zählt in der Matrix als zwei Zeilen |
| Gerät entzogen | Kopf „Entzogen“, Entwürfe nur lesend mit „auf Papier übertragen“; noch Unquittiertes erscheint am Bedienrechner unter „Vorschläge“ |
| Lauf unterbrochen (Wetter, Unfall), Lauf neu gestartet | Meldung aus dem Betrieb erscheint auf allen Geräten; Schlangen ruhen, Entwürfe bleiben; bei Neustart des Laufs entscheidet der Bedienrechner, welche Zeilen gelten |
| Verzahnung am Tag gelöst | Betrieb ruht, Geräte zeigen „Betrieb angehalten“; abgeschickte Zeilen bleiben |
| Bedienrechner neu geladen oder anderes Fenster führt | die Geräte wiederholen ihre Zeilen, nichts wirkt doppelt (wie seit E7) |
| Parallel: eigene Seite leer | Start erscheint auf diesem Gerät nicht |

**Rückkanal**: Der Bedienrechner kann einem Gerät kurze, feste Meldungen schicken, die groß im Kopf erscheinen und
quittiert werden: „Bitte Nr. 23 prüfen/nachtragen“, „Papier nehmen“, „Lauf unterbrochen“, „Weiter digital“. Kein Freitext.

---

## 8. Papier als Rückfall und Vorrangregel

- Die **WKR-Bögen gibt es weiter**, gedruckt wie heute; jede Liste kann jederzeit auf Papier gehen, auch mitten im Lauf.
- **Je Liste einstellbar**: „digital“, „Papier“, „beides“ – **immer**, nicht nur beim ersten Einsatz (F1, 21.11.2026).
  Bei „beides“ schreibt der WKR zusätzlich auf den Bogen, abgetippt wird nur, wo die Matrix oder die Markierung in der
  Erfassung eine Lücke oder Rückfrage zeigt; danach ein Vergleich.
- **Pausieren / Abmelden** (F1): Gerade weil Papier mitläuft, kann sich das Gerät pausieren (kurz weg, Papier
  übernimmt) oder abmelden. Dann zählt die Liste nicht als Rückstand, und die Freigabe wartet nicht darauf (§6.1, §6.2).
  Am Steg mit zwei Handys (Ablegen/Anlegen, F16) pausiert ein Handy nur seinen Teil; das andere erfasst weiter
  (Auslegung 21.11.2026, noch zu bestätigen).
  Die Starts der Pause sind P und werden vom Bogen abgetippt.
- **Vorrang**:
  1. Was am Bedienrechner steht, gilt (abgetippt oder übernommen).
  2. Vom Gerät kommt ein Wert nur in leere oder gleiche Zellen; sonst Rückfrage.
  3. Wird ein Bogen abgetippt, wo schon Gerätewerte (◆) stehen, fragt die Erfassung bei Abweichung nach, welcher gilt.
  4. Bei „beides“ gilt im Zweifel der unterschriebene Bogen; das Gerät ist dann nur Schnellweg.
  5. „Papier ab Start …“ macht die Liste ab dort zum Papier: Gerätezeilen danach werden zu Vorschlägen.
- Nach dem Lauf zeigt der Laufzettel, welche Listen (und ab welchem Start) vom Papier abzutippen sind.

---

## 9. Datenschutz

- **Aufs WKR-Gerät** kommen nur: Startnummer, Klasse, Lauf/Attempt/Runde, beim Paar die eigene Seite, die Bootskennung
  (wenn es Boote gibt – sie ist auf Entfernung besser zu erkennen als die Weste), die aufgelöste Maske der eigenen Liste.
  **Kein Name** als Vorgabe (die Startnummer reicht); nur wenn gewünscht, nach der öffentlichen Namensregel der Tafel (F6).
- **Nie**: Geburtsdatum, Gewicht, Geschlecht, Herkunft, Werte oder Summen anderer Listen, Wertung, Plätze.
- **Neu: Werte auf der Leitung.** Bisher gilt „nie Werte über ntfy“. Die Erfassung schickt die Werte der eigenen Liste
  vom Gerät zum Bedienrechner – verschlüsselt, nur in einer eigenen Gruppe je Liste, die nur die Geräte dieser Liste
  lesen können (am Steg auch das Gerät des anderen Teils; Auslegung 21.11.2026, WKR_ANNAHMEN.rueckfrageInListe).
  Zurück kommen nur Quittungen und bei einer Rückfrage der Stand genau dieser Zelle; die eigenen Werte hält das Gerät
  selbst. Die Tafel- und Zuschauerwege bleiben wertfrei. Das braucht eine ausdrückliche, datierte Ausnahme (F11).
- **Ausgleichsgewicht** am Steg a gehört nicht in diese Etappe (ließe auf das Körpergewicht schließen); eigene Entscheidung
  mit dem Check-In (E10).
- **Auf dem Gerät gespeichert**: Kopplung, Schlüssel, wartende Zeilen, Entwürfe, die letzten Zeilen zum Korrigieren,
  Maskenwahl. Gelöscht bei Entkoppeln, Raum beendet oder 36 h ohne Nachricht. Nie im AppState, nie in der Sicherung.
- Der **WKR-Name** bei „Liste abschließen“ ist eine Personenangabe im Stand; die Einteilung führt WKR-Namen schon heute.

---

## 10. Verkehr (Kontingent des ntfy-Servers)

Überschlag 120 Starter × 2 Läufe, 6 digitale Listen, ein Bereich: Geräte ≈ 2 600 Nachrichten am Tag, Bedienrechner
≈ 3 300 (inklusive des bisherigen Betriebs). Bei ntfy.adminforge.de (17 280 je Tag und IP) unkritisch; gehen alle
Geräte über **einen** Hotspot, zählen sie zusammen (≈ 6 000, bei zwei Bereichen ≈ 12 000). ntfy.sh (250) reicht nicht.

Dafür nötig: Quittungen gesammelt im nächsten Paket an die Liste, Lebenszeichen nur bei Stille, nichts an Listen ohne
offene Starts, Zeilen nach Funkloch gebündelt. Die Aufgabe „Liste“ lässt sich nur koppeln, wenn der Server genug
Kontingent hat; die Kontingentanzeige (E8) zeigt die Erfassung getrennt und warnt beim Hotspot.

---

## 11. Etappenplan

| Etappe | Inhalt | Größe |
|---|---|---|
| **W1 Kern** | Aufgabe „Liste“ (Rechte je Liste und Zelle, Wertprüfung wie in der Tabelle), Zeile vom Gerät → Übernahme über die Erfassung mit „vorher“-Prüfung und Rückfrage, Teilhaken Steg (Disq. vereinigt, Kopplung je Teil), Schlange je Liste, eigene verschlüsselte Gruppe je Liste, Lebenszeichen, gesammelte Quittungen, Rückkanal-Codes, Meldungen „pausiert/abgemeldet/weiter“ (F1), Korrektur und Abschluss als Ganzes im Protokoll (F7), Protokollfassung 2; Tests ohne echte Geräte | L |
| **W2 Bedienrechner** | Matrix mit zwei Ampeln, Rückfragen und Vorschläge, Herkunftszeichen ◆ in der Erfassung, Markierung „Papier ansehen“ an Zeile/Zelle in der Erfassung (F4), Warnung vor „Nächster Start“ (Einstellung R, warnen/nachfragen; pausierte/abgemeldete Listen ausgenommen), Zeile auf dem Freigabe-Handy, „Papier ab Start …“ und „digital/Papier/beides“ je Liste (F1), Pausieren/Abmelden durch den Bediener, „Liste abgeschlossen“ | M |
| **W3 Handy, Katalog** | Steg zweiteilig (= E9), Tor 5, MüB, Vorsteg; Rahmen mit Doppeltipp-Schutz, „Pausieren/Abmelden“ unter „Mehr“, „Zuletzt“ mit Korrektur und „Liste abschließen“ mit Prüfung aller Zeilen (F7), Sonnenmodus, Zustände ohne Arbeit, Probe beim Einrichten („Tippe Tor 1 links an“), Übungsmodus mit Beispieldaten | M |
| **Feldtest 1** | zwei bis drei WKR, Handschuhe, Sonne, Funkloch, ein Lauf doppelt (Papier + Gerät) verglichen, Kontingent gemessen; Checkliste in feldtest.md (Schutzhülle, Handschuh-Modus, Bildschirmsperre, Trageband, Powerbank, iPhone ohne Vibration) | S–M |
| **W4 Handy, Bojen** | Knopf-Maske in Fahrtfolge (Schalter je Boje und Richtung; Tor 5 Zähler; Tor 1 Rückfahrt je Durchfahrt eine Zeile, F2), Seiten nach Blick | M |
| **W5 Pad** | Bild mit Umschalter Hin/Rück und Klassenwechsel, Schlange/Zuletzt-Spalte, zwei Listen, Racecourse A + B, Knoten-Prüfliste, Ziffernblock Zeit, Tabelle für Geübte | L |
| **W6 nach Befund** | Handy-Bild, Zeit auf dem Handy, weitere Maskenoptionen | M |

Bis zum ersten Feldtest (W1–W3) grob 3 000–4 000 Zeilen mit Tests. Check-In (E10) bleibt unabhängig davon.

---

## 12. Entscheidungen (Antworten 21.11.2026)

Der Nutzer hat alle Fragen beantwortet und den Vorschlag als schlüssig bestätigt. Je Frage die Entscheidung; „wie
empfohlen“ = die frühere Empfehlung gilt. Kurzfassung auch in [entscheidungen.md](entscheidungen.md).

| Frage | Entscheidung |
|---|---|
| **F1** Papier zusätzlich? | **Anders**: „Papier“ und „beides“ gibt es **immer** je Liste, nicht nur beim ersten Wettkampf. Das Gerät kann sich **pausieren** oder **abmelden**; dann zählt die Liste nicht als Rückstand, die Freigabe wartet nicht (§3, §6.1, §6.2, §8). |
| **F2** Bojen Schalter, Tor 5 Zähler? | **Anders/genauer**: Eine Boje je Richtung nur einmal berührbar (Schalter). Ausnahmen: Torbojen Tor 5 (Zähler je Berührung) und Tor 1 auf der Rückfahrt, das wegen der Speedrunde zweimal durchfahren wird – je Durchfahrt eine Zeile mit eigenem Schalter, passend zu den zwei Spalten `t1b`/`t1c` im Fahrweg (§4.2). |
| **F3** Nur mit Start-Freigabe? | **Ja**, wie empfohlen. |
| **F4** Rückstand vor „Nächster Start“? | **Wie empfohlen** (warnen ab R = 2, „nachfragen“ wählbar, nie sperren), **plus** Markierung „Papier ansehen“ an Zeile/Zelle in der Erfassung am Bedienrechner (§6.1). |
| **F5** X vom Gerät? | **Ja**, nur Steg-Ablegen und Vorsteg, mit Rückfrage und Hervorhebung. |
| **F6** Name auf dem Gerät? | **Nein**, Startnummer, Klasse, ggf. Boot. |
| **F7** Korrigieren bis wann? | **Ja, mit Auslegung** der Nutzerfrage („das Gerät sieht nur den aktiven Starter – wie korrigieren?“): über „Zuletzt“; „Liste abschließen“ zeigt alle Zeilen zur Prüfung und wird als Ganzes quittiert; bis dahin direkt, danach Vorschlag (§5). |
| **F8** Abschluss statt Unterschrift? | **Ja**. |
| **F9** Nur abgelesene Zeit? | **Ja**, kein Stoppen am Handy. |
| **F10** Herkunft in der Sicherung? | **Nein**, nur ◆ und Verlauf am Bedienrechner. |
| **F11** Werte auf der Leitung? | **Ja**, nur eigene Liste, verschlüsselt Gerät → Bedienrechner; zurück Quittungen bzw. eine Zelle; kein Ausgleichsgewicht. |
| **F12** Übernahme? | **Automatisch in leere Zellen**, abnicken nur bei Abweichung. |
| **F13** Sprache der Maske? | **Sprache der Liste**, umschaltbar. |
| **F14** Wer legt die Maske fest? | **Bedienrechner gibt vor.** |
| **F15** Listen je Gerät? | **Handy eine, Pad höchstens zwei.** |
| **F16** Teilkopplung? | **Ja, nur Steg (AB/AN).** |
| **F17** Etwas auf der Anzeigetafel? | **Nein.** |
