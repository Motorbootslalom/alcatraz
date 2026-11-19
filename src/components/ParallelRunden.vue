<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useStore } from '../state/store'
import { useKonfig } from '../lib/konfig'
import { useEvent } from '../lib/event'
import { festeRunden } from '../lib/parallelBogen'
import { alleWeiter, klassenStaende, rundenWerteZahl, type KlassenStand, type RundenSchritt } from '../lib/parallelStage'
import { klassenTeilnehmer, loeseAuf, rundenName, VORLAUF } from '../planung/parallelRunden'
import { adresse } from '../lib/router'
import { rundenNeuGeordnet } from '../state/reducer'
import { t, tn } from '../i18n'
import type { ClassId, ParallelRunde } from '../types'
import AppDialog from './AppDialog.vue'
import HeatTable from './HeatTable.vue'

/**
 * Die Runden nach dem Vorlauf (Regel 960, Pkt. 4.4 und 5.2.6): je Klasse, wo sie steht, welche
 * Runde als Nächstes festgeschrieben werden kann (Halbfinale, Finals, Wiederholung) und wer
 * darin gegen wen fährt – gerechnet in lib/parallelStage.ts. Festgeschrieben und gelöscht wird
 * von Hand, je Klasse: Ein Plan, der einmal gedruckt ist, ändert sich nicht von selbst, auch
 * wenn ein Protest das Ergebnis davor ändert; er gilt dann als veraltet (Warnung). „Löschen“
 * (nicht „Lösen“, Entscheidung des Nutzers vom 15.11.2026): Es nimmt die Klasse aus dem Plan der
 * Runde und löscht ihre Werte darin.
 *
 * Darunter die festgeschriebenen Pläne der Runden, klassenübergreifend und verzahnt wie der
 * Vorlauf (klein/groß im Wechsel, 19.11.2026) – so stehen sie auf den Listen der race officials.
 * Oben „Alle Klassen weiter“: die nächste Runde aller Klassen, die so weit sind, in einem Schritt.
 */
const { state, dispatch } = useStore()
const konfig = useKonfig()
const { classLabel } = useEvent()

const staende = computed(() => klassenStaende(state.value, konfig.value))
const name = (runde: ParallelRunde) => rundenName(runde, t)
const starterVon = computed(() => new Map(state.value.starters.map((p) => [p.id, p])))
const nummer = (id: string | null) => (id === null ? t('parallel.dummy') : (starterVon.value.get(id)?.startNr ?? '?'))
const finalText = (finale: 1 | 3 | undefined) => (finale === undefined ? '' : `${t(`parallel.final.${finale}`)}: `)
const paare = (schritt: RundenSchritt) => schritt.paare.map((p) => `${finalText(p.finale)}${nummer(p.a)} ↔ ${nummer(p.b)}`).join(' · ')
const nummern = (ids: readonly string[]) => ids.map((id) => nummer(id)).join(', ')
/** Die Runde der Klasse, an der gerade erfasst wird: festgeschrieben, aber noch nicht vollständig. */
const laufend = (ks: KlassenStand) => ks.runden.find((r) => r.zustand !== 'fertig' && !r.veraltet)
/** Ein Gleichstand an der Grenze, dessen Wiederholung noch nicht festgeschrieben ist. */
const gleichstand = (ks: KlassenStand) => ks.runden.map((r) => r.ergebnis).find((e) => e && e.rerun.length > 0 && e.rerunFest === false)

function schreibeFest(klasse: ClassId, runde: ParallelRunde) {
  pruefeUndSende([{ klasse, runde }], () => dispatch({ type: 'PARALLEL_RUNDE_FESTSCHREIBEN', klasse, runde }))
}

// Ordnet das Festschreiben eine Runde neu, in der schon andere Klassen stehen (verzahnt, 19.11.2026),
// rücken deren Zeilen – schon gedruckte Listen und Laufzettel passten nicht mehr. Dann erst nach
// Rückfrage, wie beim Löschen (Prüfbefund vom 19.11.2026); sonst ohne.
const neuOrdnen = ref<{ runden: ParallelRunde[]; senden: () => void } | null>(null)
function pruefeUndSende(schritte: { klasse: ClassId; runde: ParallelRunde }[], senden: () => void) {
  const runden = rundenNeuGeordnet(state.value, schritte)
  if (runden.length === 0) senden()
  else neuOrdnen.value = { runden, senden }
}
function neuOrdnenBestaetigt() {
  neuOrdnen.value?.senden()
  neuOrdnen.value = null
}

// „Alle Klassen weiter“ (Wunsch des Nutzers vom 19.11.2026): Wer mitkommt, sagt dieselbe Prüfung
// wie beim Knopf je Klasse (lib/parallelStage.ts `alleWeiter`); der Knopf erscheint erst ab zwei
// Klassen – für eine reicht ihr eigener. Rückfrage nur, wenn eine Runde neu geordnet würde (wie je Klasse).
const alle = computed(() => alleWeiter(staende.value))
const alleRunden = computed(() => [...new Set(alle.value.weiter.map((s) => s.runde))].map(name).join(', '))
const alleKlassen = computed(() => alle.value.weiter.map((s) => classLabel(s.klasse)).join(', '))
const bleibenText = computed(() => alle.value.bleiben.map((b) => t(`parallel.rounds.stay.${b.grund}`, { class: classLabel(b.klasse), round: name(b.runde) })).join(' · '))
function alleFest() {
  const schritte = alle.value.weiter
  if (schritte.length > 0) pruefeUndSende(schritte, () => dispatch({ type: 'PARALLEL_RUNDEN_ALLE_FESTSCHREIBEN', schritte }))
}

// Löschen nur nach Rückfrage: Die Listen der Runde können gedruckt sein, und die Werte der Klasse
// in dieser Runde gehen verloren – die Rückfrage nennt, wie viele.
const frage = ref<{ klasse: ClassId; runde: ParallelRunde } | null>(null)
const frageWerte = computed(() =>
  frage.value ? rundenWerteZahl(state.value.eingaben, frage.value.runde, klassenTeilnehmer(state.value.parallelPlaene[frage.value.runde], frage.value.klasse)) : { werte: 0, starter: 0 },
)
function loesche() {
  const f = frage.value
  if (f) dispatch({ type: 'PARALLEL_RUNDE_LOESEN', klasse: f.klasse, runde: f.runde })
  frage.value = null
}
// Ist die Runde inzwischen anders gelöscht (zweites Fenster), geht der Dialog zu.
watch(staende, (alle) => {
  const f = frage.value
  if (f && !alle.find((ks) => ks.klasse === f.klasse)?.loesbar.includes(f.runde)) frage.value = null
})

// Die festgeschriebenen Pläne der Runden nach dem Vorlauf, mit Klasse und Finale je Start.
const plaene = computed(() =>
  festeRunden(state.value.parallelPlaene)
    .filter((r) => r !== VORLAUF)
    .map((runde) => {
      const fest = state.value.parallelPlaene[runde]!
      return {
        runde,
        heats: loeseAuf(fest, state.value.starters).plan.heats,
        vermerke: fest.starts.map((s) => [s.klasse ? classLabel(s.klasse) : '', s.finale ? t(`parallel.final.${s.finale}`) : ''].filter(Boolean).join(' · ')),
      }
    }),
)
</script>

<template>
  <div class="panel" data-panel="parallel-runden">
    <h2>{{ t('parallel.rounds.title') }}</h2>
    <p class="hint">{{ t('parallel.rounds.hint') }}</p>
    <p class="note" data-hinweis="parallel-annahmen">{{ t('parallel.rounds.assumptions') }}</p>
    <p v-if="staende.length === 0" class="note" data-hinweis="runden-ohne-plan">{{ t('parallel.rounds.none') }}</p>
    <div v-if="alle.weiter.length >= 2" class="parallel-alle" data-hinweis="runden-alle">
      <p class="hint">{{ t('parallel.rounds.allHint', { classes: alleKlassen }) }}</p>
      <button type="button" class="btn primary" data-action="runden-alle-fest" @click="alleFest">{{ t('parallel.rounds.all', { rounds: alleRunden }) }}</button>
      <p v-if="alle.bleiben.length > 0" class="note" data-hinweis="runden-alle-bleiben">{{ t('parallel.rounds.allStay', { classes: bleibenText }) }}</p>
    </div>
    <div v-for="ks in staende" :key="ks.klasse" class="parallel-klasse" :data-klasse="ks.klasse" :data-fertig="ks.fertig">
      <h3>{{ classLabel(ks.klasse) }}</h3>
      <ul class="parallel-weg">
        <li v-for="r in ks.runden" :key="r.runde" :data-runde="r.runde" :data-zustand="r.zustand" :data-veraltet="r.veraltet || undefined">
          <b>{{ name(r.runde) }}</b
          >: {{ t(`parallel.rounds.state.${r.zustand}`) }}
          <span v-if="r.veraltet" class="parallel-veraltet"> – {{ t('parallel.rounds.staleShort') }}</span>
          <button v-if="ks.loesbar.includes(r.runde)" type="button" class="btn ghost" data-action="runde-loeschen" :data-runde="r.runde" @click="frage = { klasse: ks.klasse, runde: r.runde }">
            {{ t('parallel.rounds.release', { round: name(r.runde) }) }}
          </button>
        </li>
      </ul>
      <p v-if="ks.runden.some((r) => r.veraltet)" class="boat-banner warn" role="alert" data-warnung="runde-veraltet">{{ t('parallel.rounds.stale') }}</p>
      <!-- Gleichstand an einer Grenze: Das Weiterkommen ist gesperrt, bis die Wiederholung gefahren ist (Pkt. 5.2.6). -->
      <p v-if="gleichstand(ks)" class="boat-banner warn" role="alert" data-hinweis="runde-gleichstand">
        {{ t('parallel.rounds.rerun', { numbers: nummern(gleichstand(ks)!.rerun) }) }}
      </p>
      <p v-if="ks.naechste" class="parallel-naechste" data-hinweis="runde-naechste">
        {{ t('parallel.rounds.next', { round: name(ks.naechste.runde), pairs: paare(ks.naechste) }) }}
        <button type="button" class="btn primary" data-action="runde-fest" :data-runde="ks.naechste.runde" @click="schreibeFest(ks.klasse, ks.naechste.runde)">
          {{ t('parallel.rounds.fix', { round: name(ks.naechste.runde) }) }}
        </button>
      </p>
      <p v-else-if="ks.fertig" class="boat-banner ok" role="status" data-hinweis="runde-fertig">
        {{ t('parallel.rounds.done') }} <a :href="adresse('listen')">{{ t('nav.listen') }}</a>
      </p>
      <p v-else-if="laufend(ks)" class="note" role="status" data-hinweis="runde-laeuft">
        {{ t('parallel.rounds.waiting', { round: name(laufend(ks)!.runde) }) }} <a :href="adresse('erfassung')">{{ t('nav.erfassung') }}</a>
      </p>
    </div>
  </div>

  <div v-for="p in plaene" :key="p.runde" class="panel" :data-runde="p.runde" data-fest="true">
    <h2>{{ name(p.runde) }}</h2>
    <p class="hint">{{ t('parallel.rounds.planHint') }}</p>
    <HeatTable :heats="p.heats" :vermerke="p.vermerke" :kopf="t('parallel.rounds.head', { n: p.heats.length })" />
  </div>

  <AppDialog v-if="neuOrdnen" :titel="t('parallel.rounds.reorder.heading', { rounds: neuOrdnen.runden.map(name).join(', ') })" data-dialog="runde-neu-ordnen" @abbrechen="neuOrdnen = null">
    <p>{{ t('parallel.rounds.reorder.text') }}</p>
    <template #knoepfe>
      <button type="button" class="btn primary" data-action="runde-neu-ordnen-bestaetigen" @click="neuOrdnenBestaetigt">{{ t('parallel.rounds.reorder.confirm') }}</button>
      <button type="button" class="btn" data-action="dialog-abbrechen" autofocus @click="neuOrdnen = null">{{ t('common.cancel') }}</button>
    </template>
  </AppDialog>

  <AppDialog v-if="frage" :titel="t('parallel.rounds.release.heading', { round: name(frage.runde), class: classLabel(frage.klasse) })" data-dialog="runde-loeschen" @abbrechen="frage = null">
    <p>{{ t('parallel.rounds.release.text') }}</p>
    <p v-if="frageWerte.werte > 0" class="boat-banner warn" role="alert" data-warnung="runde-werte">{{ tn('parallel.rounds.release.values', frageWerte.werte, { starter: frageWerte.starter }) }}</p>
    <template #knoepfe>
      <button type="button" class="btn primary" data-action="runde-loeschen-bestaetigen" @click="loesche">{{ frageWerte.werte > 0 ? tn('parallel.rounds.release.confirmValues', frageWerte.werte) : t('parallel.rounds.release.confirm') }}</button>
      <button type="button" class="btn" data-action="dialog-abbrechen" autofocus @click="frage = null">{{ t('common.cancel') }}</button>
    </template>
  </AppDialog>
</template>
