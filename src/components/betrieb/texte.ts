import type { OeffentlicheSicht, PunktId, SichtBereich, SichtPunkt, SichtStart } from '../../types'
import { t } from '../../i18n'

// Texte der Start-Freigabe in der Sprache der Oberfläche, gemeinsam für ihre Teile (StartFreigabe, BetriebsFolge,
// EinreihenListe, KlassenAussetzen, EinsteigenAb). Namen von Klassen und Parcours kommen aus der Sicht (Sprache der
// Anzeigetafel, unter UIM „Dolphin“); „Lauf 2“ sagt die Oberfläche selbst. Gelesen wird NUR die Sicht – dieselben
// Teile bedienen ab E7 vom Handy aus.

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
