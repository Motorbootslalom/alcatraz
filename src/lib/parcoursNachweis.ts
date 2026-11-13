import { PARCOURS_HERKUNFT as herkunft } from './parcoursQuelle'
import { t } from '../i18n'

/**
 * Die Namensnennung der Parcours-Zeichnungen als eine Zeile Text – für den gedruckten Bogen,
 * wo es keine Links gibt: Urheber, Hinweis auf die Bearbeitung, Quelle mit Stand und Lizenz
 * (CC BY-NC-SA 4.0 Abschnitt 3(a)). Am Bildschirm steht dasselbe mit Links in
 * components/ParcoursNachweis.vue.
 */
export function nachweisZeile(): string {
  const quelle = herkunft.repo.replace(/^https?:\/\//, '')
  return `${t('parcours.credit', { author: herkunft.urheber })} ${t('parcours.creditSource')} ${quelle} (${t('parcours.creditRevision', { commit: herkunft.commit.slice(0, 7) })}) · ${t('parcours.creditLicense')} ${herkunft.lizenz}`
}
