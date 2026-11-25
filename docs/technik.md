# Technik

Wie Alcatraz gebaut ist und wie man daran arbeitet.
Was die App fachlich kann: [funktionen.md](funktionen.md).
Betrieb ohne Internet, Sicherung und Verlauf: [betrieb.md](betrieb.md).
Für Agenten und Entwickler gibt es dazu die Projektkarte [CLAUDE.md](../CLAUDE.md) mit Ordnerkarte und Datenfluss.

## Inhalt

- [Aufbau](#aufbau)
- [Abhängigkeiten](#abhängigkeiten)
- [Offline-Speicher](#offline-speicher)
- [Gerätebetrieb: Sicherheitsmodell](#gerätebetrieb-sicherheitsmodell)
- [Entwickeln](#entwickeln)
- [Tests](#tests)

## Aufbau

Alcatraz ist eine reine Browser-Anwendung ([Vue 3](https://vuejs.org/), TypeScript, [Vite](https://vite.dev/)).
Server, Datenbank und Anmeldung gibt es nicht (siehe [README](../README.md)).

- **Mehrsprachig:** Die Oberfläche lässt sich im laufenden Betrieb umschalten (bisher Deutsch und Englisch).
  Die Texte stehen in `src/i18n/`; eine weitere Sprache ist eine weitere Katalogdatei.
- **Adressen in der Sprache der Oberfläche:** Jede Ansicht, jeder Reiter und jedes Sprungziel hat eine Adresse
  zum Weitergeben (`#/listen/wkr`, englisch `#/lists/race-officials`).
  - Geschrieben wird sie in der Sprache der Oberfläche, gelesen in jeder.
    Ein deutscher Verweis geht auch bei englischer Oberfläche auf und wird ohne Schritt im Verlauf umgeschrieben.
  - Die Wörter stehen je Sprache in einer Tabelle in `src/lib/adressen.ts`; die Namen im Code bleiben deutsch.
  - Ergibt eine weitere Sprache ein mehrdeutiges Wort, gilt für dieses Ziel das englische (`wortraum`).
  - Ein Querverweis kann eine Auswahl im Reiter mitgeben (drittes Segment, ein Wert aus den Daten, nicht übersetzt).
    Beispiel: „Verwiegung → Gewichtslisten drucken“ führt zu `#/listen/gewicht/<Herkunft>` (`*` = alle).
    Die Ansicht übernimmt die Wahl; danach steht in der Adresse wieder nur der Reiter.
  - Verändert wird nur der Hash – das geht auch in der Ein-Datei-Fassung unter `file://`.
- **Gedruckte Listen im Mittelpunkt:** Gedruckt wird über den Druckdialog des Browsers (auch „Als PDF speichern“).

Aufbau von `src/`:

- `domain/`: Klassen, Startnummern
- `import/`: Excel-Austausch
- `planung/`: Verzahnung, Boote, Parallel-Slalom
- `state/`: Zustand als reiner Reducer
- `persistenz/`: Speicher im Browser, Sicherung
- `i18n/`: Sprachen
- `views/` und `components/`: Oberfläche

Die vollständige Ordnerkarte steht in [CLAUDE.md](../CLAUDE.md).

## Abhängigkeiten

In der ausgelieferten App stecken nur wenige fremde Pakete (`package.json`, `dependencies`):

| Paket | Wofür | Lizenz |
|---|---|---|
| `vue` | Oberfläche | MIT |
| `js-yaml` | Regelwerke und Aufbauten (YAML) | MIT |
| `qrcode-generator` | QR-Codes auf Bögen und Laufzetteln | MIT |
| `vuedraggable` (mit `sortablejs`) | Ziehen in Verzahnung und Startliste | MIT |
| `tweetnacl` | Verschlüsselung und Signaturen im Gerätebetrieb (`src/geraete/`, ab Etappe E5) | Unlicense (gemeinfrei) |

Dazu kommen die Flaggenbilder aus `country-flag-icons` (MIT; als Entwicklungsabhängigkeit eingetragen, weil nur die
Bilder beim Bauen übernommen werden). Alle Vermerke zeigt die App unter „Einstellungen → Fremde Bestandteile und
Lizenzen“ (`src/components/FremdeBestandteile.vue`) – die Ein-Datei-Fassung wird ohne README weitergereicht.

`tweetnacl` (1.0.3, wie im Prototyp `tafel`; Plan vom 16.11.2026) statt WebCrypto: `crypto.subtle` fehlt außerhalb
sicherer Kontexte und kann unter `file://` bei undurchsichtiger Herkunft fehlen, tweetnacl läuft überall.
Solange nichts außerhalb von `src/geraete/` es lädt (Etappe E5), steckt es noch nicht im Bündel.

## Offline-Speicher

Was Auswerter davon sehen und tun müssen, steht in [betrieb.md](betrieb.md).

- `scripts/offline-sw.js` ist der Service Worker, von Hand geschrieben, ohne Workbox.
  Eine Strategie: alles vorab, mit Prüfsumme je Datei, ein Cache je Fassung.
- Welche Fassung ausgeliefert wird, sagt ein Zeiger „gültige Fassung“ im Speicher.
  Ihn setzt nur „Update“ um – oder bei leerem Stand der Start –, nicht der gerade laufende Service Worker.
  Deshalb muss die Datei über Fassungen hinweg verträglich bleiben, siehe ihren Kopf;
  alte Caches gehen nach dem Umschalten.
- Einen Übergang von Fassungen vor dem Zeiger gibt es nicht:
  Die Anwendung ist noch in Entwicklung (Entscheidung vom 15.11.2026).
- Geprüft mit zwei Builds hintereinander, die ein statischer Server auf derselben Adresse nacheinander ausliefert:
  Mit Startern bleibt die alte Fassung über Neuladen, neuen Tab und Neustart des Browsers hinweg,
  bis „Update“ gedrückt wird (andere Fenster zeigen danach „bitte neu laden“).
  Ohne Starter übernimmt Alcatraz die neue beim Öffnen von selbst
  (bzw. beim nächsten Öffnen, wenn im Fenster schon gearbeitet wurde).
- `scripts/offline-speicher.ts` schreibt den Service Worker beim Build mit der Liste aller Dateien als `dist/sw.js`.
  Das Deployment ruft das Skript nach dem Kopieren von `alcatraz.html` noch einmal auf.
- Die Seite dazu: `src/lib/offline.ts`, `src/components/OfflinePanel.vue`.
- Der zweite Speicher: `src/persistenz/zweitspeicher.ts` (IndexedDB),
  `src/state/zweit.ts` (wann geschrieben wird, Abgleich beim Start),
  `src/lib/verlauf.ts` (welcher Stand neuer ist, Zusammenfassen, Grenzen), `src/components/VerlaufPanel.vue`.
- Jede Speicherung trägt eine Speichermarke (Folge-Nummer und Uhrzeit), die der Store vergibt;
  der Reducer bleibt ohne Uhr.
  Sie steht im gespeicherten Text, aber nicht im Stand und nie in einer Datei.
- Die Tests benutzen statt der IndexedDB des Browsers `fake-indexeddb` (nur zum Testen).
- `public/manifest.webmanifest` macht die Pages-Fassung installierbar.

## Gerätebetrieb: Sicherheitsmodell

Stand Etappe E7 (20.11.2026): Anzeigetafel und Zuschauerliste gehen über Lese-Links auf andere Geräte, gekoppelte
Handys bedienen die Start-Freigabe ihrer Bereiche (Bedienung: [betrieb.md](betrieb.md#gerätebetrieb)). Geprüft und
angewandt wird nur am Bedienrechner: Positivliste `src/geraete/aufgaben.ts` nach dem Register des Hosts, nie nach dem,
was ein Gerät von sich sagt; jede Action trägt eine Nummer (Doppelte nur quittiert), Entzug sperrt sofort.
Plan und Entscheidungen: [entscheidungen.md](entscheidungen.md#betrieb-und-offline); Ordnerkarte `src/geraete/CLAUDE.md`.

- **Ohne Einschalten keine Verbindung:** Erst „Gerätebetrieb einschalten“ legt einen Raum an; bis dahin öffnet die App
  weder WebSocket noch Abfrage noch Fensterbus (`src/main.geraete.test.ts`, `src/geraete/host.test.ts`). Ein Gerät mit
  Lese-Link spricht nur mit dem Server, der im Link steht (`src/main.sehen.test.ts`).
- **Lese-Links:** `#/sehen/<paket>` (`src/geraete/paket.ts`), gepackt für einen kleinen QR-Code (Version 10). Das Paket
  trägt Server, Raum, Thema, den Schlüssel seiner Gruppe und den öffentlichen Schlüssel des Bedienrechners – nie das
  Geheimnis, nie das Thema der Geräte. Anzeigetafel und Zuschauer sind zwei Gruppen mit eigenem Schlüssel: Der
  Zuschauer-Link öffnet nur die Zuschauersicht. Ein Gerät (`src/GeraetApp.vue`) hat keinen Store und berührt den
  Stand einer Veranstaltung nie.

- **Ein fremder Server, kein eigener:** Nachrichten gehen über einen ntfy-Server (Vorgabe `ntfy.adminforge.de`,
  änderbar). Er sieht Themen, Zeitpunkte, Größen und IP-Adressen, aber keine Inhalte.
- **Der Bedienrechner ist die einzige Wahrheit.** Geräte bekommen nie den Stand der Veranstaltung, sondern eine
  zugeschnittene Sicht (`src/betrieb/sicht.ts`: nie Geburtsdatum, Gewicht, Geschlecht). Geräte schicken nur
  Änderungswünsche; prüfen und anwenden tut allein der Bedienrechner.
- **Verschlüsselt und signiert:** Sichten je Gruppe mit einem gemeinsamen Schlüssel (secretbox), Nachrichten an ein
  Gerät und von einem Gerät an dessen bzw. den Schlüssel des Bedienrechners (box). Jede Nachricht des
  Bedienrechners ist signiert (Ed25519) – samt Thema, Raum, Gruppe, Nummer, Fassung und Sendezeit. Eine alte,
  erneut eingestellte Nachricht verliert gegen die neueste; ein Gerät ohne eigenen Stand nimmt nur Frisches (höchstens
  2 Stunden alt). „Andere Fassung, Update nötig“ meldet ein Gerät nur mit einem signierten Fassungsbeleg.
- **Themen:** Die beiden öffentlichen (Anzeigetafel-Link, Zuschauer-Link) sind Zufall und stehen nur in ihrem Link;
  der Zuschauer-Link lässt sich erneuern, ohne die Anzeigetafel zu stören. Alle übrigen leiten sich aus einem
  Geheimnis des Bedienrechners ab und erfahren nur gekoppelte Geräte.
- **Gegen Störung:** Der Bedienrechner lädt nie einen Anhang; Geräte nur nach signierter Ankündigung, mit Prüfsumme
  und höchstens 256 kB. Anmeldungen Unbekannter öffnet er nur auf Koppel-Themen und gedrosselt je Thema, auf dem
  Thema der gekoppelten Geräte gar nicht; Ablehnungen und zweite Antworten kosten ihn nur wenige Veröffentlichungen.
  Jede Nachricht eines Geräts trägt eine fortlaufende Nummer; der Bedienrechner merkt sich die letzte dauerhaft,
  auch über ein Neuladen hinweg. Schlüsselwechsel und Entzug stehen im Raum, bis ntfy sie angenommen hat.
- **Ein Fenster führt:** Mit ntfy verbindet nur ein Fenster des Bedienrechners (Web Locks, sonst eine Lease im
  localStorage); angewandt wird im zuletzt bedienten Fenster (Fensterbus), damit es bei einem Schreiber bleibt. Geht
  das führende Fenster in den Back/Forward-Cache, gibt es die Führung ab.
- **Schlüssel bleiben auf dem Gerät:** Raum, Schlüssel und Geräteliste liegen im localStorage dieses Browsers
  (`alcatraz.geraete.*`, auf Geräten `alcatraz.geraet.*`), nie in Sicherung, Vorlage oder Verlauf. Sie liegen dort im
  Klartext (wer den Rechner hat, hat ohnehin den Stand); ein anderer Rechner heißt neuer Raum. Auf Geräten läuft eine
  abgelegte Sicht nach 36 Stunden ab; Kennung und Nummernfolge eines Geräts liegen in einem Eintrag und gehen nur
  zusammen verloren („Raum verlassen“ heißt neu koppeln mit neuem Schlüssel).

## Entwickeln

```sh
npm install
npm run dev             # Entwicklungsserver (nur dieser Rechner)
npm run dev:host        # dasselbe im lokalen Netz, für Tests mit Handy und Pad
npm run dev:https       # dasselbe mit HTTPS (selbst signiert): Wake Lock und Web Locks (kein Offline-Speicher)
npm run preview:host    # gebaute Fassung (nach build) im lokalen Netz
npm run check           # Typprüfung und Tests
npm run build:all       # dist/ (GitHub Pages) und dist-single/ (eine Datei)
npm run parcours:sync   # von Hand: Parcours-Zeichnungen aus ../Parcours holen (nicht Teil der CI)
```

**Test mit Handy und Pad im WLAN** (`dev:host`, 21.11.2026): Vite nennt unter „Network“ die Adresse im lokalen Netz
(z. B. `http://192.168.178.20:5173/`). Den Bedienrechner über **diese** Adresse öffnen, nicht über `localhost` – Lese- und
Koppel-Links nehmen die Adresse des Bedienfensters, und `localhost` erreicht kein Handy. Ohne HTTPS fehlen den Geräten
einige Browser-Funktionen: Bildschirm-Wachhalten (Wake Lock), Offline-Speicher und Web Locks. Die App läuft trotzdem
(Rückfall ohne Wake Lock, Fensterführung über die Lease). Für den Feldtest mit allem deshalb die Fassung auf GitHub Pages.

**Mit HTTPS im WLAN** (`dev:https`, 21.11.2026): wie `dev:host`, aber über `https://192.168.…:5173/` mit einem selbst
signierten Zertifikat (`@vitejs/plugin-basic-ssl`, nur devDependency; vite.config.ts `--mode https`). Der Browser warnt
einmal je Gerät („Verbindung ist nicht privat“) – auf dem Bedienrechner UND auf jedem Handy „Erweitert → Weiter zu …“
bestätigen; danach ist es ein sicherer Kontext: Das Handy hält den Bildschirm wach (Wake Lock), der Bedienrechner führt
seine Fenster über Web Locks. Den Bedienrechner auch hier über die Netzadresse öffnen, nicht über `localhost`. Das
Zertifikat legt das Plugin unter `node_modules/.vite/basic-ssl/` ab; es gilt nur für die Entwicklung. Den
Offline-Speicher gibt es auch so NICHT: Im Entwicklungsserver ist er immer aus („nicht verfügbar“, lib/offline.ts), und
Service Worker lassen sich mit selbst signiertem Zertifikat nicht registrieren – Offline prüfen nur über GitHub Pages
(Prüfbefund 21.11.2026).

Die Parcours-Zeichnungen unter `src/assets/parcours/` kommen nur über `npm run parcours:sync`
(Herkunft und Lizenz: [`src/assets/parcours/LICENSE.md`](../src/assets/parcours/LICENSE.md)).

**Bilder der README** (`docs/bilder/`): aufgenommen mit `npm run dev` und den Beispieldaten der App.

- Nur erfundene Daten: Beispiel-Starterfeld, Beispielwerte, Beispiel-Besetzung, Beispielgewichte,
  ein erfundener Veranstaltungsname ohne Jahr (die App hängt das Jahr an, im Kopf stünde es sonst doppelt).
- Herkunft „Bundesland“ oder „Land“, nie „Verein“: `src/data/clubs.ts` ist an reale Vereine angelehnt,
  und erfundene Personen sollen nicht echten Vereinen zugeordnet erscheinen.
- Helles Farbschema, zugeschnitten auf das Wesentliche, etwa 1200 px breit, je Datei unter 250 KB
  (verkleinert mit ImageMagick auf 64–256 Farben und `oxipng`).
- Ohne Fußzeile der App und ohne die Quellenzeile unter dem Parcoursbild; die Lizenz steht in der README.
- Die README zeigt sie nur als Vorschau mit Link auf das volle Bild:
  Ansichten und Bögen 180–300 px breit, breite Listen 600 px in einer eigenen Zeile.

## Tests

Getestet wird mit Vitest und happy-dom; die Tests liegen neben dem Code (`*.test.ts`).
Personen in Tests und Beispieldaten sind erfunden (`src/data/names.ts`).
Die Befehle für gezielte und volle Läufe stehen in der Projektkarte unter [Befehle](../CLAUDE.md#befehle).

Die CI (`.github/workflows/ci.yml`) führt `npm run check` und `npm run build:all` aus.
Das Deployment auf GitHub Pages (`.github/workflows/deploy.yml`) liefert die Ein-Datei-Fassung als `alcatraz.html` mit.

**Wackelige Tests** (24.11.2026): Zwei Ende-zu-Ende-Tests in `src/GeraetWkr.test.ts` – „Probe beim Einrichten …
einmal je Raum und Liste“ und „W5.2 Maske ‚Bild‘: Probe am Bild …“ – warten mit fester Zeitgrenze auf Gerät und
nachgebauten ntfy-Server und schlagen unter Last gelegentlich mit „Zeit abgelaufen“ fehl. Damit sie den Pages-Deploy
nicht aufhalten, laufen sie auf GitHub (dort ist `CI` gesetzt) nur auf Wunsch; Regel: `src/testHilfen.ts`
`wackelTestsAuslassen`, in den Tests `it.skipIf(WACKELTESTS_AUS)`; `src/testHilfen.test.ts` prüft, dass die Regel zu
der Zeile in `ci.yml` passt (ohne Haken `0` = aus).

- Lokal, auch im pre-commit-Hook (ohne `CI`): laufen immer.
- Auf GitHub mitlaufen lassen: **Actions → CI → Run workflow**, Branch wählen, Haken bei „Wackelige Tests mitlaufen
  lassen“ setzen, **Run workflow**. Der Haken setzt `ALCATRAZ_WACKELTESTS=1`; bei Push und Pull Request ist er aus.
- Deploy (`deploy.yml`): setzt die Variable nie, die beiden Tests bleiben dort immer aus.
- Lokal so prüfen wie auf GitHub: `CI=true npx vitest run src/GeraetWkr.test.ts -t "Probe"` (die zwei: übersprungen),
  mit `ALCATRAZ_WACKELTESTS=1` davor laufen sie mit.
