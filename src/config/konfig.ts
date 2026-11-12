import { load as yamlLoad } from 'js-yaml'
import type { DisqDef, SheetDef, Sprache } from '../types'
import {
  buildConfig,
  regelwerkInfo,
  type BeschriftungScheme,
  type LegendeModel,
  type RegelwerkInfo,
  type ResolvedAufbau,
  type ResolvedConfig,
} from './build'
import type { RawAufbau, RawConfig, RawDisziplin, RawPositionen, RawQuelle, RawRegelwerk, RawRegelwerkListe } from './schema'
import { aufloesen } from './kurzform'
import {
  aufbauYaml,
  brauchbareEigene,
  defektMeldung,
  mitEigenen,
  pruefeEigene,
  verdeckteEigene,
  type Abgelehnt,
  type EigeneAuswahl,
  type Pruefung,
} from './eigene'
import { ueberwachungsLuecken, type UeberwachungsLuecke } from './validate'
import type { BogenTexte } from './sprache'
import { mergePositionen, quellDateien } from './merge-positionen'
import regelwerkListe from './regelwerke.yaml?raw'
import aufbauListe from './aufbauten.yaml?raw'

/**
 * Die Konfiguration der Wettkampfrichter-Listen: Regelwerke, Aufbauten, Positionen.
 *
 * Im Fehlerpunkte-Prototyp war sie ein veränderlicher Modulzustand (`config/active.ts`:
 * applyRegelwerk, applySprache, applyBeschriftung, setzeEigeneAufbauten), den jede
 * Ansicht nach einem Wechsel von Hand neu lesen musste. Hier ist sie eine **reine
 * Funktion** der Auswahl: {@link configFor} liefert zu Regelwerk, Sprache,
 * Beschriftung und eigenen Aufbauten immer dieselbe aufgelöste Konfiguration. So
 * hängt sie als `computed` am Stand der Veranstaltung (lib/konfig.ts), und zwei
 * Fenster oder zwei Tests kommen sich nicht in die Quere.
 *
 * Die YAML-Dateien dieses Ordners werden beim Bauen eingebunden und beim Modulstart
 * einmal zusammengeführt (im Prototyp tat das `scripts/sync-config.ts` zur Buildzeit
 * und `load.ts` per fetch). Nichts wird zur Laufzeit nachgeladen.
 */

/** Ein Regelwerk, wie es in der Datei steht; `disziplinen` gibt es nur hier (siehe catalog.ts). */
export type RohRegelwerk = RawRegelwerk & { disziplinen?: string[]; gewichte?: Record<string, number> }

const dateien = (found: Record<string, string>) =>
  new Map(Object.entries(found).map(([pfad, text]) => [pfad.replace(/^\.\/|\.yaml$/g, ''), text]))

const regelwerkDateien = dateien(
  import.meta.glob<string>('./regelwerke/*.yaml', { query: '?raw', import: 'default', eager: true }),
)
const positionsDateien = dateien(
  import.meta.glob<string>(['./einstellungen.yaml', './i18n/*.yaml', './aufbauten/*.yaml'], {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
)

/** Friert tief ein: Was alle Konfigurationen teilen, darf keine von ihnen verändern. */
function eingefroren<T>(wert: T): T {
  if (wert && typeof wert === 'object' && !Object.isFrozen(wert)) {
    Object.freeze(wert)
    for (const teil of Object.values(wert)) eingefroren(teil)
  }
  return wert
}

/** Die Regelwerke in Menü-Reihenfolge, wie sie in den Dateien stehen; das erste ist die Vorgabe. */
export const ROH_REGELWERKE: readonly RohRegelwerk[] = eingefroren(
  (((yamlLoad(regelwerkListe) as RawRegelwerkListe) ?? {}).regelwerke ?? []).map((id) => {
    const roh = yamlLoad(regelwerkDateien.get(`regelwerke/${id}`) ?? '') as RohRegelwerk | undefined
    if (!roh || roh.id !== id) throw new Error(`Regelwerk ${id}: Datei fehlt oder trägt eine andere id`)
    return roh
  }),
)

/** Die mitgelieferten Positionsdateien, zusammengeführt: Vorlagen für den Assistenten. */
export const ROH_QUELLE: RawQuelle = eingefroren(
  mergePositionen(
    quellDateien(aufbauListe).map((name) => {
      // Wie bei den Regelwerken: Eine genannte, aber fehlende Datei ist ein Fehler beim Bauen
      // und kein stilles Weglassen ihrer Aufbauten (im Prototyp meldete das `config:check`).
      const text = positionsDateien.get(name)
      if (text === undefined) throw new Error(`Positionsdatei ${name}.yaml fehlt (genannt in aufbauten.yaml)`)
      return yamlLoad(text)
    }),
  ),
)

/** Kenndaten der Regelwerke in Menü-Reihenfolge. */
export const REGELWERK_INFOS: readonly RegelwerkInfo[] = ROH_REGELWERKE.map(regelwerkInfo)

/** Die ID, falls es das Regelwerk gibt, sonst die Vorgabe (z. B. alte Sicherung). */
export function resolveRegelwerkId(id: string | undefined): string {
  return ROH_REGELWERKE.some((r) => r.id === id) ? id! : (ROH_REGELWERKE[0]?.id ?? '')
}

/** Wovon die Konfiguration abhängt. Alles Fehlende bekommt die Vorgabe. */
export interface KonfigWahl {
  /** Kennung des Regelwerks; unbekannte fallen auf das erste zurück. */
  regelwerk?: string
  /** Sprache der Listen; wirkt nur, wenn das Regelwerk Englisch anbietet. */
  sprache?: Sprache
  /** Bezeichnungs-Schema der Bojen (z. B. `rl`, `ia`); unbekannte gelten als Vorgabe. */
  beschriftung?: string
  /** Eigene Aufbauten aus dem Stand der Veranstaltung. */
  eigeneAufbauten?: readonly RawAufbau[]
}

/**
 * Die aufgelöste Konfiguration zu einer Auswahl. Die Zugriffsfunktionen heißen wie im
 * Prototyp (`getSheetDef`, `getAufbau`, `aufbauOrder` …), hängen aber an diesem Ergebnis
 * statt an einem Modulzustand. Sie nutzen kein `this` und lassen sich herauslösen.
 */
export interface Konfig extends ResolvedConfig {
  /** Verfügbare Regelwerke in Menü-Reihenfolge. */
  regelwerke: readonly RegelwerkInfo[]
  /** Das gewählte Regelwerk, wie es in der Datei steht. */
  rohRegelwerk: RohRegelwerk
  /** Die Positionsdateien, wie sie mitgeliefert werden: Vorlagen für den Assistenten. */
  rohQuelle: RawQuelle
  /** Die eigenen Aufbauten dieser Auswahl, so wie sie gespeichert sind. */
  eigeneAufbauten: readonly RawAufbau[]
  /** Eigene Aufbauten, die es inzwischen mitgeliefert gibt (der mitgelieferte gilt). */
  verdeckteEigene: RawAufbau[]
  /**
   * Eigene Aufbauten, die die Prüfung nicht bestehen (z. B. aus einer beschädigten Sicherung),
   * je mit den Meldungen. Sie fehlen in der Konfiguration und in der Auswahl; die übrigen
   * gelten weiter.
   */
  abgelehnteEigene: readonly Abgelehnt[]
  /** Die Kursvarianten zur Auswahl. */
  kurse: Array<{ id: string; name: string }>

  getSheetDef(typeId: string): SheetDef
  getPositions(): SheetDef[]
  /** Gilt diese Position (das ganze Blatt) für diese Klasse – im Regelwerk und an der Position? */
  positionAllowsClass(typeId: string, klasse: string): boolean
  getAufbauten(): ResolvedAufbau[]
  defaultAufbauId(): string
  /** Aufbau nach ID (Rückfall: der erste). */
  getAufbau(id: string): ResolvedAufbau
  /** Positionen eines Aufbaus, wahlweise mit zusammengelegten Listen. */
  aufbauOrder(id: string, kombiAktiv: boolean): string[]
  /** Das Parcoursbild einer Klasse im Aufbau: die Datei der Kursvariante, sonst Klasse<k>. */
  bildDatei(aufbauId: string, klasse: string): string
  /** Disziplin nach ID; ohne Eintrag eine ohne Ergebnis-Spalten. */
  getDisziplin(id: string): RawDisziplin
  getRegelwerk(): RegelwerkInfo
  getRegelwerke(): readonly RegelwerkInfo[]
  getLegende(): LegendeModel
  getBogenTexte(): BogenTexte
  getBeschriftungen(): BeschriftungScheme[]
  defaultBeschriftungId(): string
  getLaufzettelConfig(): ResolvedConfig['laufzettel']
  getAllDisqs(): DisqDef[]
  /** Alle vergebenen IDs von Aufbauten und Positionen, auch die der eigenen – selbst der abgelehnten. */
  vergebeneIds(): Set<string>
  /** Was in einem Entwurf noch keine Liste beobachtet (Prüfung auf Lücken, je Klasse). */
  entwurfsLuecken(aufbau: RawAufbau): UeberwachungsLuecke[]
  /**
   * Prüft eigene Aufbauten aus einer Datei gegen das gewählte Regelwerk. `vorhanden` sind
   * die übrigen eigenen Aufbauten (Vorgabe: die brauchbaren dieser Auswahl – ein abgelehnter
   * darf die Prüfung eines neuen nicht zu Fall bringen).
   */
  pruefeEigeneAufbauten(eingabe: unknown, vorhanden?: readonly RawAufbau[]): Pruefung
  /** Ein Aufbau als YAML-Datei: eigene mit ihren Positionen, mitgelieferte mit Verweisen. */
  aufbauAlsYaml(id: string, kopf: { datum: string; version: string }): string | undefined
}

/**
 * Baut die Konfiguration aus einem Regelwerk und Positionen. Rein; für Tests und für
 * {@link configFor}. Die Schema-Tokens der Beschriftung überschreiben die globalen
 * `bezeichnungen`.
 */
export function baue(
  regelwerk: RawRegelwerk,
  positionen: RawPositionen,
  wahl: { sprache?: Sprache; beschriftung?: string } = {},
): ResolvedConfig {
  const scheme = positionen.beschriftungen?.find((b) => b.id === wahl.beschriftung)
  // `disziplinen` des Regelwerks (Kennungen) gehört nicht in die Listen-Konfiguration;
  // dort sind es die Disziplinen der Positionsdateien.
  const { disziplinen: _disziplinen, gewichte: _gewichte, ...ohneDisziplinen } = regelwerk as RohRegelwerk
  const raw: RawConfig = {
    ...ohneDisziplinen,
    ...positionen,
    bezeichnungen: { ...(positionen.bezeichnungen ?? {}), ...(scheme?.tokens ?? {}) },
  }
  return buildConfig(raw, { raeumlich: scheme?.raeumlich, sprache: wahl.sprache, schema: scheme?.id })
}

// Zwischenspeicher der Auswahl: Der Reducer fragt bei jeder Wahl eines Aufbaus danach.
const auswahlGemerkt = new Map<string, EigeneAuswahl>()
const KEINE_EIGENEN: EigeneAuswahl = eingefroren({ gut: [], abgelehnt: [] })

/**
 * Welche der gespeicherten eigenen Aufbauten gelten (siehe `brauchbareEigene` in eigene.ts).
 * Rein, wie {@link configFor}, und unabhängig vom gewählten Regelwerk. Konfiguration **und**
 * Auswahl (catalog.ts) fragen hier, damit nie ein Aufbau gewählt ist, den die Konfiguration
 * nicht liefert.
 */
export function eigeneAuswahl(eigene: readonly RawAufbau[] = []): EigeneAuswahl {
  if (eigene.length === 0) return KEINE_EIGENEN
  const schluessel = JSON.stringify(eigene)
  const treffer = auswahlGemerkt.get(schluessel)
  if (treffer) return treffer
  // Eigene Kopie: Das Ergebnis wird eingefroren und darf nicht an Objekten des Aufrufers hängen.
  const kopie = JSON.parse(JSON.stringify(eigene)) as RawAufbau[]
  const auswahl = eingefroren(
    brauchbareEigene(kopie, ROH_QUELLE, ROH_REGELWERKE, (aufbauten) => {
      const quelle = aufloesen(mitEigenen(ROH_QUELLE, aufbauten))
      ueberwachungsLuecken(quelle)
      // Mit jedem Regelwerk: Was hier wählbar ist, muss sich auch nach einem Wechsel bauen lassen.
      for (const rohRegelwerk of ROH_REGELWERKE) baue(rohRegelwerk, quelle)
    }),
  )
  auswahlGemerkt.set(schluessel, auswahl)
  if (auswahlGemerkt.size > MAX_GEMERKT) auswahlGemerkt.delete(auswahlGemerkt.keys().next().value!)
  return auswahl
}

function erzeuge(wahl: Required<Omit<KonfigWahl, 'beschriftung'>> & { beschriftung?: string }): Konfig {
  const rohRegelwerk = ROH_REGELWERKE.find((r) => r.id === wahl.regelwerk) ?? ROH_REGELWERKE[0] ?? {}
  const eigene = wahl.eigeneAufbauten
  const auswahl = eigeneAuswahl(eigene)
  let gut: readonly RawAufbau[] = auswahl.gut
  let abgelehnt: readonly Abgelehnt[] = auswahl.abgelehnt

  let cfg: ResolvedConfig
  try {
    cfg = baue(rohRegelwerk, aufloesen(mitEigenen(ROH_QUELLE, [...gut])), wahl)
  } catch (e) {
    // Letztes Netz: Die Auswahl hat mit jedem Regelwerk probeweise gebaut, aber nur mit den
    // Vorgaben für Sprache und Beschriftung. Scheitert der Bau mit dieser Wahl trotzdem,
    // bleibt die Anwendung mit den mitgelieferten Aufbauten benutzbar.
    cfg = baue(rohRegelwerk, aufloesen(ROH_QUELLE), wahl)
    abgelehnt = [...abgelehnt, ...gut.map((a) => ({ id: a.id, name: a.name, fehler: [defektMeldung(a.id, e)] }))]
    gut = []
  }

  const getAufbau = (id: string): ResolvedAufbau =>
    cfg.aufbauten.find((x) => x.id === id) ??
    cfg.aufbauten[0] ?? { id: 'standard', name: 'Standard', disziplin: 'standard', order: [], zusatz: [] }

  return {
    ...cfg,
    regelwerke: REGELWERK_INFOS,
    rohRegelwerk,
    rohQuelle: ROH_QUELLE,
    eigeneAufbauten: eigene,
    verdeckteEigene: verdeckteEigene(ROH_QUELLE, [...eigene]),
    abgelehnteEigene: abgelehnt,
    kurse: (ROH_QUELLE.kurse ?? []).map((k) => ({ id: k.id, name: k.name })),

    getSheetDef(typeId) {
      const def = cfg.positions.find((p) => p.typeId === typeId)
      if (!def) throw new Error(`Unbekannte Position: ${typeId}`)
      return def
    },
    getPositions: () => cfg.positions,
    positionAllowsClass(typeId, klasse) {
      if (!cfg.regelwerk.klassen.includes(klasse)) return false
      const d = cfg.positions.find((p) => p.typeId === typeId)
      return !d?.klassen || d.klassen.length === 0 || d.klassen.includes(klasse)
    },
    getAufbauten: () => cfg.aufbauten,
    defaultAufbauId: () => cfg.aufbauten[0]?.id ?? 'standard',
    getAufbau,
    aufbauOrder(id, kombiAktiv) {
      const a = getAufbau(id)
      return kombiAktiv && a.kombi ? a.kombi.order : a.order
    },
    bildDatei: (aufbauId, klasse) => getAufbau(aufbauId).kurs?.bilder[klasse] ?? `Klasse${klasse}`,
    getDisziplin: (id) => cfg.disziplinen.find((d) => d.id === id) ?? { id, name: id },
    getRegelwerk: () => cfg.regelwerk,
    getRegelwerke: () => REGELWERK_INFOS,
    getLegende: () => cfg.legende,
    getBogenTexte: () => cfg.bogenTexte,
    getBeschriftungen: () => cfg.beschriftungen,
    defaultBeschriftungId: () => cfg.beschriftungen[0]?.id ?? '',
    getLaufzettelConfig: () => cfg.laufzettel,
    getAllDisqs: () => cfg.allDisqs,
    vergebeneIds: () =>
      new Set([
        ...cfg.aufbauten.map((a) => a.id),
        ...cfg.positions.map((p) => p.typeId),
        // Auch abgelehnte und verdeckte eigene belegen ihre IDs: Ein neuer Aufbau darf nicht
        // so heißen wie einer, der noch gespeichert ist.
        ...eigene.flatMap((a) => [a.id, ...a.positionen.flatMap((e) => (typeof e === 'string' ? [] : [String(e.id)]))]),
      ]),
    entwurfsLuecken(aufbau) {
      const mitEntwurf = mitEigenen(ROH_QUELLE, [...gut.filter((a) => a.id !== aufbau.id), aufbau])
      return ueberwachungsLuecken(aufloesen(mitEntwurf)).filter((l) => l.aufbau === aufbau.id)
    },
    pruefeEigeneAufbauten: (eingabe, vorhanden = gut) => pruefeEigene(eingabe, ROH_QUELLE, rohRegelwerk, [...vorhanden]),
    aufbauAlsYaml(id, kopf) {
      const aufbau = eigene.find((a) => a.id === id) ?? ROH_QUELLE.aufbauten?.find((a) => a.id === id)
      return aufbau && aufbauYaml(aufbau, { ...kopf, regelwerk: cfg.regelwerk.label })
    },
  }
}

// Zwischenspeicher je Auswahl. Der Schlüssel ist der Inhalt, nicht die Identität: Der
// Stand wird bei jedem Laden neu aus JSON gelesen, die eigenen Aufbauten sind dann
// andere Objekte mit demselben Inhalt. Begrenzt, damit er über einen langen Wettkampftag
// nicht wächst (jede Änderung an eigenen Aufbauten ist eine neue Auswahl).
const MAX_GEMERKT = 12
const gemerkt = new Map<string, Konfig>()

/**
 * Die Konfiguration zu einer Auswahl. Rein: gleiche Eingabe, gleiches Ergebnis; nichts
 * außerhalb ändert sich. Das Ergebnis ist eingefroren, weil mehrere Stellen dasselbe
 * Objekt bekommen.
 */
export function configFor(wahl: KonfigWahl = {}): Konfig {
  const regelwerk = resolveRegelwerkId(wahl.regelwerk)
  const sprache = wahl.sprache ?? 'de'
  const eigeneAufbauten = wahl.eigeneAufbauten ?? []
  // Ein unbekanntes Schema ist die Vorgabe – und soll auch denselben Eintrag treffen.
  const beschriftung = ROH_QUELLE.beschriftungen?.some((b) => b.id === wahl.beschriftung) ? wahl.beschriftung : undefined
  const schluessel = JSON.stringify([regelwerk, sprache, beschriftung ?? '', eigeneAufbauten])
  const treffer = gemerkt.get(schluessel)
  if (treffer) {
    // Zuletzt Benutztes nach hinten: Verdrängt wird, was am längsten ungenutzt ist.
    gemerkt.delete(schluessel)
    gemerkt.set(schluessel, treffer)
    return treffer
  }
  // Eine eigene Kopie der Aufbauten: Das Ergebnis hängt nicht an Objekten des Aufrufers.
  const eigene = eingefroren(JSON.parse(JSON.stringify(eigeneAufbauten)) as RawAufbau[])
  const konfig = eingefroren(erzeuge({ regelwerk, sprache, beschriftung, eigeneAufbauten: eigene }))
  gemerkt.set(schluessel, konfig)
  if (gemerkt.size > MAX_GEMERKT) gemerkt.delete(gemerkt.keys().next().value!)
  return konfig
}
