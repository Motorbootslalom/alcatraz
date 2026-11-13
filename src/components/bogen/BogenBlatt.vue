<script setup lang="ts">
import { computed, ref } from 'vue'
import { BOGEN_VORGABEN, bogenSeiten, type BogenAuftrag, type BogenKonfig, type BogenOptionen } from '../../lib/bogen'
import { pageHeightMm, rowsThatFit } from '../../lib/paging'
import BogenRueckseite from './BogenRueckseite.vue'
import BogenSeite from './BogenSeite.vue'

/**
 * Ein Wettkampfrichter-Bogen, bei Bedarf auf mehrere A4-Seiten aufgeteilt. Vorbild:
 * SheetView.vue im Fehlerpunkte-Prototyp. Jede Seite trägt Kopf, Spaltenüberschriften,
 * Legende/Bild, Leerzeilen und Unterschrift.
 *
 * Alles, was auf dem Bogen steht, kommt von außen (`auftrag`): Liste, Klasse(n), Lauf,
 * Zeilen, Kopfangaben. Die Beispielansicht reicht Muster-Zeilen herein, die echten Listen
 * später die Starter in Startreihenfolge.
 *
 * „Zeilen je Seite“ 0 = automatisch: Die erste Seite misst, wie viele Starter auf ein Blatt
 * passen; passt es nicht, wird in 5er-Schritten geteilt (lib/paging.ts).
 */
const props = defineProps<{
  konfig: BogenKonfig
  auftrag: BogenAuftrag
  optionen?: Pick<BogenOptionen, 'leerzeilen' | 'zeilenJeSeite' | 'teilenAb' | 'anzeige' | 'klassenBloecke' | 'leerzeilenJeKlasse'>
  rueckseite?: boolean
  kennzeichen?: string
  wkrPflege?: boolean
  wkrLabel?: string
}>()
const emit = defineEmits<{ wkr: [name: string] }>()

// Gemessene Höhe von Kopf/Fuß und Zeilenhöhe (von der ersten Seite). Nur echte Änderungen
// übernehmen – Rundungsrauschen soll die Aufteilung nicht hin- und herschalten.
const layout = ref<{ fixedPx: number; rowPx: number } | null>(null)
function onLayout(m: { fixedPx: number; rowPx: number }) {
  const cur = layout.value
  if (!cur || Math.abs(cur.fixedPx - m.fixedPx) > 2 || Math.abs(cur.rowPx - m.rowPx) > 0.5) layout.value = m
}

const orientation = computed(() => props.konfig.getSheetDef(props.auftrag.typeId).orientation)
const leerzeilen = computed(() => props.optionen?.leerzeilen ?? BOGEN_VORGABEN.leerzeilen)

/** Tabellenzeilen, die neben Kopf und Fuß auf ein Blatt passen (0 = unbekannt). */
const zeilenKapazitaet = computed(() =>
  layout.value ? rowsThatFit(layout.value.fixedPx, layout.value.rowPx, pageHeightMm(orientation.value)) : 0,
)
/** Starter je Seite, die neben Kopf/Fuß und den Leerzeilen auf ein Blatt passen (0 = unbekannt). */
const kapazitaet = computed(() => (layout.value ? Math.max(1, zeilenKapazitaet.value - leerzeilen.value) : 0))

const seiten = computed(() =>
  bogenSeiten(props.konfig, props.auftrag, {
    ...props.optionen,
    kapazitaet: kapazitaet.value,
    // Mit der Beschreibung auf der Rückseite gilt dieselbe Messung: Sie misst die Vorderseite, wie sie ist.
    zeilenKapazitaet: layout.value ? Math.max(2, zeilenKapazitaet.value) : 0,
  }),
)
</script>

<template>
  <template v-for="seite in seiten" :key="seite.pageIndex">
    <BogenSeite
      :seite="seite"
      :rueckseite="rueckseite"
      :kennzeichen="kennzeichen"
      :wkr-pflege="wkrPflege"
      :wkr-label="wkrLabel"
      @layout="onLayout"
      @wkr="emit('wkr', $event)"
    />
    <!-- Je Vorderseite eine Rückseite mit der Beschreibung. -->
    <BogenRueckseite v-if="rueckseite" :seite="seite" :kennzeichen="kennzeichen" />
  </template>
</template>
