import type { AppState, ClassId, OriginMode, Starter } from '../types'
import { CLASS_IDS } from '../domain/classes'
import { SCHEMA_VERSION } from '../types'
import { emptyState, laufzettelLayoutWert, leerzeilenZahl, streichlaeufeWert, teilenAbZahl, wkrSprachenWert, zeilenJeSeiteZahl } from './reducer'
import { aufbauOf, beschriftungOf, regelwerkOf } from '../config/catalog'
import { normalisiereZusatzListen } from '../lib/listen'
import { ID_MUSTER } from '../config/eigene'
import type { RawAufbau } from '../config/schema'
import { normalisiereEinteilung } from '../lib/einteilung'
import { normalisiereBesetzung } from '../lib/besetzung'
import { normalisiereEingaben, nurStarter } from '../lib/eingaben'
import { istKennung } from '../lib/qr'
import { configFor } from '../config/konfig'
import { isSprache } from '../config/sprache'
import { bietetEnglisch, regelwerkSprache } from '../lib/listensprache'
import { pokalWert } from '../config/pokal'
import { istOriginStyle } from '../lib/origin'
import type { ErgebnisHerkunft } from '../types'

/** Herkunft auf den Ergebnislisten: „aus“ oder eine Darstellung der Listen; alles andere ist unbekannt. */
const ergebnisHerkunft = (wert: unknown): ErgebnisHerkunft | undefined => (wert === 'aus' || istOriginStyle(wert) ? wert : undefined)

/**
 * Einen gelesenen Stand (localStorage, Sicherungsdatei) auf die aktuelle Fassung
 * bringen. Unbekanntes oder Kaputtes ergibt `null` – dann beginnt die
 * Anwendung leer, statt mit halben Daten zu rechnen.
 *
 * Neue Fassungen bekommen hier einen Schritt `if (version < n) { … }`; die
 * Schritte laufen der Reihe nach, sodass auch alte Sicherungen lesbar bleiben.
 *
 * `oberflaeche`: die Sprache der Oberfläche dieses Geräts, soweit der Aufrufer sie kennt
 * (persistenz/). Sie gehört nicht zum Stand; gebraucht wird sie nur für alte Stände, deren
 * Bögen „wie die Oberfläche“ gedruckt wurden (`alteWkrSprachen`).
 */
export function migrate(raw: unknown, optionen: { oberflaeche?: string } = {}): AppState | null {
  if (!raw || typeof raw !== 'object') return null
  const loaded = raw as Partial<AppState>
  if (!Array.isArray(loaded.starters)) return null
  if (typeof loaded.schemaVersion === 'number' && loaded.schemaVersion > SCHEMA_VERSION) return null

  const base = emptyState()
  // Eine Kennung gilt einmal, der erste Eintrag gewinnt: Zwei gleiche wären in der Liste
  // nicht zu unterscheiden (Bearbeiten träfe den ersten, Löschen beide).
  const gesehen = new Set<string>()
  const eigeneAufbauten = (Array.isArray(loaded.eigeneAufbauten) ? loaded.eigeneAufbauten.filter(isAufbau) : []).filter(
    (a) => !gesehen.has(a.id) && !!gesehen.add(a.id),
  )
  const parcoursList = Array.isArray(loaded.parcoursList) ? loaded.parcoursList : base.parcoursList
  const starters = loaded.starters.map(normalizeStarter)
  // Bis zur Sprache je Liste gab es eine Wahl für alle Listen (`listenSprache`). Das Feld
  // entfällt; was daraus für die Bögen wird, steht unten bei `wkrSprachen`.
  // Ebenso `pokalStand` (eigene Zeitpunkte der Mannschaftswertung): Ihr Zeitpunkt ist jetzt der
  // jüngste der Gesamtlisten (lib/listenStand.ts `wertungZeit`).
  // `gespeichert` ist die Speichermarke (persistenz/storage.ts): Sie gehört zum Speichern, nicht zum Stand.
  const {
    listenSprache: alteSprache,
    pokalStand: _pokalStand,
    gespeichert: _gespeichert,
    ...uebernommen
  } = loaded as Partial<AppState> & { listenSprache?: unknown; pokalStand?: unknown; gespeichert?: unknown }
  const regelwerk = regelwerkOf(loaded.regelwerk ?? '').id
  return {
    ...base,
    ...uebernommen,
    schemaVersion: SCHEMA_VERSION,
    starters,
    // Fehlen in Ständen vor der Erfassung. Werte von Startern, die es nicht (mehr) gibt, entfallen.
    eingaben: nurStarter(normalisiereEingaben(loaded.eingaben), new Set(starters.map((p) => p.id))),
    streichlaeufe: streichlaeufeWert(loaded.streichlaeufe),
    laufCount: Math.max(1, Math.min(9, Math.round(Number(loaded.laufCount)) || base.laufCount)),
    parcoursList,
    boats: { ...base.boats, ...loaded.boats },
    // Kennungen, die es nicht (mehr) gibt, fallen auf die Vorgabe zurück.
    regelwerk: regelwerkOf(loaded.regelwerk ?? '').id,
    eigeneAufbauten,
    // Auch ein eigener, den die Fachprüfung ablehnt, ist nicht wählbar (config/catalog.ts).
    aufbau: aufbauOf(loaded.aufbau ?? '', eigeneAufbauten).id,
    sollgewicht: ownWeights(loaded.sollgewicht, regelwerkOf(loaded.regelwerk ?? '').gewichte),
    verzahnungLocked: loaded.verzahnungLocked === true,
    showBirthdate: loaded.showBirthdate !== false,
    // Stände vor den Flaggen kennen nur „kurz“ und „lang“ – beide gelten weiter; Unbekanntes wird die Vorgabe.
    listOrigin: istOriginStyle(loaded.listOrigin) ? loaded.listOrigin : 'lang',
    originShort: { ...loaded.originShort },
    // Fehlt in Ständen vor der WKR-Einteilung; Unbrauchbares entfällt – auch Namen zu
    // Parcours, die es nicht (mehr) gibt.
    einteilung: normalisiereEinteilung(
      loaded.einteilung,
      parcoursList.map((p) => p?.id).filter((id): id is string => typeof id === 'string'),
    ),
    // Fehlen in Ständen vor dem Block „Besetzung“; Unbrauchbares entfällt.
    boote: normalisiereBesetzung(loaded.boote),
    coPiloten: normalisiereBesetzung(loaded.coPiloten),
    // Fehlen in Ständen vor den Wettkampfrichter-Listen.
    wkrLeerzeilen: leerzeilenZahl(loaded.wkrLeerzeilen) ?? base.wkrLeerzeilen,
    wkrLeerzeilenKlasse: eigeneLeerzeilen(loaded.wkrLeerzeilenKlasse, leerzeilenZahl(loaded.wkrLeerzeilen) ?? base.wkrLeerzeilen),
    // Fehlt in Ständen vor den geteilten Leerzeilen: Dann gilt die Vorgabe (drei je Seite).
    wkrLeerzeilenSeite: leerzeilenZahl(loaded.wkrLeerzeilenSeite) ?? base.wkrLeerzeilenSeite,
    wkrRueckseite: loaded.wkrRueckseite === true,
    // Vorgabe an: Wirkt ohnehin nur bei der Clubmeisterschaft, und dort ist Papier sparen das Übliche.
    wkrClubGemeinsam: loaded.wkrClubGemeinsam !== false,
    ergebnisListen: {
      aushang: {
        namen: (['voll', 'kurz', 'ohne'] as const).find((n) => n === loaded.ergebnisListen?.aushang?.namen) ?? base.ergebnisListen.aushang.namen,
        herkunft: ergebnisHerkunft(loaded.ergebnisListen?.aushang?.herkunft) ?? base.ergebnisListen.aushang.herkunft,
      },
      intern: { herkunft: ergebnisHerkunft(loaded.ergebnisListen?.intern?.herkunft) ?? base.ergebnisListen.intern.herkunft },
    },
    // Fehlt in Ständen vor den QR-Codes; der Store vergibt dann eine.
    kennung: istKennung(loaded.kennung) ? loaded.kennung : '',
    // Fehlt in Ständen vor dem Zeitpunkt auf den Ergebnislisten: Dann ist er unbekannt, und
    // die Listen zeigen keinen (lib/listenStand.ts) – bis zu ihrer nächsten Änderung.
    listenStand: listenStandVon(loaded.listenStand),
    // Fehlt in Ständen vor dieser Angabe; ohne Starter gibt es kein Beispiel-Starterfeld.
    beispielStarter: loaded.beispielStarter === true && starters.length > 0,
    // Fehlen in Ständen vor diesen Listenoptionen: automatische Aufteilung, R/L, Sprache der Oberfläche.
    wkrZeilenJeSeite: zeilenJeSeiteZahl(loaded.wkrZeilenJeSeite),
    wkrTeilenAb: teilenAbZahl(loaded.wkrTeilenAb),
    beschriftung: beschriftungOf(loaded.beschriftung),
    wkrSprachen: loaded.wkrSprachen === undefined ? alteWkrSprachen(alteSprache, regelwerk, eigeneAufbauten, optionen.oberflaeche) : wkrSprachenWert(loaded.wkrSprachen),
    // Fehlen in Ständen vor diesen Optionen: getrennte Listen, die Vorgabe des Regelwerks
    // (damit die Knoten-Liste), Laufzettel mit einer Zeile je Seite.
    tor5MitParcours: loaded.tor5MitParcours === true,
    zusatzListen: normalisiereZusatzListen(loaded.zusatzListen),
    laufzettelLayout: laufzettelLayoutWert(loaded.laufzettelLayout),
    // Fehlt in Ständen vor der Pokalauswertung: Dann gilt die Vorgabe des Regelwerks, alle Starter zählen.
    pokal: pokalWert(loaded.pokal),
    startNrMode: loaded.startNrMode === 'klassisch' ? 'klassisch' : 'klasse',
    // `enabled` stammt aus dem Prototyp (Nummern als Zusatz); hier gibt es nur eine Art je Veranstaltung.
    runningNumbers: { ...base.runningNumbers, ...loaded.runningNumbers, enabled: false },
  }
}

/**
 * Stände aus der Zeit der einen „Sprache der Listen“ (wie die Oberfläche, deutsch, englisch,
 * zweisprachig): Die übrigen Listen folgen jetzt dem Regelwerk – dafür braucht es nichts. Für
 * die Wettkampfrichter-Bögen galt eine feste Wahl bisher für alle Listen; sie bleibt, je Liste
 * eingetragen, damit schon gedruckte und noch zu druckende Bögen dieselbe Sprache haben. „Wie
 * die Oberfläche“ (die frühere Vorgabe, auch wenn das Feld ganz fehlt) gibt es nicht mehr:
 * Kennt der Aufrufer die Sprache der Oberfläche, wird SIE je Liste eingetragen – wer unter UIM
 * deutsch bedient hat, druckte deutsche Bögen und soll nach dem Update nicht stillschweigend
 * englische bekommen. Ist sie unbekannt, gilt die Sprache des Regelwerks. Unter einem
 * Regelwerk ohne Englisch wirkte die Wahl nie – sie wird nicht übernommen.
 */
function alteWkrSprachen(alt: unknown, regelwerk: string, eigeneAufbauten: readonly RawAufbau[], oberflaeche?: string): AppState['wkrSprachen'] {
  if (!bietetEnglisch(regelwerk)) return {}
  const wieOberflaeche = alt === 'ui' || alt === undefined
  const sprache = isSprache(alt) ? alt : wieOberflaeche && isSprache(oberflaeche) ? oberflaeche : undefined
  // Was der Vorgabe des Regelwerks entspricht, wird nicht eingetragen und folgt ihm weiter.
  if (!sprache || (wieOberflaeche && sprache === regelwerkSprache(regelwerk))) return {}
  return Object.fromEntries(configFor({ regelwerk, eigeneAufbauten }).getPositions().map((p) => [p.typeId, sprache]))
}

/**
 * Hat der Eintrag die Gestalt eines eigenen Aufbaus? Geprüft wird hier nur die Form, damit
 * eine Sicherung nichts verliert: Was die Fachprüfung ablehnt, bleibt gespeichert, gilt aber
 * nicht (`eigeneAuswahl` in config/konfig.ts) – die Einstellungen nennen es mit dem Grund.
 */
function isAufbau(value: unknown): value is RawAufbau {
  if (!value || typeof value !== 'object') return false
  const a = value as Partial<RawAufbau>
  return (
    typeof a.id === 'string' &&
    ID_MUSTER.test(a.id) &&
    typeof a.name === 'string' &&
    Array.isArray(a.positionen) &&
    a.positionen.every((p) => typeof p === 'string' || (!!p && typeof p === 'object' && typeof p.id === 'string'))
  )
}

/** Nur Einträge mit Prüfsumme; ein unbrauchbarer Zeitpunkt entfällt (die Liste zeigt dann keinen). */
function listenStandVon(loaded: unknown): AppState['listenStand'] {
  if (!loaded || typeof loaded !== 'object' || Array.isArray(loaded)) return {}
  const stand: AppState['listenStand'] = {}
  for (const [schluessel, eintrag] of Object.entries(loaded as Record<string, unknown>)) {
    const e = eintrag as { inhalt?: unknown; zeit?: unknown } | null
    if (!e || typeof e.inhalt !== 'number' || !Number.isFinite(e.inhalt)) continue
    stand[schluessel] = typeof e.zeit === 'number' && Number.isFinite(e.zeit) && e.zeit > 0 ? { inhalt: e.inhalt, zeit: e.zeit } : { inhalt: e.inhalt }
  }
  return stand
}

/** Nur behalten, was vom Regelwerk abweicht – der Rest folgt dem Regelwerk, auch wenn es wechselt. */
function ownWeights(
  loaded: AppState['sollgewicht'] | undefined,
  preset: AppState['sollgewicht'],
): AppState['sollgewicht'] {
  const own: AppState['sollgewicht'] = {}
  for (const [klasse, kg] of Object.entries(loaded ?? {}) as [keyof AppState['sollgewicht'], number][]) {
    if (typeof kg === 'number' && kg > 0 && kg !== preset[klasse]) own[klasse] = kg
  }
  return own
}

/** Nur die Klassen, deren Zahl brauchbar ist und von der allgemeinen abweicht. */
function eigeneLeerzeilen(loaded: unknown, allgemein: number): AppState['wkrLeerzeilenKlasse'] {
  if (!loaded || typeof loaded !== 'object' || Array.isArray(loaded)) return {}
  const eigene: AppState['wkrLeerzeilenKlasse'] = {}
  for (const [klasse, n] of Object.entries(loaded)) {
    const anzahl = leerzeilenZahl(n)
    if (CLASS_IDS.includes(klasse as ClassId) && anzahl !== undefined && anzahl !== allgemein) eigene[klasse as ClassId] = anzahl
  }
  return eigene
}

function normalizeStarter(s: Starter): Starter {
  return {
    id: String(s.id),
    startNr: s.startNr ?? '',
    vorname: s.vorname ?? '',
    nachname: s.nachname ?? '',
    verein: s.verein ?? '',
    bundesland: s.bundesland ?? '',
    ...(typeof s.land === 'string' && s.land.trim() ? { land: s.land } : {}),
    geburtsdatum: s.geburtsdatum ?? '',
    klasse: s.klasse,
    groesse: s.groesse ?? '',
    ...(typeof s.gewicht === 'number' && s.gewicht > 0 ? { gewicht: s.gewicht } : {}),
    // Nur die Abwahl steht im Stand; alles andere heißt „zählt für die Pokalauswertung“.
    ...(s.pokal === false ? { pokal: false as const } : {}),
  }
}

/**
 * Stand des Verzahnungs-Prototyps (`verzahnung-prototyp:v1`) übernehmen. Der
 * Prototyp nannte die Starter `participants`; alles Übrige passt.
 */
export function fromVerzahnungPrototyp(raw: unknown, optionen: { oberflaeche?: string } = {}): AppState | null {
  if (!raw || typeof raw !== 'object') return null
  const old = raw as Record<string, unknown>
  if (!Array.isArray(old.participants)) return null
  const { participants, initialized: _initialized, originMode, ...rest } = old
  const origin: OriginMode = originMode === 'bundesland' ? 'bundesland' : 'verein'
  return migrate({ ...rest, originMode: origin, starters: participants }, optionen)
}
