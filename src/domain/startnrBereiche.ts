import type { ClassId, Starter } from '../types'
import { normalizeSize } from './sizes'
import { makeStartNr, parseClassNumber, redistributeNumbers, sortedByStartNr, startNrPrefix, type StartNrPraefixe } from './startnumbers'

/**
 * Startnummern nach Größenbereichen (Wunsch des Nutzers vom 19.11.2026): Die klassenbasierten
 * Startnummern stehen auf Westen in Konfektionsgrößen. Je Klasse gehört ein Nummernbereich zu
 * einer Größengruppe (DMYV: 101–130 S–M, 421–430 L–XL, 529–530 XXL …), einzelne Westen fehlen
 * (verloren, kaputt) – ihre Nummern werden nie vergeben. Rein und deterministisch: Der Reducer
 * (state/reducer/startnummern.ts) und die Oberfläche rechnen hiermit.
 */

/** Die Größengruppen der Westen, klein → groß. Die Reihenfolge trägt die Ausweichregel ({@link ausweichFolge}). */
export const GROESSEN_GRUPPEN = ['S-M', 'L-XL', 'XXL'] as const
export type GroessenGruppe = (typeof GROESSEN_GRUPPEN)[number]

// XS zählt zu S–M und XXXL zu XXL: Westen gibt es nur in den drei Gruppen (Liste des DMYV).
const GRUPPE_DER_GROESSE: Record<string, GroessenGruppe> = { XS: 'S-M', S: 'S-M', M: 'S-M', L: 'L-XL', XL: 'L-XL', XXL: 'XXL', XXXL: 'XXL' }

/** Ein Nummernbereich einer Klasse, so geschrieben, wie die Nummern auf den Westen stehen (z. B. „501“ bis „510“, „E101“). */
export interface StartNrBereich {
  von: string
  bis: string
  gruppe: GroessenGruppe
}

/** Bereiche je Klasse; eine Klasse ohne Eintrag hat keine (fortlaufende Vergabe). */
export type StartNrBereiche = Partial<Record<ClassId, StartNrBereich[]>>

/** Was die Vergabe einer Klasse braucht: ihre Bereiche, die fehlenden Nummern (alle Klassen) und die Präfixe. */
export interface StartNrRegeln {
  bereiche: readonly StartNrBereich[]
  fehlend: readonly string[]
  praefixe?: StartNrPraefixe
}

export const istGroessenGruppe = (wert: unknown): wert is GroessenGruppe => (GROESSEN_GRUPPEN as readonly unknown[]).includes(wert)

/** Die Größengruppe einer Konfektionsgröße; `null` für leere oder unbekannte Größen. */
export function gruppeDerGroesse(groesse: string): GroessenGruppe | null {
  return GRUPPE_DER_GROESSE[normalizeSize(groesse)] ?? null
}

/**
 * Die laufende Nummer einer Startnummer dieser Klasse – nur, wenn der Text genau so geschrieben
 * ist, wie die Vergabe ihn schreibt (Präfix + mindestens zweistellig: „512“ in Klasse 5 → 12,
 * „E101“ in Klasse E → 101; in Klasse E zählen E und D wie in parseClassNumber). Sonst `null`:
 * „51“ oder „5012“ sind keine Nummern der Klasse 5.
 */
export function nummerDerKlasse(text: string, klasse: ClassId, praefixe?: StartNrPraefixe): number | null {
  const s = String(text).trim().toUpperCase()
  const n = parseClassNumber(s, klasse, praefixe)
  if (n === null || n < 1) return null
  const ziffern = String(n).padStart(2, '0')
  const moegliche = klasse === 'E' ? [startNrPrefix(klasse, praefixe), 'E', 'D'] : [startNrPrefix(klasse, praefixe)]
  return moegliche.some((p) => s === p.toUpperCase() + ziffern) ? n : null
}

/** Von/bis eines Bereichs als laufende Nummern; `null`, wenn er für die Klasse nicht lesbar ist oder von > bis. */
export function bereichsGrenzen(b: StartNrBereich, klasse: ClassId, praefixe?: StartNrPraefixe): { von: number; bis: number } | null {
  const von = nummerDerKlasse(b.von, klasse, praefixe)
  const bis = nummerDerKlasse(b.bis, klasse, praefixe)
  return von === null || bis === null || von > bis ? null : { von, bis }
}

/** Die fehlenden Nummern, die zu dieser Klasse gehören, als laufende Nummern. */
export function fehlendeDerKlasse(fehlend: readonly string[], klasse: ClassId, praefixe?: StartNrPraefixe): Set<number> {
  const out = new Set<number>()
  for (const f of fehlend) {
    const n = nummerDerKlasse(f, klasse, praefixe)
    if (n !== null) out.add(n)
  }
  return out
}

interface Topf {
  gruppe: GroessenGruppe
  von: number
  bis: number
  /** Die vergebbaren Nummern des Bereichs: ohne die fehlenden. */
  nummern: number[]
}

/** Die brauchbaren Bereiche der Klasse, nach Gruppe (klein → groß) und Anfang geordnet. Unlesbare fallen weg. */
function toepfe(klasse: ClassId, regeln: StartNrRegeln): Topf[] {
  const fehlend = fehlendeDerKlasse(regeln.fehlend, klasse, regeln.praefixe)
  const out: Topf[] = []
  for (const b of regeln.bereiche) {
    const g = bereichsGrenzen(b, klasse, regeln.praefixe)
    if (!g) continue
    const nummern: number[] = []
    for (let n = g.von; n <= g.bis; n++) if (!fehlend.has(n)) nummern.push(n)
    out.push({ gruppe: b.gruppe, ...g, nummern })
  }
  return out.sort((a, b) => GROESSEN_GRUPPEN.indexOf(a.gruppe) - GROESSEN_GRUPPEN.indexOf(b.gruppe) || a.von - b.von)
}

/**
 * Wohin ein Starter ausweicht, wenn der Bereich seiner Gruppe voll ist oder fehlt: zuerst die
 * größeren Gruppen (aufsteigend), dann die kleineren (absteigend) – eine größere Weste passt noch,
 * eine kleinere nicht (Vorgabe vom 19.11.2026). Ohne bekannte Größe gilt der Starter wie in der
 * Sortierung nach Größe (sizeRank) als größer als alle: also XXL, L–XL, S–M.
 */
export function ausweichFolge(gruppe: GroessenGruppe | null): GroessenGruppe[] {
  const i = gruppe === null ? GROESSEN_GRUPPEN.length : GROESSEN_GRUPPEN.indexOf(gruppe)
  return [...GROESSEN_GRUPPEN.slice(i + 1), ...GROESSEN_GRUPPEN.slice(0, i).reverse()]
}

/** Hat die Klasse mindestens einen brauchbaren Bereich? */
export function hatBereiche(klasse: ClassId, regeln: StartNrRegeln): boolean {
  return toepfe(klasse, regeln).length > 0
}

/**
 * Vergibt die Startnummern EINER Klasse frisch, in der Reihenfolge von `ordered` (wie heute: die
 * Folge des Starter-Reiters). Mit Bereichen in zwei Durchgängen: Erst bekommt jeder, dessen Gruppe
 * einen Bereich mit freier Nummer hat, die nächste freie daraus – so nimmt kein Ausweichender einem
 * später Kommenden seine Weste weg. Dann die Übrigen (Bereich voll oder fehlt, Größe leer/unbekannt)
 * nach {@link ausweichFolge}, und reicht auch das nicht, fortlaufend hinter dem höchsten Bereich.
 * Ohne Bereiche fortlaufend ab 1. Fehlende Nummern werden immer übersprungen.
 */
export function vergibKlasse(ordered: readonly Starter[], klasse: ClassId, regeln: StartNrRegeln): Starter[] {
  const fehlend = fehlendeDerKlasse(regeln.fehlend, klasse, regeln.praefixe)
  const nr = (n: number) => makeStartNr(klasse, n, regeln.praefixe)
  const alle = toepfe(klasse, regeln)
  if (alle.length === 0) {
    let n = 0
    return ordered.map((p) => {
      do n++
      while (fehlend.has(n))
      return { ...p, startNr: nr(n) }
    })
  }
  const belegt = new Set<number>()
  const nimm = (gruppe: GroessenGruppe): number | null => {
    for (const t of alle)
      if (t.gruppe === gruppe)
        for (const n of t.nummern)
          if (!belegt.has(n)) {
            belegt.add(n)
            return n
          }
    return null
  }
  const vergeben = new Map<string, number>()
  const rest: Starter[] = []
  for (const p of ordered) {
    const g = gruppeDerGroesse(p.groesse)
    const n = g ? nimm(g) : null
    if (n === null) rest.push(p)
    else vergeben.set(p.id, n)
  }
  let hinten = Math.max(...alle.map((t) => t.bis))
  for (const p of rest) {
    let n: number | null = null
    for (const g of ausweichFolge(gruppeDerGroesse(p.groesse))) if (n === null) n = nimm(g)
    if (n === null) {
      do hinten++
      while (fehlend.has(hinten) || belegt.has(hinten))
      n = hinten
      belegt.add(n)
    }
    vergeben.set(p.id, n)
  }
  return ordered.map((p) => ({ ...p, startNr: nr(vergeben.get(p.id)!) }))
}

/**
 * Die nächste freie Nummer für EINEN neuen Starter der Klasse (von Hand, Umzug in eine andere
 * Klasse, Import): mit Bereichen die erste freie seiner Gruppe, sonst nach {@link ausweichFolge},
 * sonst hinter allem; ohne Bereiche wie bisher die höchste vergebene + 1. Fehlende überspringen.
 */
export function naechsteStartNr(vorhandene: readonly Starter[], klasse: ClassId, groesse: string, regeln: StartNrRegeln): string {
  const fehlend = fehlendeDerKlasse(regeln.fehlend, klasse, regeln.praefixe)
  const belegt = new Set<number>()
  let max = 0
  for (const p of vorhandene) {
    if (p.klasse !== klasse) continue
    // Streng gelesen wie die Bereiche (Korrektur vom 19.11.2026): Ein Tippfehler wie „5012“ in
    // Klasse 5 belegt nicht die 512 – sonst bekäme der Nächste 513, und die Weste 512 bliebe liegen.
    const n = nummerDerKlasse(p.startNr, klasse, regeln.praefixe)
    if (n === null) continue
    belegt.add(n)
    max = Math.max(max, n)
  }
  const alle = toepfe(klasse, regeln)
  const g = gruppeDerGroesse(groesse)
  for (const gruppe of [...(g ? [g] : []), ...ausweichFolge(g)])
    for (const t of alle) if (t.gruppe === gruppe) for (const n of t.nummern) if (!belegt.has(n)) return makeStartNr(klasse, n, regeln.praefixe)
  let n = Math.max(max, ...alle.map((t) => t.bis))
  do n++
  while (fehlend.has(n) || belegt.has(n))
  return makeStartNr(klasse, n, regeln.praefixe)
}

/**
 * Verteilt die vorhandenen Nummern einer Klasse neu auf die geordnete Liste (Verschieben,
 * „Sortierung ändern“, „Zufall“) – mit Bereichen je Bereich für sich: Wer eine Nummer aus einem
 * Bereich trägt, bekommt wieder eine aus demselben, nur die Folge darin ändert sich. Sonst wanderte
 * eine XXL-Weste zu einem Starter der Größe S. Nummern außerhalb aller Bereiche bilden eine
 * eigene Gruppe. Ohne Bereiche genau wie bisher (redistributeNumbers).
 */
export function verteileInBereichen(ordered: readonly Starter[], klasse: ClassId, regeln: StartNrRegeln): Starter[] {
  const alle = toepfe(klasse, regeln)
  if (alle.length === 0) return redistributeNumbers([...ordered])
  const topfVon = (p: Starter) => {
    // Streng: Eine von Hand verschriebene Nummer („5012“) gehört zu keinem Bereich und tauscht nur mit ihresgleichen.
    const n = nummerDerKlasse(p.startNr, klasse, regeln.praefixe)
    return n === null ? -1 : alle.findIndex((t) => n >= t.von && n <= t.bis)
  }
  const gruppen = new Map<number, Starter[]>()
  for (const p of ordered) gruppen.set(topfVon(p), [...(gruppen.get(topfVon(p)) ?? []), p])
  const neu = new Map<string, string>()
  for (const glieder of gruppen.values()) {
    const nummern = sortedByStartNr(glieder).map((p) => p.startNr)
    glieder.forEach((p, i) => neu.set(p.id, nummern[i]))
  }
  return ordered.map((p) => ({ ...p, startNr: neu.get(p.id)! }))
}

/**
 * Warum eine Nummer nicht zur Weste des Starters passt (Hinweis im Starter-Reiter):
 * `fehlend` – die Nummer steht in der Liste der fehlenden Westen; `fremd` – sie liegt im Bereich
 * einer anderen Größengruppe; `ausserhalb` – in keinem Bereich (Überlauf oder von Hand);
 * `ohneGroesse` – der Starter hat keine bekannte Größe.
 */
export type StartNrAbweichung = 'fehlend' | 'fremd' | 'ausserhalb' | 'ohneGroesse'

/** Die Starter einer Klasse, deren Nummer nicht zu ihrer Größe passt, mit Grund. Starter ohne Nummer zählen nicht. */
export function startNrAbweichungen(starters: readonly Starter[], klasse: ClassId, regeln: StartNrRegeln): { starter: Starter; art: StartNrAbweichung }[] {
  const fehlend = fehlendeDerKlasse(regeln.fehlend, klasse, regeln.praefixe)
  const alle = toepfe(klasse, regeln)
  const out: { starter: Starter; art: StartNrAbweichung }[] = []
  for (const p of sortedByStartNr(starters.filter((s) => s.klasse === klasse))) {
    if (!p.startNr.trim()) continue
    // Streng gelesen: „5012“ in Klasse 5 ist keine Nummer eines Bereichs, sondern „außerhalb“.
    const n = nummerDerKlasse(p.startNr, klasse, regeln.praefixe)
    if (n === null) {
      if (alle.length > 0) out.push({ starter: p, art: 'ausserhalb' })
      continue
    }
    if (fehlend.has(n)) out.push({ starter: p, art: 'fehlend' })
    else if (alle.length === 0) continue
    else {
      const t = alle.find((x) => n >= x.von && n <= x.bis)
      const g = gruppeDerGroesse(p.groesse)
      if (!t) out.push({ starter: p, art: 'ausserhalb' })
      else if (g === null) out.push({ starter: p, art: 'ohneGroesse' })
      else if (t.gruppe !== g) out.push({ starter: p, art: 'fremd' })
    }
  }
  return out
}

/**
 * Liest die fehlenden Nummern aus einem Eingabetext („512, 517; 623 E105“): tolerant gegen
 * Kommas, Semikolons, Leerzeichen und Kleinschreibung. `nummern` sind die, die zu einer der
 * `klassen` passen (eindeutig, in Eingabefolge), `unbekannt` der Rest – die Oberfläche zeigt ihn.
 */
export function liesFehlende(text: string, klassen: readonly ClassId[], praefixe?: StartNrPraefixe): { nummern: string[]; unbekannt: string[] } {
  const nummern: string[] = []
  const unbekannt: string[] = []
  for (const teil of text.split(/[\s,;]+/)) {
    const s = teil.trim().toUpperCase()
    if (!s) continue
    const passt = klassen.some((k) => nummerDerKlasse(s, k, praefixe) !== null)
    const ziel = passt ? nummern : unbekannt
    if (!ziel.includes(s)) ziel.push(s)
  }
  return { nummern, unbekannt }
}

/** Prüft und bereinigt Bereiche aus Stand oder Action: nur Einträge mit Text-von/bis und bekannter Gruppe. */
export function normalisiereBereichsListe(roh: unknown): StartNrBereich[] | null {
  if (!Array.isArray(roh)) return null
  const out: StartNrBereich[] = []
  for (const b of roh) {
    if (!b || typeof b !== 'object') continue
    const { von, bis, gruppe } = b as Record<string, unknown>
    if ((typeof von !== 'string' && typeof von !== 'number') || (typeof bis !== 'string' && typeof bis !== 'number') || !istGroessenGruppe(gruppe)) continue
    out.push({ von: String(von).trim().toUpperCase(), bis: String(bis).trim().toUpperCase(), gruppe })
  }
  return out
}
