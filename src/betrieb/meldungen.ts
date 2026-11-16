import type { Meldung, MeldungArt, OeffentlicheSicht } from '../types'
import { tIn, type Locale, type MessageKey } from '../i18n'

// Vorlagen für wiederkehrende Meldungen auf der Anzeigetafel (Lastenheft der Tafel B-8): Begrüßung, Dank,
// Pause, Störung. Texte nach dem Tafel-Prototyp (data/messages.ts), dort aus der bisherigen Word-Lösung
// übernommen – sie haben sich über Jahre bewährt. Hier nur die Daten (Kennung, Art); die Texte stehen in
// i18n de/ und en/betrieb.ts (`meldung.vorlage.<id>` für die Tafel, `….titel` für die Auswahl).
//
// Eine Vorlage landet zuerst im Eingabefeld, nicht direkt auf der Tafel: Uhrzeiten und Tage sind
// Beispielwerte zum Anpassen. Sprache der Texte = Sprache der Anzeigetafel, Beschriftung = Oberfläche
// (BETRIEB_ANNAHMEN.vorlagenInTafelSprache).

export type VorlagenGruppe = 'begruessung' | 'dank' | 'pause' | 'stoerung'

export type VorlageId =
  | 'gutenMorgen'
  | 'willkommenZurueck'
  | 'gleichLos'
  | 'vielErfolg'
  | 'dankWkr'
  | 'dankHelfer'
  | 'verabschiedung'
  | 'mittag'
  | 'appetit'
  | 'appetitErholen'
  | 'werwolf'
  | 'siegerehrung'
  | 'kurzeStoerung'
  | 'betriebsablauf'
  | 'bootswechsel'
  | 'technik'
  | 'bojen'
  | 'wind'

export interface MeldungsVorlage {
  id: VorlageId
  art: MeldungArt
}

export interface MeldungsVorlagenGruppe {
  gruppe: VorlagenGruppe
  vorlagen: readonly MeldungsVorlage[]
}

/**
 * Die Vorlagen nach Anlass. Begrüßungen stehen als „Pause“ groß und allein auf der Tafel, nicht als
 * Hinweis klein unter dem Starter: Sie richten sich an alle im Umfeld und werden gelesen, bevor der erste
 * Starter oben steht – als kleine Zeile gingen sie in 50 m Entfernung unter (Prototyp).
 */
export const MELDUNGS_VORLAGEN: readonly MeldungsVorlagenGruppe[] = [
  {
    gruppe: 'begruessung',
    vorlagen: [
      { id: 'gutenMorgen', art: 'pause' },
      { id: 'willkommenZurueck', art: 'pause' },
      { id: 'gleichLos', art: 'pause' },
      { id: 'vielErfolg', art: 'pause' },
    ],
  },
  {
    gruppe: 'dank',
    vorlagen: [
      { id: 'dankWkr', art: 'info' },
      { id: 'dankHelfer', art: 'info' },
      { id: 'verabschiedung', art: 'info' },
    ],
  },
  {
    gruppe: 'pause',
    vorlagen: [
      { id: 'mittag', art: 'pause' },
      { id: 'appetit', art: 'pause' },
      { id: 'appetitErholen', art: 'pause' },
      { id: 'werwolf', art: 'pause' },
      { id: 'siegerehrung', art: 'pause' },
    ],
  },
  {
    gruppe: 'stoerung',
    vorlagen: [
      { id: 'kurzeStoerung', art: 'stoerung' },
      { id: 'betriebsablauf', art: 'stoerung' },
      { id: 'bootswechsel', art: 'stoerung' },
      { id: 'technik', art: 'stoerung' },
      { id: 'bojen', art: 'stoerung' },
      { id: 'wind', art: 'stoerung' },
    ],
  },
]

/** Alle Vorlagen flach. */
export const ALLE_VORLAGEN: readonly MeldungsVorlage[] = MELDUNGS_VORLAGEN.flatMap((g) => g.vorlagen)

/** Schlüssel der Überschrift einer Gruppe (Sprache der Oberfläche, t()). */
export const gruppenTitel = (g: VorlagenGruppe): MessageKey => `meldung.gruppe.${g}`

/** Schlüssel der Beschriftung einer Vorlage in der Auswahl (Sprache der Oberfläche, t()). */
export const vorlagenTitel = (id: VorlageId): MessageKey => `meldung.vorlage.${id}.titel`

/**
 * Der Text einer Vorlage in der Sprache der Anzeigetafel, mit dem Namen der Veranstaltung für
 * `{veranstaltung}` – fehlt er, ein allgemeines Wort statt einer Lücke im Satz.
 */
export function vorlagenText(id: VorlageId, sprache: Locale, veranstaltung: string): string {
  const name = veranstaltung.trim() || tIn(sprache, 'meldung.vorlage.ohneName')
  return tIn(sprache, `meldung.vorlage.${id}`, { veranstaltung: name })
}

/** Die Meldung einer Vorlage für die Start-Freigabe – aus der Sicht (Sprache der Tafel, Name der Veranstaltung). */
export function vorlagenMeldung(sicht: Pick<OeffentlicheSicht, 'sprache' | 'veranstaltung'>, vorlage: MeldungsVorlage): Meldung {
  return { text: vorlagenText(vorlage.id, sicht.sprache, sicht.veranstaltung), art: vorlage.art }
}
