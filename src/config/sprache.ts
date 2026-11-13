import type { Sprache } from '../types'

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
  /** Nur der Name der Klasse („7“, „Dolphin“) – für die Klassen-Spalte. */
  klasseName(id: string): string
  lauf(n: number): string
  parcours(n: number): string
  seite(n: number, von: number): string
}

export function bogenTexte(sprache: Sprache, klassenNamen: Record<string, string> = {}): BogenTexte {
  const t = (de: string, en: string) => uebersetzt(sprache, de, en)
  return {
    nr: t('Nr.', 'No.'),
    klasseKurz: t('Kl.', 'Cl.'),
    // Englisch nach dem Sprachgebrauch der UIM: „judge“ (im Prototyp noch „race official“).
    wkr: `${t('WKR', 'Judge')}:`,
    wkrPlatzhalter: t('Name Wettkampfrichter*in', 'Name of judge'),
    unterschrift: t('Unterschrift WKR', 'Signature of judge'),
    rueckseite: t(
      'Beschreibung (Fehlerpunkte, Disqualifikationen, Parcours) steht auf der Rückseite - zum Lesen das Blatt nach oben klappen.',
      'Description (penalties, disqualifications, racecourse) is on the back - fold the sheet upwards to read it.',
    ),
    klasse: (id) => `${t('Klasse', 'Class')} ${klassenNamen[id] ?? id}`,
    klassen: (ids) => `${t('Klassen', 'Classes')} ${ids.map((id) => klassenNamen[id] ?? id).join(', ')}`,
    fortsetzung: t('Fortsetzung', 'continued'),
    klasseName: (id) => klassenNamen[id] ?? id,
    lauf: (n) => t(`${n}. Lauf`, `Attempt ${n}`),
    parcours: (n) => t(`Parcours ${n}`, `Course ${n}`),
    seite: (n, von) => `${t('Seite', 'Page')} ${n} / ${von}`,
  }
}
