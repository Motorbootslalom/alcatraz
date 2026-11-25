<script setup lang="ts">
import { computed, ref } from 'vue'
import type { BojenFolge, Entwurf, MaskenAufbau, MaskenBoje, MaskenDisq, MaskenTeil } from '../../wkr/maske'
import type { MaskenWahl } from '../../wkr/maskenWahl'
import type { Weg } from '../../wkr/bojen'
import type { BildLage, BildWeg, BildZuordnung } from '../../wkr/bild'
import WkrBild from './WkrBild.vue'
import WkrBojen from './WkrBojen.vue'
import WkrDisq from './WkrDisq.vue'
import WkrDisqOrt from './WkrDisqOrt.vue'
import WkrKnoepfe from './WkrKnoepfe.vue'
import WkrVorsteg from './WkrVorsteg.vue'
import WkrZeiten from './WkrZeiten.vue'
import WkrTabelle from './WkrTabelle.vue'
import type { TabellenSpalte } from '../../wkr/tabelle'
import type { ListenTeil } from '../../wkr/liste'
import type { KeineZeitGrund } from '../../types'
import { useWkrText, type TabellenGesendet } from './texte'

/**
 * Die Arbeitsfläche einer Maske – die Wahl, WAS getippt wird (W5.1, Plan docs/plan-wkr-w5.md §11 „WkrMaske wächst“,
 * 22.11.2026): aus WkrMaske ausgelagert, ohne Verhalten zu ändern. WkrMaske behält Start, Entwurf, Takt und Rahmen
 * (Kopf, Karte, Ausweichen, Mehr, Fuß) und reicht hier nur durch; jede Änderung geht als Ereignis zurück.
 *
 * Je Art: Vorsteg → WkrVorsteg; Disq. offen → WkrDisqOrt (Bojen-Listen, erst die Boje, BZ4) bzw. WkrDisq; Bojen →
 * WkrBojen; sonst WkrKnoepfe. `maske` (F14, wkr/maskenWahl.ts wirksameMaske) wählt seit W5.2 (22.11.2026) das Bild
 * (WkrBild) – nur auf Bojen-Listen und nur mit vollständiger Zuordnung `bild` (wkr/bild.ts bildTreffer; fehlt eine
 * Boje im Bild der Klasse, bleiben es die Bojen-Knöpfe, BD2). DISQ im Fuß öffnet auch beim
 * Bild WkrDisqOrt (BD7). Zeit (W5.4, 22.11.2026, ZT1): `zeit` → WkrZeiten (Ziffernblock); auf gemischten Listen (Bojen +
 * Zeit) steht WkrZeiten unter den Bojen bzw. dem Bild – eine Zeile je Start. Tabelle (W5.5, 22.11.2026, TB1–TB5):
 * `maske === 'text'` mit `tabelle` → WkrTabelle statt allem anderen (auch statt der Disq.-Wahl – Buchstaben tippt man
 * dort in die Zelle); nicht auf reinen Zeit-Listen (feste Art, MW1). Die `:key` je Start und Teil
 * bleiben hier: ein vorgemerkter Disq.-Buchstabe bzw. ein offener Disq.-Modus gilt nie für den nächsten Start.
 */
const props = defineProps<{
  art: 'katalog' | 'vorsteg' | 'bojen' | 'zeit'
  /** Kennung des gezeigten Starts mit Teil und Korrektur – Schlüssel der Kinder. */
  schluessel: string
  aufbau: MaskenAufbau
  entwurf: Entwurf
  startNr: string
  disqOffen: boolean
  /** Lang gedrückte Boje (LD1, 22.11.2026): WkrDisqOrt beginnt bei ihren Buchstaben. */
  disqBoje?: MaskenBoje | null
  disqCodes: MaskenDisq['codes']
  gesperrt: boolean
  weg: Weg
  /** Folge für WkrBojen und WkrDisqOrt – beim Bild schon die Vorgabe (WkrMaske bojenFolgeWirksam, BL6 24.11.2026). */
  bojenFolge: BojenFolge
  sichtbareTeile: MaskenTeil[]
  maske?: MaskenWahl
  /** Zuordnung des Bilds der Klasse (W5.2); `null` = kein vollständiges Bild → Bojen-Knöpfe (BD2). */
  bild?: BildZuordnung | null
  /** Titel der Klasse (Beschriftung des Bilds). */
  klasse?: string
  /** Pad (W5.1-Anordnung): das Bild dreht auch ±90° (BD-Auslegung bildDrehungNurPad). */
  pad?: boolean
  /** Lage des Bilds nach Wahl des WKR (Nutzer 24.11.2026, BL3) – geht vor `pad` und Platz; fehlt = wie der Bogen. */
  bildLage?: BildLage | null
  /** Maske „Tabelle“ (W5.5): Spalten und Zeilen; fehlt = keine Tabelle. */
  tabelle?: {
    spalten: TabellenSpalte[]
    teil?: ListenTeil
    gesendet: TabellenGesendet[]
    korrektur: number | null
    naechste: { key: string; startNr: string; klasse: string }[]
  } | null
}>()
const emit = defineEmits<{
  setzeDisq: [code: string]
  bojeDisq: [boje: MaskenBoje, code: string | null]
  disqFertig: []
  boje: [boje: MaskenBoje]
  disq: []
  /** Langdruck auf eine Boje (LD1). */
  disqAnBoje: [boje: MaskenBoje]
  tippe: [feld: string, code: string]
  weg: [weg: Weg]
  zeit: [feld: string, text: string]
  keineZeit: [feld: string, grund: KeineZeitGrund | null]
  entwurf: [e: Entwurf]
  tabellenFehler: [n: number]
  abschicken: []
  korrigiere: [z: number]
  korrekturAbbrechen: []
  /** Wirksame Drehung des Bilds (WkrBild, BL1) – „Mehr“ zeigt damit die Lage ohne eigene Wahl. */
  bildDrehung: [drehung: number]
}>()
const { w } = useWkrText()

/**
 * „Rück 2“ des Bilds (BD5) je Start (Prüfbefund 22.11.2026): WkrMaske kennt nur Hin/Rück, WkrBild wird aber bei
 * offener Disq.-Wahl (WkrDisqOrt) ausgehängt und danach neu gebaut – ohne diesen Merker stünde es dann auf „Rückweg“,
 * und der nächste Tipp auf Tor 1 träfe die Rückfahrt statt die 2. Durchfahrt. Gilt nur, solange WkrMaske weiter
 * „rueck“ meldet und derselbe Start (`schluessel`) gezeigt wird.
 */
const bildRueck2 = ref<string | null>(null)
const bildWeg = computed<BildWeg>(() => (props.weg === 'rueck' && bildRueck2.value === props.schluessel ? 'rueck2' : props.weg))
function merkeBildWeg(x: BildWeg): void {
  bildRueck2.value = x === 'rueck2' ? props.schluessel : null
}
</script>

<template>
  <!-- W5.5: Tabelle für Geübte – :key je Start und Korrektur: frische Eingaben, Fokus in der ersten Zelle. -->
  <WkrTabelle
    v-if="maske === 'text' && tabelle && art !== 'zeit'"
    :key="`tabelle|${schluessel}`"
    :spalten="tabelle.spalten"
    :aufbau="aufbau"
    :entwurf="entwurf"
    :teil="tabelle.teil"
    :start-nr="startNr"
    :klasse="klasse ?? aufbau.titel"
    :gesperrt="gesperrt"
    :gesendet="tabelle.gesendet"
    :korrektur="tabelle.korrektur"
    :naechste="tabelle.naechste"
    @entwurf="(e) => emit('entwurf', e)"
    @fehler="(n) => emit('tabellenFehler', n)"
    @abschicken="emit('abschicken')"
    @korrigiere="(z) => emit('korrigiere', z)"
    @abbrechen="emit('korrekturAbbrechen')"
  />
  <WkrVorsteg v-else-if="art === 'vorsteg'" :key="schluessel" :codes="disqCodes" :gesetzt="entwurf.disq" :start-nr="startNr" :gesperrt="gesperrt" @setze="(c) => emit('setzeDisq', c)" />
  <!-- Bojen-Listen (BZ4): erst der Ort, dann der Buchstabe; :key je Start wie WkrDisq. -->
  <WkrDisqOrt
    v-else-if="disqOffen && art === 'bojen'"
    :key="schluessel"
    :aufbau="aufbau"
    :entwurf="entwurf"
    :codes="disqCodes"
    :start-nr="startNr"
    :gesperrt="gesperrt"
    :folge="bojenFolge"
    :boje="disqBoje ?? null"
    @setze="(c) => emit('setzeDisq', c)"
    @boje-disq="(b, c) => emit('bojeDisq', b, c)"
    @fertig="emit('disqFertig')"
  />
  <!-- W5.4: reine Zeit-Liste – :key je Start, das aktive Feld beginnt beim ersten offenen. -->
  <WkrZeiten
    v-else-if="art === 'zeit' && !disqOffen"
    :key="`zeit|${schluessel}`"
    :aufbau="aufbau"
    :entwurf="entwurf"
    :gesperrt="gesperrt"
    :pad="pad"
    @zeit="(f, t) => emit('zeit', f, t)"
    @keine-zeit="(f, g) => emit('keineZeit', f, g)"
  />
  <WkrDisq
    v-else-if="disqOffen"
    :key="schluessel"
    :titel="w('wkr.geraet.disq')"
    :codes="disqCodes"
    :gesetzt="entwurf.disq"
    :start-nr="startNr"
    :gesperrt="gesperrt"
    @setze="(c) => emit('setzeDisq', c)"
  />
  <!-- W5.2: Maske „Bild“ – :key je Start und Klasse (neue Zeichnung beim Klassenwechsel, GF9). -->
  <WkrBild
    v-else-if="art === 'bojen' && maske === 'bild' && bild"
    :key="`bild|${schluessel}`"
    :aufbau="aufbau"
    :entwurf="entwurf"
    :zuordnung="bild"
    :klasse="klasse ?? aufbau.titel"
    :start-nr="startNr"
    :weg="bildWeg"
    :pad="pad"
    :gesperrt="gesperrt"
    :lage-wahl="bildLage ?? null"
    @boje="(b) => emit('boje', b)"
    @boje-disq="(b, c) => emit('bojeDisq', b, c)"
    @tippe="(f, c) => emit('tippe', f, c)"
    @weg="(x) => emit('weg', x)"
    @bild-weg="merkeBildWeg"
    @drehung="(d) => emit('bildDrehung', d)"
  />
  <!-- :key je Start: Ein offener Disq.-Modus gilt nie für den nächsten Start (wie WkrDisq). -->
  <WkrBojen
    v-else-if="art === 'bojen'"
    :key="schluessel"
    :aufbau="aufbau"
    :entwurf="entwurf"
    :weg="weg"
    :folge="bojenFolge"
    :gesperrt="gesperrt"
    @boje="(b) => emit('boje', b)"
    @disq="emit('disq')"
    @disq-boje="(b) => emit('disqAnBoje', b)"
    @tippe="(f, c) => emit('tippe', f, c)"
    @weg="(x) => emit('weg', x)"
  />
  <WkrKnoepfe v-else :teile="sichtbareTeile" :entwurf="entwurf" @tippe="(f, c) => emit('tippe', f, c)" />
  <!-- ZT1: Zeit-Abschnitt gemischter Listen unter den Bojen (bzw. dem Bild), nicht während der Disq.-Wahl. -->
  <WkrZeiten
    v-if="art === 'bojen' && aufbau.zeiten.length > 0 && !disqOffen && !(maske === 'text' && tabelle)"
    :key="`zeit|${schluessel}`"
    :aufbau="aufbau"
    :entwurf="entwurf"
    :gesperrt="gesperrt"
    :pad="pad"
    @zeit="(f, t) => emit('zeit', f, t)"
    @keine-zeit="(f, g) => emit('keineZeit', f, g)"
  />
</template>
