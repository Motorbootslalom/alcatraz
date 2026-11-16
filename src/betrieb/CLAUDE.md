# src/betrieb – Betrieb am Wettkampftag (Anzeigetafel, Start-Freigabe)

Rein, ohne DOM und Store. Plan zur Übernahme der Tafel vom 16.11.2026 (Etappen E1–E8); E1 = Anzeigetafel im
zweiten Fenster und Start-Freigabe am Bedienrechner, nur Manövrieren, ohne Netz. Begriffe: „Anzeigetafel“ (Code
`anzeige`), „Start-Freigabe“; „Tafel“ ist das Aushangbrett. Englisch vorläufig: display board, start release.

## Dateien

- `annahmen.ts` – BETRIEB_ANNAHMEN: alle Auslegungen mit Datum, an EINER Stelle (Muster PARALLEL_ANNAHMEN).
- `folge.ts` – Kennungen (refKey/liesRef, istPunktId, laufPunkt), bereicheZumStand (alle bzw. `{anzeige:true}`),
  programm (lauf:1..n; „nacheinander“ nur lauf:1), startfolge (abgeleitet, Entfallene mit `entfaellt`), lage
  (aktuell, vorig, Zeiger, offen, frei, nachzuholen, naechster, naechsterPunkt). Parallel (`parallel`) erst ab E4.
- `sicht.ts` – sichtOeffentlich(stand, {logos}) → OeffentlicheSicht: die EINE Stelle für den Datenschutz-Zuschnitt.
- Typen: types/betrieb.ts. Actions und Normalisierer: state/reducer/betrieb.ts. Nur-Lese-Store: state/leseStore.ts.
- Oberfläche (liest nur die Sicht): components/anzeige/ (AnzeigeTafel, AnzeigeBereich; styles/anzeige.css, lib/fit.ts),
  components/betrieb/ (StartFreigabe, NachzuholenListe), views/BetriebView.vue, src/AnzeigeApp.vue,
  lib/anzeigeFenster.ts (window.open, postMessage-Rückfall). Einstellungen: SettingsView `#anzeigetafel`.

## Abläufe

- Stand → lage(stand, bereich) → sichtOeffentlich → Anzeigetafel/Start-Freigabe (lesen nur die Sicht, schicken Actions).
- „Nächster Start“: BETRIEB_ZEIGEN {bereich, ref: sicht.offen[0].key, vorher: sicht.aktuell?.key ?? null}.
- Zweites Fenster: main.ts liest `#/anzeige[/<bereich>]` (lib/router.ts vollbild) VOR jedem Store → AnzeigeApp mit
  createLeseStore() → storage-Ereignis → lies() → Sicht nach JSON verglichen (shallowRef) → AnzeigeTafel. Rückfall:
  Bedienfenster stößt per postMessage an (verbindeAnzeigen in main.ts), die Tafel meldet sich beim opener.

## Fallen

- Die Folge wird nie gespeichert: Gezeigtes hängt an Kennungen (Starter + Lauf), nicht an Stellen. Ein gezeigter
  Start kann aus der Folge fallen (Lauf entfällt, Starter gelöscht) – `aktuell.eintrag` ist dann `null`. Die Sicht
  trägt ihn trotzdem (`aktuell.key`, ohne Eintrag in `starter`): Sonst passte `vorher` nie und „Nächster Start“ hinge.
- Entfallen heißt allein: ein X in einer Disq-Zelle des Laufs, Steg oder Vorsteg (lib/erfassung.ts nichtGestartet,
  dieselbe Frage wie die Wertung); `abgemeldet` filtert nicht.
- Vor dem Zeiger = „nachzuholen“, nie von selbst der Nächste; der Nächste braucht einen begonnenen Punkt. Den Zeiger
  schiebt nur Erledigtes begonnener Punkte (`zeigerNurBegonnene`: „nacheinander“ mitten im Lauf ausgeschaltet).
- Sicht: nie Geburtsdatum, Gewicht, Geschlecht, Werte, Abmeldungen; nur vorkommende Starter. Neue Felder → sicht.test.ts
  (Schlüssel-Durchlauf) und `sv` hochzählen, wenn sich die Form ändert. Zeitunabhängig: „seit“ rechnet der Bildschirm.
- planEvent wird je Stand einmal gerechnet (WeakMap in folge.ts) – Stände nie verändern, immer neu anlegen.
- Texte der Tafel in deren Sprache (tIn(sicht.sprache), Bogentexte in der Sicht); Bedienung in der Oberflächensprache.
  Start-Freigabe zeigt Namen nach der öffentlichen Einstellung (`namen: 'ohne'` ⇒ auch dort keine).
- Schreib-Spione in Tests an der Instanz (`vi.spyOn(localStorage, 'setItem')`): localStorage ist dort eine eigene
  Klasse (test-setup.ts), ein Spion an Storage.prototype sieht nichts. Echter Start mit `#/anzeige`: src/main.test.ts.
- AnzeigeApp vergleicht die Sicht nach Inhalt: Ein neues Feld, das sich bei jeder Eingabe ändert, zeichnete die Tafel
  bei jedem Tastendruck neu (AnzeigeApp.test.ts „zwei Fenster“ fängt das).

## Tests

`npx vitest run src/betrieb src/state/betrieb src/state/leseStore src/components/anzeige src/AnzeigeApp src/main
src/views/Betrieb src/lib/anzeigeFenster src/lib/fit` (Hilfen: testHilfen.ts betriebsStand, festgeschrieben, zeigeNaechsten
– nimmt `ref`/`vorher` aus der Sicht wie die Start-Freigabe;
Starter e1/k1/e2/k2 auf Parcours 1, v1/f1/v2 auf Parcours 2; Einstellungen: views/SettingsView.test.ts „Anzeigetafel“).
