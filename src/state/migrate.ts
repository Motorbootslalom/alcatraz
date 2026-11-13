import type { AppState, ClassId, OriginMode, Starter } from '../types'
import { CLASS_IDS } from '../domain/classes'
import { SCHEMA_VERSION } from '../types'
import { emptyState, leerzeilenZahl, streichlaeufeWert } from './reducer'
import { aufbauOf, regelwerkOf } from '../config/catalog'
import { ID_MUSTER } from '../config/eigene'
import type { RawAufbau } from '../config/schema'
import { normalisiereEinteilung } from '../lib/einteilung'
import { normalisiereEingaben, nurStarter } from '../lib/eingaben'

/**
 * Einen gelesenen Stand (localStorage, Sicherungsdatei) auf die aktuelle Fassung
 * bringen. Unbekanntes oder Kaputtes ergibt `null` – dann beginnt die
 * Anwendung leer, statt mit halben Daten zu rechnen.
 *
 * Neue Fassungen bekommen hier einen Schritt `if (version < n) { … }`; die
 * Schritte laufen der Reihe nach, sodass auch alte Sicherungen lesbar bleiben.
 */
export function migrate(raw: unknown): AppState | null {
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
  return {
    ...base,
    ...loaded,
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
    listOrigin: loaded.listOrigin === 'kurz' ? 'kurz' : 'lang',
    originShort: { ...loaded.originShort },
    // Fehlt in Ständen vor der WKR-Einteilung; Unbrauchbares entfällt – auch Namen zu
    // Parcours, die es nicht (mehr) gibt.
    einteilung: normalisiereEinteilung(
      loaded.einteilung,
      parcoursList.map((p) => p?.id).filter((id): id is string => typeof id === 'string'),
    ),
    // Fehlen in Ständen vor den Wettkampfrichter-Listen.
    wkrLeerzeilen: leerzeilenZahl(loaded.wkrLeerzeilen) ?? base.wkrLeerzeilen,
    wkrLeerzeilenKlasse: eigeneLeerzeilen(loaded.wkrLeerzeilenKlasse, leerzeilenZahl(loaded.wkrLeerzeilen) ?? base.wkrLeerzeilen),
    wkrRueckseite: loaded.wkrRueckseite === true,
    wkrClubGemeinsam: loaded.wkrClubGemeinsam === true,
    startNrMode: loaded.startNrMode === 'klassisch' ? 'klassisch' : 'klasse',
    // `enabled` stammt aus dem Prototyp (Nummern als Zusatz); hier gibt es nur eine Art je Veranstaltung.
    runningNumbers: { ...base.runningNumbers, ...loaded.runningNumbers, enabled: false },
  }
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
    geburtsdatum: s.geburtsdatum ?? '',
    klasse: s.klasse,
    groesse: s.groesse ?? '',
    ...(typeof s.gewicht === 'number' && s.gewicht > 0 ? { gewicht: s.gewicht } : {}),
  }
}

/**
 * Stand des Verzahnungs-Prototyps (`verzahnung-prototyp:v1`) übernehmen. Der
 * Prototyp nannte die Starter `participants`; alles Übrige passt.
 */
export function fromVerzahnungPrototyp(raw: unknown): AppState | null {
  if (!raw || typeof raw !== 'object') return null
  const old = raw as Record<string, unknown>
  if (!Array.isArray(old.participants)) return null
  const { participants, initialized: _initialized, originMode, ...rest } = old
  const origin: OriginMode = originMode === 'bundesland' ? 'bundesland' : 'verein'
  return migrate({ ...rest, originMode: origin, starters: participants })
}
