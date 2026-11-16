import type { OeffentlicheSicht, PunktId, SichtBereich, SichtPunkt, SichtStart, VerschiebeZiel } from '../../types'
import { t, tIn, type Locale } from '../../i18n'
import { wartezeitAnzeige } from '../../betrieb/prognose'

// Texte der Start-Freigabe in der Sprache der Oberfläche, gemeinsam für ihre Teile (StartFreigabe, BetriebsFolge,
// EinreihenListe, KlassenAussetzen, EinsteigenAb, StartListe). Namen von Klassen und Parcours kommen aus der Sicht
// (Sprache der Anzeigetafel, unter UIM „Dolphin“); „Lauf 2“ sagt die Oberfläche selbst. Gelesen wird NUR die Sicht –
// dieselben Teile bedienen ab E7 vom Handy aus. Ausnahme `wartezeitText`: in einer gegebenen Sprache, weil die
// Zuschauerliste (components/zuschauer/) in der Sprache der Anzeigetafel schreibt.

/** Ein Punkt: „Lauf 2“, mit „Versuche nacheinander“ „Läufe 1–3“; ohne Läufe (Parallelslalom, E4) sein Titel. */
export function punktText(p: SichtPunkt): string {
  if (p.laeufe.length === 0) return p.titel
  return p.laeufe.length > 1 ? t('betrieb.laeufe', { von: p.laeufe[0], bis: p.laeufe.at(-1)! }) : t('betrieb.lauf', { n: p.laeufe[0] })
}

/** „Lauf 2 beginnen“ bzw. „Läufe 1–3 beginnen“. */
export function beginnenText(p: SichtPunkt): string {
  if (p.laeufe.length === 0) return p.titel
  return p.laeufe.length > 1 ? t('betrieb.beginnen.laeufe', { von: p.laeufe[0], bis: p.laeufe.at(-1)! }) : t('betrieb.beginnen', { n: p.laeufe[0] })
}

/** Ein Punkt des Programms nach seiner Kennung; `null`, wenn es ihn (nicht mehr) gibt. */
export function punktVon(b: Pick<SichtBereich, 'programm'>, id: PunktId): SichtPunkt | null {
  return b.programm.find((p) => p.id === id) ?? null
}

/** Ein Start, wie ihn die Start-Freigabe in einer Zeile nennt. */
export interface StartZeile {
  key: string
  /** '–', wenn der Starter (noch) keine Nummer hat oder nicht in der Sicht steht. */
  startNr: string
  /** '' bei „Namen: ohne“. */
  name: string
  /** „Klasse E · Lauf 2“. */
  was: string
  herkunft: string
  /** Klassenfarbe, '' ohne Klasse. */
  farbe: string
  /** Kurzname der Klasse für die Plakette („1“, „Dolphin“), '' ohne Klasse. */
  klasse: string
}

/** Angaben zu einem Start aus der Sicht – auch für einen Starter, der dort fehlt (dann nur der Lauf). */
export function startZeile(sicht: Pick<OeffentlicheSicht, 'starter' | 'klassen'>, s: SichtStart): StartZeile {
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
export function verschiebeZiele(b: Pick<SichtBereich, 'offen' | 'waehlbar' | 'programm'>, s: SichtStart): VerschiebeWahl[] {
  const vorne = b.offen[0]?.key ?? b.waehlbar[0]?.key ?? null
  const out: VerschiebeWahl[] = []
  if (vorne && vorne !== s.key) out.push({ id: 'vorne', text: t('betrieb.folge.vorziehen'), ziel: { vor: vorne } })
  out.push({ id: 'ende', text: t('betrieb.einreihen.ende'), ziel: { nachPunkt: s.punkt } })
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
