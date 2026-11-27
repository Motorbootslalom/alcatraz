<script setup lang="ts">
import { codeStand, type Entwurf, type MaskenCode, type MaskenTeil } from '../../wkr/maske'
import { useWkrText } from './texte'

/**
 * Katalog-Knöpfe (W3.3, Plan §5.3): je Code ein breiter Knopf mit Code, Kurztext, Punkten und dem Zähler ×n rechts.
 * Ein Tipp = +1 (H2, Zelle „2x20“) – zurück geht es nur über „↩ Rückgängig“ im Fuß (kein [−][+] nebeneinander).
 * Codes, die laut Regelwerk in der Klasse des Starts nicht gelten (`aus`, YAML `abKlasse`), sind seit 21.11.2026
 * ausgegraut, bleiben aber drückbar und fragen nicht nach (Nutzer W3-07, GF2: Die Besprechung kann sie für weitere
 * Klassen freigeben; vorher G6 nur der Text). Ein getippter ausgegrauter Code zeigt seinen Zähler wie jeder andere.
 * Tor 5, MüB und Steg-Teil teilen sich diese Komponente.
 *
 * Höchstzahl je Code (Nutzer 24.11.2026, WKR_ANNAHMEN CM3/CM4): Am Höchstwert steht eine eigene Zeile im Knopf –
 * „höchstens 1×“ (nimmt nichts mehr an), bei „2. und 3. Versuch“ „nächster = Disq. D“ (der nächste Tipp setzt D,
 * wkr/maske.ts tippe) und danach „Disq. D gesetzt“. Die Zeile kommt nur mit einem Tipp (nie von selbst, M5).
 */
defineProps<{ teile: MaskenTeil[]; entwurf: Entwurf }>()
const emit = defineEmits<{ tippe: [feld: string, code: string] }>()
const { w } = useWkrText()

/** Die Zeile unter dem Text am Höchstwert – '' darunter. */
function grenze(e: Entwurf, feld: string, c: MaskenCode): string {
  const s = codeStand(e, feld, c)
  if (!s.voll) return ''
  if (s.naechster === 'danach') return w('wkr.geraet.code.danach', { disq: c.danach! })
  if (s.danachGesetzt) return w('wkr.geraet.code.danachGesetzt', { disq: c.danach! })
  return w('wkr.geraet.code.max', { n: c.max })
}
</script>

<template>
  <div class="wkr-knoepfe" data-teil="knoepfe">
    <section v-for="t in teile" :key="t.feld" class="wkr-katalog" :data-feld="t.feld">
      <h2 class="wkr-katalog-titel">{{ t.titel }}</h2>
      <button
        v-for="c in t.codes"
        :key="c.code"
        type="button"
        class="wkr-knopf wkr-code"
        :class="{ 'wkr-code--aus': c.aus }"
        :data-aus="c.aus || undefined"
        :title="c.aus ? w('wkr.geraet.code.aus') : undefined"
        data-ziel="gross"
        data-action="code"
        :data-code="c.code"
        :data-anzahl="codeStand(entwurf, t.feld, c).anzahl"
        :data-max="c.max"
        :data-naechster="codeStand(entwurf, t.feld, c).naechster"
        :data-danach="c.danach"
        @click="emit('tippe', t.feld, c.code)"
      >
        <span class="wkr-code-nr">{{ c.code }}</span>
        <!-- Text und Punkte umbrechen gemeinsam: Punkte rechts daneben, notfalls darunter (Befund 1, 21.11.2026). -->
        <span class="wkr-code-mitte">
          <span class="wkr-code-text">{{ c.text }}</span>
          <span v-if="c.aus" class="wkr-code-aus" data-teil="code-aus">{{ w('wkr.geraet.code.aus') }}</span>
          <span class="wkr-code-punkte">{{ w('wkr.geraet.punkte', { n: c.punkte }) }}</span>
          <span v-if="grenze(entwurf, t.feld, c)" class="wkr-code-grenze" data-teil="code-grenze">{{ grenze(entwurf, t.feld, c) }}</span>
        </span>
        <span class="wkr-code-zaehler" data-teil="zaehler">{{ codeStand(entwurf, t.feld, c).anzahl > 0 ? `×${codeStand(entwurf, t.feld, c).anzahl}` : '' }}</span>
      </button>
    </section>
  </div>
</template>
