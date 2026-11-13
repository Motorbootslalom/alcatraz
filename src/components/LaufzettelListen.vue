<script setup lang="ts">
import { computed, reactive, ref, useId, watchEffect } from 'vue'
import { merke } from '../lib/merken'
import { useStore } from '../state/store'
import { useKonfig } from '../lib/konfig'
import { useEvent } from '../lib/event'
import { useBogenZoom } from '../lib/bogenZoom'
import { buildLaufzettel, listenZeilen, messBoegen, messKennung, waehleLaufzettel, type Laufzettel, type LaufzettelAuswahl } from '../lib/laufzettel'
import { schrittText } from '../lib/laufzettelText'
import { laufzettelCode } from '../lib/qr'
import { veranstaltungsListen } from '../lib/listen'
import { wkrBoegenZumStand, type WkrBogen } from '../lib/wkrListen'
import { t, tn } from '../i18n'
import { useListenSprache } from '../lib/listensprache'
import type { ClassId } from '../types'
import BogenBlatt from './bogen/BogenBlatt.vue'
import LaufzettelBlatt from './LaufzettelBlatt.vue'

/**
 * Die Laufzettel (Checklisten) unter „Listen“: je Blattstapel – Parcours, Klasse und Lauf, bei
 * der Clubmeisterschaft Parcours und Lauf – ein Zettel mit einem Kästchen je gedruckter Seite
 * jeder Wettkampfrichter-Liste (lib/laufzettel.ts). Die
 * Bildschirmansicht ist die Druckansicht; gedruckt wird, was die Auswahl zeigt.
 *
 * Die Seitenzahlen sind gemessen, nicht geschätzt: Unsichtbar neben dem Fenster stehen
 * dieselben Bögen in Druckmaßen wie unter „Wettkampfrichter-Listen“ (BogenBlatt.vue) und
 * melden, in wie viele Seiten sie sich aufteilen – je Parcours, Klassen und Liste einer, weil
 * sich die Läufe nur im Kopf unterscheiden.
 *
 * `gesperrt`: Startnummern fehlen oder sind doppelt (ListsView.vue zeigt den Hinweis) – wie
 * bei den Bögen entsteht dann nichts.
 */
const props = defineProps<{ gesperrt?: boolean }>()
const emit = defineEmits<{
  /** Wie viele Zettel die Auswahl zeigt und wie sie heißt (für Fenstertitel und Dateiname). */
  stand: [stand: { anzahl: number; auswahl: string }]
}>()

const { state } = useStore()
const konfig = useKonfig()
// Gemessen wird mit der Konfiguration der Bögen (zweisprachige Bögen brechen anders um); die
// Namen auf dem Zettel stehen dagegen in der einen Sprache der übrigen Listen – „zweisprachig“
// gilt nur für die Bögen selbst, und „Tor 1 / 3 / 5 · Gate 1 / 3 / 5 – Seite 1“ kostete Platz.
const namen = useKonfig({ einsprachig: true })
const { classLabel, regelwerk } = useEvent()
const id = useId()
// Was auf dem Zettel steht, folgt der Listensprache (`lt`); die Bedienung der der Oberfläche (`t`).
const { listenLocale, t: lt } = useListenSprache()

const boegen = computed(() => wkrBoegenZumStand(state.value, konfig.value).boegen)
const listen = computed(() => veranstaltungsListen(konfig.value, state.value))

// Gemessene Seitenzahl je Mess-Kennung; bis ein Bogen gemessen ist, gilt eine Seite.
const seiten = reactive(new Map<string, number>())
const zuMessen = computed(() => (props.gesperrt ? [] : messBoegen(boegen.value)))
// Clubmeisterschaft mit „Papier sparen“: Alle Klassen stehen auf denselben Bögen – der Stapel ist der Lauf.
const jeParcours = computed(() => state.value.eventKind === 'club' && state.value.wkrClubGemeinsam)
const alle = computed<Laufzettel[]>(() => buildLaufzettel(boegen.value, listen.value, (b) => seiten.get(messKennung(b)) ?? 1, { jeParcours: jeParcours.value }))

const parcours = computed(() => state.value.parcoursList.filter((p) => alle.value.some((z) => z.parcoursId === p.id)))
const klassen = computed(() => [...new Set(alle.value.flatMap((z) => z.klassen))])
const laeufe = computed(() => [...new Set(alle.value.map((z) => z.lauf))].sort((a, b) => a - b))

// Eine Wahl, die es nach einer Änderung (Aufbau, Verzahnung, Läufe) nicht mehr gibt, gilt als „alle“.
const wahl = merke<LaufzettelAuswahl>('listen.laufzettel', {})
const auswahl = computed<LaufzettelAuswahl>(() => ({
  parcours: parcours.value.some((p) => p.id === wahl.value.parcours) ? wahl.value.parcours : undefined,
  klasse: wahl.value.klasse !== undefined && klassen.value.includes(wahl.value.klasse) ? wahl.value.klasse : undefined,
  lauf: wahl.value.lauf !== undefined && laeufe.value.includes(wahl.value.lauf) ? wahl.value.lauf : undefined,
}))
const zettel = computed(() => (props.gesperrt ? [] : waehleLaufzettel(alle.value, auswahl.value)))

function setze<K extends keyof LaufzettelAuswahl>(feld: K, e: Event) {
  const wert = (e.target as HTMLSelectElement).value
  wahl.value = { ...wahl.value, [feld]: wert === '' ? undefined : feld === 'lauf' ? Number(wert) : wert }
}

/** Die Auswahl in Worten, für Fenstertitel und Dateiname – in der Sprache der Oberfläche. */
const auswahlText = computed(() => {
  const a = auswahl.value
  return [
    a.parcours !== undefined ? parcours.value.find((p) => p.id === a.parcours)?.name : undefined,
    a.klasse !== undefined ? classLabel(a.klasse) : undefined,
    a.lauf !== undefined ? t('lists.wkr.runN', { n: a.lauf }) : undefined,
  ]
    .filter(Boolean)
    .join(' - ')
})
watchEffect(() => emit('stand', { anzahl: zettel.value.length, auswahl: auswahlText.value }))

const eventName = computed(() => [state.value.eventName, state.value.eventJahr].filter(Boolean).join(' '))
const mehrereParcours = computed(() => state.value.parcoursList.length > 1)
const klassenName = (k: ClassId) => regelwerk.value.klassenNamen[k] ?? k
/** „Klasse 3“, „Dolphin“ oder „Klassen E, 1, 2“. */
const klassenText = (ks: readonly ClassId[]) =>
  ks.length === 1 ? (regelwerk.value.klassenNamen[ks[0]] ?? lt('common.class', { id: ks[0] })) : lt('runsheet.classes', { classes: ks.map(klassenName).join(', ') })

// Der Name der Liste wie im Kopf des Bogens (einsprachig, siehe oben); teilen sich zwei den
// Titel, der ausführliche aus dem Menü.
const titelVon = computed(() => {
  const jeTyp = new Map(boegen.value.map((b) => [b.typeId, namen.value.getSheetDef(b.typeId).title]))
  const mehrfach = (text: string) => [...jeTyp.values()].filter((x) => x === text).length > 1
  return new Map([...jeTyp].map(([typeId, text]) => [typeId, mehrfach(text) ? namen.value.getSheetDef(typeId).menuLabel : text]))
})

const blaetter = computed(() =>
  zettel.value.map((z) => ({
    zettel: z,
    klassenText: klassenText(z.klassen),
    laufText: lt('lists.wkr.runN', { n: z.lauf }),
    parcours: mehrereParcours.value ? z.parcoursName : undefined,
    qr: laufzettelCode(state.value, z),
    // Eine Zeile je Liste; darin je Bogen seine Kästchen. Trägt ein Bogen nur einen Teil der
    // Klassen des Zettels (Clubmeisterschaft), stehen sie kurz davor („Kl. 4, 5“).
    zeilen: listenZeilen(z.zeilen).map((liste) => ({
      key: liste.typeId,
      label: titelVon.value.get(liste.typeId) ?? liste.typeId,
      gruppen: liste.boegen.map((b) => ({
        key: b.bogenId,
        label: b.klassen.length > 0 ? lt('runsheet.classShort', { classes: b.klassen.map(klassenName).join(', ') }) : undefined,
        seiten: b.seiten,
      })),
    })),
  })),
)
const titel = computed(() => [lt('runsheet.title'), eventName.value].filter(Boolean).join(' · '))
const schritte = computed(() => {
  const { titel: ueber, schritte: liste } = namen.value.getLaufzettelConfig()
  return { titel: ueber ? schrittText(ueber, lt) : undefined, liste: liste.map((s) => schrittText(s, lt)) }
})

const merkeSeiten = (b: WkrBogen, anzahl: number) => seiten.set(messKennung(b), anzahl)

// Zettel, die auch dicht gesetzt nicht auf ihr Blatt passen: Sie sagen es selbst (auch im
// Druck); hier steht zusätzlich, wie viele es sind und was hilft.
const zuViel = reactive(new Set<string>())
const merkeZuViel = (zettelId: string, ja: boolean) => (ja ? zuViel.add(zettelId) : zuViel.delete(zettelId))
const zuVielAnzahl = computed(() => zettel.value.filter((z) => zuViel.has(z.id)).length)

// Schmale Fenster: Die Zettel werden als Ganzes verkleinert, wie die Bögen (lib/bogenZoom.ts).
const stapel = ref<HTMLElement | null>(null)
const { zoom } = useBogenZoom(stapel)
</script>

<template>
  <div v-if="!gesperrt" class="panel no-print laufzettel-wahl">
    <p class="hint">{{ t('runsheet.hint') }}</p>
    <div class="row wkr-listen-leiste">
      <div v-if="mehrereParcours" class="field">
        <label :for="`${id}-parcours`">{{ t('lists.wkr.parcours') }}</label>
        <select :id="`${id}-parcours`" class="input" data-feld="lz-parcours" :value="auswahl.parcours ?? ''" @change="setze('parcours', $event)">
          <option value="">{{ t('lists.wkr.all') }}</option>
          <option v-for="p in parcours" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
      </div>
      <div class="field">
        <label :for="`${id}-klasse`">{{ t('lists.class') }}</label>
        <select :id="`${id}-klasse`" class="input" data-feld="lz-klasse" :value="auswahl.klasse ?? ''" @change="setze('klasse', $event)">
          <option value="">{{ t('lists.wkr.all') }}</option>
          <option v-for="k in klassen" :key="k" :value="k">{{ classLabel(k) }}</option>
        </select>
      </div>
      <div class="field">
        <label :for="`${id}-lauf`">{{ t('lists.wkr.run') }}</label>
        <select :id="`${id}-lauf`" class="input" data-feld="lz-lauf" :value="auswahl.lauf ?? ''" @change="setze('lauf', $event)">
          <option value="">{{ t('lists.wkr.all') }}</option>
          <option v-for="l in laeufe" :key="l" :value="l">{{ t('lists.wkr.runN', { n: l }) }}</option>
        </select>
      </div>
      <p class="note wkr-listen-stand" role="status">{{ tn('runsheet.count', zettel.length) }}</p>
    </div>
    <p v-if="zuVielAnzahl > 0" class="boat-banner warn" role="status" data-hinweis="lz-zuviel">
      {{ tn('runsheet.overflowNote', zuVielAnzahl) }}
      <template v-if="state.laufzettelLayout !== 'liste'">{{ t('runsheet.overflowFix') }} <a href="#/einstellungen">{{ t('nav.einstellungen') }}</a>.</template>
    </p>
    <p class="note" data-hinweis="lz-layout">
      {{ t('runsheet.layoutNote', { layout: t(`listopt.runsheet.${state.laufzettelLayout}`) }) }} <a href="#/einstellungen">{{ t('nav.einstellungen') }}</a>.
    </p>
    <p class="note">{{ t('runsheet.print') }}</p>
    <p class="note">{{ t('runsheet.scan') }} <a href="#/erfassung">{{ t('nav.erfassung') }}</a>.</p>
  </div>

  <div v-if="!gesperrt && alle.length > 0 && zettel.length === 0" class="panel empty no-print">{{ t('runsheet.none') }}</div>

  <!-- Immer da, auch leer: Der Stapel misst seine Breite ab dem Einhängen. -->
  <div ref="stapel" class="laufzettel-stapel" :style="zoom">
    <LaufzettelBlatt
      v-for="b in blaetter"
      :key="b.zettel.id"
      :klassen-text="b.klassenText"
      :lauf-text="b.laufText"
      :parcours="b.parcours"
      :titel="titel"
      :zeilen="b.zeilen"
      :layout="state.laufzettelLayout"
      :qr="b.qr"
      :schritte-titel="schritte.titel"
      :schritte="schritte.liste"
      :sprache="listenLocale"
      :data-zettel="b.zettel.id"
      @zuviel="merkeZuViel(b.zettel.id, $event)"
    />
  </div>

  <!-- Nur zum Messen der Seitenzahlen (siehe oben): unsichtbar, nie gedruckt, für Vorleseprogramme nicht da. -->
  <div class="lz-messung no-print" aria-hidden="true" inert>
    <BogenBlatt
      v-for="b in zuMessen"
      :key="messKennung(b)"
      :konfig="konfig"
      :auftrag="b.auftrag"
      :optionen="b.optionen"
      :rueckseite="state.wkrRueckseite"
      @seiten="merkeSeiten(b, $event)"
    />
  </div>
</template>
