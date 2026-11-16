<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { MeldungArt, OeffentlicheSicht, SichtBereich, SichtPunkt, SichtStart } from '../../types'
import type { BetriebAenderung } from '../../state/reducer/betrieb'
import { t, tn } from '../../i18n'
import AppDialog from '../AppDialog.vue'
import NachzuholenListe from './NachzuholenListe.vue'

/**
 * Start-Freigabe eines Bereichs (Parcours): wer im Boot sitzt, wer als Nächstes dran ist, „Nächster Start“,
 * „Zurück“, „Lauf N beginnen“, Nachzuholendes und die Meldung auf der Anzeigetafel. Nach dem Tafel-Prototyp
 * (StegPanel.vue, 16.11.2026), in E1 ohne Zurückstellen, Aussetzen und Verschieben (E2).
 *
 * Liest NUR die öffentliche Sicht und schickt Actions über `sende` – am Bedienrechner dispatch, später (E7)
 * vom Handy über den Host. Jede Action ist bedingt (state/reducer/betrieb.ts): „Nächster Start“ trägt den
 * Start, der gerade steht (`vorher`), ein Doppelklick schaltet so nicht zweimal. Bedienung in der Sprache
 * der Oberfläche; Namen von Parcours und Klassen kommen aus der Sicht (Sprache der Tafel).
 */
const props = defineProps<{
  sicht: OeffentlicheSicht
  bereich: SichtBereich
  sende: (action: BetriebAenderung) => void
  /** Nur am Bedienrechner: eine eigene Anzeigetafel für diesen Bereich öffnen. */
  anzeigeOeffnen?: () => void
}>()

const b = computed(() => props.bereich)

/** Ein Punkt in der Sprache der Oberfläche: „Lauf 2“, mit „Versuche nacheinander“ „Läufe 1–3“. */
function punktText(p: SichtPunkt): string {
  if (p.laeufe.length === 0) return p.titel
  return p.laeufe.length > 1 ? t('betrieb.laeufe', { von: p.laeufe[0], bis: p.laeufe.at(-1)! }) : t('betrieb.lauf', { n: p.laeufe[0] })
}
function beginnenText(p: SichtPunkt): string {
  if (p.laeufe.length === 0) return p.titel
  return p.laeufe.length > 1 ? t('betrieb.beginnen.laeufe', { von: p.laeufe[0], bis: p.laeufe.at(-1)! }) : t('betrieb.beginnen', { n: p.laeufe[0] })
}

interface Zeile {
  startNr: string
  name: string
  was: string
  herkunft: string
}
function zeile(s: SichtStart | null): Zeile | null {
  if (!s) return null
  const p = props.sicht.starter[s.starter]
  if (!p) return null
  const klasse = props.sicht.klassen[p.klasse]
  return {
    startNr: p.startNr || '–',
    name: p.name,
    was: [klasse ? t('common.class', { id: klasse.name }) : '', t('betrieb.lauf', { n: s.lauf })].filter(Boolean).join(' · '),
    herkunft: p.herkunft?.klartext ?? '',
  }
}

const aktuell = computed(() => zeile(b.value.aktuell))
const vorig = computed(() => zeile(b.value.vorig))
const naechster = computed(() => zeile(b.value.offen[0] ?? null))
const vorher = computed(() => b.value.aktuell?.key ?? null)

const stand = computed(() => {
  if (!b.value.punkt) return t('betrieb.nichtBegonnen')
  return `${t('betrieb.laufend', { punkt: punktText(b.value.punkt) })} · ${tn('betrieb.offen', b.value.offenZahl)}`
})
/** Kein Nächster: Der laufende Punkt ist zu Ende (die Tafel bleibt stehen) – oder alle sind es. */
const ohneNaechsten = computed(() => {
  if (b.value.offen.length > 0 || !b.value.punkt) return ''
  return b.value.naechsterPunkt ? t('betrieb.punktZuEnde', { punkt: punktText(b.value.punkt) }) : t('betrieb.alleZuEnde')
})

function zeige(key: string) {
  props.sende({ type: 'BETRIEB_ZEIGEN', bereich: b.value.id, ref: key, vorher: vorher.value })
}
function naechsterStart() {
  const n = b.value.offen[0]
  if (n) zeige(n.key)
}
function zurueck() {
  if (b.value.aktuell) props.sende({ type: 'BETRIEB_ZURUECK', bereich: b.value.id, ref: b.value.aktuell.key })
}

// „Lauf N beginnen“: Sind im laufenden noch Starts offen, erst fragen – sie bleiben freigegeben und kommen vorher dran.
const frageBeginnen = ref(false)
function beginnen() {
  if (b.value.offenZahl > 0) frageBeginnen.value = true
  else beginnenJa()
}
function beginnenJa() {
  frageBeginnen.value = false
  const p = b.value.naechsterPunkt
  if (p) props.sende({ type: 'BETRIEB_BEGINNEN', bereich: b.value.id, punkt: p.id })
}

// --- Meldung ---
const ARTEN: MeldungArt[] = ['info', 'stoerung', 'pause']
const text = ref(b.value.meldung?.text ?? '')
const art = ref<MeldungArt>(b.value.meldung?.art ?? 'info')
// Ändert sich die Meldung anderswo (anderer Bereich mit „auf allen“, später ein Gerät), folgt der Entwurf –
// aber nur, solange hier nichts Eigenes getippt ist.
watch(
  () => b.value.meldung,
  (neu, alt) => {
    if (text.value.trim() === (alt?.text ?? '')) text.value = neu?.text ?? ''
    if (neu) art.value = neu.art
  },
)
const mehrere = computed(() => props.sicht.bereiche.length > 1)
function meldungSetzen(alle: boolean) {
  props.sende({ type: 'BETRIEB_MELDUNG', bereich: alle ? '*' : b.value.id, meldung: { text: text.value, art: art.value } })
}
function meldungLoeschen() {
  text.value = ''
  props.sende({ type: 'BETRIEB_MELDUNG', bereich: b.value.id, meldung: null })
}
</script>

<template>
  <section class="panel betrieb-karte" :data-bereich="bereich.id">
    <div class="betrieb-karte-kopf">
      <h3>{{ bereich.name }}</h3>
      <span class="note" data-teil="stand">{{ stand }}</span>
      <button v-if="anzeigeOeffnen" type="button" class="btn sm" data-action="anzeige-oeffnen-bereich" :title="t('betrieb.oeffnen.bereichTitel', { name: bereich.name })" @click="anzeigeOeffnen()">
        {{ t('betrieb.oeffnen.bereich') }}
      </button>
    </div>

    <div class="betrieb-imboot" data-teil="imboot">
      <span class="note">{{ t('betrieb.imBoot') }}</span>
      <template v-if="aktuell">
        <span class="betrieb-nr">{{ aktuell.startNr }}</span>
        <span class="betrieb-name">{{ aktuell.name }}</span>
        <span class="note">{{ [aktuell.was, aktuell.herkunft].filter(Boolean).join(' · ') }}</span>
      </template>
      <!-- Ein Start ohne Starter in der Sicht: Der Starter wurde gelöscht. Der Start bleibt im Boot, bis der nächste kommt. -->
      <span v-else-if="bereich.aktuell" class="note" data-teil="geloescht">{{ t('betrieb.geloescht') }}</span>
      <span v-else class="note">{{ t('betrieb.keiner') }}</span>
      <span v-if="vorig" class="note" data-teil="vorig">{{ t('betrieb.davor') }}: {{ [vorig.startNr, vorig.was, vorig.name].filter(Boolean).join(' · ') }}</span>
    </div>

    <div class="betrieb-naechster" data-teil="naechster">
      <span class="note">{{ t('betrieb.naechster') }}</span>
      <template v-if="naechster">
        <b>{{ naechster.startNr }}</b> {{ naechster.name }}
        <span class="note">{{ [naechster.was, naechster.herkunft].filter(Boolean).join(' · ') }}</span>
      </template>
      <span v-else-if="ohneNaechsten" class="note">{{ ohneNaechsten }}</span>
      <span v-else class="note">–</span>
    </div>

    <div class="betrieb-knoepfe">
      <button type="button" class="btn primary betrieb-gross" data-action="zeigen" :disabled="!bereich.fest || !naechster" @click="naechsterStart">
        {{ t('betrieb.zeigen') }}
      </button>
      <button type="button" class="btn" data-action="zurueck" :disabled="!bereich.aktuell" :title="t('betrieb.zurueck.title')" @click="zurueck">
        {{ t('betrieb.zurueck') }}
      </button>
      <button
        v-if="bereich.naechsterPunkt"
        type="button"
        :class="['btn', bereich.offen.length === 0 ? 'primary' : '']"
        data-action="beginnen"
        :disabled="!bereich.fest"
        @click="beginnen"
      >
        {{ beginnenText(bereich.naechsterPunkt) }}
      </button>
    </div>

    <NachzuholenListe :sicht="sicht" :eintraege="bereich.nachzuholen" :gesperrt="!bereich.fest" @zeigen="zeige" />

    <details class="betrieb-meldung" :open="!!bereich.meldung">
      <summary>
        {{ t('betrieb.meldung') }}
        <span v-if="bereich.meldung" :class="['betrieb-meldung-aktiv', bereich.meldung.art]" data-teil="meldung-aktiv">
          {{ t('betrieb.meldung.aktiv', { art: t(`meldung.${bereich.meldung.art}`), text: bereich.meldung.text }) }}
        </span>
      </summary>
      <p class="note">{{ t('betrieb.meldung.hint') }}</p>
      <div class="segmented" role="group" :aria-label="t('betrieb.meldung')">
        <button v-for="a in ARTEN" :key="a" type="button" :data-meldung-art="a" :class="art === a ? 'active' : ''" :aria-pressed="art === a" @click="art = a">
          {{ t(`meldung.${a}`) }}
        </button>
      </div>
      <textarea v-model="text" class="input" rows="2" maxlength="200" data-meldung-text :placeholder="t('betrieb.meldung.platzhalter')" :aria-label="t('betrieb.meldung')" />
      <div class="betrieb-knoepfe">
        <button type="button" class="btn" data-action="meldung-setzen" :disabled="!text.trim()" @click="meldungSetzen(false)">{{ t('betrieb.meldung.setzen') }}</button>
        <button v-if="mehrere" type="button" class="btn" data-action="meldung-alle" :disabled="!text.trim()" @click="meldungSetzen(true)">{{ t('betrieb.meldung.alle') }}</button>
        <button type="button" class="btn" data-action="meldung-loeschen" :disabled="!bereich.meldung" @click="meldungLoeschen">{{ t('betrieb.meldung.loeschen') }}</button>
      </div>
    </details>

    <AppDialog v-if="frageBeginnen && bereich.naechsterPunkt" :titel="t('betrieb.beginnen.frage')" data-dialog="beginnen" @abbrechen="frageBeginnen = false">
      <p>{{ tn('betrieb.beginnen.text', bereich.offenZahl) }}</p>
      <template #knoepfe>
        <button type="button" class="btn primary" data-action="beginnen-ja" @click="beginnenJa">{{ beginnenText(bereich.naechsterPunkt) }}</button>
        <button type="button" class="btn" data-action="beginnen-nein" autofocus @click="frageBeginnen = false">{{ t('common.cancel') }}</button>
      </template>
    </AppDialog>
  </section>
</template>
