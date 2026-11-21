<script setup lang="ts">
import type { EntwurfEintrag } from '../../geraete/erfassen'
import { useWkrText } from './texte'

/**
 * Zustände ohne Arbeit (W3.3, Plan §5.6/§5.3): Die Maske sagt immer, warum es gerade nichts zu tippen gibt – nie
 * eine leere Fläche. Getrennt ist KEIN Ruhezustand (weiter erfassen; das rote Band steht im Kopf).
 *
 * - `warte`: noch keine Sicht der Liste; `leer`: kein Boot unterwegs, nächster Start aus „danach“, dazu die Meldung
 *   der Start-Freigabe aus der öffentlichen Sicht (Text wie auf der Anzeigetafel);
 * - `pausiert`/`abgemeldet` (Liste bzw. eigener Steg-Teil): „Papierbogen gilt“, Knopf „Weiter digital“;
 * - `papier`: Der Bedienrechner hat die Liste auf Papier gestellt – nichts zu tippen;
 * - `abgeschlossen`: Punkt abgeschlossen, Korrekturen nur noch als Vorschlag;
 * - `entfaellt`: Die Klasse hat diese Liste nicht (grau, mit Wort);
 * - `spaeter`: Liste mit Bojen/Zeit/Knoten – Maske folgt (W4/W5), bitte Papier, „Pausieren“ angeboten (G14);
 * - `entzogen`: Rechte weg; Entwürfe nur lesend zum Übertragen aufs Papier.
 */
defineProps<{
  art: 'warte' | 'leer' | 'pausiert' | 'abgemeldet' | 'papier' | 'abgeschlossen' | 'entfaellt' | 'spaeter' | 'entzogen' | 'keine-liste'
  naechster?: { startNr: string; klasse: string } | null
  meldung?: string | null
  punkt?: string | null
  liste?: string
  klasse?: string
  /** `spaeter`: Liste noch aktiv – dann „Pausieren“ anbieten. */
  aktiv?: boolean
  entwuerfe?: EntwurfEintrag[]
}>()
const emit = defineEmits<{ weiter: []; pausiere: [] }>()
const { w } = useWkrText()

/**
 * Ein Entwurf fürs Papier (Prüfbefund W3, 21.11.2026): Liste · Bereich, am Steg der Teil, dann jedes belegte Feld mit
 * seiner Überschrift („Ablegen: 3 · Disq.: A“) – nie nur Werte, sonst landen sie in der falschen Spalte. Die
 * Überschriften legte der Kern beim Ablegen dazu (geraete/erfassen.ts EntwurfPapier); ohne sie die Kennung.
 */
function wo(e: EntwurfEintrag): string {
  const teile: string[] = []
  if (e.papier) teile.push(`${e.papier.titel} · ${e.papier.bereich}`)
  if (e.teil) teile.push(w(e.teil === 'ab' ? 'wkr.geraet.steg.ab' : 'wkr.geraet.steg.an'))
  return teile.join(' · ')
}
function werte(e: EntwurfEintrag): string {
  return Object.entries(e.zellen)
    .filter(([, x]) => x !== '')
    .map(([f, x]) => `${e.papier?.felder[f] ?? f}: ${x}`)
    .join(' · ')
}
</script>

<template>
  <section class="wkr-ruhe" role="status" data-teil="ruhe" :data-ruhe="art">
    <template v-if="art === 'warte'">
      <h2>{{ w('wkr.geraet.ruhe.warte') }}</h2>
    </template>
    <template v-else-if="art === 'leer'">
      <h2>{{ w('wkr.geraet.ruhe.leer') }}</h2>
      <p v-if="naechster" data-teil="naechster">{{ w('wkr.geraet.ruhe.naechster', { nr: naechster.startNr, klasse: naechster.klasse }) }}</p>
      <p v-if="meldung" class="wkr-ruhe-meldung" data-teil="meldung">{{ meldung }}</p>
    </template>
    <template v-else-if="art === 'pausiert' || art === 'abgemeldet'">
      <p class="wkr-band wkr-band--gross" data-teil="pause-band">{{ w(art === 'pausiert' ? 'wkr.geraet.ruhe.pausiert' : 'wkr.geraet.ruhe.abgemeldet') }}</p>
      <button type="button" class="wkr-knopf wkr-knopf--haupt" data-ziel="gross" data-action="weiter-digital" @click="emit('weiter')">{{ w('wkr.geraet.weiter') }}</button>
    </template>
    <template v-else-if="art === 'papier'">
      <h2>{{ w('wkr.geraet.ruhe.papier') }}</h2>
      <p>{{ w('wkr.geraet.ruhe.papier.hint') }}</p>
    </template>
    <template v-else-if="art === 'abgeschlossen'">
      <h2>{{ w('wkr.geraet.ruhe.abgeschlossen', { punkt: punkt ?? '' }) }}</h2>
      <p>{{ w('wkr.geraet.ruhe.abgeschlossen.hint') }}</p>
    </template>
    <template v-else-if="art === 'entfaellt'">
      <h2 class="wkr-entfaellt">{{ w('wkr.geraet.ruhe.entfaellt', { liste: liste ?? '', klasse: klasse ?? '' }) }}</h2>
    </template>
    <template v-else-if="art === 'spaeter'">
      <h2>{{ w('wkr.geraet.ruhe.spaeter') }}</h2>
      <button v-if="aktiv" type="button" class="wkr-knopf" data-ziel="gross" data-action="pausieren" @click="emit('pausiere')">{{ w('wkr.geraet.pausieren') }}</button>
    </template>
    <template v-else-if="art === 'entzogen'">
      <h2>{{ w('wkr.geraet.ruhe.entzogen') }}</h2>
      <template v-if="entwuerfe && entwuerfe.length > 0">
        <p>{{ w('wkr.geraet.ruhe.entzogen.entwuerfe') }}</p>
        <ul class="wkr-entwurf-liste" data-teil="entwuerfe-lesend">
          <li v-for="e in entwuerfe" :key="`${e.liste}|${e.s}|${e.teil ?? ''}`">
            <b>{{ e.sn ?? '?' }}</b>
            <span v-if="wo(e)" data-teil="entwurf-wo"> {{ wo(e) }}</span>
            <br /><span data-teil="entwurf-werte">{{ werte(e) }}</span>
          </li>
        </ul>
      </template>
    </template>
    <template v-else>
      <h2>{{ w('wkr.geraet.ruhe.keineListe') }}</h2>
    </template>
  </section>
</template>
