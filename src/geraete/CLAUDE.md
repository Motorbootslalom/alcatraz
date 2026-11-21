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
  Speicher nie), nur frisch (NEULADEN_BEFEHL_GUELTIG_MS 10 min). PROTOKOLL_FASSUNG blieb 1 (`neu-laden` gab es seit E5).
  Annahmen BETRIEB_ANNAHMEN.wachBleiben/alleNeuLaden/kontingent. Tests: neuLaden.test.ts, kontingent.test.ts;
  haertung.test.ts (Start-Freigabe im Parallelslalom: Rechte je Bereich – A und B sind EIN Bereich –, Paar als Einheit;
  Zeitgrenzen: Wiederholabstand bis 5 min auch mit Fake-Uhr, Führungswechsel mit offener Action, Code/QR abgelaufen,
  Gerät länger weg als das Einstiegsfenster), src/GeraetParallel.test.ts (Oberfläche: Paar A/B, „Keine Bestätigung“).
  Doku: docs/betrieb.md (Ablauf am Wettkampftag, Wake Lock, Alle Geräte neu laden, Kontingent), Checkliste
  docs/feldtest.md – offene Punkte des Feldtests dort und in docs/entscheidungen.md „Offen“.
- W1.2 (21.11.2026, Plan docs/plan-wkr-w1.md §5; Host/Leitung folgen mit W1.3): `aufgaben.ts` Aufgabe `liste`
  {liste, teil?} (liesAufgaben: höchstens LISTEN_JE_GERAET = 2 Listen, F15; Teil nur bei geteilten Listen, F16),
  listenAufgaben, WKR_ACTIONS = ['WKR_ZEILEN','WKR_STATUS','WKR_ABSCHLUSS'] (Geräte-Arten, Positivliste),
  erlaubteWkr(action, aufgaben, stand, konfig, {id, name}) → {action: WKR_ZEILEN|WKR_LISTE|WKR_ABSCHLUSS | null,
  abgelehnt: {z, grund}[]} | null (Zeilen über wkr/zeile.ts pruefeZeile, ≤ WKR_ANNAHMEN.buendel, quelle aus dem
  Register); erlaubteAction lässt WKR-Arten nie durch. `wkrGruppen.ts`: gruppeDerListe = 'l' + FNV-1a hex8,
  gruppenFuer(aufgaben) = [ko, …Listengruppen]. GeraeteListe.vue behält Listen-Aufgaben beim Umschalten der Bereiche.
- W1.3 (21.11.2026, Plan §5/§8; Gerätekern folgt mit W1.4): **PROTOKOLL_FASSUNG = 2** (Ausnahme „Werte auf der
  Leitung“, F11: nur Gerät→Host auf g und `steht` einer Rückfrage in der Gruppe der Liste – lesbar für alle Geräte
  derselben Liste, auch den anderen Steg-Teil, WKR_ANNAHMEN.rueckfrageInListe; ko/kz wertfrei).
  protokoll.ts: GeraeteNachricht + `lebenszeichen` {wartend, akku?}, `gesehen` {hinweis}; ABLEHNUNGEN + Zeilen-Codes
  (wkr/zeile.ts) und `offen` (Texte `geraete.ablehnung.*`); HINWEISE (= wkr/sicht.ts WKR_HINWEISE, Test).
  transport.ts: `quittiere(e, ergebnis, grund?, {still})` (letzteNr ja, direkte Quittung nein), `verteile(g, sicht,
  {voll})`, `schickeSchluessel(id)` (Vermerk wie ein Wechsel); GeraetTransport `bestaetige(bisNr)` (gesammelte
  Quittung, alles ≤ bis aus der Schlange). register.ts: setzeAufgaben → {neu, weg} Gruppen (gruppenNachAufgaben legt
  sie an), vermerkeLebenszeichen (wartend/akku im Raum), hatGruppe. `wkrEingang.ts` (rein): Gesprächsstand
  (abgelehnte Zeilen ≤ 20, Hinweise je Gerät mit Zähler, extraFuer → ListenSichtExtra) und Herkunft ◆ (zellSchluessel
  lauf|starter|feld, herkunftGilt nur bei gleichem Wert). host.ts: hallo mit Listen → Gruppen anlegen, willkommen mit
  ihren Schlüsseln, WKR_LISTE {digital, nurWennFehlt} über reicheWeiter; Befehl `aufgaben`: weg → rotiere, neu →
  schickeSchluessel; Sicht voll (`listenVoll`) nach neuem Schlüssel/Gerät; verteile zusätzlich je Liste mit Geräten
  sichtListe (bis = letzteNr, nach Inhalt verglichen); nimmWkrAn: erlaubteWkr → Ablehnungen in die Ablage →
  reicheWeiter → Herkunft → quittiere(still, wenn das Gerät die Gruppe hat; `offen` bei wirkungslosem Abschluss –
  gemessen am eigenen Eintrag vorher/nachher, am Steg je Teil, wkr/abschluss.ts abschlussVon) →
  plane; lebenszeichen/gesehen still; nicht erlaubt immer direkt. API `hinweis(liste, code, startNr?)` (Fensterbus-
  Befehl `hinweis`). Tests: wkrHost.test.ts (nackter GeraetTransport als Gerät), transport.test.ts „W1“, wire.test.ts.
- W1.4 (21.11.2026, Plan §5/§6): `erfassen.ts` – Gerätekern der WKR-Erfassung OHNE Maske: oeffneErfassung(geraet:
  GekoppeltesGeraet, {ablage, uhr, taktMs, akku}) → listen (aus den Aufgaben), sichten (ShallowRef je Liste, `lv`
  geprüft), schlange (Sicht minus eigene Zeilen außer abgelehnten, Teil-Geräte ohne Starts mit eigenem Teil; ohne
  Verbindung + `danach` mit `geschaetzt`), stufen je `z` (unterwegs {gesendet} | uebernommen {nachRueckfrage} |
  rueckfrage {zellen mit steht} | abgelehnt {grund} | vorschlag), zuletzt, hinweise (minus gesehen), abschluesse
  (unterwegs|angenommen|abgelehnt, `offen` = still quittiert, aber nicht abgeschlossen – am Steg zählt nur der eigene
  Teil, `zuFuer` mit ListenSicht.teile), wartend; schicke, korrigiere
  (vorher = zuletzt gesendeter Wert; wartende Zeile wird geändert statt einer zweiten), pausiere/meldeAb/weiter
  (WKR_STATUS; ein Teil-Gerät wirkt nur auf seinen Teil, erlaubteWkr gibt `teil` mit), schliesseAb (Prüfsummen wkr/uebernahme.ts zeilenPruefsumme über die Masken-Felder des eigenen Teils),
  gesehen, stop. gekoppelt.ts: `kanal` (empfange, schicke, unbestaetigt, bestaetige, id, zuletztGesendet);
  transport.ts GeraetTransport.eigeneId(). ablage.ts: `alcatraz.geraet.wkr` (geraetWkrAblage: Raum + 36 h; pruefeRaum/
  verlasseRaum räumen ihn). Tests: wkr.test.ts (Ende zu Ende mit echtem Reducer).
- `tabWache.ts` (Befund 15, 21.11.2026) – oeffneTabWache({ablage?, fenster?, id?}) → {ablage (bewacht: schreibt
  `alcatraz.geraet.*` nur, solange dieser Tab der aktive ist), verdraengt, meins(), uebernimm(), stop()}: Der zuletzt
  geöffnete Tab schreibt seine Kennung nach `alcatraz.geraet.tab` (ABLAGE.geraetTab) und gewinnt; ein älterer merkt
  es am storage-Ereignis bzw. beim nächsten Schreiben. GeraetFreigabe.vue gibt Gerät UND Erfassung die bewachte
  Ablage, stoppt beide bei `verdraengt` (flush 'sync') und zeigt `data-meldung="andererTab"` mit „Hier weitermachen“
  (`hier-weiter`). Kein Web Lock (fehlt über http, hielte den neuen Tab draußen). Tests: tabWache.test.ts,
  src/GeraetWkr.test.ts „Befund 15“.
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
  `alcatraz.geraete.kontingent`, `alcatraz.geraete.fassung`; W1 `alcatraz.geraete.wkr` (Gesprächsstand) und
  `alcatraz.geraete.herkunft` (◆, F10) – liesWkrEingang/liesHerkunft an AppState.kennung gebunden (andere = gelöscht),
  bleiben nach „Raum beenden“.
- W2.2 (21.11.2026, Plan docs/plan-wkr-w2.md §5): host.ts `herkunft`/`eingang` (ShallowRef, gelesen beim Start, nach
  eigenem Schreiben – schreibeEingang/schreibeHerk – und beim storage-Ereignis auf ABLAGE.herkunft/ABLAGE.wkr; auch
  ohne Raum, ohne Verbindung/Fensterbus/Schloss; ohne Kennung leer und nichts gelöscht); `zieheZuletztNach` im
  Führungsfenster nach beruehre/Lebenszeichen (≤ ZULETZT_NACHZIEHEN_MS 5 s, nach Date.now; Begrüßen sofort).
  register.ts `geraetAngaben(geraete)` → wkr/lage.ts GeraetAngabe (nur Geräte mit Listen). Oberfläche:
  components/betrieb/WkrMatrix.vue, WkrListeBedienung.vue, WkrEingang.vue (Betrieb → WKR). Tests: host.test.ts „W2.2“,
  wkr.test.ts „W2.2“ (Matrix ✓, ◆ reaktiv, gedrosseltes Nachziehen), views/BetriebWkr.test.ts (Host-Doppel).
  Prüfbefunde W2 (21.11.2026): `hinweis(liste, code, startNr?, teil?)` – mit Teil nur an Geräte dieses Teils und ohne
  Teil (Fensterbus-Befehl trägt `teil`); `merkeEntscheid(liste, geraetName, zeilen)` schreibt ◆ nach einer Entscheidung
  im Eingang (jedes Fenster, auch ohne Raum; dieselbe Hilfe wie nach WKR_ZEILEN); verteileFreigabe/Koppel-Takt prüfen
  `endet`. Neue Methode am GeraeteHost → alle Host-Doppel in den Tests (`satisfies GeraeteHost`) mitziehen.
- W2.4 (21.11.2026, Plan docs/plan-wkr-w2.md §5/§6.3): **Freigabe-Gruppe je Bereich** – wkrGruppen.ts
  gruppeDerFreigabe(bereich) = 'f' + FNV-1a hex8 über `["f", bereich]`; gruppenFuer nimmt sie für jede Aufgabe
  `startfreigabe` dazu (also legen register.ts gruppenNachAufgaben/setzeAufgaben sie an, `neu`/`weg` wie bei Listen).
  host.ts: hallo legt alle nicht öffentlichen Gruppen an (nicht nur bei Listen) und schickt sie voll; ergaenzeGruppen
  beim Start des Führungsfensters (Bestandsgeräte vor W2: Gruppe anlegen + schickeSchluessel, kein neues Koppeln);
  verteileFreigabe je Bereich mit Freigabe-Gerät: erfassungsLage (konfigDerTafel = Sprache der Anzeigetafel, D3) →
  wkr/freigabe.ts sichtFreigabe → nach Inhalt verglichen (Map `listen` wie die Listen-Gruppen; nie gesendet und leer →
  nichts), zusätzlich im Koppel-Takt alle FREIGABE_TAKT_MS (= WKR_ANNAHMEN.freigabeTaktSek 15 s; die Ampel altert).
  gekoppelt.ts `freigabe` (ShallowRef je Bereich; nur Sicht einer `f…`-Gruppe, die zu einem eigenen Bereich passt,
  liesFreigabe; entzogen → leer). PROTOKOLL_FASSUNG bleibt 2 (Gruppen sind allgemein; ältere Geräte lesen sie nicht),
  innen `fv: 1`. Oberfläche: GeraetFreigabe.vue reicht `freigabe[b.id]` als `erfassung` an StartFreigabe. Tests:
  wkr.test.ts „W2.4“ (Handy bekommt Rückstand, Inhalt ohne Namen, mit ko-Schlüssel nicht lesbar, ko/kz ohne Freigabe-
  Felder; Verkehr nur bei Änderung; Bestandsgerät; Rechte), wkrGruppen.test.ts, register.test.ts, src/GeraetKoppeln.test.ts
  „W2.4“ (Leiste und „Trotzdem freigeben?“ auf dem Handy).

- W3.1 (21.11.2026, Plan docs/plan-wkr-w3.md §4): `erfassen.ts` – **Schlange je Steg-Teil** (eigene Zeilen nach
  Start UND Teil; `schlange` = ganz bzw. Teil der Aufgabe, ein Gerät für den ganzen Steg behält den Start, bis beide
  Teile erledigt sind; `schlangeTeil(liste, teil)`), `sn` je Zeile (ZuletztZeile.sn/teil), **Entwürfe** im Ausgang
  (`entwurf`/`merkeEntwurf`/`verwirfEntwurf`, `entwuerfe` = Leiste; `schicke` räumt den Entwurf, gehen mit
  verlasseRaum), `holeZurueck(z)` nur bei `nr === null` und ohne neuere Zeile desselben Starts (Werte auf `vorher`,
  Entwurf zurück), `pruefung(liste, punkt, teil?)` (Werte je Start mit `sn`/`t` im Ausgang, offene Starts der
  Teil-Schlange, X), `uebung`/`verbunden`/`entzogen`; Typ **ErfassungsQuelle** = was die Maske liest. `uebung.ts`
  oeffneUebung({regelwerk, typeId, teil?, sprache?, uhr?, taktMs?}) – dieselbe Schnittstelle ohne Transport, Ablage
  und Store (Quittung nach 300 ms, Beispiel-Rückfrage beim 5. Start, Takt 30 s; Teil-Gerät erledigt den anderen Teil
  mit). aufgaben.ts: ListenAufgabe `maske?` ('knoepfe'|'bild'|'text', MASKEN_VORGABEN) und `fest?: true` (F14; nur
  bekannte Werte). ablage.ts: `alcatraz.geraet.ansicht` (liesAnsicht/schreibeAnsicht: modus sonne|hell|dunkel – Vorgabe
  sonne –, hand, sprache?, name?; verlasseRaum löscht nur `name`) und `alcatraz.geraet.probe` (probeErledigt/merkeProbe
  je Raum und Liste; pruefeRaum/verlasseRaum räumen). Tests: wkr.test.ts „W3.1“, uebung.test.ts, ablage.test.ts,
  aufgaben.test.ts.

- W3.2 (21.11.2026, Plan docs/plan-wkr-w3.md §6): **Liste zuweisen am Bedienrechner** – nur Oberfläche, kein neuer
  Befehl: GeraeteKoppeln.vue gibt gibCode/oeffneQr die Aufgaben Start-Freigabe und/oder EINE Liste (+ Teil, J4),
  GeraeteListe.vue ändert Listen und Teil je Gerät über setzeAufgaben (Folge: Freigabe vorn, Listen dahinter). Die
  Listen kommen aus wkr/liste.ts listenDerVeranstaltung über components/betrieb/wkrListenWahl.ts – dieselbe Menge, die
  erlaubteWkr gelten lässt. Maskenvorgabe `maske` schickt der Host weiter nicht (G4). Tests: views/BetriebKoppeln.test.ts
  „W3.2“ (echter Host für Code/QR, Host-Doppel für die Geräteliste), wkr.test.ts „W3.2“ (Ende zu Ende über die
  Oberfläche, Steg nur Ablegen).

- W3.3 (21.11.2026, Plan docs/plan-wkr-w3.md §5): **Handy-Maske** – components/wkr/ (WkrGeraet …) liest nur die
  ErfassungsQuelle; GeraetFreigabe.vue öffnet `oeffneErfassung(geraet, {ablage, uhr})` einmal, sobald das Gerät
  Listen-Aufgaben hat (stop bei Unmount, Entkoppeln, anderem Gerät; nach dem Entzug bleibt sie offen, K3). Kein neuer
  Kern, kein neues Protokoll. Tests: src/GeraetWkr.test.ts.

- Prüfbefunde W3 (21.11.2026, plan-wkr-w3.md §14): erfassen.ts WerteEintrag.`wt` = gemeinsame Steg-Felder je Teil
  (`vorher` einer Teil-Zeile nur aus DIESEM Teil; `w` vereinigt wie der Bedienrechner; Feldteil an der Sicht,
  feldTeil), `stand(z)` (eigener Stand des Starts und Teils – Grundlage jeder Korrektur, auch uebung.ts),
  `getrenntSeit`/`wartendSeit` (Wanduhr), `verbindung` (21.11.2026, N11: verbinde in der Karenz
  WKR_ANNAHMEN.verbindeKarenzSek nach dem Öffnen, getrennt nach Karenz oder Abriss; „geschätzt“ nur bei getrennt), EntwurfEintrag.`papier` {titel, bereich, felder} aus der Sicht beim Ablegen.
- W3.4 (21.11.2026, Plan docs/plan-wkr-w3.md §5.7–§5.9): kein neuer Kern, kein neues Protokoll. Oberfläche nutzt
  `pruefung`/`schliesseAb`/`abschluesse` (WkrAbschluss), ablage.ts `schreibeAnsicht` (Ansicht, Sprache, WKR-Name – der
  Name nie aus der Übung) und `probeErledigt`/`merkeProbe` (Probe je Raum und Liste; den Raum gibt GeraetFreigabe aus
  `geraet.paket` u/r/s). **Übung `#/uebung`** (lib/adressen.ts VOLLBILDER `uebung`, main.ts → GeraetApp ohne Store →
  components/wkr/WkrUebung.vue → `oeffneUebung`): kein Transport, keine Ablage außer der Ansicht, kein Netz
  (src/main.uebung.test.ts wie main.geraete.test.ts). Verweis „Üben ohne Verbindung“ im Koppel-Formular von
  GeraetFreigabe (und ohne Gerät).
- W4.2 (21.11.2026, Plan docs/plan-wkr-w4.md §5): kein neuer Kern, kein neues Protokoll – die Bojen-Maske liest
  dieselbe ErfassungsQuelle; uebung.ts unverändert (Bojen-Listen über maskenJeKlasse). Ende zu Ende: wkr.test.ts
  „W4.2“ (gate135 jede Boje + Disq. in einer Zeile, moewe135 Bojen + Einfahrt Tor 5 über SET_AUFBAU `moewe`).
- W4.3 (21.11.2026, Plan docs/plan-wkr-w4.md §6, P16/R1–R8): **„Nicht vorbeigekommen“** – erfassen.ts
  MaskenZeile.`nv` → `schicke` legt eine Zeile OHNE Zellen mit `n` (AusZeile.n, auf der Leitung GeraeteZeile.n);
  WerteEintrag.`n` = Teil der Meldung (`g` = ganz), eine spätere Zeile desselben Teils ohne `n` löscht es;
  `korrigiere` schickt nach einer ⊘-Zeile auch ohne geänderte Werte („doch vorbei, fehlerfrei“) bzw. macht aus der
  wartenden ⊘-Zeile eine mit Werten; ZuletztZeile.`nv`, PruefZeile.`nv`, Pruefung.`nichtVorbei` (Startnummern).
  uebung.ts ebenso (UebZeile.n, keine Beispiel-Rückfrage auf einer ⊘-Zeile). protokoll.ts ABLEHNUNGEN + `nv-nicht-erlaubt`
  (Text geraete.ablehnung.nv-nicht-erlaubt). PROTOKOLL_FASSUNG bleibt 2; LISTEN_SICHT_FASSUNG 5 trennt alte Geräte.
  Tests: src/GeraetWkr.test.ts „Nicht vorbeigekommen (W4.3)“ (Ende zu Ende über die Maske), uebung.test.ts.

- Nutzer 21.11.2026 (WKR_ANNAHMEN T3, T5–T8): **Abmelden am Gerät = Liste entfernen** – host.ts nimmWkrAn: WKR_STATUS
  `abgemeldet` → WKR_LISTE abgemeldet für das, was danach kein Gerät mehr abdeckt (kein anderes Gerät: ganze Liste, T6;
  sonst am Steg höchstens ein Teil; ungeteilte Liste mit anderem Gerät: kein Status, Prüfbefund 21.11.2026), Quittung
  direkt (nicht still), dann Befehl `aufgaben` ohne die Liste (rotiert die Listen-Gruppe, schickt `aufgaben`).
  erfassen.ts: `abgemeldet` (AbgemeldeteListe {liste, titel, bereich, teil?}; Inhalt.abgemeldet im Ausgang mit `id`/`nr`
  der Abmelde-Nachricht, `weg` sobald die Liste fehlt; fällt beim Neu-Zuweisen – nach `weg` oder mit einer Sicht, deren
  `bis` ≥ `nr` ist, nur mit dem neuen Schlüssel lesbar), meldeAb setzt es sofort (vor dem Senden), schicke/Schlange danach leer;
  WkrGeraet/GeraetFreigabe zeigen die Liste weiter als Reiter mit WkrRuhe `abmeldung`. uebung.ts: `abgemeldet` immer leer
  (T8). Steg-Zeitversatz (T3): ein Gerät für den ganzen Steg nimmt einen Start ins Anlegen erst, wenn sein Ablegen nicht
  mehr in der Schlange steht (erfassen.ts schlangen `ablegenOffen`, uebung.ts `passt`). Tests: wkr.test.ts „Abmelden am
  Gerät wirkt wie Liste entfernen“, „Steg ganz auf einem Gerät“ (nie beide zugleich).

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
- WKR-Gerät (W1, erfassen.ts; Oberfläche erst W3/W4): Koppeln mit Aufgabe `liste` → willkommen mit dem Schlüssel
  der Listen-Gruppe → Host stellt die Liste „digital“ und verteilt sichtListe (bis = letzteNr je Gerät). schicke →
  Ausgang (`alcatraz.geraet.wkr`) → pumpe: nur verbunden und ohne Unbestätigtes beim Transport, dann alle wartenden
  Zeilen der ersten Liste (≤ 8) als EIN WKR_ZEILEN (Abschluss/Status/gesehen bleiben in der Reihe dahinter) → Host
  nimmWkrAn → erlaubteWkr → Schreibfenster → Herkunft ◆ → quittiere still → Sicht der Liste mit `bis` ≥ nr →
  erfassen: bestaetige(bis), Stufen aus `bis`/rueckfragen/abgelehnt der Sicht (in den Ausgang übernommen, die Sicht
  hält nur 20). Direkte Quittung (ohne Gruppe, `nicht-erlaubt`, `doppelt`) gilt ebenso. Lebenszeichen: Takt prüft
  `uhr() − zuletztGesendet ≥ 60 s`, nur gekoppelt, verbunden, ohne Ausstehendes, mit laufendem Punkt einer Liste.
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
  Dazu liest GeraetTransport die Nummer vor jedem Senden und Ablegen frisch nach (nimmHoechsteNr, 21.11.2026): Zwei Tabs
  derselben Kopplung vergaben sonst dieselben Nummern – das Gerät zeigte ✓ (`bis` deckt sie), der Host hatte nichts.
  Das allein reicht nicht (Reihenfolge zweier Schlangen, gegenseitiges Überschreiben von Schlange und Ausgang): Nur
  EIN Tab sendet (tabWache.ts). Wer ein Gerät ohne GeraetFreigabe öffnet, gibt ihm selbst eine bewachte Ablage.
- Direktes (d) kann in vertauschter Reihenfolge kommen: ntfy abonniert erst und schickt dann das Zwischengespeicherte –
  was dazwischen eintrifft, kommt live vor Älterem. Das Gerät nimmt deshalb auf d nicht nur „über `seen[DIREKT]`“,
  sondern alles, was im Fenster `GeraetStand.direkt` (DIREKT_MERKEN 64 Nummern) noch fehlt (21.11.2026; vorher ging
  ein `aufgaben` direkt nach einem `schluessel` verloren – transport.test.ts „Direktes in vertauschter Reihenfolge“).
  Der Nachbau (testNtfy.ts) zeigt dieselbe Reihenfolge, wenn zwischen Abo und Öffnen etwas veröffentlicht wird.
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
- W2.4: Jedes Gerät der Start-Freigabe hat seitdem eine nicht öffentliche Gruppe (`f…`) – Tests, die `gruppen` eines
  Geräts oder `neu`/`weg` von setzeAufgaben vergleichen, müssen sie mitzählen. Die Freigabe-Gruppe trägt nie Werte und
  nie Namen (wkr/freigabe.ts Positivliste); was die Tafel nicht sehen darf, gehört nie nach ko/kz (F17).
- W1: Die Gruppe einer Liste trägt dieselbe `sv` wie ko (SICHT_FASSUNG, der Transport kennt nur eine); die Form der
  Listen-Sicht steht innen als `lv` (wkr/sicht.ts LISTEN_SICHT_FASSUNG). Still quittiert wird nur, wer die Gruppe hat –
  sonst wartete das Gerät auf eine Sicht, die es nicht lesen kann. Akku/wartend liegen im Register (Raum), nicht in
  `alcatraz.geraete.wkr`.
- Echter ntfy ungeprüft (nur der Nachbau; Checkliste docs/feldtest.md): in E6/E8 `since=<id>` über mehrere Themen und mit abgelaufener ID, und dass
  `attachment.url` mit der eingegebenen Server-Adresse beginnt (sonst verwirft der Host jeden Vollstand mit `zu-gross`).

- W1-Gerät: Stille Quittung trägt nur die Sicht der Listen-Gruppe – ein Gerät ohne die Gruppe (entzogen, Schlüssel
  verloren) hängt sonst; der Host quittiert dann direkt, Wiederholungen bekommen `doppelt`. Die gesammelte Quittung
  (`bestaetige(bis)`) nimmt auch Start-Freigabe-Actions aus der Schlange, deren direkte Quittung noch unterwegs ist.
- W1: Herkunft ◆ und Gesprächsstand liegen gerätelokal am Bedienrechner (`alcatraz.geraete.herkunft`/`.wkr`), der
  Ausgang gerätelokal auf dem Gerät (`alcatraz.geraet.wkr`) – nie im AppState. erfassen.ts schreibt nur, solange die
  Kopplung dieses Raums in der Ablage steht (nach verlasseRaum nichts wieder ablegen). Zeilenzähler `z` beginnt bei
  der Uhrzeit (Rückfrage-IDs `${geraet}.${z}` nie doppelt). Kein Name in Rückgaben des Kerns (F6); der WKR-Name des
  Abschlusses steht nur in der Nachricht (und bis zur Quittung in der Sende-Schlange).
- W3.4: Die Übung bleibt dieselbe Wurzel wie Lese-/Koppel-Gerät (main.ts `wurzel`) – ein Wechsel `#/geraet` ↔
  `#/uebung` lädt nicht neu; GeraetApp stoppt dabei das Lese-Gerät, GeraetFreigabe stoppt Gerät und Erfassung beim
  Unmount. Wer der Übung etwas mit Ablage gibt, bricht G13 (nur die Ansicht).
- W3.1: Eine eigene Zeile am Steg nimmt den Start nur aus der Schlange IHRES Teils (vor W3 aus beiden). Wer die
  Schlange eines Teils braucht, nimmt `schlangeTeil`, nicht `schlange` (das ist beim Gerät für den ganzen Steg die
  Vereinigung). Die Übung (uebung.ts) darf nie ablage.ts, transport/ oder den Store importieren.
- W1-Tests: Mit `sammelnMs` 150 am Host muss `quittungMs` des Geräts darüber liegen, sonst wiederholt es (Verkehr ×2).

## Tests

`npx vitest run src/geraete src/main.geraete src/main.sehen src/main.uebung src/GeraetApp src/GeraetKoppeln src/views/BetriebGeraete
src/views/BetriebKoppeln` (nachgebauter ntfy, kein Netz). WKR (W1): wkr.test.ts Ende zu Ende (koppeln mit Liste, Zeile →
Erfassung, Rückfrage hin und zurück, Doppel, Funkloch → eine Nachricht, Führungswechsel, Neuladen Host/Gerät, Liste
entzogen, Lebenszeichen mit Fake-Uhr, Pause/P, Abschluss → Vorschlag, Hinweis, Steg AB/AN (Zeilen; Abschluss und Abmelden je
Teil), Parallel A/B, Leitung,
Verkehr je Zeile), wkrHost.test.ts (Host mit nacktem Transport). Oberfläche E7: src/GeraetKoppeln.test.ts (Code, falsches
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
