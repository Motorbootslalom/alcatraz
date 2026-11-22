import type { BereichId, WkrWarnung } from '../types'
import { schlechteste, type Ampel, type ListenLage } from './lage'
import type { AmpelLage, ParcoursAmpel } from './ampel'

// Freigabe-Sicht der WKR-Erfassung (W2.4, Plan docs/plan-wkr-w2.md §5/§6.3, 21.11.2026): was die Start-Freigabe über
// den Stand der Erfassung ihres Bereichs zeigt – die Geräteleiste und die Rückstandszeile über „Nächster Start“. Am
// Bedienrechner rechnet BetriebView sie aus erfassungsLage, auf dem Freigabe-Handy kommt sie verschlüsselt über die
// Freigabe-Gruppe des Bereichs (geraete/wkrGruppen.ts gruppeDerFreigabe) – NIE über ko/kz (F17: nichts davon auf der
// Anzeigetafel; deren Lese-Link kann jeder haben, der vor der Tafel steht).
//
// Positivliste (Test freigabe.test.ts): je Liste Titel, Stand, schlechteste Ampel, Zahl offener Starts, Startnummern
// von/bis, wartende Zeilen (Zahl), Zahl der Rückfragen, warnt, Parcours-Liste; seit fv 2 (21.11.2026, P-03) die
// Parcours-Ampel mit der Kennung des gezeigten Starts (steht ohnehin in der öffentlichen Sicht), Auto-Modus möglich, die
// Titel der Listen, an denen er scheitert, und der Countdown in Sekunden. Nie Werte, Namen von Startern, Geräten oder WKR,
// Herkunft, Gewicht, Geburtsdatum, Geschlecht, Abschlüsse (WKR_ANNAHMEN.freigabeOhneNamen, A9). Jedes Objekt Feld für
// Feld neu gebaut (wie betrieb/sicht.ts sichtZuschauer) – ein neues Feld in ListenLage gelangt nie von selbst hierher.
// Rein: kein DOM, kein Store, keine Uhr, nichts aus geraete/.

/**
 * Fassung der Freigabe-Sicht (innen `fv`; die Gruppe trägt die `sv` der öffentlichen Sicht wie jede Gruppe).
 * 2 seit der Parcours-Ampel (Nutzer 21.11.2026, P-03): `ampel`, `autoMoeglich`, `autoOhne`, `autoIn`, je Liste `parcours`.
 */
export const FREIGABE_SICHT_FASSUNG = 2

/** Stand einer Liste für die Leiste: Papier = kein Eintrag oder Modus Papier (▭). */
export type FreigabeStand = 'aktiv' | 'pausiert' | 'abgemeldet' | 'papier'

export interface FreigabeListe {
  /** Name der Liste (im Parallelslalom mit Racecourse). */
  titel: string
  stand: FreigabeStand
  /** Schlechteste Ampel der Geräte der Liste; `null` ohne Gerät. */
  ampel: Ampel | null
  /** Offene gezeigte Starts (Rückstand, A4) und deren Startnummern von–bis ('' ohne). */
  offen: number
  von: string
  bis: string
  /** Laut Lebenszeichen noch nicht zugestellte Zeilen (A11, nur die Zahl). */
  wartend?: number
  /** Offene Rückfragen der Liste (nur die Zahl; entschieden wird am Bedienrechner). */
  rueckfragen: number
  /** Mindestens R offen (seit 21.11.2026, Befund 8; vorher mehr als R), Liste digital und aktiv (F1, F4) – nur Parcours-Listen (AM5). */
  warnt: boolean
  /** Parcours-Liste (AM1) – Steg und Vorsteg stehen in der Leiste, warnen aber nie. */
  parcours: boolean
}

/** Was StartFreigabe.vue als Prop `erfassung` bekommt – am Bedienrechner wie auf dem Handy dieselbe Form. */
export interface FreigabeErfassung {
  fv: typeof FREIGABE_SICHT_FASSUNG
  bereich: BereichId
  warnung: WkrWarnung
  /** Leer, solange keine Liste des Bereichs einen Eintrag hat (alles Papier: keine Leiste). */
  listen: FreigabeListe[]
  /** Parcours-Ampel des gezeigten Starts (wkr/ampel.ts); `aus` = keine. */
  ampel: ParcoursAmpel
  /** Der gezeigte Start, für den die Ampel gilt (Kennung, wie in der öffentlichen Sicht) – nur mit Ampel. */
  ampelRef: string | null
  /** „Durchs Start-Tor“ wurde getippt (nur dann „zurück“). */
  perKnopf: boolean
  /** Auto-Modus wirksam (AM6). */
  autoMoeglich: boolean
  /** Auto-Modus eingeschaltet, aber nicht wirksam: Titel der Parcours-Listen, an denen es liegt. */
  autoOhne: string[]
  /** Countdown des Auto-Modus in Sekunden, wie der Host ihn beim Senden sah; `null` = keiner. */
  autoIn: number | null
}

/** Ohne Ampel (alter Aufrufer, Bereich ohne Parcours-Liste): wie AM3 – keine. */
const OHNE_AMPEL: AmpelLage = { ampel: 'aus', ref: null, perKnopf: false, offen: [], autoMoeglich: false, autoOhne: [] }

/**
 * Die Freigabe-Sicht eines Bereichs aus den Lagen seiner Listen (wkr/lage.ts erfassungsLage), der Ampel desselben
 * Stands (wkr/ampel.ts parcoursAmpel) und dem Countdown des Auto-Modus (`autoIn`, nur der Host weiß ihn).
 */
export function sichtFreigabe(bereich: BereichId, lagen: readonly ListenLage[], warnung: WkrWarnung, ampel: AmpelLage = OHNE_AMPEL, autoIn: number | null = null): FreigabeErfassung {
  const mitEintrag = lagen.some((l) => l.modus !== null)
  const listen = !mitEintrag
    ? []
    : lagen.map((l): FreigabeListe => {
        const wartend = l.geraete.reduce((s, g) => s + (g.wartend ?? 0), 0)
        const papier = l.modus === null || l.modus === 'papier'
        return {
          titel: l.racecourse ? `${l.titel} ${l.racecourse}` : l.titel,
          stand: papier ? 'papier' : l.status,
          ampel: schlechteste(l.geraete.map((g) => g.ampel)),
          offen: papier ? 0 : (l.rueckstand?.zahl ?? 0),
          von: papier ? '' : (l.rueckstand?.von ?? ''),
          bis: papier ? '' : (l.rueckstand?.bis ?? ''),
          ...(wartend > 0 ? { wartend } : {}),
          rueckfragen: l.rueckfragen,
          warnt: l.warnt,
          parcours: l.parcours,
        }
      })
  const mitAmpel = ampel.ampel !== 'aus'
  return {
    fv: FREIGABE_SICHT_FASSUNG,
    bereich,
    warnung: warnung === 'nachfragen' ? 'nachfragen' : 'warnen',
    listen,
    ampel: ampel.ampel,
    ampelRef: mitAmpel ? ampel.ref : null,
    perKnopf: mitAmpel && ampel.perKnopf,
    autoMoeglich: ampel.autoMoeglich,
    autoOhne: [...ampel.autoOhne],
    autoIn: ampel.autoMoeglich && autoIn !== null ? Math.max(0, Math.ceil(autoIn)) : null,
  }
}

const STAENDE: readonly FreigabeStand[] = ['aktiv', 'pausiert', 'abgemeldet', 'papier']
const PARCOURS_AMPELN: readonly ParcoursAmpel[] = ['aus', 'gruen', 'rot', 'frei']
const AMPELN: readonly Ampel[] = ['gehoert', 'still', 'weg', 'ruht']
const istObjekt = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const zahl = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(Math.floor(v), 9999) : 0)
const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '')

/**
 * Eine Freigabe-Sicht von der Leitung lesen (Gerät): falsche Fassung oder Form → `null` (keine Leiste, kein Fehler).
 * Gelesen wird wieder Feld für Feld – was ein neuerer Host mehr schickt, fällt weg.
 */
export function liesFreigabe(v: unknown): FreigabeErfassung | null {
  if (!istObjekt(v) || v.fv !== FREIGABE_SICHT_FASSUNG || typeof v.bereich !== 'string' || !Array.isArray(v.listen)) return null
  const listen: FreigabeListe[] = []
  for (const l of v.listen.slice(0, 64)) {
    if (!istObjekt(l) || typeof l.titel !== 'string') continue
    const wartend = zahl(l.wartend)
    listen.push({
      titel: text(l.titel, 80),
      stand: STAENDE.includes(l.stand as FreigabeStand) ? (l.stand as FreigabeStand) : 'papier',
      ampel: AMPELN.includes(l.ampel as Ampel) ? (l.ampel as Ampel) : null,
      offen: zahl(l.offen),
      von: text(l.von, 16),
      bis: text(l.bis, 16),
      ...(wartend > 0 ? { wartend } : {}),
      rueckfragen: zahl(l.rueckfragen),
      warnt: l.warnt === true,
      parcours: l.parcours === true,
    })
  }
  const ampel = PARCOURS_AMPELN.includes(v.ampel as ParcoursAmpel) ? (v.ampel as ParcoursAmpel) : 'aus'
  const ampelRef = ampel !== 'aus' && typeof v.ampelRef === 'string' ? v.ampelRef.slice(0, 400) : null
  const autoOhne = Array.isArray(v.autoOhne) ? v.autoOhne.filter((x): x is string => typeof x === 'string').slice(0, 64).map((x) => x.slice(0, 80)) : []
  const autoIn = typeof v.autoIn === 'number' && Number.isFinite(v.autoIn) && v.autoIn >= 0 ? Math.min(Math.ceil(v.autoIn), 60) : null
  return {
    fv: FREIGABE_SICHT_FASSUNG,
    bereich: v.bereich,
    warnung: v.warnung === 'nachfragen' ? 'nachfragen' : 'warnen',
    listen,
    ampel: ampelRef === null ? 'aus' : ampel,
    ampelRef,
    perKnopf: ampelRef !== null && v.perKnopf === true,
    autoMoeglich: v.autoMoeglich === true,
    autoOhne,
    autoIn: v.autoMoeglich === true ? autoIn : null,
  }
}
