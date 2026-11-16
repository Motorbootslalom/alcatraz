<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { Meldung, MeldungArt, OeffentlicheSicht, SichtBereich, SichtStart } from '../../types'
import type { BetriebAenderung } from '../../state/reducer/betrieb'
import { t, tn } from '../../i18n'
import { merke } from '../../lib/merken'
import AppDialog from '../AppDialog.vue'
import BetriebsFolge from './BetriebsFolge.vue'
import EinreihenListe from './EinreihenListe.vue'
import EinsteigenAb from './EinsteigenAb.vue'
import KlassenAussetzen from './KlassenAussetzen.vue'
import MeldungWahl from './MeldungWahl.vue'
import { beginnenText, punktText, startZeile } from './texte'

/**
 * Start-Freigabe eines Bereichs (Parcours): wer im Boot sitzt, wer als Nächstes dran ist, „Nächster Start“,
 * „Zurück“, „Lauf N beginnen“ und die Meldung auf der Anzeigetafel (E1); dazu die Steuerung der Etappe E2
 * (Plan vom 16.11.2026): den Nächsten zurückstellen, einen anderen Starter wählen und zeigen, verschieben,
 * zurückgestellte und nachzuholende einreihen, Klassen aussetzen („Boot fehlt“) und vorziehen, Meldungsvorlagen,
 * „Einsteigen ab …“. Nach dem Tafel-Prototyp (StegPanel.vue), neu auf die Sicht geschrieben.
 *
 * Anordnung für den Laptop am Steg: oben groß, was jeder Start braucht (Im Boot, Als Nächstes, „Nächster
 * Start“); daneben die seltenen Griffe als Knöpfe; alles Weitere zugeklappt darunter, damit nicht bei jedem
 * Starter gescrollt wird. Rückfrage nur bei „Lauf beginnen“, solange Starts offen sind – alles andere ist
 * umkehrbar. Nur betriebliche Knöpfe; Einstellungen (etwa „Verzahnung beim Verschieben halten“) stehen in den
 * Einstellungen (BETRIEB_ANNAHMEN.wohin).
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
/** Ohne festgeschriebene Verzahnung ruhen Zeigen, Beginnen und alle Schritte der Folge (BETRIEB_ANNAHMEN.schritteNurFestgeschrieben). */
const gesperrt = computed(() => !b.value.fest)

interface Zeile {
  startNr: string
  name: string
  was: string
  herkunft: string
}
/** Ein Start mit seinem Starter; `null`, wenn der Starter nicht (mehr) in der Sicht steht (gelöscht). */
function zeile(s: SichtStart | null): Zeile | null {
  if (!s || !props.sicht.starter[s.starter]) return null
  return startZeile(props.sicht, s)
}

const aktuell = computed(() => zeile(b.value.aktuell))
const vorig = computed(() => zeile(b.value.vorig))
const naechster = computed(() => zeile(b.value.offen[0] ?? null))
const vorher = computed(() => b.value.aktuell?.key ?? null)

const stand = computed(() => {
  if (!b.value.punkt) return t('betrieb.nichtBegonnen')
  return `${t('betrieb.laufend', { punkt: punktText(b.value.punkt) })} · ${tn('betrieb.offen', b.value.offenZahl)}`
})
/**
 * Starts begonnener Punkte, die nicht von selbst drankommen: zurückgestellt, „Boot fehlt“, nachzuholen. Ist
 * nichts mehr frei, aber hier noch etwas, stockt der Lauf – er ist nicht zu Ende (die Bedienung muss etwas tun).
 */
const wartend = computed(() => {
  const begonnen = new Set(b.value.begonnen)
  return [...b.value.zurueckgestellt, ...b.value.bootFehlt, ...b.value.nachzuholen].filter((s) => begonnen.has(s.punkt)).length
})
/** Kein Nächster: Der Lauf stockt, der laufende Punkt ist zu Ende (die Tafel bleibt stehen) – oder alle sind es. */
const ohneNaechsten = computed(() => {
  if (b.value.offen.length > 0 || !b.value.punkt) return ''
  if (wartend.value > 0) return tn('betrieb.stockt', wartend.value)
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
/** B-3: Der Nächste ist kurzfristig verhindert – er fährt vorerst nicht, bleibt aber sichtbar (wie „Nächsten zurückstellen“ im Prototyp). */
function zurueckstellen() {
  const n = b.value.offen[0]
  if (n) props.sende({ type: 'BETRIEB_ZURUECKSTELLEN', bereich: b.value.id, ref: n.key })
}
function einreihen(key: string, wo: 'naechster' | 'ende') {
  props.sende({ type: 'BETRIEB_EINREIHEN', bereich: b.value.id, ref: key, wo })
}

// „Anderen Starter wählen“: aufgeklappt bleibt, wie man es gelassen hat (lib/merken.ts) – nach dem Zeigen zu.
const wahlOffen = merke(`betrieb.wahl.${props.bereich.id}`, false)
const zeigenKnopf = ref<HTMLButtonElement | null>(null)
const wahlKnopf = ref<HTMLButtonElement | null>(null)
/**
 * Die Wahl schließt sich (die Komponente wird ausgehängt): Der Fokus fiele auf <body>, und wer mit der Tastatur
 * arbeitet, müsste vom Seitenanfang her wieder hintabben. Nach „Zeigen“ daher auf „Nächster Start“ (der nächste
 * Griff), nach Escape zurück auf „Anderen Starter wählen“.
 */
async function wahlZu(grund: 'gezeigt' | 'geschlossen') {
  wahlOffen.value = false
  await nextTick()
  const naechsterKnopf = zeigenKnopf.value && !zeigenKnopf.value.disabled ? zeigenKnopf.value : null
  ;(grund === 'gezeigt' ? (naechsterKnopf ?? wahlKnopf.value) : wahlKnopf.value)?.focus()
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
/** Eine Vorlage füllt nur den Entwurf (B-8); auf die Anzeigetafel kommt sie erst mit „Meldung zeigen“. */
function vorlage(m: Meldung) {
  text.value = m.text
  art.value = m.art
}
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
      <span v-else-if="ohneNaechsten" :class="['note', wartend > 0 ? 'betrieb-warn' : '']" :data-teil="wartend > 0 ? 'stockt' : 'ende'">{{ ohneNaechsten }}</span>
      <span v-else class="note">–</span>
    </div>

    <div class="betrieb-knoepfe">
      <button ref="zeigenKnopf" type="button" class="btn primary betrieb-gross" data-action="zeigen" :disabled="gesperrt || !naechster" @click="naechsterStart">
        {{ t('betrieb.zeigen') }}
      </button>
      <button type="button" class="btn" data-action="zurueckstellen" :disabled="gesperrt || !bereich.offen[0]" :title="t('betrieb.zurueckstellen.title')" @click="zurueckstellen">
        {{ t('betrieb.zurueckstellen') }}
      </button>
      <button type="button" class="btn" data-action="zurueck" :disabled="!bereich.aktuell" :title="t('betrieb.zurueck.title')" @click="zurueck">
        {{ t('betrieb.zurueck') }}
      </button>
      <button
        ref="wahlKnopf"
        type="button"
        :class="['btn', wahlOffen && !gesperrt ? 'active' : '']"
        data-action="wahl"
        :aria-expanded="wahlOffen && !gesperrt"
        :disabled="gesperrt"
        :title="t('betrieb.wahl.title')"
        @click="wahlOffen = !wahlOffen"
      >
        {{ t('betrieb.wahl') }}
      </button>
      <button
        v-if="bereich.naechsterPunkt"
        type="button"
        :class="['btn', bereich.offen.length === 0 && wartend === 0 ? 'primary' : '']"
        data-action="beginnen"
        :disabled="gesperrt"
        @click="beginnen"
      >
        {{ beginnenText(bereich.naechsterPunkt) }}
      </button>
    </div>

    <BetriebsFolge v-if="wahlOffen && !gesperrt" :sicht="sicht" :bereich="bereich" :sende="sende" :gesperrt="gesperrt" @fertig="wahlZu" />

    <EinreihenListe :sicht="sicht" :eintraege="bereich.zurueckgestellt" art="zurueckgestellt" :gesperrt="gesperrt" @zeigen="zeige" @einreihen="einreihen" />
    <EinreihenListe :sicht="sicht" :eintraege="bereich.nachzuholen" art="nachzuholen" :gesperrt="gesperrt" @zeigen="zeige" @einreihen="einreihen" />

    <!-- Umgestellt: Die WKR-Bögen bleiben trotzdem, wie sie sind – das soll am Steg niemand fürchten müssen. -->
    <p v-if="bereich.abweichend" class="note" data-teil="abweichend">{{ t('betrieb.abweichend') }}</p>

    <KlassenAussetzen :sicht="sicht" :bereich="bereich" :sende="sende" :gesperrt="gesperrt" />

    <details class="betrieb-abschnitt betrieb-meldung" :open="!!bereich.meldung">
      <summary>
        {{ t('betrieb.meldung') }}
        <span v-if="bereich.meldung" :class="['betrieb-meldung-aktiv', bereich.meldung.art]" data-teil="meldung-aktiv">
          {{ t('betrieb.meldung.aktiv', { art: t(`meldung.${bereich.meldung.art}`), text: bereich.meldung.text }) }}
        </span>
      </summary>
      <p class="note">{{ t('betrieb.meldung.hint') }}</p>
      <div class="row betrieb-meldung-wahl">
        <div class="segmented" role="group" :aria-label="t('betrieb.meldung')">
          <button v-for="a in ARTEN" :key="a" type="button" :data-meldung-art="a" :class="art === a ? 'active' : ''" :aria-pressed="art === a" @click="art = a">
            {{ t(`meldung.${a}`) }}
          </button>
        </div>
        <MeldungWahl :sicht="sicht" @wahl="vorlage" />
      </div>
      <textarea v-model="text" class="input" rows="3" maxlength="200" data-meldung-text :placeholder="t('betrieb.meldung.platzhalter')" :aria-label="t('betrieb.meldung')" />
      <p class="note">{{ t('meldung.vorlagen.hint') }}</p>
      <div class="betrieb-knoepfe">
        <button type="button" class="btn" data-action="meldung-setzen" :disabled="!text.trim()" @click="meldungSetzen(false)">{{ t('betrieb.meldung.setzen') }}</button>
        <button v-if="mehrere" type="button" class="btn" data-action="meldung-alle" :disabled="!text.trim()" @click="meldungSetzen(true)">{{ t('betrieb.meldung.alle') }}</button>
        <button type="button" class="btn" data-action="meldung-loeschen" :disabled="!bereich.meldung" @click="meldungLoeschen">{{ t('betrieb.meldung.loeschen') }}</button>
      </div>
    </details>

    <EinsteigenAb :sicht="sicht" :bereich="bereich" :sende="sende" :gesperrt="gesperrt" />

    <AppDialog v-if="frageBeginnen && bereich.naechsterPunkt" :titel="t('betrieb.beginnen.frage')" data-dialog="beginnen" @abbrechen="frageBeginnen = false">
      <p>{{ tn('betrieb.beginnen.text', bereich.offenZahl) }}</p>
      <template #knoepfe>
        <button type="button" class="btn primary" data-action="beginnen-ja" @click="beginnenJa">{{ beginnenText(bereich.naechsterPunkt) }}</button>
        <button type="button" class="btn" data-action="beginnen-nein" autofocus @click="frageBeginnen = false">{{ t('common.cancel') }}</button>
      </template>
    </AppDialog>
  </section>
</template>
