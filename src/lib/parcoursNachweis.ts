import { PARCOURS_HERKUNFT as herkunft } from './parcoursQuelle'
import { tIn, type MessageKey } from '../i18n'
import { uebersetzt } from '../config/sprache'
import type { Sprache } from '../types'

/**
 * Die Namensnennung der Parcours-Zeichnungen als eine Zeile Text – für den gedruckten Bogen,
 * wo es keine Links gibt: Urheber, Hinweis auf die Bearbeitung, Quelle mit Stand und Lizenz
 * (CC BY-NC-SA 4.0 Abschnitt 3(a)). Am Bildschirm steht dasselbe mit Links in
 * components/ParcoursNachweis.vue.
 *
 * In der Sprache des Bogens (`BogenTexte.sprache`), nie in der der Oberfläche – auf gedruckten Blättern gilt die
 * Listensprache (23.11.2026: vorher t(), dann stand auf dem englischen Fahrweg-Bogen einer UIM-Veranstaltung bei
 * deutscher Oberfläche die deutsche Zeile). Zweisprachig je Teil „deutsch / englisch“ wie die übrigen Bogentexte
 * (config/sprache.ts uebersetzt); Adresse und Lizenzname stehen nur einmal.
 */
export function nachweisZeile(sprache: Sprache): string {
  const text = (key: MessageKey, params?: object) => uebersetzt(sprache, tIn('de', key, params), tIn('en', key, params))
  const quelle = herkunft.repo.replace(/^https?:\/\//, '')
  return `${text('parcours.credit', { author: herkunft.urheber })} ${text('parcours.creditSource')} ${quelle} (${text('parcours.creditRevision', { commit: herkunft.commit.slice(0, 7) })}) · ${text('parcours.creditLicense')} ${herkunft.lizenz}`
}
