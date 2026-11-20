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
  sonst steht „Bildschirm kann ausgehen …“ in der Leiste. Android: ______ iPhone: ______ Home-App: ______
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

## Nur iPhone

- [ ] **CompressionStream** (ab Safari 16.4). Erwartet: Lese-Link zeigt an; auf älteren Geräten „Dieser Browser ist zu
  alt dafür“. iOS-Fassung: ______
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
