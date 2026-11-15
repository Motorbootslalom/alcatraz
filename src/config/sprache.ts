import type { Sprache } from '../types'
import { zerlegeRerun } from '../planung/parallelRunden'

// Sprachen der Listen und Fehlertexte. Ein Regelwerk nennt in `sprachen`, was es
// anbietet; die Bedienleiste bleibt immer deutsch.

export const SPRACHEN: Array<{ id: Sprache; name: string }> = [
  { id: 'de', name: 'Deutsch' },
  { id: 'en', name: 'English' },
  { id: 'de+en', name: 'Deutsch + English' },
]

export function isSprache(x: unknown): x is Sprache {
  return SPRACHEN.some((s) => s.id === x)
}

/**
 * Text in der Sprache; zweisprachig auf einer Zeile: „deutsch / englisch“. Enthält
 * der Text selbst „ / “ (Tor 1 / 3 / 5), trennt „ · “ die beiden Sprachen.
 */
export function uebersetzt(sprache: Sprache, de: string, en?: string): string {
  if (sprache === 'de' || !en || en === de) return de
  if (sprache === 'en') return en
  return `${de}${de.includes(' / ') ? ' · ' : ' / '}${en}`
}

/** Wie {@link uebersetzt}, für ganze Sätze: zweisprachig untereinander. */
export function uebersetztBlock(sprache: Sprache, de: string, en?: string): string {
  if (sprache === 'de' || !en || en === de) return de
  return sprache === 'en' ? en : `${de}\n${en}`
}

/** Siehe {@link BogenTexte.parcoursName}. */
export function parcoursName(name: string, sprache: Sprache): string {
  const n = /^Parcours (\d+)$/.exec(name.trim())
  return n ? uebersetzt(sprache, `Parcours ${n[1]}`, `Course ${n[1]}`) : name
}

/** Feste Texte auf den Listen (außer den Spaltennamen, siehe i18n/en.yaml). */
export interface BogenTexte {
  nr: string
  /** Kopf der Klassen-Spalte, wenn mehrere Klassen auf einer Liste stehen (Clubmeisterschaft). */
  klasseKurz: string
  wkr: string
  wkrPlatzhalter: string
  unterschrift: string
  rueckseite: string
  klasse(id: string): string
  /** Mehrere Klassen im Kopf einer gemeinsamen Liste: „Klassen 1, 2, 3“. */
  klassen(ids: readonly string[]): string
  /** Zusatz der Zwischenüberschrift, wenn eine Klasse auf der nächsten Seite weitergeht. */
  fortsetzung: string
  /** Zwischenüberschrift der Leerzeilen, die sich die Klassen einer Seite teilen (Clubmeisterschaft). */
  nachmeldungen: string
  /** Nur der Name der Klasse („7“, „Dolphin“) – für die Klassen-Spalte. */
  klasseName(id: string): string
  lauf(n: number): string
  /**
   * Der Name eines Parcours auf dem Blatt. Der Vorgabename „Parcours n“ (state/reducer.ts) steht
   * englisch als „Course n“ (Regel 960 Pkt. 4.3.2 „course“); ein von Hand vergebener Name ist
   * ein Eigenname und bleibt, wie er ist.
   */
  parcoursName(name: string): string
  seite(n: number, von: number): string
  /**
   * Listen des Parallelslaloms (lib/parallelBogen.ts). Englisch nach Regel 960: „racecourse“
   * (Pkt. 4.4: „each running on a separate racecourse“), „attempt“ (Pkt. 4.4: „Each driver
   * shall have two attempts“), die Runden nach Pkt. 5.2.2 („Parallel slalom preliminary heat /
   * semi-finals / finals“) und Pkt. 5.2.6 („must re-run both attempts“). Den Dummy kennt die
   * Regel nicht – er ist Organisation.
   */
  start: string
  attempt: string
  dummy: string
  /** Ein Start ohne Starter (beide eines Paares entfernt): Die Zeile bleibt, die Positionen auch. */
  entfaellt: string
  racecourse(kennung: string): string
  runde(runde: string): string
}

export function bogenTexte(sprache: Sprache, klassenNamen: Record<string, string> = {}): BogenTexte {
  const t = (de: string, en: string) => uebersetzt(sprache, de, en)
  return {
    nr: t('Nr.', 'No.'),
    klasseKurz: t('Kl.', 'Cl.'),
    // Englisch nach dem UIM Circuit Rulebook: „race official“ (Regel 960, Pkt. 1: „all race
    // officials must be familiar with the UIM Formula Future rules“). „Judge“ ist dort allein der
    // „Protest Judge“ (Pkt. 3.6) – eine andere Rolle.
    wkr: `${t('WKR', 'Race official')}:`,
    wkrPlatzhalter: t('Name Wettkampfrichter*in', 'Name of race official'),
    unterschrift: t('Unterschrift WKR', 'Signature of race official'),
    rueckseite: t(
      'Beschreibung (Fehlerpunkte, Disqualifikationen, Parcours) steht auf der Rückseite - zum Lesen das Blatt nach oben klappen.',
      'Description (penalties, disqualifications, racecourse) is on the back - fold the sheet upwards to read it.',
    ),
    klasse: (id) => `${t('Klasse', 'Class')} ${klassenNamen[id] ?? id}`,
    klassen: (ids) => `${t('Klassen', 'Classes')} ${ids.map((id) => klassenNamen[id] ?? id).join(', ')}`,
    fortsetzung: t('Fortsetzung', 'continued'),
    nachmeldungen: t('Nachmeldungen', 'Late entries'),
    klasseName: (id) => klassenNamen[id] ?? id,
    lauf: (n) => t(`${n}. Lauf`, `Attempt ${n}`),
    parcoursName: (name) => parcoursName(name, sprache),
    seite: (n, von) => `${t('Seite', 'Page')} ${n} / ${von}`,
    start: 'Start',
    attempt: t('Versuch', 'Attempt'),
    dummy: 'Dummy',
    entfaellt: t('entfällt', 'cancelled'),
    racecourse: (kennung) => t(`Parcours ${kennung}`, `Racecourse ${kennung}`),
    runde: (runde) => {
      const name = (r: string) => (r === 'pre' ? t('Vorlauf', 'Preliminary heat') : r === 'semi' ? t('Halbfinale', 'Semi-finals') : r === 'final' ? t('Finale', 'Finals') : undefined)
      // Eine Wiederholung nennt ihre Runde und ab der zweiten ihre Nummer – gebaut wie
      // `rundenName` (planung/parallelRunden.ts), damit sich auf dem Papier die Wiederholung zum
      // Vorlauf von der zum Halbfinale und die erste von der zweiten unterscheidet.
      const rerun = zerlegeRerun(runde as Parameters<typeof zerlegeRerun>[0])
      const wiederholung = rerun && rerun.n > 1 ? t(`${rerun.n}. Wiederholung`, `Re-run ${rerun.n}`) : t('Wiederholung', 'Re-run')
      return name(runde) ?? (rerun ? `${name(rerun.basis)} – ${wiederholung}` : wiederholung)
    },
  }
}
