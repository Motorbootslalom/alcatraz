<script setup lang="ts">
import { computed } from 'vue'
import { useStore } from '../state/store'
import { useEvent } from '../lib/event'
import { sollgewichtOf } from '../config/catalog'
import { herkunftAnzeige, originLabelKey, starterHerkunft } from '../lib/origin'
import { listenNachname, type NamenArt } from '../lib/namen'
import { useListenSprache } from '../lib/listensprache'
import { parcoursName } from '../config/sprache'
import { geburtsdatumAufListe } from '../i18n'
import { SEITEN_VORGABE } from '../lib/seiten'
import type { StarterDokument, StarterListe } from '../lib/starterlisten'
import type { ErgebnisHerkunft, Starter } from '../types'
import HerkunftText from './HerkunftText.vue'
import ListenDokument from './ListenDokument.vue'

/**
 * Die Blätter der Listen mit einer Zeile je Starter: Starterlisten (verzahnt, je Herkunft,
 * nach Klasse), Vorsteg-Liste und Gewichtsliste zum Eintragen. Was auf ihnen steht, legt
 * lib/starterlisten.ts `starterDokumente` fest; hier steht nur das Blatt.
 *
 * Eine Komponente, weil dieselbe Starterliste an zwei Stellen gedruckt wird: im Reiter
 * „Starterlisten“ (views/ListsView.vue) und in der Druckdatei (DruckdateiListen.vue) – dort
 * in der Fassung, die nach außen geht: Namen nach der Regel des Aushangs, ohne Geburtsdatum.
 */
const props = withDefaults(
  defineProps<{
    dokumente: StarterDokument[]
    liste: StarterListe
    /** `herkunft`: Liste je Herkunft – ohne Spalte der Herkunft (sie steht im Kopf), die Klasse vor dem Geburtsdatum. */
    form?: 'starter' | 'herkunft'
    /** Namen: voll (Vorgabe), Nachname gekürzt („M.“) oder gar nicht – dann stehen nur Startnummer, Herkunft und Klasse da. */
    namen?: NamenArt
    /** Geburtsdatum zeigen; fehlt = wie für die Veranstaltung eingestellt (auf der Gewichtsliste immer, auf der Vorsteg-Liste nie). */
    geburtsdatum?: boolean
    /** Wie die Herkunft dasteht; `aus` = keine Spalte. Fehlt = wie für die Starterlisten eingestellt (`listOrigin`). */
    herkunft?: ErgebnisHerkunft
  }>(),
  // Ohne Vorgabe machte Vue aus dem fehlenden Schalter ein `false` – „nie zeigen“ statt „wie eingestellt“.
  { geburtsdatum: undefined },
)

const { state } = useStore()
// Die Klasse steht mit ihrem Namen aus dem Regelwerk in der Spalte (UIM: „Dolphin“), sonst mit ihrer Kennung.
const { classCell } = useEvent()
// Was auf den Blättern steht, folgt der Listensprache (lib/listensprache.ts).
const { t: lt, listenLocale, kuerzelNorm } = useListenSprache()

const form = computed(() => (props.liste === 'starter' ? (props.form ?? 'starter') : 'starter'))
// Gewichtslisten entstehen beim Check-in, oft bevor es Startnummern gibt – vorn steht die Klasse.
const weightList = computed(() => props.liste === 'gewicht')
const mitNamen = computed(() => props.namen !== 'ohne')
/** Für eine Liste, die nach außen geht, lässt sich der Nachname auf den Anfangsbuchstaben kürzen. */
const nachname = (p: Starter) => listenNachname(p, props.namen)
const herkunftStil = computed(() => (props.herkunft === undefined || props.herkunft === 'aus' ? state.value.listOrigin : props.herkunft))
// Die Spalte der Herkunft: nicht auf der Gewichtsliste und der Liste je Herkunft – dort steht sie im Kopf.
const showOrigin = computed(() => state.value.originMode !== 'none' && props.herkunft !== 'aus' && !weightList.value && form.value === 'starter')
// Geburtsdatum nur, wenn die Veranstaltung es zeigt; auf der Vorsteg-Liste steht es nie.
// Auf der Gewichtsliste steht das Geburtsdatum immer – es wird beim Check-in abgeglichen.
const showBirthdate = computed(() => props.geburtsdatum ?? (weightList.value || (state.value.showBirthdate && props.liste !== 'vorsteg')))
const weightText = (p: Starter) => (p.gewicht === undefined ? '' : String(p.gewicht).replace('.', ','))
// Was als Herkunft dasteht (Text, Kürzel, Flagge), entscheidet lib/origin.ts – für alle Listen gleich.
const origin = (p: Starter) => starterHerkunft(p, state.value.originMode, herkunftStil.value, state.value.originShort, listenLocale.value, kuerzelNorm.value)
/** Die Herkunft im Kopf eines Blatts: ausgeschrieben – sie ist dort der Name des Blatts –, mit Flagge, wenn die Starterlisten eine zeigen. */
const titelHerkunft = (name: string) => herkunftAnzeige(name, state.value.originMode, state.value.listOrigin.startsWith('flagge') ? 'flagge-lang' : 'lang', state.value.originShort, listenLocale.value)
const columns = computed(
  () =>
    2 +
    (mitNamen.value ? 2 : 0) +
    (showOrigin.value ? 1 : 0) +
    (showBirthdate.value ? 1 : 0) +
    (props.liste === 'vorsteg' ? state.value.laufCount : 0) +
    (weightList.value ? 1 : 0),
)
const runs = computed(() => Array.from({ length: state.value.laufCount }, (_, i) => i + 1))

/**
 * Lange Namen werden wie in den bisherigen Ausdrucken kleiner gesetzt statt umbrochen. Erst
 * sehr lange (fit-3, etwa ab 61 Zeichen Herkunft) dürfen umbrechen, wenn die Breite nicht
 * reicht: Sonst würde die Tabelle breiter als das Blatt, und der Browser verkleinerte beim
 * Drucken die ganze Seite. Die höhere Zeile misst die Seitenteilung mit.
 */
const fit = (text: string, normal: number) =>
  text.length > normal * 1.9 ? 'fit-3' : text.length > normal * 1.35 ? 'fit-2' : text.length > normal ? 'fit-1' : ''

/**
 * Der breiteste Text jeder Spalte, je Dokument. Jede Seite ist eine eigene Tabelle und richtete
 * ihre Spalten sonst nur nach den eigenen Zeilen aus – die Spalten sprängen von Seite zu Seite.
 * Eine unsichtbare Zeile mit diesen Texten im Kopf jeder Seite (`.sheet-mass`) hält sie gleich.
 * „Breit“ ist geschätzt: Zeichen mal Schriftgrad der kleiner gesetzten Namen.
 */
const SCHRIFTGRAD: Record<string, number> = { '': 1, 'fit-1': 0.82, 'fit-2': 0.68, 'fit-3': 0.68 }
const breitester = (texte: string[], normal = Infinity) => {
  const breite = (text: string) => text.length * SCHRIFTGRAD[fit(text, normal)]
  return texte.reduce((a, b) => (breite(b) > breite(a) ? b : a), '')
}
const masszeilen = computed(() =>
  props.dokumente.map((s) => {
    const alle = s.groups.flat().map((z) => z.p)
    return {
      nr: breitester(alle.map((p) => p.startNr)),
      nachname: breitester(alle.map(nachname), 18),
      vorname: breitester(alle.map((p) => p.vorname), 18),
      // Die breiteste Herkunft samt Flagge: `mass` rechnet deren Breite mit.
      herkunft: showOrigin.value ? alle.map(origin).reduce((a, b) => (breitester([a.mass, b.mass], 32) === a.mass ? a : b), herkunftAnzeige('', 'none', 'lang', {})) : undefined,
      geburtsdatum: breitester(alle.map((p) => (p.geburtsdatum ? geburtsdatumAufListe(listenLocale.value, p.geburtsdatum) : ''))),
      klasse: breitester(alle.map((p) => classCell(p.klasse))),
    }
  }),
)

const heading = computed(() => [state.value.eventName, state.value.eventJahr].filter(Boolean).join(' '))
/** Die Blöcke eines Dokuments in Zeilen – daraus teilt es sich in Seiten (lib/seiten.ts). */
const laengen = computed(() => props.dokumente.map((s) => s.groups.map((g) => g.length)))
</script>

<template>
<div :class="['sheet', weightList ? 'weights' : '']">
  <!-- Je Abschnitt ein Dokument: Es teilt sich selbst in Seiten und zählt nur die eigenen. -->
  <div v-for="(s, si) in dokumente" :key="`${liste}:${form}:${s.id}`" class="sheet-section" :data-liste="s.id">
    <ListenDokument
      v-slot="{ teile }"
      class="sheet-page"
      :laengen="laengen[si]"
      :format="weightList ? 'landscape' : 'portrait'"
      :vorgabe="weightList ? SEITEN_VORGABE.gewicht : form === 'herkunft' ? SEITEN_VORGABE.starterHerkunft : SEITEN_VORGABE.starter"
      :sprache="listenLocale"
    >
    <!-- Mit Markierung ist die Tabelle schmaler: Links und rechts von ihr stehen die Dreiecke, auf dem Blatt statt im Seitenrand. -->
    <table :class="['sheet-table', s.markierung ? 'sheet-table--markierung' : '']">
      <thead>
        <tr class="sheet-title">
          <th :colspan="columns">
            <!-- Jede Angabe in einem eigenen Feld: Liste | Parcours | Herkunft | Veranstaltung. Was fehlt, entfällt. -->
            <div class="sheet-title-box">
              <!-- Das Leerzeichen zwischen den Feldern zeichnet nichts (Flex), trennt sie aber im Text:
                   Kopiert, vorgelesen oder aus dem PDF gelesen heißt es „Gewichtsliste Deutschland“. -->
              <span class="list" data-feld="liste">{{ s.title }}</span>{{ ' ' }}
              <span v-if="s.zusatz" class="feld" data-feld="zusatz">{{ parcoursName(s.zusatz, listenLocale) }}</span>{{ ' ' }}
              <span v-if="s.origin" class="feld" data-feld="herkunft"><HerkunftText :anzeige="titelHerkunft(s.origin)" /></span>{{ ' ' }}
              <span class="event" data-feld="veranstaltung">{{ heading }}</span>
            </div>
          </th>
        </tr>
        <tr class="sheet-cols">
          <th v-if="weightList" class="narrow">{{ lt('lists.class') }}</th>
          <th v-else class="narrow">{{ lt('common.startNr') }}</th>
          <template v-if="mitNamen">
            <th>{{ lt('common.lastName') }}</th>
            <th>{{ lt('common.firstName') }}</th>
          </template>
          <th v-if="form === 'herkunft'" class="narrow">{{ lt('lists.class') }}</th>
          <th v-if="showOrigin">{{ lt(originLabelKey(state.originMode)) }}</th>
          <th v-if="showBirthdate" class="narrow">{{ lt('common.birthdate') }}</th>
          <template v-if="liste === 'vorsteg'">
            <th v-for="r in runs" :key="r" class="check">{{ lt('lists.run', { n: r }) }}</th>
          </template>
          <template v-if="weightList">
            <th class="weight">{{ lt('lists.standardWeight') }}</th>
            <th class="weight">{{ lt('lists.weight') }}</th>
          </template>
          <th v-else-if="form !== 'herkunft'" class="narrow">{{ lt('lists.class') }}</th>
        </tr>
        <!-- Unsichtbare Maßzeile: hält die Spalten auf allen Seiten der Liste gleich breit (siehe `masszeilen`).
             Mit Markierung fett – die hervorgehobenen Zeilen sind es auch und brauchen die Breite. -->
        <tr :class="['sheet-mass', s.markierung ? 'markiert' : '']" aria-hidden="true">
          <td class="narrow">{{ weightList ? masszeilen[si].klasse : masszeilen[si].nr }}</td>
          <template v-if="mitNamen">
            <td :class="fit(masszeilen[si].nachname, 18)">{{ masszeilen[si].nachname }}</td>
            <td :class="fit(masszeilen[si].vorname, 18)">{{ masszeilen[si].vorname }}</td>
          </template>
          <td v-if="form === 'herkunft'" class="narrow">{{ masszeilen[si].klasse }}</td>
          <td v-if="showOrigin && masszeilen[si].herkunft" :class="fit(masszeilen[si].herkunft.mass, 32)"><HerkunftText :anzeige="masszeilen[si].herkunft" /></td>
          <td v-if="showBirthdate" class="narrow">{{ masszeilen[si].geburtsdatum }}</td>
          <template v-if="liste === 'vorsteg'">
            <td v-for="r in runs" :key="r" class="check" />
          </template>
          <template v-if="weightList">
            <td class="weight" />
            <td class="weight" />
          </template>
          <td v-else-if="form !== 'herkunft'" class="narrow">{{ masszeilen[si].klasse }}</td>
        </tr>
      </thead>
      <tbody v-for="teil in teile" :key="teil.block">
        <tr v-for="{ p, shade, markiert } in s.groups[teil.block].slice(teil.von, teil.bis)" :key="p.id" :class="{ shade, markiert }" :data-markiert="markiert ? '' : undefined">
          <td v-if="weightList" class="narrow">{{ classCell(p.klasse) }}</td>
          <td v-else class="narrow">{{ p.startNr }}</td>
          <template v-if="mitNamen">
            <td :class="fit(nachname(p), 18)">{{ nachname(p) }}</td>
            <td :class="fit(p.vorname, 18)">{{ p.vorname }}</td>
          </template>
          <td v-if="form === 'herkunft'" class="narrow">{{ classCell(p.klasse) }}</td>
          <td v-if="showOrigin" :class="fit(origin(p).mass, 32)"><HerkunftText :anzeige="origin(p)" /></td>
          <td v-if="showBirthdate" class="narrow">{{ p.geburtsdatum ? geburtsdatumAufListe(listenLocale, p.geburtsdatum) : '' }}</td>
          <template v-if="liste === 'vorsteg'">
            <td v-for="r in runs" :key="r" class="check" />
          </template>
          <template v-if="weightList">
            <td class="weight">{{ sollgewichtOf(state.regelwerk, state.sollgewicht, p.klasse) }} kg</td>
            <td class="weight">{{ weightText(p) }}</td>
          </template>
          <td v-else-if="form !== 'herkunft'" class="narrow">{{ classCell(p.klasse) }}</td>
        </tr>
      </tbody>
    </table>
    </ListenDokument>
  </div>
</div>
</template>
