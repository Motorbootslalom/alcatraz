# Feldtest Gerätebetrieb (E8)

Checkliste für den ersten Test mit echten Geräten und dem echten Server (Plan vom 16.11.2026, Etappe E8; vorbereitet
20.11.2026). Bisher ist der Gerätebetrieb nur gegen einen nachgebauten Server und nachgebaute Browser geprüft.
Bedienung: [betrieb.md](betrieb.md#gerätebetrieb), Ablauf: [betrieb.md](betrieb.md#ablauf-am-wettkampftag).

Nur Beispieldaten verwenden (Reiter „Veranstaltung“ → Beispieldaten), keine echten Starter.
Je Punkt abhaken, wenn das erwartete Ergebnis eintritt; sonst unter „Beobachtung“ notieren, was geschah
(Gerät, Uhrzeit, Text auf dem Bildschirm).

## Aufbau

- Bedienrechner: Pages-Fassung, „Offline bereit“, Fassung (Build-Zeit): ______
- Server: `ntfy.adminforge.de` (Einstellungen → Geräte leer = Vorgabe)
- Netz am Bedienrechner (WLAN, Hotspot welches Handys?): ______

| Gerät | Modell, Betriebssystem | Browser, Fassung | Netz (WLAN/Mobilfunk) | Rolle |
|---|---|---|---|---|
| A | Android | Chrome | | Anzeigetafel / Start-Freigabe |
| B | iPhone | Safari | | Zuschauer / Start-Freigabe |
| C | iPhone als Home-Bildschirm-App (optional) | Safari | | Start-Freigabe |

## Lese-Links

- [ ] **Gerätebetrieb einschalten.** Erwartet: Verbindung „verbunden“ binnen weniger Sekunden; zwei QR-Codes.
  Beobachtung:
- [ ] **Anzeigetafel per QR** (Gerät A). Erwartet: Tafel statt „Warte auf den Bedienrechner …“ binnen etwa 5 s,
  Fingerabdruck gleich dem des Bedienrechners. Beobachtung:
- [ ] **Zuschauer per QR** (Gerät B, über Mobilfunk). Erwartet: Zuschauerliste, „ca. in“ plausibel (Uhrversatz).
  Beobachtung:
- [ ] **Start freigeben** am Bedienrechner. Erwartet: Tafel und Zuschauerliste zeigen den Wechsel binnen etwa 2 s.
  Verzögerung gemessen: ______ s. Beobachtung:

## Koppeln

- [ ] **Per QR-Code** (Gerät A; einmal auch über Mobilfunk mit langsamem ersten Laden). Erwartet: gekoppelt ohne
  Tippen, Start-Freigabe der angekreuzten Parcours; reicht das 30-s-Fenster des QR-Codes (plus 30 s Gnade)?
  Zeit vom Scannen bis gekoppelt: ______ s. Beobachtung:
- [ ] **Per Geräte-Code über Mobilfunk** (Gerät B: Koppel-Link öffnen, Code eintippen; der Code gilt 5 min). Erwartet:
  gekoppelt; kommt die Antwort vor „Keine Antwort“ (15 s)? Zeit bis gekoppelt: ______ s. Beobachtung:
- [ ] **iPhone: QR öffnet Safari statt der Home-Bildschirm-App** (Gerät C). Erwartet laut Plan: Safari öffnet sich;
  festhalten, wie man in die Home-App kommt (Link kopieren?). Beobachtung:

## Start-Freigabe vom Handy

- [ ] **Schalten:** „Nächster Start“ auf dem Handy. Erwartet: „Wird gesendet …“, dann frei; Bedienrechner und Tafel
  zeigen den Start. Dauer bis zur Bestätigung: ______ s. Beobachtung:
- [ ] **Doppelt tippen** (schnell zweimal, und auf zwei Handys gleichzeitig). Erwartet: genau ein Schritt; das zweite
  Handy sieht „Nichts geändert – schon geschehen oder jemand anderes war schneller“ oder nichts. Beobachtung:
- [ ] **Zurückstellen, Meldung, Einreihen** vom Handy. Erwartet: wirkt wie am Bedienrechner. Beobachtung:
- [ ] **Nur eigene Parcours:** Häkchen am Bedienrechner wegnehmen. Erwartet: Karte verschwindet auf dem Handy sofort.
  Beobachtung:

## Hintergrund und Bildschirm

- [ ] **Wake Lock** (Bildschirmsperre auf 30 s stellen, Handy liegen lassen, 2 min). Erwartet: Bildschirm bleibt an;
  sonst steht „Bildschirm kann ausgehen …“ in der Leiste, in der WKR-Maske als gelbes Band oben mit dem Tipp
  „Display-Zeit am Handy verlängern“ (seit 21.11.2026; über `npm run dev:host`, also http, immer – dort gibt es keine
  Wake Lock; für lokale Tests mit Wake Lock `npm run dev:https` und die Zertifikatswarnung auf jedem Gerät einmal
  bestätigen, docs/technik.md „Mit HTTPS im WLAN“; den Offline-Speicher bringt das nicht – Offline nur über GitHub Pages).
  Android: ______ iPhone: ______ Home-App: ______
- [ ] **Handy 5 min weglegen** (Bildschirm aus), währenddessen 3 Starts am Bedienrechner. Erwartet nach dem Einschalten:
  binnen etwa 10 s der aktuelle Stand, Verbindung „verbunden“. Android: ______ iPhone: ______
- [ ] **Handy 15 min weglegen**, dazu einmal eine andere App im Vordergrund. Erwartet: wie oben; auf dem iPhone ist der
  WebSocket im Hintergrund zu (Plan, Risiko 7) – es muss beim Zurückkommen selbst neu verbinden. Android: ______
  iPhone: ______
- [ ] **Start-Freigabe nach dem Weglegen:** sofort „Nächster Start“. Erwartet: Bestätigung, kein doppelter Start.
  Beobachtung:

## Bedienrechner

- [ ] **Bedienrechner neu laden** (F5). Erwartet: Raum bleibt, Geräte zeigen weiter an, nach wenigen Sekunden wieder
  „verbunden“; Handy-Freigabe geht danach. Beobachtung:
- [ ] **Zweites Bedienfenster** öffnen, dort schalten, dann das erste schließen. Erwartet: „Die Verbindung hält ein
  anderes Fenster“, Knöpfe wirken; nach dem Schließen übernimmt das zweite. Beobachtung:
- [ ] **Bedienfenster im Hintergrund:** Fenster minimieren bzw. einen anderen Tab nach vorn holen, 10 min, dabei vom
  Handy schalten. Erwartet: Quittung kommt, Tafel aktuell (der Browser drosselt den Herzschlag der Führung, 2 s, und
  das Sammeln im Hintergrund). Verzögerung bis zur Quittung: ______ s. Beobachtung:
- [ ] **Bedienrechner als Ein-Datei-Fassung** (`file://`), Geräte über Pages. Erwartet: Lese- und Koppel-Links zeigen
  auf Pages; gleiche Fassung → Anzeige; ist die Datei älter als Pages → auf dem Gerät „Bedienrechner aktualisieren“.
  Dazu zwei Fenster unter `file://`: Erwartet wie beim zweiten Bedienfenster (storage, BroadcastChannel, Web Locks
  verhalten sich unter `file://` je Browser anders). Browser: ______ Beobachtung:
- [ ] **Funkloch:** Bedienrechner 1 min in den Flugmodus, dabei 2 Starts schalten; danach ein Handy 1 min in den
  Flugmodus und dort schalten. Erwartet: Bedienrechner arbeitet weiter, Geräte holen nach; das Handy sendet nach dem
  Funkloch, der Start wirkt einmal. Beobachtung:

## Verwaltung

- [ ] **Entziehen** (Geräteliste). Erwartet: das Handy kann nicht mehr schalten, zeigt aber weiter Im Boot/Als Nächstes.
  Beobachtung:
- [ ] **Neu laden aller Geräte nach Update:** am Bedienrechner ein Update einspielen (oder nur „Alle Geräte neu laden“).
  Erwartet: Hinweis „Dieser Bedienrechner läuft mit einer neuen Fassung …“; nach dem Knopf laden alle verbundenen Geräte
  einmal neu und zeigen wieder an, Handys bleiben gekoppelt. Beobachtung:
- [ ] **Raum beenden.** Erwartet: Geräte zeigen „Der Bedienrechner hat den Raum beendet“. Beobachtung:
- [ ] **Kontingent-Anzeige nach dem Test** (Betrieb → Geräte, vor dem Beenden notieren). Nachrichten: ______
  Anfragen: ______ Warnung oder „Zuletzt gebremst“? ______ Dauer des Tests und Zahl der Starts: ______
  Hochgerechnet auf einen Wettkampftag (120 Starter, 2 Läufe) – erwartet laut Überschlag etwa 600 Nachrichten ohne,
  850 mit Start-Freigabe vom Handy (docs/betrieb.md „Kontingent“): ______

## WKR-Maske auf dem Handy (W3)

Gebaut 21.11.2026 (Plan [plan-wkr-w3.md](plan-wkr-w3.md)), bisher nur mit nachgebautem Server und ohne echte
Bildschirmgrößen geprüft – Zielgrößen stehen nur im CSS. Bedienung:
[betrieb.md](betrieb.md#wkr-erfassung-w1-kern-w2-bedienrechner-w3-handy-maske-knöpfe-w4-bojen). Je Handy eine Liste koppeln
(Tor 5, Steg nur Ablegen, Vorsteg), Probe durchtippen, dann einen Lauf mit Beispieldaten erfassen.

- [ ] **Handschuhe** (dünne Arbeits- und dicke Segelhandschuhe): Codes, Hauptknopf, Disq., „− letzte zurück“,
  Ausweichen, Ziffernfeld der Suche treffen. Erwartet: jeder Tipp trifft den gemeinten Knopf, kein Nachbar.
  Fehlgriffe auf 20 Tipps: dünn ______ dick ______ Beobachtung:
- [ ] **Sonne** (Mittagssonne, Display-Helligkeit automatisch und voll; Sonnenbrille, auch polarisiert): Sonnenmodus
  (Vorgabe) gegen Hell und Dunkel. Erwartet: Startnummer, Hauptknopf und Stufenzeichen (✓ ↑ ! ✗ V) aus Armlänge lesbar,
  „ÜBUNG“/rotes Band „Keine Verbindung“ sofort erkennbar. Beobachtung:
- [ ] **Doppeltipp** (absichtlich zweimal schnell auf „Fehlerfrei ✓“, auch auf einen Code direkt nach dem Wechsel;
  Tropfen auf dem Display). Erwartet: genau eine Zeile; 2 s „● gesendet“ mit derselben Nummer, dann Blitz, 1 s ohne
  Eingabe; am Bedienrechner kein doppelter Wert. Beobachtung:
- [ ] **iPhone ohne Vibration** (Safari kennt `navigator.vibrate` nicht): Erwartet: der Blitz allein zeigt den Wechsel
  deutlich genug, auch in der Sonne. Ist er zu kurz (150 ms) oder zu blass? Beobachtung:
- [ ] **Hochkant, eine Hand**: Daumen erreicht Hauptknopf und Disq. ohne Umgreifen; Linkshand (Mehr → Ansicht)
  spiegelt den Fuß. Bildschirmbreite des Geräts: ______ Beobachtung:
- [ ] **Probe** beim ersten Empfang der Liste; danach (neu laden) nicht noch einmal. Erwartet: am Bedienrechner kommt
  nichts an. Beobachtung:
- [ ] **Funkloch** (Flugmodus 2 min, weiter erfassen): Erwartet: rotes Band „Keine Verbindung seit …“, Zeilen warten,
  nach dem Einschalten gehen sie als eine Nachricht; ab 5 min „Papierbogen ab Nr. …“. Beobachtung:
- [ ] **Liste abschließen** am Laufende mit Namen; einmal mit offenem Start („Rest auf Papier“). Erwartet: am
  Bedienrechner unter Betrieb → WKR der Abschluss mit Namen; spätere Korrektur kommt als Vorschlag. Beobachtung:
- [ ] **Übung** („Üben ohne Verbindung“ im Koppel-Formular) im Flugmodus. Erwartet: Maske arbeitet ohne Netz, Kopf
  „ÜBUNG“; nach dem Abschicken kommt der nächste Start nach 2–6 s, hin und wieder steht er schon vorher da
  (Y1–Y3). Passt das Tempo? Taugt sie für die Einweisung? Beobachtung:
- [ ] **Akku** nach einem Lauf mit Maske offen (Wake Lock): Anfang ______ % Ende ______ % Dauer ______ min.

## Bojen-Maske (W4)

Gebaut 21.11.2026 (Plan [plan-wkr-w4.md](plan-wkr-w4.md)), nur mit nachgebautem Server geprüft. Je Handy eine
Bojen-Liste koppeln (Tor 1/3/5, Tor 2/4/5, Parcours; unter UIM Parallelslalom Racecourse A), Probe durchtippen, einen
Lauf mit Klassen 4 bis 7 erfassen.

- [ ] **Bojen-Punkte** (Plan §9): Jede Berührung 5, Tor 5 je Berührung; am Bedienrechner steht in der Erfassung genau
  der Wert, den der WKR auf Papier schriebe („5“, Tor 5 „15“). Erwartet: Summe in „Abschicken · n Pkt.“ = Summe der
  Zeile in der Wertung. Beobachtung:
- [ ] **Zwei Boote im Parcours** (Tor 1/3/5: das ältere Boot auf dem Rückweg, das nächste auf dem Hinweg): über
  „Ausweichen“ zwischen den Starts wechseln, Seite je Start bleibt gemerkt. Erwartet: keine Berührung beim falschen
  Start; reicht das am Wasser oder braucht es zwei Starts nebeneinander? Beobachtung:
- [ ] **Seiten nach Blick** bei `rechts`/`links` (Baden-Württemberg, Berlin, Möwe 2/4/5 – die zwei Bojen liegen nah
  und fern, nicht links und rechts): Erwartet: die Knöpfe stehen wie die Unterspalten auf dem Bogen. Wäre „oben/unten“
  besser? Beobachtung:
- [ ] **Klasse 7 auf kleinem Handy** (≤ 700 px hoch, Handschuhe): Umschalter Hinweg/Rückweg, zehn Zeilen; kein Text
  abgeschnitten, kein Nachbarknopf getroffen. Grenze sieben Zeilen passend? Beobachtung:
- [ ] **Tor-5-Zähler bei 360 px** (Prüfbefund 21.11.2026, S4): Zähler bis 9 tippen, auch englisch. Erwartet: „9× = 45“
  und „höchstens 9×“ in zwei Zeilen im Knopf, nichts über den Rand, kein waagerechtes Scrollen. Beobachtung:
- [ ] **Prellschutz** (S1): Bojen-Schalter mit Handschuh antippen. Erwartet: ein Tipp setzt, ein prellender zweiter
  nimmt nichts weg; bewusst nach ½ s erneut tippen nimmt weg. 400 ms passend? Beobachtung:
- [ ] **Klassenwechsel** (Klasse 4 nach 7): Band „Klasse n – andere Halte“ 2 s. Erwartet: kein Tipp auf die falsche
  Zeile. Beobachtung:
- [ ] **Nicht vorbeigekommen** (Mehr → Rückfrage): Erwartet: Matrix „⊘ nicht vorbei“ gelb, kein Rückstand, Erfassung
  „Papier ansehen“; am Vorsteg und im Steg-Ablegen nicht angeboten. Versehentlich gemeldet → „Zuletzt“ → Korrektur
  hebt es auf. Wird es am Wasser gebraucht, oder reicht X? Beobachtung:

## Nur iPhone

- [ ] **CompressionStream** (ab Safari 16.4). Erwartet: Lese-Link zeigt an; auf älteren Geräten „Dieser Browser ist zu
  alt dafür“. iOS-Fassung: ______
- [ ] **Vibration fehlt** bei der WKR-Maske (siehe oben „iPhone ohne Vibration“): nur der Blitz – reicht er?
  Beobachtung:
- [ ] **ITP** (Safari löscht Daten einer Seite nach 7 Tagen ohne Besuch): nach dem Test Safari schließen, nach
  einigen Tagen `#/geraet` öffnen. Erwartet: Kopplung noch da oder sauber „nicht gekoppelt“ (dann neu koppeln).
  Beobachtung:

## Was danach zu melden ist

- Die ausgefüllte Liste, je Gerät Modell, Betriebssystem und Browser mit Fassung.
- Jeder Punkt, der nicht wie erwartet lief: was zu sehen war (Text, Bildschirmfoto ohne echte Namen), Uhrzeit.
- Verzögerungen: Start bis Tafel, Handy-Druck bis Bestätigung, Zeit bis gekoppelt.
- Ob Wake Lock und das Wiederverbinden nach dem Hintergrund auf Android, iPhone und Home-App wirken.
- Kontingent: Nachrichten und Anfragen gegen Dauer und Zahl der Starts; ob der Server gebremst hat. Damit lässt sich
  der Überschlag (600–850 Nachrichten je Wettkampftag) prüfen und entscheiden, ob `ntfy.adminforge.de` reicht.
- Was am Bedienrechner unklar war (Texte, Knöpfe).
- WKR-Maske: Fehlgriffe mit Handschuhen, Lesbarkeit in der Sonne, ob der Doppeltipp-Schutz zu lang oder zu kurz ist
  (seit 21.11.2026 Overlay „wird übertragen …“ → „✓ übernommen“: mindestens 0,6 s, dann 0,8 s, ohne Quittung
  höchstens 3 s, danach 1 s Sperre – WKR_ANNAHMEN N1, uebertragenMinMs/uebernommenMs/uebertragenMaxMs/sperreMs), Blitz
  ohne Vibration auf dem iPhone, Akku; Texte bei großer Systemschrift (nichts abgeschnitten, N3), Farben unter
  System-Dunkelmodus in allen drei Ansichten (N4).
