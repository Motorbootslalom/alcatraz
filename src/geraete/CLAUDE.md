# src/geraete – Gerätebetrieb über ntfy (ab Etappe E5)

Plan zur Übernahme der Tafel vom 16.11.2026, §1/§2/§5. E5 = Übertragungskern; E6 = Anzeigetafel und Zuschauer über
Lese-Links (host.ts im Bedienfenster, geraet.ts auf dem Gerät, paket.ts, Einstellung `geraeteServer`) – main.ts legt
den Host an, tweetnacl steckt damit in dist/. Oberfläche E6: Betrieb → Geräte (components/betrieb/GeraeteRaum.vue,
LeseLink.vue, GeraeteLage.vue), src/GeraetApp.vue (`#/sehen/<paket>`, ohne Store), SettingsView `#geraete`. E7 Koppeln
und Start-Freigabe vom Handy (Kern + Oberfläche 20.11.2026: GeraeteKoppeln.vue, GeraeteListe.vue, GeraetFreigabe.vue).
**Ohne bewusst geöffneten Raum keine Verbindung** (bis dahin verlässt nichts den Browser): host.ts öffnet ohne Raum
weder Fensterbus noch Schloss noch WebSocket (host.test.ts, src/main.geraete.test.ts).
Der Host (Bedienrechner) ist die einzige Wahrheit: Geräte bekommen nie den AppState, sondern eine Sicht
(betrieb/sicht.ts), und schicken nur Nachrichten; anwenden tut allein der Host. Nichts von hier im Reducer.

## Dateien

- `themen.ts` – Themen eines Raums: oA/oZ zufällig (`zufallsThema`, nur im jeweiligen Lese-Link), g/d·/k· abgeleitet
  (`geraeteThema`, `direktThema`, `gruppenThema` = base64url(nacl.hash(geheimnis‖0‖kennzeichen…)), 22 Zeichen),
  `koppelThema(oA, code)` (E7), `istThema`, `normalisiereServer` (seit E6 aus lib/serverAdresse.ts, damit Reducer und
  migrate ohne geraete/ prüfen). **`NTFY_VORGABE`** = die EINE Stelle des Vorgabe-Servers (Entscheidung
  11./16.11.2026: ntfy.adminforge.de, änderbar über AppState.geraeteServer, '' = Vorgabe); sonst kommt der Server immer
  von außen.
- `transport/typen.ts` – Verbindungsstand, Fehlercode (Codes, nie Text; Oberfläche ab E6 `geraete.fehler.<code>`),
  Schnittstelle Transport; E6 `verbindungsLage(status, fehler)` → aus|verbinde|verbunden|gestoert|kontingent|fehler.
  `transport/protokoll.ts` – Nachrichten und Prüfer: PROTOKOLL_FASSUNG (`v`), OEFFENTLICH ('ko', Anzeigetafel, oA),
  ZUSCHAUER ('kz', Zuschauer, oZ; E6), istOeffentlich, DIREKT ('-'), GeraeteNachricht (hallo | action ohne `zeit`),
  DirektNachricht (willkommen, abgelehnt, quittung, schluessel, aufgaben, entzogen), ABLEHNUNGEN, ERGEBNISSE,
  Gruppeninhalt (voll | patch | meldung).
- `transport/ntfy/codec.ts` (Base64url, deflate mit Grenzen 4 MB Host / 64 kB Gerät, canonicalJson, fingerprint,
  textHash), `patch.ts` (diff/applyPatch/equal auf JSON), `wire.ts` (versiegeln/öffnen/signieren, Kontext
  `alcatraz-ntfy-1`; Signatur über [KONTEXT, thema, v, r, g, e, n, a, sv, hz, x, c, l]; dazu Fassungsbeleg `fs` über
  ['alcatraz-fassung', thema, r, v, sv, hz] – Format NIE ändern, `belegteFassung`), `raum.ts` (HostRaum mit
  `ausstehend` (Verwaltungsnachrichten bis ntfy sie annimmt), neuerRaum (Gruppen `ko` UND `kz`), themenDerGruppe
  (ko → [oA], kz → [oZ]), linkDerGruppe/gruppeDesLinks, Lese-Paket `{u,r,t,g,k,e,s}` (g = ko|kz),
  fingerabdruck, GeraetStand, HostSpeicher (`voll()`)/GeraetSpeicher (`schreibe` → false = voll) mit Fassungen im
  Arbeitsspeicher), `leitung.ts` (NtfyLeitung: WebSocket mit `since`, mehrere Themen je Abo, `poll`, Anhang laden nur
  angekündigt, POST mit Wiederholung, `sitzung` gegen alte Schleifen nach stop/start; NTFY_ZEITEN, INLINE_GRENZE 4096,
  MAX_ANHANG 256 kB), `transport.ts` (HostTransport – E6: erneuereThema lenkt Wartendes aufs neue Thema,
  `bisGesendet(ms)`; GeraetTransport – E6: Empfang mit `nachgeholt`, nach stop() nichts mehr ablegen;
  lesegeraet(paket, speicher, sv, zeiten?, uhr?)). `testNtfy.ts` = nachgebauter ntfy.
- `paket.ts` (E6) – Lese-Link in der Adresse `#/sehen/<paket>` (SEHEN = lib/adressen.ts VOLLBILDER `sehen`, in jeder
  Sprache gleich; sehenAdresse; leseLinkUrl(paket, seite, PAGES_URL) = Seite des Bedienrechners, unter file:// Pages): packeLesePaket/liesLeseLink
  (Bytes + Base64url, ~155 Zeichen: Fassung, Merker a/z und https, Epoche, r, t, k, s, Server IMMER (auch die Vorgabe),
  4 Byte Prüfsumme) → `{ok, paket, welches}` | `link-ungueltig` | `fassung` (PAKET_FASSUNG).
- `host.ts` (E6) – starteGeraeteHost(store, umgebung?) → GeraeteHost {raum: RaumInfo|null (server, anzeige, zuschauer
  = Pakete, fingerabdruck), fuehrt, verbindung (VerbindungsMeldung über den Fensterbus), oeffne(), erneuereZuschauer(),
  beende() → 'gemeldet'|'ohne-meldung', stop()}; geraeteHostKey/useGeraeteHost (main.ts stellt bereit), hostServer.
- `geraet.ts` (E6) – oeffneLeseLink(text, umgebung?) → {ok, geraet: LeseGeraet} | link-ungueltig | fassung (lage);
  LeseGeraet {art anzeige|zuschauer, paket, fingerabdruck, anzeige/zuschauer (shallowRef, nach Inhalt), versatz,
  hostZeit(jetzt), status, fehler, fassung host-neuer|host-aelter, beendet, start, stop, verlasse}; NEULADEN_SPERRE_MS.
- E7 Kern (20.11.2026, Oberfläche folgt): `aufgaben.ts` (Aufgabe `startfreigabe` {bereiche}; STARTFREIGABE_ACTIONS =
  Positivliste BETRIEB_* ohne ZURUECKSETZEN; bereinige → nur Reducer-Felder; erlaubteAction/darf(action, aufgaben,
  stand); Meldung '*' nie), `geraeteName.ts` (geraeteArt → i18n `geraete.name.<art>`, eindeutigerName), `koppeln.ts`
  (Code 6 Zeichen/5 min/ein Gerät, Thema koppelThema(oA, code); QR-Sitzung mit zufälligem Thema, Token 30 s + 30 s
  Gnade, Sitzung ≤ 10 min; Nachlauf 2 min; pruefeKoppeln nur auf dem eigenen Thema), `koppelEntscheid.ts`
  (entscheideAnmeldung: bekannt = ID UND Schlüssel; S1 belegte ID → neue ID), `register.ts` (rein über HostRaum:
  geraete[id].name/aufgaben/seit/zuletzt, raum.entzogen, raum.koppeln), `gekoppelt.ts` (Gerät der Start-Freigabe:
  oeffneKoppelLink/oeffneGekoppelt → lage, aufgaben, offen (ohne Anmeldung), meldetSich (P-7), quittung,
  koppeln(name, code?), sende, darf; Kern =
  geraet.ts lesegeraetAus mit eigenem Transport). paket.ts: Koppel-Link `#/koppeln/<paket>` (Merker Bit 1, mit QR
  Bit 3: Token + Thema; Box-Schlüssel `b`), koppelPaketAus. ablage.ts: `alcatraz.geraet.kopplung` (liesKopplung/
  schreibeKopplung; pruefeRaum/verlasseRaum räumen sie mit). transport.ts: begruesse schreibt name/aufgaben/seit/
  zuletzt mit; HostTransport.verwalte/raumJetzt; GeraetTransport.koppleUeber(thema). fensterbus.ts: GeraeteBefehl
  (code, qr, koppeln-ende, aufgaben, umbenennen, entziehen; liesBefehl). host.ts: HostStore.dispatch, RaumInfo +
  koppelLink/koppeln/geraete/entzogen, gibCode/oeffneQr/beendeKoppeln/setzeAufgaben/benenne/entziehe, nimmAn,
  pflegeKoppeln (Takt `koppelTaktMs`), Bedienung = pointerdown/keydown → bus.bedient(). Annahmen:
  BETRIEB_ANNAHMEN.startfreigabeRechte/koppelnZeiten/gekoppelteGeraete. Tests: kopplung.test.ts (Ende zu Ende).
- E8 (20.11.2026): `kontingent.ts` (KONTINGENT = Grenzen je Server: adminforge 17 280, ntfy.sh 250 Nachrichten/Tag je IP, sonst
  unbekannt → nur 429; tagesGrenze(server); Warnung ab 80 %; Überschlag eines
  Wettkampftags ≈ 600–850 im Kopfkommentar; kontingentZaehler(ablage, uhr) je lokalem Tag, `alcatraz.geraete.kontingent`;
  NtfyLeitung zählt über den 3. Konstruktor-Parameter `zaehle` – Anfragen (POST, Abfrage, Anhang, Abo), angenommene
  Nachrichten, 429). host.ts: `kontingent`, `ladeAlleNeu()` → gesendet|nicht-verbunden (nur bei stehender Verbindung; Befehl `alle-neu-laden` →
  melde(ko|kz, neu-laden); in der Schlange verfällt die Meldung nach transport.ts NEULADEN_SENDEN_MS 1 min),
  `neueFassung`/`fassungGesehen()` (Fassung = Commit + Build-Zeit, `alcatraz.geraete.fassung`; HostUmgebung.fassung).
  geraet.ts: Meldung `neu-laden` → `aktualisiere` je Befehl `r:g:n` einmal (`alcatraz.geraet.neugeladen`, ohne
  Speicher nie), nur frisch (NEULADEN_BEFEHL_GUELTIG_MS 10 min). PROTOKOLL_FASSUNG bleibt 1 (`neu-laden` gab es seit E5).
  Annahmen BETRIEB_ANNAHMEN.wachBleiben/alleNeuLaden/kontingent. Tests: neuLaden.test.ts, kontingent.test.ts;
  haertung.test.ts (Start-Freigabe im Parallelslalom: Rechte je Bereich – A und B sind EIN Bereich –, Paar als Einheit;
  Zeitgrenzen: Wiederholabstand bis 5 min auch mit Fake-Uhr, Führungswechsel mit offener Action, Code/QR abgelaufen,
  Gerät länger weg als das Einstiegsfenster), src/GeraetParallel.test.ts (Oberfläche: Paar A/B, „Keine Bestätigung“).
  Doku: docs/betrieb.md (Ablauf am Wettkampftag, Wake Lock, Alle Geräte neu laden, Kontingent), Checkliste
  docs/feldtest.md – offene Punkte des Feldtests dort und in docs/entscheidungen.md „Offen“.
- `testBrowser.ts` – nur Tests: nachgebauter Browser (Fenster mit gemeinsamem Speicher + storage-Ereignis,
  BroadcastChannel, Web Locks).
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
  E6: `befiehl(befehl)`/`beimBefehl` (BEFEHLE: zuschauer-erneuern, raum-beenden, E8 alle-neu-laden) – ausführen nur das Führungsfenster.
- `ablage.ts` – ALLE localStorage-Schlüssel (`ABLAGE`): Host `alcatraz.geraete.*` (raum, fuehrung, fensterbus), Gerät
  `alcatraz.geraet.*` (verbindung, sicht). hostAblage(kennung) = HostSpeicher, an AppState.kennung gebunden
  (andere Veranstaltung = kein Raum; Speicher voll → weiter im Arbeitsspeicher, `voll()`); legeRaumAn/beendeRaum/
  raumKennung; ichOderNeu(bezug)/liesIch(bezug) (nur `sk` abgelegt, IM Verbindungs-Eintrag: Kennung und Nummernfolge
  nur zusammen, Abweichung von Plan §3 `alcatraz.geraet.ich`); geraetAblage(bezug {u,r,s}) = GeraetSpeicher nur für
  diesen Raum; sichtAblage (Ablauf 36 h, SICHT_GUELTIG_MS; E6 legt `{art, sicht}` ab); pruefeRaum (anderer Raum →
  Verbindung samt Kennung und Sicht weg), verlasseRaum (dasselbe; neu koppeln = neuer Schlüssel); E6
  `alcatraz.geraet.aktualisiert` (Sperre gegen Neulade-Schleifen, ohne Personenbezug); E8 `alcatraz.geraet.neugeladen`,
  `alcatraz.geraete.kontingent`, `alcatraz.geraete.fassung`.

## Abläufe

- Oberfläche (E6): Betrieb → Geräte = GeraeteRaum.vue mit useGeraeteHost(): ohne Raum Text „was über welchen Server
  geht“ + „Gerätebetrieb einschalten“ (oeffne(); Fehler → `geraete.fehler.<code>`); mit Raum Verbindung (verbindungsLage
  aus `verbindung`, ohne Meldung = verbinde; auch im Kopf der anderen Unterreiter und in jedem Fenster über den
  Fensterbus), Fingerabdruck (components/betrieb/texte.ts fingerabdruckText, auch auf dem Gerät), zwei LeseLink-Karten
  (QR = QrCode.vue mit der ganzen URL, Kopieren, Öffnen), „Zuschauer-Link erneuern“ und „Raum beenden“ mit AppDialog.
  Gerät: main.ts `#/sehen/…` → GeraetApp.vue (+ starteOffline ohne darfVonSelbst) → oeffneLeseLink(paket, {aktualisiere:
  lib/offline.ts holeNeueFassung, sonst location.reload}) → AnzeigeTafel bzw. ZuschauerListe (jetzt = hostZeit) →
  Leiste (Verbindung, Fingerabdruck, Vollbild per lib/tafelFenster.ts, „Raum verlassen“ → verlasse() + `#/sehen`).

- Host (E6, host.ts): main.ts starteGeraeteHost(store) → pruefe(): Raum für `state.kennung` (hostAblage)? Nein → nichts.
  Ja (oeffne() → legeRaumAn, oder schon da, oder storage-Ereignis eines anderen Fensters) → Fensterbus + waehleFuehrung
  → bei `fuehrt`: `new HostTransport({server: hostServer(state) = geraeteServer || NTFY_VORGABE, speicher:
  hostAblage(kennung), sichtFassung: SICHT_FASSUNG})` → start() → bei jeder Änderung des Stands (gesammelt
  `sammelnMs`, nach JSON verglichen) `verteile(OEFFENTLICH, sichtOeffentlich(state, {logos: false}))` und
  `verteile(ZUSCHAUER, sichtZuschauer(…))` (Vollstand stündlich von selbst); Status über `fensterbus.meldeVerbindung`.
  Andere Kennung → trennen; anderer Server → neu starten (passt er nicht zum Raum: `raum-anderer-server`).
  Befehle aus Nicht-Führungsfenstern über den Fensterbus; beende(): `melde(ko|kz, ende)` → bisGesendet(8 s) →
  Transport stopp → beendeRaum → Schloss frei (in dieser Reihenfolge).
- Host (E7): Geräte-Action: `beiEingang` → darf/nr → `fensterbus.reicheWeiter(action, dispatch-im-Führungsfenster)` →
  `quittiere(e, ergebnis)` – erst dann zählt `letzteNr` und geht die Quittung.
- Gerät (E6, geraet.ts): `#/sehen/<paket>` → oeffneLeseLink → liesLeseLink → pruefeRaum(bezug) → abgelegte Sicht
  (gleiche Art und sv) sofort zeigen → `lesegeraet(paket, geraetAblage(bezug), SICHT_FASSUNG)` → start():
  Abfrage `poll&since=70m`, neuester Vollstand, Differenzen danach, dann Abo mit `since=<id>`. Nach dem Neuladen
  (seen abgelegt, Grundlage nicht) baut der neueste Vollstand die Grundlage neu und liefert gleich wieder die zuletzt
  gesehene Sicht; gekoppelt holt es d zusätzlich ab dem abgelegten `seit`. `beiEmpfang` liefert sicht/meldung/direkt/
  verworfen; `fremdeFassung` → host-neuer (aktualisiere, einmal je Fassung in 10 min) | host-aelter („Bedienrechner
  aktualisieren“) (F7, nur mit gültigem Beleg `fs`); Uhrversatz = größtes `hz − Empfang` der letzten 20 frischen
  (nicht `nachgeholt`); jede Sicht → sichtAblage (36 h ab letzter Nachricht), Takt prüft Ablauf; Meldung `ende` →
  stop + verlasseRaum + `beendet`. E7: Gerät mit `ich: ichOderNeu(bezug)` und `koppeln`; „Raum verlassen“ = stop +
  verlasseRaum.
- Was ntfy sieht: Themen, `r/g/e/n/a/sv/hz`, Größen, den öffentlichen Schlüssel eines Geräts; nie Inhalte, Geräte-IDs
  oder g in einem Link. Nie auf der Leitung: AppState, Geburtsdatum, Gewicht, Geschlecht, Werte, Abmeldungen, Logos,
  Geräteliste, Geheimnis (Schlüssel-Durchlauf über alle entschlüsselten Inhalte: geraet.test.ts „Leitung“).

- Oberfläche (E7, 20.11.2026; Annahmen BETRIEB_ANNAHMEN.koppelnOberflaeche): Betrieb → Geräte unter den Lese-Links
  GeraeteKoppeln.vue (Bereiche für das nächste Gerät, merke `geraete.koppeln.bereiche`, einer vorgewählt; „QR-Code
  zeigen“ → oeffneQr, QR = koppelLinkUrl(raum.koppeln.qr.paket) mit Wechsel-/Ende-Zeit; „Geräte-Code ausgeben“ →
  gibCode, Code groß mit Ablauf/benutzt; Koppel-Link als LeseLink art `koppeln`) und GeraeteListe.vue (Name → benenne
  bei change, Häkchen → setzeAufgaben sofort, seit/zuletzt gehört über texte.ts uhrzeitText, „Entziehen“ mit
  AppDialog; entzogene darunter). Keine Rückfrage „annehmen?“ – der Entscheid ist koppelEntscheid.ts.
  Gerät: main.ts wählt GeraetApp für `sehen`, `koppeln` UND `geraet` (eine Wurzel – sonst lüde das Ersetzen der
  Adresse neu). GeraetApp zeigt für koppeln/geraet components/betrieb/GeraetFreigabe.vue: oeffneKoppelLink →
  `location.replace('#/geraet')` (QR-Token raus aus der Adresse; Kopplung liegt schon ungekoppelt in der Ablage) →
  start(); mit QR-Token sofort koppeln(Vorschlag `geraete.name.<art>`); ohne: Formular Code + Name → koppeln(name,
  code). `#/geraet` → oeffneGekoppelt. Gekoppelt: StartFreigabe je eigenem Bereich (`nur-dieser`: ohne „Meldung auf
  allen“), in `<fieldset disabled>` solange `offen` (K32), „Wird gesendet …“, nach 10 s „Keine Bestätigung“;
  Quittung abgelehnt/unveraendert der letzten eigenen Nummer als Satz (`geraete.ablehnung.<grund>`). `koppelt` ohne
  Antwort 15 s → „Keine Antwort“ + Formular (falscher Code: niemand hört das Thema); neue Anmeldung verwirft die alte
  (transport.ts GeraetTransport.verwirfAnmeldung). Entzogen: nur lesend Im Boot/Als Nächstes je Bereich + <details>
  „wieder koppeln“. „Gerät entkoppeln“ = verlasse (nur gerätelokal).

## Fallen

- Öffentliche Gruppen `ko`/`kz` werden nie neu verschlüsselt (K14) – zwei Sperren: raum.ts mitNeuemSchluessel UND
  transport.ts rotiere (istOeffentlich). Je Lese-Link eine Gruppe (BETRIEB_ANNAHMEN.lesenJeLink): `kz` trägt nur die
  Zuschauersicht; ein neues Feld dort ist eine bewusste Entscheidung (betrieb/sicht.ts sichtZuschauer).
- Den Raum schreibt nur das Führungsfenster: „Zuschauer-Link erneuern“/„Raum beenden“ aus einem anderen Fenster gehen
  als Befehl über den Fensterbus; andere Fenster LESEN den Raum (Links, Fingerabdruck) bei jedem storage-Ereignis.
- Nach stop() (Raum beendet/verlassen) schreibt der GeraetTransport nichts mehr ab – sonst stünde die eben gelöschte
  Verbindung wieder im Speicher. Ebenso verteilt host.ts nach „Ende“ nichts mehr (eine spätere Sicht gälte neuen
  Geräten wieder als Stand).
- Das Paket trägt den Server immer: Geräte laden das neueste Programm, ein Host als Datei ist oft älter – eine
  geänderte Vorgabe darf alte Links nicht umlenken.
- Host lädt nie einen Anhang (K13); Geräte nur nach signierter Ankündigung, eigener Server, ≤ angekündigte Größe (S5).
- `letzteNr` erst in `quittiere` schreiben (nach dem Anwenden), nie beim Empfang: Sonst ginge eine Action verloren,
  wenn das Fenster dazwischen schließt. Eine Geräte-ID wird nie an einen anderen Schlüssel gebunden (S1, `id-belegt`).
- Nummern eines Geräts: Ein neuer Stand beginnt bei der Uhrzeit (ms), nie bei 1 – und ablage.ts hält Kennung und
  Stand in EINEM Eintrag. Beides, damit ein Schlüssel nie mit Nummern unter `letzteNr` sendet (still verworfen).
- Unbekannte Schlüssel auf g öffnet der Host nie (dort schreiben nur Gekoppelte); Koppel-Themen je eigener Eimer.
  Ausnahme ohne Öffnen: Ein Schlüssel aus `raum.entzogen` (pk) bekommt gedrosselt noch einmal `entzogen` auf sein
  d-Thema (erinnereEntzogenes) – sonst erführe ein Gerät, das länger als 12 h aus war, den Entzug nie (Prüfung E7).
- Geräte wiederholen ohne Antwort mit wachsendem Abstand (wiederholAbstand: quittungMs, ×2, ≤ 5 min) – Kontingent.
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
- Echter ntfy ungeprüft (nur der Nachbau; Checkliste docs/feldtest.md): in E6/E8 `since=<id>` über mehrere Themen und mit abgelaufener ID, und dass
  `attachment.url` mit der eingegebenen Server-Adresse beginnt (sonst verwirft der Host jeden Vollstand mit `zu-gross`).

## Tests

`npx vitest run src/geraete src/main.geraete src/main.sehen src/GeraetApp src/GeraetKoppeln src/views/BetriebGeraete
src/views/BetriebKoppeln` (nachgebauter ntfy, kein Netz). Oberfläche E7: src/GeraetKoppeln.test.ts (Code, falsches
Format, benutzter Code, QR ohne Eingabe, #/geraet ohne Kopplung, Knöpfe schalten am Host und sperren bis zur
Quittung, Rechte ändern, Entzug, Neuladen und entkoppeln), views/BetriebKoppeln.test.ts (Bereiche, Code mit Ablauf,
QR mit Token, Koppel-Link, Geräteliste: ändern, umbenennen, entziehen mit Rückfrage). Oberfläche E6: views/BetriebGeraete.test.ts (einschalten, Links/QR, Kopieren, erneuern, beenden,
Kopf-Anzeige, zweites Fenster, Hinweis in den Einstellungen), src/GeraetApp.test.ts (Tafel/Liste, warte, kaputter Link,
Paket- und Host-Fassung, verlassen, beendet, Neuladen ohne Netz), src/main.sehen.test.ts (echter Start: kein Store,
nur der Server aus dem Link), SettingsView.test.ts „Geräte“. Kern (E6): paket.test.ts
(rund, kurz für QR, Prüfsumme, Fassung, nichts Geheimes), host.test.ts (ohne Raum keine Verbindung, Kennung, Server,
Neuladen, zwei Fenster mit Befehlen, Übernahme der Führung), geraet.test.ts (Ende zu Ende: dispatch → Sicht auf
Anzeigetafel/Zuschauer, Leitung ohne verbotene Felder, Zuschauer-Link erneuern, Neuladen Host/Gerät, Ablauf 36 h,
Raum beenden/verlassen, Uhrversatz, Fassungen), src/main.geraete.test.ts (echter Start: kein Netz ohne Raum). Benannte Lücken des Prototyps (S1–S7,
K13–K18) und „Befunde der E5-Prüfung“ in transport.test.ts; S7 Führung (Web Locks nachgebaut, Lease mit verzögert
abgleichendem Speicher) und Back/Forward-Cache in fuehrung.test.ts; Schreibfenster/Rückfall storage in
fensterbus.test.ts; Neuladen von Host und Gerät über die echte Ablage (S2/S3/S18), Speicher voll, „Raum verlassen und
neu koppeln“ und „nie in Sicherung/Vorlage“ in ablage.test.ts. Lizenzvermerk: components/FremdeBestandteile.test.ts.
