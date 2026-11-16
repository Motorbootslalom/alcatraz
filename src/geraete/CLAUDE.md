# src/geraete – Gerätebetrieb über ntfy (ab Etappe E5)

Plan zur Übernahme der Tafel vom 16.11.2026, §1/§2/§5. E5 = Übertragungskern OHNE Oberfläche; noch importiert nichts
außerhalb dieses Ordners (und seiner Tests) etwas von hier, tweetnacl steckt also noch nicht in dist/. E6 baut
host.ts/geraet.ts, Lese-Links und die Einstellung `geraeteServer`, E7 Koppeln und Start-Freigabe vom Handy.
Der Host (Bedienrechner) ist die einzige Wahrheit: Geräte bekommen nie den AppState, sondern eine Sicht
(betrieb/sicht.ts), und schicken nur Nachrichten; anwenden tut allein der Host. Nichts von hier im Reducer.

## Dateien

- `themen.ts` – Themen eines Raums: oA/oZ zufällig (`zufallsThema`, nur im jeweiligen Lese-Link), g/d·/k· abgeleitet
  (`geraeteThema`, `direktThema`, `gruppenThema` = base64url(nacl.hash(geheimnis‖0‖kennzeichen…)), 22 Zeichen),
  `koppelThema(oA, code)` (E7), `istThema`, `normalisiereServer`. **`NTFY_VORGABE`** = die EINE Stelle des
  Vorgabe-Servers (Entscheidung 11./16.11.2026: ntfy.adminforge.de, änderbar); sonst kommt der Server immer von außen.
- `transport/typen.ts` – Verbindungsstand, Fehlercode (Codes, nie Text; Oberfläche ab E6 `geraete.fehler.<code>`),
  Schnittstelle Transport. `transport/protokoll.ts` – Nachrichten und Prüfer: PROTOKOLL_FASSUNG (`v`), OEFFENTLICH
  ('ko'), DIREKT ('-'), GeraeteNachricht (hallo | action ohne `zeit`), DirektNachricht (willkommen, abgelehnt, quittung,
  schluessel, aufgaben, entzogen), ABLEHNUNGEN, ERGEBNISSE, Gruppeninhalt (voll | patch | meldung).
- `transport/ntfy/codec.ts` (Base64url, deflate mit Grenzen 4 MB Host / 64 kB Gerät, canonicalJson, fingerprint,
  textHash), `patch.ts` (diff/applyPatch/equal auf JSON), `wire.ts` (versiegeln/öffnen/signieren, Kontext
  `alcatraz-ntfy-1`; Signatur über [KONTEXT, thema, v, r, g, e, n, a, sv, hz, x, c, l]; dazu Fassungsbeleg `fs` über
  ['alcatraz-fassung', thema, r, v, sv, hz] – Format NIE ändern, `belegteFassung`), `raum.ts` (HostRaum mit
  `ausstehend` (Verwaltungsnachrichten bis ntfy sie annimmt), neuerRaum, Gruppen, Lese-Paket `{u,r,t,k,e,s}`,
  fingerabdruck, GeraetStand, HostSpeicher (`voll()`)/GeraetSpeicher (`schreibe` → false = voll) mit Fassungen im
  Arbeitsspeicher), `leitung.ts` (NtfyLeitung: WebSocket mit `since`, mehrere Themen je Abo, `poll`, Anhang laden nur
  angekündigt, POST mit Wiederholung, `sitzung` gegen alte Schleifen nach stop/start; NTFY_ZEITEN, INLINE_GRENZE 4096,
  MAX_ANHANG 256 kB), `transport.ts` (HostTransport, GeraetTransport, lesegeraet). `testNtfy.ts` = nachgebauter ntfy.
- `fuehrung.ts` – waehleFuehrung(id?, umgebung?) → `{fuehrt, art: 'sperre'|'lease', stop}`: Web Lock
  `alcatraz-fuehrung`; fehlt es oder wird abgewiesen, Lease `alcatraz.geraete.fuehrung` (Herzschlag 2 s, verwaist
  6 s, Bedenkzeit 500 ms: schreiben, warten, nachlesen). `pagehide` gibt Schloss bzw. Lease frei, `pageshow` mit
  `persisted` fragt neu an (Back/Forward-Cache hielte das Schloss sonst bis 10 min). Nur Fenster mit vollem Store
  (App) – nie AnzeigeApp/ZuschauerApp/leseStore (Test). Nur das führende Fenster legt den HostTransport an und
  stoppt ihn bei `fuehrt=false`; wird es wieder `true`, start() (dieselbe Instanz geht, beginnt mit Vollstand).
- `fensterbus.ts` – oeffneFensterbus(id?, umgebung?): BroadcastChannel `alcatraz-fenster` UND storage-Schlüssel
  `alcatraz.geraete.fensterbus` (Doppelte per Kennung verworfen). `bedient()` bei jeder eigenen Bedienung →
  `schreibfenster` (spätere Bedienung gewinnt); `reicheWeiter(action, selbst)` im Führungsfenster → Schreibfenster
  wendet per `beimAnwenden` an (Ergebnis angewandt|unveraendert), nach 1 s ohne Antwort `selbst`;
  `meldeVerbindung` → `verbindung` in allen Fenstern; neues Fenster fragt, `pagehide`/`schliesse` meldet „weg“.
- `ablage.ts` – ALLE localStorage-Schlüssel (`ABLAGE`): Host `alcatraz.geraete.*` (raum, fuehrung, fensterbus), Gerät
  `alcatraz.geraet.*` (verbindung, sicht). hostAblage(kennung) = HostSpeicher, an AppState.kennung gebunden
  (andere Veranstaltung = kein Raum; Speicher voll → weiter im Arbeitsspeicher, `voll()`); legeRaumAn/beendeRaum/
  raumKennung; ichOderNeu(bezug)/liesIch(bezug) (nur `sk` abgelegt, IM Verbindungs-Eintrag: Kennung und Nummernfolge
  nur zusammen, Abweichung von Plan §3 `alcatraz.geraet.ich`); geraetAblage(bezug {u,r,s}) = GeraetSpeicher nur für
  diesen Raum; sichtAblage (Ablauf 36 h, SICHT_GUELTIG_MS); pruefeRaum (anderer Raum → Verbindung samt Kennung und
  Sicht weg), verlasseRaum (dasselbe; neu koppeln = neuer Schlüssel).

## Abläufe

- Host (E6/E7): App-Fenster → waehleFuehrung → bei `fuehrt`: `new HostTransport({server: geraeteServer ||
  NTFY_VORGABE, speicher: hostAblage(state.kennung), sichtFassung})` → start(); `verteile(OEFFENTLICH, sicht)` bei
  jeder Änderung (vergleicht nach Inhalt, fasst zusammen, Vollstand stündlich von selbst); Status über
  `fensterbus.meldeVerbindung`. Geräte-Action: `beiEingang` → darf/nr (E7) → `fensterbus.reicheWeiter(action,
  dispatch-im-Führungsfenster)` → `quittiere(e, ergebnis)` – erst dann zählt `letzteNr` und geht die Quittung.
- Gerät (E6): Link → liesLesePaket → pruefeRaum(bezug) → `lesegeraet(paket, geraetAblage(bezug), sv)` → start():
  Abfrage `poll&since=70m`, neuester Vollstand, Differenzen danach, dann Abo mit `since=<id>`. Nach dem Neuladen
  (seen abgelegt, Grundlage nicht) baut der neueste Vollstand die Grundlage neu und liefert gleich wieder die zuletzt
  gesehene Sicht; gekoppelt holt es d zusätzlich ab dem abgelegten `seit`. `beiEmpfang` liefert sicht/meldung/direkt/
  verworfen; `fremdeFassung` → „Update nötig“ (F7, nur mit gültigem Beleg `fs`); `hz` = Uhrversatz. E7: Gerät mit
  `ich: ichOderNeu(bezug)` und `koppeln`; „Raum verlassen“ = stop + verlasseRaum.
- Was ntfy sieht: Themen, `r/g/e/n/a/sv/hz`, Größen, den öffentlichen Schlüssel eines Geräts; nie Inhalte, Geräte-IDs
  oder g in einem Link. Nie auf der Leitung: AppState, Geburtsdatum, Gewicht, Geschlecht, Geräteliste, Geheimnis.

## Fallen

- Öffentliche Gruppe `ko` wird nie neu verschlüsselt (K14) – zwei Sperren: raum.ts mitNeuemSchluessel UND transport.ts.
- Host lädt nie einen Anhang (K13); Geräte nur nach signierter Ankündigung, eigener Server, ≤ angekündigte Größe (S5).
- `letzteNr` erst in `quittiere` schreiben (nach dem Anwenden), nie beim Empfang: Sonst ginge eine Action verloren,
  wenn das Fenster dazwischen schließt. Eine Geräte-ID wird nie an einen anderen Schlüssel gebunden (S1, `id-belegt`).
- Nummern eines Geräts: Ein neuer Stand beginnt bei der Uhrzeit (ms), nie bei 1 – und ablage.ts hält Kennung und
  Stand in EINEM Eintrag. Beides, damit ein Schlüssel nie mit Nummern unter `letzteNr` sendet (still verworfen).
- Unbekannte Schlüssel auf g öffnet der Host nie (dort schreiben nur Gekoppelte); Koppel-Themen je eigener Eimer.
  Zweite Antworten an Gekoppelte (doppelt, erneute Begrüßung) gedrosselt: Abstand wächst, Summe ≤ 12/min.
- Eine Anmeldung eines GEBUNDENEN Schlüssels über ein Koppel-Thema mit nr = letzteNr heißt: willkommen ging verloren →
  wird als `gebunden: true` erneut geliefert, E7 begrüßt wieder (`begruesse` antwortet auf das Thema, über das sie kam).
- Schlüsselwechsel/Entzug: im selben Schreiben im Raum vermerkt (`ausstehend`), Inhalt erst beim Senden; der Vermerk
  fällt erst, wenn ntfy angenommen hat (bei `schluessel` nur, wenn kein neuerer Wechsel kam). start() schickt Offenes.
- Grundlagen der Differenzen nur im Speicher: Jeder start() – auch derselben Instanz nach stop() – beginnt mit
  Vollständen (stop() leert sie). Nach stop() geht auch nichts Versiegeltes mehr hinaus.
- „neu laden“ (Meldung) geht vor eine wartende Sicht; die entfällt, der letzte Stand folgt als Vollstand mit höherer n.
- Gerät ohne Grundlage nimmt nur Frisches (hz ≤ 2 h, Geräteuhr) – in Abfrage UND Abo (K17).
- Neuer Speicherort → in ABLAGE eintragen, nie in den AppState (Sicherung, Vorlage, Verlauf). Präfixe nicht `tafel:`.
- Lease ist best effort (localStorage ohne atomares Setzen; gedrosselte Hintergrund-Tabs): Web Locks sind der Schutz;
  dazu liest HostSpeicher.aendere vor jedem Schreiben frisch und `n` steht im Raum.
- Fensterbus vertraut allen Fenstern derselben Herkunft (die könnten ohnehin den Stand schreiben), prüft nur die Form.
- Echter ntfy ungeprüft (nur der Nachbau): in E6/E8 `since=<id>` über mehrere Themen und mit abgelaufener ID, und dass
  `attachment.url` mit der eingegebenen Server-Adresse beginnt (sonst verwirft der Host jeden Vollstand mit `zu-gross`).

## Tests

`npx vitest run src/geraete` (≈ 9 Dateien, nachgebauter ntfy, kein Netz). Benannte Lücken des Prototyps (S1–S7,
K13–K18) und „Befunde der E5-Prüfung“ in transport.test.ts; S7 Führung (Web Locks nachgebaut, Lease mit verzögert
abgleichendem Speicher) und Back/Forward-Cache in fuehrung.test.ts; Schreibfenster/Rückfall storage in
fensterbus.test.ts; Neuladen von Host und Gerät über die echte Ablage (S2/S3/S18), Speicher voll, „Raum verlassen und
neu koppeln“ und „nie in Sicherung/Vorlage“ in ablage.test.ts. Lizenzvermerk: components/FremdeBestandteile.test.ts.
