import type { AppState, Starter } from '../types'
import { migrate } from '../state/migrate'
import { aufbauOf } from '../config/catalog'
import { haengeUm } from '../lib/einteilung'
import { mitTor5Umzug } from '../state/tor5'

/**
 * Dateien zum Aufheben und Weitergeben. Weil alle Daten nur in diesem Browser
 * liegen, ist eine Datei der einzige Weg, einen Stand aufzuheben oder auf einen
 * anderen Rechner zu bringen. Es gibt drei Arten:
 *
 * - `sicherung`: der gesamte Stand der Veranstaltung.
 * - `vorlage`: nur die Einstellungen – ohne Starter, Name, Jahr, WKR-Einteilung,
 *   erfasste Werte, den Stand der Ergebnislisten, die Kennung der Veranstaltung und die
 *   Angabe, ob das Starterfeld aus Beispieldaten stammt (sie gehört zu den Startern).
 *   Damit beginnt die nächste Veranstaltung so, wie man es gewohnt ist. Eine Vorlage
 *   wird weitergegeben und enthält deshalb keine Personennamen, auch nicht die der
 *   Wettkampfrichter.
 * - `starter`: nur die Teilnehmerdaten.
 */
export type FileKind = 'sicherung' | 'vorlage' | 'starter'

/**
 * Einstellungen einer Vorlage: alles außer Startern, Name, Jahr, WKR-Einteilung, erfassten
 * Werten, dem Stand der Ergebnislisten und der Kennung der Veranstaltung.
 */
export type Template = Omit<AppState, 'starters' | 'eventName' | 'eventJahr' | 'einteilung' | 'eingaben' | 'listenStand' | 'kennung' | 'beispielStarter'>

interface FileBase {
  app: 'alcatraz'
  version: 1
  savedAt: string
}

export type AlcatrazFile =
  | (FileBase & { kind: 'sicherung'; state: AppState })
  | (FileBase & { kind: 'vorlage'; settings: Template })
  | (FileBase & { kind: 'starter'; starters: Starter[] })

export function makeFile(kind: FileKind, state: AppState, savedAt: string): AlcatrazFile {
  const base: FileBase = { app: 'alcatraz', version: 1, savedAt }
  if (kind === 'sicherung') return { ...base, kind, state }
  if (kind === 'starter') return { ...base, kind, starters: state.starters }
  // Die erfassten Werte gehören zu den Startern dieser Veranstaltung (sie hängen an deren IDs).
  // Ebenso der Stand der Ergebnislisten. Die Kennung der Veranstaltung bleibt hier: Mit einer
  // Vorlage beginnt eine andere Veranstaltung, deren Bögen sich von diesen unterscheiden müssen.
  const { starters: _starters, eventName: _name, eventJahr: _jahr, einteilung: _wkr, eingaben: _eingaben, listenStand: _stand, kennung: _kennung, beispielStarter: _beispiel, ...settings } = state
  return { ...base, kind, settings }
}

export type ParsedFile =
  | { ok: true; kind: 'sicherung'; state: AppState; savedAt: string | null }
  /** `apply` setzt die Einstellungen auf einen Stand – Starter, Name, Jahr, WKR-Einteilung und eigene Aufbauten bleiben. */
  | { ok: true; kind: 'vorlage'; apply: (current: AppState) => AppState; savedAt: string | null }
  | { ok: true; kind: 'starter'; starters: Starter[]; savedAt: string | null }
  | { ok: false }

export function parseFile(text: string): ParsedFile {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false }
  }
  if (!parsed || typeof parsed !== 'object') return { ok: false }
  const file = parsed as Partial<FileBase> & { kind?: unknown; state?: unknown; settings?: unknown; starters?: unknown }
  if (file.app !== 'alcatraz') return { ok: false }
  const savedAt = typeof file.savedAt === 'string' ? file.savedAt : null
  // Dateien aus der Zeit vor den drei Arten sind Sicherungen.
  const kind = file.kind ?? 'sicherung'

  if (kind === 'sicherung') {
    const state = migrate(file.state)
    return state ? { ok: true, kind, state, savedAt } : { ok: false }
  }
  if (kind === 'starter') {
    const state = migrate({ starters: file.starters })
    return state ? { ok: true, kind, starters: state.starters, savedAt } : { ok: false }
  }
  if (kind === 'vorlage' && file.settings && typeof file.settings === 'object') {
    const settings = file.settings as Partial<AppState>
    // Über `migrate`, damit auch eine ältere Vorlage vollständige, gültige Einstellungen ergibt.
    const checked = migrate({ ...settings, starters: [] })
    if (!checked) return { ok: false }
    const apply = (current: AppState): AppState => {
      // Eigene Aufbauten sind erarbeitet, keine bloße Einstellung: Die der Vorlage kommen
      // dazu (bei gleicher Kennung gilt die Vorlage), die vorhandenen bleiben. Sonst löschte
      // eine Vorlage ohne eigene Aufbauten stillschweigend alle, die es hier gibt.
      const ausVorlage = new Set(checked.eigeneAufbauten.map((a) => a.id))
      const eigeneAufbauten = [...checked.eigeneAufbauten, ...current.eigeneAufbauten.filter((a) => !ausVorlage.has(a.id))]
      const mitVorlage: AppState = {
        ...checked,
        eigeneAufbauten,
        // Die Wahl der Vorlage gilt – auch wenn sie auf einen eigenen Aufbau zeigt, den nur
        // diese Veranstaltung hat (die Migration der Vorlage allein kennt ihn nicht).
        aufbau: aufbauOf(typeof settings.aufbau === 'string' ? settings.aufbau : '', eigeneAufbauten).id,
        starters: current.starters,
        beispielStarter: current.beispielStarter,
        eventName: current.eventName,
        eventJahr: current.eventJahr,
        // Ergebnisse bleiben bei ihren Startern – auch eine von Hand ergänzte Vorlage bringt keine mit.
        eingaben: current.eingaben,
        listenStand: current.listenStand,
        // Die Veranstaltung bleibt dieselbe; ihre gedruckten Bögen gelten weiter.
        kennung: current.kennung,
        // Auch aus einer von Hand ergänzten Vorlage kommen keine Namen: Es gelten die hiesigen.
        // Die Vorlage bringt aber ihre eigenen Parcours mit – die Namen ziehen der Stelle nach
        // auf deren Kennungen um, sonst hingen sie an Parcours, die es nicht mehr gibt.
        einteilung: haengeUm(
          current.einteilung,
          current.parcoursList.map((p) => p.id),
          checked.parcoursList.map((p) => p.id),
        ),
      }
      // Bringt die Vorlage „Tor 5 übernimmt die Parcoursüberwachung“ oder einen anderen Aufbau
      // mit, wechselt die Liste für Tor 5: Die hiesigen Eingaben und Namen ziehen mit, sonst
      // stünden sie als „verborgen“ an einer Liste, die es nicht mehr gibt.
      return mitTor5Umzug(current, mitVorlage)
    }
    return { ok: true, kind, apply, savedAt }
  }
  return { ok: false }
}

/** Text → Teil eines Dateinamens: klein, ohne Umlaute und Sonderzeichen. */
export function slug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Zeitpunkt für Dateinamen in Ortszeit, z. B. `2026-11-11_2315`. */
export function fileStamp(date: Date): string {
  const two = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}_${two(date.getHours())}${two(date.getMinutes())}`
}

/**
 * Dateiname, z. B. `alcatraz-sicherung-moewepokal-2026-2026-11-11_2315.json`.
 * `label` ist die Art in der Sprache der Oberfläche („sicherung“ / „backup“) –
 * wer englisch arbeitet, bekommt englische Dateinamen.
 */
export function filename(kind: FileKind, label: string, state: AppState, date: Date): string {
  const event = kind === 'vorlage' ? '' : `${state.eventName} ${state.eventJahr}`
  return ['alcatraz', slug(label), slug(event), fileStamp(date)].filter(Boolean).join('-') + '.json'
}

/** Text als Datei herunterladen – ohne Server, direkt aus dem Browser. */
export function downloadText(name: string, text: string, type = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
