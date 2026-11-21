import type { AppState, Betrieb, Starter } from '../types'
import { migrate } from '../state/migrate'
import { aufbauOf, hasParallel, PARALLEL } from '../config/catalog'
import { mitVorlaufPlan, VORLAUF, vorlaufGebunden } from '../planung/parallelRunden'
import { haengeUm } from '../lib/einteilung'
import { mitTor5Umzug } from '../state/tor5'
import { ergaenzeAbmeldungen } from '../lib/abmeldung'
import { configFor } from '../config/konfig'
import { starterfeldFest } from '../lib/eingaben'

/**
 * Dateien zum Aufheben und Weitergeben. Weil alle Daten nur in diesem Browser
 * liegen, ist eine Datei der einzige Weg, einen Stand aufzuheben oder auf einen
 * anderen Rechner zu bringen. Es gibt drei Arten:
 *
 * - `sicherung`: der gesamte Stand der Veranstaltung.
 * - `vorlage`: nur die Einstellungen – ohne Starter, Name, Jahr, WKR-Einteilung, Co-Piloten,
 *   erfasste Werte, „Disziplin nicht werten“, festgeschriebene Pläne des Parallelslaloms, den Stand der Wertungslisten und Pokalauswertungen, die Kennung der
 *   Veranstaltung und die Angabe, ob das Starterfeld aus Beispieldaten stammt (sie gehört zu
 *   den Startern). Die Einstellungen der Pokalauswertung (Varianten, Punkte, „nur ausgewählte
 *   Starter“) sind dabei; welche Starter gewählt sind, steht an den Startern und damit nicht.
 *   Damit beginnt die nächste Veranstaltung so, wie man es gewohnt ist. Eine Vorlage
 *   wird weitergegeben und enthält deshalb keine Personennamen, auch nicht die der
 *   Wettkampfrichter und der Co-Piloten. Die Boote je Klasse sind keine Personenangabe und
 *   reisen mit. Ebenso die Logos der Listen (Einstellung des Ausrichters, keine Personendaten,
 *   16.11.2026); ein Logo, das der Vorlage fehlt, lässt das hiesige stehen. Der Betrieb am
 *   Wettkampftag (`betrieb`: begonnene Läufe, gezeigte Starts) gehört zur Veranstaltung und bleibt
 *   draußen; die Einstellungen der Anzeigetafel reisen mit, nur ohne Kopfzeile (16.11.2026). Ebenso bleibt die
 *   digitale WKR-Erfassung (`wkr`: Modus/Status der Listen, Rückfragen, Vorschläge, Abschlüsse mit den Namen der
 *   Wettkampfrichter) draußen – sie gehört zu dieser Veranstaltung und ihren Startern (W1, 21.11.2026).
 * - `starter`: nur die Teilnehmerdaten.
 */
export type FileKind = 'sicherung' | 'vorlage' | 'starter'

/**
 * Einstellungen einer Vorlage: alles außer Startern, Name, Jahr, WKR-Einteilung, Co-Piloten, erfassten
 * Werten, dem Stand der Wertungslisten, der Kennung und dem Betrieb der Veranstaltung.
 */
export type Template = Omit<AppState, 'starters' | 'eventName' | 'eventJahr' | 'einteilung' | 'coPiloten' | 'eingaben' | 'abgemeldet' | 'abgemeldetBis' | 'listenStand' | 'kennung' | 'beispielStarter' | 'parallelPlaene' | 'parallelGedruckt' | 'nichtWerten' | 'betrieb' | 'wkr'>

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
  // Ebenso der Stand der Wertungslisten. Die Kennung der Veranstaltung bleibt hier: Mit einer
  // Vorlage beginnt eine andere Veranstaltung, deren Bögen sich von diesen unterscheiden müssen.
  // Die festgeschriebenen Pläne des Parallelslaloms nennen Starter (ihre IDs) und bleiben ebenfalls hier.
  // „Disziplin nicht werten“ ist eine Entscheidung zu den Ergebnissen dieser Veranstaltung: ebenfalls nicht.
  // Der Betrieb (was auf der Anzeigetafel stand) ebenso; die Kopfzeile der Anzeigetafel nennt die Veranstaltung.
  // Die digitale WKR-Erfassung (Rückfragen, Abschlüsse mit Namen der Wettkampfrichter) gehört zur Veranstaltung.
  const { starters: _starters, eventName: _name, eventJahr: _jahr, einteilung: _wkr, coPiloten: _coPiloten, eingaben: _eingaben, abgemeldet: _abgemeldet, abgemeldetBis: _abgemeldetBis, listenStand: _stand, kennung: _kennung, beispielStarter: _beispiel, parallelPlaene: _plaene, parallelGedruckt: _gedruckt, nichtWerten: _nichtWerten, betrieb: _betrieb, wkr: _erfassung, ...rest } = state
  const settings: Template = { ...rest, anzeige: { ...rest.anzeige, kopfzeile: null } }
  return { ...base, kind, settings }
}

export type ParsedFile =
  | { ok: true; kind: 'sicherung'; state: AppState; savedAt: string | null }
  /**
   * `apply` setzt die Einstellungen auf einen Stand – Starter, Name, Jahr, WKR-Einteilung, Co-Piloten und eigene Aufbauten bleiben.
   * Die Logos reisen mit (keine Personendaten); ein Logo, das der Vorlage fehlt, lässt das hiesige stehen.
   */
  | { ok: true; kind: 'vorlage'; apply: (current: AppState) => AppState; savedAt: string | null }
  | { ok: true; kind: 'starter'; starters: Starter[]; savedAt: string | null }
  | { ok: false }

/** `optionen.oberflaeche`: die Sprache der Oberfläche – nur für alte Dateien (state/migrate.ts). */
export function parseFile(text: string, optionen: { oberflaeche?: string } = {}): ParsedFile {
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
    const state = migrate(file.state, optionen)
    return state ? { ok: true, kind, state, savedAt } : { ok: false }
  }
  if (kind === 'starter') {
    const state = migrate({ starters: file.starters })
    return state ? { ok: true, kind, starters: state.starters, savedAt } : { ok: false }
  }
  if (kind === 'vorlage' && file.settings && typeof file.settings === 'object') {
    const settings = file.settings as Partial<AppState>
    // Über `migrate`, damit auch eine ältere Vorlage vollständige, gültige Einstellungen ergibt.
    const checked = migrate({ ...settings, starters: [] }, optionen)
    if (!checked) return { ok: false }
    const apply = (current: AppState): AppState => {
      // Eigene Aufbauten sind erarbeitet, keine bloße Einstellung: Die der Vorlage kommen
      // dazu (bei gleicher Kennung gilt die Vorlage), die vorhandenen bleiben. Sonst löschte
      // eine Vorlage ohne eigene Aufbauten stillschweigend alle, die es hier gibt.
      const ausVorlage = new Set(checked.eigeneAufbauten.map((a) => a.id))
      const eigeneAufbauten = [...checked.eigeneAufbauten, ...current.eigeneAufbauten.filter((a) => !ausVorlage.has(a.id))]
      // Bleibt der hiesige feste Plan des Vorlaufs stehen (hier festgeschrieben, und die Vorlage
      // bringt die Sperre mit), bleiben auch die Schalter, nach denen er gerechnet wurde. Sonst
      // stünde „Strenge Klassentrennung“ aus über einem streng gepaarten Plan, und ein anderes
      // `class4Small` meldete Klassenwechsel, die es nicht gab. Im Reducer sind genau diese drei
      // bei gesetzter Sperre gesperrt (VERZAHNUNG_ACTIONS) – die Vorlage soll daran nicht vorbeiführen.
      // Ebenso, wenn der Plan an erfasste Werte gebunden ist: Er bleibt dann auch ohne Sperre
      // (`vorlaufGebunden`), und der Reducer sperrt die drei Schalter (PLAN_ACTIONS).
      const planBleibt = current.parallelPlaene[VORLAUF] !== undefined && (checked.verzahnungLocked || vorlaufGebunden(current))
      const planSchalter: Pick<AppState, 'parallelStreng' | 'class4Small' | 'parallelOrderByStartNr'> = planBleibt
        ? { parallelStreng: current.parallelStreng, class4Small: current.class4Small, parallelOrderByStartNr: current.parallelOrderByStartNr }
        : { parallelStreng: checked.parallelStreng, class4Small: checked.class4Small, parallelOrderByStartNr: checked.parallelOrderByStartNr }
      const mitVorlage: AppState = {
        ...checked,
        ...planSchalter,
        eigeneAufbauten,
        // Je Seite gilt das Logo der Vorlage; bringt sie keins mit (etwa eine Vorlage von vor den Logos), bleibt das hiesige –
        // sonst löschte sie es stillschweigend. Entfernen geht nur ausdrücklich (Einstellungen).
        logos: { links: checked.logos.links ?? current.logos.links, rechts: checked.logos.rechts ?? current.logos.rechts },
        // Die Wahl der Vorlage gilt – auch wenn sie auf einen eigenen Aufbau zeigt, den nur
        // diese Veranstaltung hat (die Migration der Vorlage allein kennt ihn nicht).
        aufbau: aufbauOf(typeof settings.aufbau === 'string' ? settings.aufbau : '', eigeneAufbauten).id,
        starters: current.starters,
        beispielStarter: current.beispielStarter,
        eventName: current.eventName,
        eventJahr: current.eventJahr,
        // Ergebnisse bleiben bei ihren Startern – auch eine von Hand ergänzte Vorlage bringt keine mit.
        eingaben: current.eingaben,
        abgemeldet: current.abgemeldet,
        abgemeldetBis: current.abgemeldetBis,
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
        // Ebenso die Co-Piloten: Sie hängen an der Klasse, nicht am Parcours – die hiesigen bleiben.
        coPiloten: current.coPiloten,
        // Festgeschriebene Pläne des Parallelslaloms hängen an den hiesigen Startern: Sie bleiben.
        parallelPlaene: current.parallelPlaene,
        // Ebenso, welche ihrer Runden gedruckt sind (20.11.2026).
        parallelGedruckt: current.parallelGedruckt,
        // „Disziplin nicht werten“ gehört zu den hiesigen Ergebnissen.
        nichtWerten: current.nichtWerten,
        // Der Betrieb gehört zur Veranstaltung: Er bleibt, hängt aber wie die Einteilung auf die Parcours
        // der Vorlage um (Parcours 1 bleibt Parcours 1). Die gezeigten Starts nennen Starter und Lauf –
        // sie gelten weiter, die Folge wird neu abgeleitet. Der Parallelslalom hängt an keinem Parcours.
        betrieb: betriebUmgehaengt(current, checked.parcoursList.map((p) => p.id)),
        // Die digitale WKR-Erfassung gehört zur Veranstaltung (Rückfragen, Abschlüsse mit Namen): Sie bleibt.
        wkr: current.wkr,
        // Die Kopfzeile der Anzeigetafel nennt die Veranstaltung: Es bleibt die hiesige.
        anzeige: { ...checked.anzeige, kopfzeile: current.anzeige.kopfzeile },
        // Sind Ergebnisse erfasst, bleibt das Regelwerk (wie im Reducer, SET_REGELWERK): Die
        // Werte hängen an seinen Listen und Feldern.
        ...(starterfeldFest(current) ? { regelwerk: current.regelwerk } : {}),
      }
      // Bringt die Vorlage „Tor 5 übernimmt die Parcoursüberwachung“ oder einen anderen Aufbau
      // mit, wechselt die Liste für Tor 5: Die hiesigen Eingaben und Namen ziehen mit, sonst
      // stünden sie als „verborgen“ an einer Liste, die es nicht mehr gibt.
      // Bringt die Vorlage die Sperre der Verzahnung mit, wird der Plan des Vorlaufs festgeschrieben
      // (ein schon fester bleibt); ohne Sperre entfällt er (planung/parallelRunden.ts).
      const umgezogen = mitTor5Umzug(current, mitVorlaufPlan(mitVorlage, hasParallel(mitVorlage.regelwerk)))
      // Bringt die Vorlage mehr Läufe mit, bekommen Abgemeldete das X auch dort – wie bei der
      // Einstellung selbst (state/reducer.ts); sonst stünden sie im neuen Lauf still „offen“.
      const konfig = (s: AppState) => configFor({ regelwerk: s.regelwerk, eigeneAufbauten: s.eigeneAufbauten })
      return ergaenzeAbmeldungen(current, umgezogen, konfig(current), konfig(umgezogen))
    }
    return { ok: true, kind, apply, savedAt }
  }
  return { ok: false }
}

/** Der Betrieb nach dem Wechsel der Parcours: je Parcours umgehängt wie die Einteilung (lib/einteilung.ts `haengeUm`). */
function betriebUmgehaengt(current: AppState, neu: readonly string[]): Betrieb {
  const { [PARALLEL]: parallel, ...jeParcours } = current.betrieb.bereiche
  const bereiche = haengeUm(jeParcours, current.parcoursList.map((p) => p.id), neu)
  return { bereiche: parallel ? { ...bereiche, [PARALLEL]: parallel } : bereiche }
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
