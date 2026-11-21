import type { OeffentlicheSicht, PunktId, SichtBereich, SichtPunkt, SichtStart, VerschiebeZiel } from '../../types'
import { locale, t, tIn, tn, type Locale, type MessageKey } from '../../i18n'
import { wartezeitAnzeige } from '../../betrieb/prognose'
import { rundeVonPunkt } from '../../betrieb/folge'
import { rundenName } from '../../planung/parallelRunden'

// Texte der Start-Freigabe in der Sprache der Oberfläche, gemeinsam für ihre Teile (StartFreigabe, BetriebsFolge,
// EinreihenListe, KlassenAussetzen, EinsteigenAb, StartListe). Namen von Klassen und Parcours kommen aus der Sicht
// (Sprache der Anzeigetafel, unter UIM „Dolphin“); „Lauf 2“ sagt die Oberfläche selbst. Gelesen wird NUR die Sicht –
// dieselben Teile bedienen ab E7 vom Handy aus. Ausnahme `wartezeitText`: in einer gegebenen Sprache, weil die
// Zuschauerliste (components/zuschauer/) in der Sprache der Anzeigetafel schreibt.

/**
 * Texte, die im Parallelslalom von Runden statt Läufen sprechen: Dort gilt die Fassung `….runde` (i18n
 * de/+en/betrieb.ts) – „Noch keine Runde begonnen“, „Ans Ende der Runde“. Unter DM gibt es den Bereich nicht, also
 * auch diese Texte nicht.
 */
export type BereichText =
  | 'betrieb.nichtBegonnen'
  | 'betrieb.alleZuEnde'
  | 'betrieb.beginnen.frage'
  | 'betrieb.beginnen.text'
  | 'betrieb.stockt'
  | 'betrieb.abweichend'
  | 'betrieb.zurueckstellen.title'
  | 'betrieb.einreihen.ende'
  | 'betrieb.einreihen.ende.title'
  | 'betrieb.einstieg.hint'
  | 'betrieb.einstieg.punkt'
  | 'betrieb.einstieg.alleKlassen'

const fassung = (b: Pick<SichtBereich, 'art'> | null | undefined, key: BereichText): MessageKey => (b?.art === 'parallel' ? (`${key}.runde` as MessageKey) : key)

/** Ein Text der Start-Freigabe in der Fassung des Bereichs (Lauf bzw. Runde). */
export function tBereich(b: Pick<SichtBereich, 'art'> | null | undefined, key: BereichText, params?: Record<string, string | number>): string {
  return t(fassung(b, key), params)
}

/** Dasselbe mit Zahlform („noch {n} Start | noch {n} Starts“). */
export function tnBereich(b: Pick<SichtBereich, 'art'> | null | undefined, key: BereichText, n: number): string {
  return tn(fassung(b, key), n)
}

/**
 * Ein Punkt: „Lauf 2“, mit „Versuche nacheinander“ „Läufe 1–3“; eine Runde des Parallelslaloms mit ihrem Namen in der
 * Sprache der Oberfläche („Vorlauf“, „Halbfinale – Wiederholung“; planung/parallelRunden.ts rundenName).
 */
export function punktText(p: SichtPunkt): string {
  const runde = rundeVonPunkt(p.id)
  if (runde !== undefined) return rundenName(runde, t)
  if (p.laeufe.length === 0) return p.titel
  return p.laeufe.length > 1 ? t('betrieb.laeufe', { von: p.laeufe[0], bis: p.laeufe.at(-1)! }) : t('betrieb.lauf', { n: p.laeufe[0] })
}

/** „Lauf 2 beginnen“ bzw. „Läufe 1–3 beginnen“, im Parallelslalom „Halbfinale beginnen“. */
export function beginnenText(p: SichtPunkt): string {
  if (rundeVonPunkt(p.id) !== undefined) return t('betrieb.beginnen.runde', { runde: punktText(p) })
  if (p.laeufe.length === 0) return p.titel
  return p.laeufe.length > 1 ? t('betrieb.beginnen.laeufe', { von: p.laeufe[0], bis: p.laeufe.at(-1)! }) : t('betrieb.beginnen', { n: p.laeufe[0] })
}

/** Ein Punkt des Programms nach seiner Kennung; `null`, wenn es ihn (nicht mehr) gibt. */
export function punktVon(b: Pick<SichtBereich, 'programm'>, id: PunktId): SichtPunkt | null {
  return b.programm.find((p) => p.id === id) ?? null
}

/** Eine Seite eines Paares (Parallelslalom) in einer Zeile der Start-Freigabe. */
export interface SeitenZeile {
  /** 'A' oder 'B'. */
  rc: 'A' | 'B'
  /** „Parcours A“ bzw. „Racecourse A“ (Sprache der Oberfläche). */
  titel: string
  /** `false`: leer (Dummy, gelöscht, X) – Nummer '–', kein Name. */
  faehrt: boolean
  startNr: string
  name: string
  herkunft: string
}

/** Ein Start, wie ihn die Start-Freigabe in einer Zeile nennt. */
export interface StartZeile {
  key: string
  /** '–', wenn der Starter (noch) keine Nummer hat oder nicht in der Sicht steht; ein Paar: „101 / 102“. */
  startNr: string
  /** '' bei „Namen: ohne“; ein Paar: beide, mit „ / “ getrennt (eine leere Seite ohne Namen). */
  name: string
  /** „Klasse E · Lauf 2“; ein Paar: „Klasse 1 · Vorlauf · Versuch 1“ – auch „Kleines Finale“ ist seit 21.11.2026 eine eigene Runde. */
  was: string
  herkunft: string
  /** Klassenfarbe, '' ohne Klasse. */
  farbe: string
  /** Kurzname der Klasse für die Plakette („1“, „Dolphin“), '' ohne Klasse. */
  klasse: string
  /** Die Startnummern, mit denen die Suche den Start findet (ein Paar: beide Seiten, die fahren). */
  nummern: string[]
  /** Die Starter, die hier fahren (Suche: „gehören alle Treffer zu einem Starter“). */
  ids: string[]
  /** Nur im Parallelslalom: beide Seiten. */
  seiten?: [SeitenZeile, SeitenZeile]
}

/** Angaben zu einem Start aus der Sicht – auch für einen Starter, der dort fehlt (dann nur der Lauf). */
export function startZeile(sicht: Pick<OeffentlicheSicht, 'starter' | 'klassen'>, s: SichtStart): StartZeile {
  if (s.paar) return paarZeile(sicht, s)
  const p = sicht.starter[s.starter]
  const klasse = p ? sicht.klassen[p.klasse] : undefined
  return {
    key: s.key,
    startNr: p?.startNr || '–',
    name: p?.name ?? '',
    was: [klasse ? t('common.class', { id: klasse.name }) : '', t('betrieb.lauf', { n: s.lauf })].filter(Boolean).join(' · '),
    herkunft: p?.herkunft?.klartext ?? '',
    farbe: klasse?.farbe ?? '',
    klasse: klasse?.name ?? '',
    nummern: p?.startNr ? [p.startNr] : [],
    ids: p ? [s.starter] : [],
  }
}

/**
 * Ein Paar des Parallelslaloms in einer Zeile: Nummern und Namen beider Seiten (A vor B), eine leere Seite als „–“;
 * die Klasse der Seite, die fährt (beide fahren in einer Klasse, außer ohne strenge Klassentrennung – dann beide).
 */
function paarZeile(sicht: Pick<OeffentlicheSicht, 'starter' | 'klassen'>, s: SichtStart): StartZeile {
  const paar = s.paar!
  const seite = (rc: 'A' | 'B', id: string | null): SeitenZeile => {
    const p = id === null ? undefined : sicht.starter[id]
    return { rc, titel: t('betrieb.racecourse', { rc }), faehrt: !!p, startNr: p ? p.startNr || '–' : '–', name: p?.name ?? '', herkunft: p?.herkunft?.klartext ?? '' }
  }
  const seiten: [SeitenZeile, SeitenZeile] = [seite('A', paar.a), seite('B', paar.b)]
  const starter = [paar.a, paar.b].flatMap((id) => (id !== null && sicht.starter[id] ? [sicht.starter[id]] : []))
  const klassen = [...new Set(starter.map((p) => p.klasse))].flatMap((k) => (sicht.klassen[k] ? [sicht.klassen[k]!] : []))
  const runde = rundeVonPunkt(s.punkt)
  const wo = runde !== undefined ? rundenName(runde, t) : ''
  return {
    key: s.key,
    startNr: seiten.map((x) => x.startNr).join(' / '),
    name: seiten.some((x) => x.name) ? seiten.map((x) => x.name || '–').join(' / ') : '',
    was: [klassen.length > 0 ? t('common.class', { id: klassen.map((k) => k.name).join('/') }) : '', wo, t('betrieb.versuch', { n: paar.attempt })].filter(Boolean).join(' · '),
    herkunft: seiten.some((x) => x.herkunft) ? seiten.map((x) => x.herkunft || '–').join(' / ') : '',
    farbe: klassen[0]?.farbe ?? '',
    klasse: klassen.map((k) => k.name).join('/'),
    nummern: starter.map((p) => p.startNr).filter(Boolean),
    ids: [paar.a, paar.b].filter((id): id is string => id !== null && !!sicht.starter[id]),
    seiten,
  }
}

/** Ein Start der ganzen Folge: offen (`waehlbar`) oder seine Klasse setzt aus („Boot fehlt“). */
export interface FolgeStart {
  s: SichtStart
  art: 'offen' | 'bootFehlt'
}

/**
 * Die ganze Folge eines Bereichs, wie die Start-Freigabe („Anderen Starter wählen“) und die Startliste sie zeigen:
 * die offenen Starts in ihrer Folge, „Boot fehlt“ jeweils hinter dem letzten Start ihres Punkts (V-5, L-7: am Ende
 * des Laufs, gekennzeichnet) – hat der Punkt keinen offenen mehr, vor dem ersten eines späteren Punkts.
 */
export function ganzeFolge(b: Pick<SichtBereich, 'waehlbar' | 'bootFehlt' | 'programm'>): FolgeStart[] {
  const rang = (p: PunktId) => {
    const i = b.programm.findIndex((x) => x.id === p)
    return i < 0 ? Number.MAX_SAFE_INTEGER : i
  }
  const out: FolgeStart[] = b.waehlbar.map((s) => ({ s, art: 'offen' }))
  const fehlt: FolgeStart[] = b.bootFehlt.map((s) => ({ s, art: 'bootFehlt' }))
  for (const punkt of new Set(fehlt.map((z) => z.s.punkt))) {
    let at = -1
    out.forEach((z, i) => {
      if (z.s.punkt === punkt) at = i + 1
    })
    if (at < 0) at = out.findIndex((z) => rang(z.s.punkt) > rang(punkt))
    if (at < 0) at = out.length
    out.splice(at, 0, ...fehlt.filter((z) => z.s.punkt === punkt))
  }
  return out
}

/** Ein Ziel von „Verschieben …“: Kennung (für `data-ziel`), Beschriftung, Ziel der Action BETRIEB_VERSCHIEBEN. */
export interface VerschiebeWahl {
  id: string
  text: string
  ziel: VerschiebeZiel
}

/**
 * Die Ziele des Menüs „Verschieben …“ für einen offenen Start (S-4, S-6): vorziehen (vor den Nächsten – gibt es
 * keinen freigegebenen, vor den ersten offenen), ans Ende seines Laufs, vor/nach jedem anderen Lauf, in dem noch
 * etwas offen ist (vor/nach einem vorbeigegangenen hieße nur „hinter den Zeiger“). Die Regeln (Blöcke, Zeiger,
 * „Verzahnung halten“) wendet der Reducer an (betrieb/schritte.ts `verschiebe`).
 */
export function verschiebeZiele(b: Pick<SichtBereich, 'offen' | 'waehlbar' | 'programm' | 'art'>, s: SichtStart): VerschiebeWahl[] {
  // Im Parallelslalom wird nicht verschoben (BETRIEB_ANNAHMEN.parallelOhneUmstellen).
  if (b.art === 'parallel') return []
  const vorne = b.offen[0]?.key ?? b.waehlbar[0]?.key ?? null
  const out: VerschiebeWahl[] = []
  if (vorne && vorne !== s.key) out.push({ id: 'vorne', text: t('betrieb.folge.vorziehen'), ziel: { vor: vorne } })
  out.push({ id: 'ende', text: tBereich(b, 'betrieb.einreihen.ende'), ziel: { nachPunkt: s.punkt } })
  const grenzen = b.programm.length > 1 ? b.programm.filter((p) => p.id !== s.punkt && b.waehlbar.some((x) => x.punkt === p.id)) : []
  for (const p of grenzen) {
    out.push({ id: `vor|${p.id}`, text: t('betrieb.folge.vorPunkt', { punkt: punktText(p) }), ziel: { vorPunkt: p.id } })
    out.push({ id: `nach|${p.id}`, text: t('betrieb.folge.nachPunkt', { punkt: punktText(p) }), ziel: { nachPunkt: p.id } })
  }
  return out
}

/**
 * Eine Wartezeit als Text in einer Sprache: unter einer Minute „gleich“, sonst „12 min“, ab einer Stunde
 * „1 h 05 min“ (betrieb/prognose.ts wartezeitAnzeige). Die Startliste schreibt in der Sprache der Oberfläche, die
 * Zuschauerliste in der der Anzeigetafel.
 */
export function wartezeitText(sekunden: number, sprache: Locale): string {
  const w = wartezeitAnzeige(sekunden)
  if (w.art === 'gleich') return tIn(sprache, 'anzeige.zeit.gleich')
  if (w.art === 'min') return tIn(sprache, 'anzeige.zeit.min', { n: w.min })
  return tIn(sprache, 'anzeige.zeit.h', { h: w.h, min: String(w.min).padStart(2, '0') })
}

/**
 * Der Kurz-Fingerabdruck des Hosts (geraete/transport/ntfy/raum.ts `fingerabdruck`) zum Vergleichen mit dem Auge: in
 * Vierergruppen, wie am Bedienrechner (Betrieb → Geräte) so auf dem Gerät (GeraetApp.vue) – gleich heißt echt (Plan §8).
 */
export function fingerabdruckText(f: string): string {
  return f.replace(/(.{4})(?=.)/g, '$1 ')
}

/**
 * Uhrzeit (Stunde:Minute) in der Sprache der Oberfläche – Geräteliste (E7: gekoppelt, zuletzt gehört). Liegt das
 * Datum nicht heute, steht es davor: Ein Raum bleibt über Nacht offen, „zuletzt 14:32“ von gestern führte in die Irre.
 */
export function uhrzeitText(ms: number, jetzt: number = Date.now()): string {
  const d = new Date(ms)
  const zwei = (n: number) => String(n).padStart(2, '0')
  // Von Hand statt toLocale…: Englisch gäbe 12-Stunden-Zeit und Monat/Tag – mm/dd „darf es nie geben“ (Wurzel-CLAUDE.md).
  const zeit = `${zwei(d.getHours())}:${zwei(d.getMinutes())}`
  if (d.toDateString() === new Date(jetzt).toDateString()) return zeit
  const datum = locale.value === 'de' ? `${zwei(d.getDate())}.${zwei(d.getMonth() + 1)}.` : `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}`
  return `${datum} ${zeit}`
}
