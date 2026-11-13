import { computed } from 'vue'
import { locale, type Locale } from '../i18n'
import type { Sprache } from '../types'

// Die Sprache der gedruckten Listen (Wettkampfrichter-Bögen, später Ergebnislisten) – an
// EINER Stelle. Vorerst folgt sie der Sprache der Oberfläche; ein eigener Wert im Stand der
// Veranstaltung (auch zweisprachig, `de+en`) kommt mit den echten Listen. Wer die
// Listensprache braucht, fragt deshalb hier und nicht `locale` – dann genügt es später,
// diese Datei zu ändern.
//
// Wirksam wird Englisch nur, wo das Regelwerk es anbietet (config/build.ts): Nach den
// DM-Regeln bleiben die Listen deutsch, auch in der englischen Oberfläche.

/** Die Listensprache zu einer Sprache der Oberfläche. */
export function listenSpracheVon(oberflaeche: Locale): Sprache {
  return oberflaeche === 'en' ? 'en' : 'de'
}

/** Die geltende Listensprache; reaktiv. */
export const listenSprache = computed<Sprache>(() => listenSpracheVon(locale.value))
