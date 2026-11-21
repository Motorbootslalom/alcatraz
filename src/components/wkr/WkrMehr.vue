<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Locale } from '../../i18n'
import type { AnsichtModus, BojenAnsicht, GeraetAnsicht } from '../../geraete/ablage'
import AppDialog from '../AppDialog.vue'
import { useWkrText } from './texte'

/**
 * „Mehr“ (W3.3/W3.4, Plan §5.1/§5.7/§5.8/§5.9): Bemerkung zum Start, der Status der Liste bzw. des eigenen Steg-Teils
 * (Pausieren, Abmelden mit Rückfrage, Weiter digital), „Liste abschließen“ (immer da, G16), die Ansicht (Sonne/Hell/
 * Dunkel, Linkshand; G1), die Sprache (F13/G9: Vorgabe die der Liste; schaltet die Bedientexte immer, Codes und
 * Titel nur, wenn die Sicht `andere` trägt – sonst sagt ein Satz, warum sie bleiben), „Probe“ (G10) und in der Übung
 * „Übung verlassen“. Die Bemerkung zählt nicht als Tipp (H2) und geht mit der Zeile des Starts.
 * W4.3 (21.11.2026, P16/R6): „Nicht vorbeigekommen“ für den gezeigten Start (`nichtVorbei` = Startnummer, sonst nicht
 * angeboten) – erst nach einer großen Rückfrage („23 ist hier nicht vorbeigekommen? Es wird nichts eingetragen.“),
 * weil die Zeile den Start ohne Werte abhakt.
 *
 * Nutzer 21.11.2026 (WKR_ANNAHMEN V1/V2): Auf Bojen-Listen (`bojenAnsicht` ≠ null) steht unter „Ansicht“ die
 * Reihenfolge „Fahrtfolge“ / „Wie der Parcours liegt“, in der Lage-Ansicht „Start oben“ / „Start unten“, dazu „Bojen
 * links/rechts tauschen“ – Ereignis `bojenAnsicht`, gemerkt je Liste in WkrGeraet.
 *
 * Diese Komponente schreibt nichts selbst ab: Ansicht und Sprache gehen als `ansicht` hinauf bis WkrGeraet, das sie
 * gerätelokal merkt (ablage.ts `alcatraz.geraet.ansicht`).
 */
const props = withDefaults(
  defineProps<{
    /** Feld der Bemerkung vorhanden und ein Start da. */
    mitBemerkung: boolean
    bemerkung: string
    status: 'aktiv' | 'pausiert' | 'abgemeldet'
    /** Pausieren/Abmelden/Weiter anbieten (in Ruhe-Zuständen mit eigenem Knopf nicht doppelt). */
    mitStatus?: boolean
    modus: AnsichtModus
    hand: 'rechts' | 'links'
    /** Sprache, in der die Maske gerade spricht, und die der Liste (Vorgabe). */
    sprache: Locale
    listenSprache: Locale
    /** Trägt die Sicht die Masken in der anderen Sprache (UIM)? */
    mitAndere: boolean
    /** Gibt es einen Punkt zum Abschließen? */
    kannAbschliessen: boolean
    uebung: boolean
    /** Startnummer des gezeigten Starts, wenn er „nicht vorbeigekommen“ melden darf (nicht Vorsteg/Ablegen, nicht Korrektur). */
    nichtVorbei?: string | null
    /** Nur Bojen-Listen: Reihenfolge und Spiegeln dieser Liste (V1/V2); `null` = keine Bojen-Maske. */
    bojenAnsicht?: BojenAnsicht | null
  }>(),
  { mitStatus: true, nichtVorbei: null, bojenAnsicht: null },
)
const emit = defineEmits<{
  bemerkung: [text: string]
  pausiere: []
  meldeAb: []
  weiter: []
  abschluss: []
  probe: []
  ansicht: [aenderung: Partial<GeraetAnsicht>]
  uebungEnde: []
  nichtVorbei: []
  bojenAnsicht: [ansicht: BojenAnsicht]
}>()
const { w } = useWkrText()

const offen = ref(false)
const text = ref(props.bemerkung)
watch(
  () => props.bemerkung,
  (b) => (text.value = b),
)
const frageAb = ref(false)
const frageNv = ref(false)

const MODI: AnsichtModus[] = ['sonne', 'hell', 'dunkel']
const SPRACHEN: ('de' | 'en')[] = ['de', 'en']
/** Die Sprache der Liste heißt „keine eigene Wahl“ – dann folgt das Gerät der Liste, auch wenn sie wechselt. */
function waehleSprache(s: 'de' | 'en'): void {
  emit('ansicht', { sprache: s === props.listenSprache ? undefined : s })
}
const FOLGEN: BojenAnsicht['folge'][] = ['fahrt', 'lage']
function aendereBojen(aenderung: Partial<BojenAnsicht>): void {
  if (props.bojenAnsicht) emit('bojenAnsicht', { ...props.bojenAnsicht, ...aenderung })
}
function tue(f: () => void): void {
  offen.value = false
  f()
}
</script>

<template>
  <div class="wkr-mehr" data-teil="mehr">
    <button type="button" class="wkr-knopf" data-ziel="klein" data-action="mehr" :aria-expanded="offen" @click="offen = !offen">{{ w(offen ? 'wkr.geraet.mehr.zu' : 'wkr.geraet.mehr') }}</button>
    <div v-if="offen" class="wkr-mehr-inhalt">
      <label v-if="mitBemerkung" class="wkr-feld">
        {{ w('wkr.geraet.bemerkung') }}
        <input v-model="text" class="wkr-eingabe" data-feld="bemerkung" maxlength="200" autocomplete="off" @change="emit('bemerkung', text)" />
      </label>
      <div v-if="mitStatus" class="wkr-reihe">
        <button v-if="status === 'aktiv'" type="button" class="wkr-knopf" data-ziel="klein" data-action="pausieren" @click="emit('pausiere')">{{ w('wkr.geraet.pausieren') }}</button>
        <button v-if="status === 'aktiv'" type="button" class="wkr-knopf" data-ziel="klein" data-action="abmelden" @click="frageAb = true">{{ w('wkr.geraet.abmelden') }}</button>
        <button v-else type="button" class="wkr-knopf" data-ziel="klein" data-action="weiter" @click="emit('weiter')">{{ w('wkr.geraet.weiter') }}</button>
      </div>
      <button v-if="nichtVorbei" type="button" class="wkr-knopf" data-ziel="klein" data-action="nicht-vorbei" @click="frageNv = true">⊘ {{ w('wkr.geraet.nichtVorbei') }}</button>
      <button type="button" class="wkr-knopf" data-ziel="klein" data-action="abschliessen" :disabled="!kannAbschliessen" @click="tue(() => emit('abschluss'))">
        {{ w('wkr.geraet.abschluss') }}
      </button>

      <fieldset class="wkr-feldgruppe" data-teil="ansicht">
        <legend>{{ w('wkr.geraet.ansicht') }}</legend>
        <div class="wkr-reihe">
          <button
            v-for="m in MODI"
            :key="m"
            type="button"
            class="wkr-knopf"
            data-ziel="klein"
            data-action="modus"
            :data-modus="m"
            :aria-pressed="modus === m"
            @click="emit('ansicht', { modus: m })"
          >
            {{ w(`wkr.geraet.ansicht.${m}`) }}
          </button>
        </div>
        <button
          type="button"
          class="wkr-knopf"
          data-ziel="klein"
          data-action="linkshand"
          :aria-pressed="hand === 'links'"
          @click="emit('ansicht', { hand: hand === 'links' ? 'rechts' : 'links' })"
        >
          {{ w('wkr.geraet.ansicht.links') }}
        </button>
        <div v-if="bojenAnsicht" class="wkr-mehr-bojen" data-teil="bojen-ansicht">
          <p class="wkr-mehr-untertitel">{{ w('wkr.geraet.bojen.ansicht') }}</p>
          <div class="wkr-reihe">
            <button
              v-for="f in FOLGEN"
              :key="f"
              type="button"
              class="wkr-knopf"
              data-ziel="klein"
              data-action="bojen-folge"
              :data-folge="f"
              :aria-pressed="bojenAnsicht.folge === f"
              @click="aendereBojen({ folge: f })"
            >
              {{ w(`wkr.geraet.bojen.ansicht.${f}`) }}
            </button>
          </div>
          <div v-if="bojenAnsicht.folge === 'lage'" class="wkr-reihe">
            <button
              v-for="oben in [true, false]"
              :key="String(oben)"
              type="button"
              class="wkr-knopf"
              data-ziel="klein"
              data-action="bojen-start"
              :data-start-oben="oben"
              :aria-pressed="bojenAnsicht.startOben === oben"
              @click="aendereBojen({ startOben: oben })"
            >
              {{ w(oben ? 'wkr.geraet.bojen.ansicht.startOben' : 'wkr.geraet.bojen.ansicht.startUnten') }}
            </button>
          </div>
          <button
            type="button"
            class="wkr-knopf"
            data-ziel="klein"
            data-action="bojen-tauschen"
            :aria-pressed="bojenAnsicht.tauschen"
            @click="aendereBojen({ tauschen: !bojenAnsicht.tauschen })"
          >
            {{ w('wkr.geraet.bojen.ansicht.tauschen') }}
          </button>
        </div>
      </fieldset>

      <fieldset class="wkr-feldgruppe" data-teil="sprache">
        <legend>{{ w('wkr.geraet.sprache') }}</legend>
        <div class="wkr-reihe">
          <button
            v-for="s in SPRACHEN"
            :key="s"
            type="button"
            class="wkr-knopf"
            data-ziel="klein"
            data-action="sprache"
            :data-sprache="s"
            :lang="s"
            :aria-pressed="sprache === s"
            @click="waehleSprache(s)"
          >
            {{ w(`wkr.geraet.sprache.${s}`) }}
          </button>
        </div>
        <p v-if="sprache !== listenSprache && !mitAndere" class="wkr-hinweis" data-teil="nur-bedientexte">{{ w('wkr.geraet.sprache.nurBedien') }}</p>
      </fieldset>

      <div class="wkr-reihe">
        <button type="button" class="wkr-knopf" data-ziel="klein" data-action="probe" @click="tue(() => emit('probe'))">{{ w('wkr.geraet.probe') }}</button>
        <button v-if="uebung" type="button" class="wkr-knopf" data-ziel="klein" data-action="uebung-ende" @click="tue(() => emit('uebungEnde'))">{{ w('wkr.geraet.uebung.ende') }}</button>
      </div>
    </div>
    <AppDialog
      v-if="frageNv && nichtVorbei"
      class="wkr-dialog"
      :titel="w('wkr.geraet.nichtVorbei.frage', { nr: nichtVorbei })"
      data-dialog="wkr-nicht-vorbei"
      @abbrechen="frageNv = false"
    >
      <p>{{ w('wkr.geraet.nichtVorbei.hint') }}</p>
      <template #knoepfe>
        <button type="button" class="wkr-knopf wkr-knopf--haupt" data-ziel="gross" data-action="nicht-vorbei-ja" @click="(frageNv = false), tue(() => emit('nichtVorbei'))">
          ⊘ {{ w('wkr.geraet.nichtVorbei') }}
        </button>
        <button type="button" class="wkr-knopf" data-ziel="gross" data-action="nicht-vorbei-nein" autofocus @click="frageNv = false">{{ w('wkr.geraet.abbrechen') }}</button>
      </template>
    </AppDialog>
    <AppDialog v-if="frageAb" class="wkr-dialog" :titel="w('wkr.geraet.abmelden.frage')" data-dialog="wkr-abmelden" @abbrechen="frageAb = false">
      <p>{{ w('wkr.geraet.abmelden.text') }}</p>
      <template #knoepfe>
        <button type="button" class="wkr-knopf wkr-knopf--gefahr" data-ziel="gross" data-action="abmelden-ja" @click="(frageAb = false), emit('meldeAb')">{{ w('wkr.geraet.abmelden') }}</button>
        <button type="button" class="wkr-knopf" data-ziel="gross" data-action="abmelden-nein" autofocus @click="frageAb = false">{{ w('wkr.geraet.abbrechen') }}</button>
      </template>
    </AppDialog>
  </div>
</template>
