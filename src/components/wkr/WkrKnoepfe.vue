<script setup lang="ts">
import type { Entwurf, MaskenTeil } from '../../wkr/maske'
import { useWkrText } from './texte'

/**
 * Katalog-Knöpfe (W3.3, Plan §5.3): je Code ein breiter Knopf mit Code, Kurztext, Punkten und dem Zähler ×n rechts.
 * Ein Tipp = +1 (H2, Zelle „2x20“) – zurück geht es nur über „− letzte zurück“ im Fuß (kein [−][+] nebeneinander).
 * Codes, die laut Regelwerk in der Klasse des Starts nicht gelten (`aus`, YAML `abKlasse`), sind seit 21.11.2026
 * ausgegraut, bleiben aber drückbar und fragen nicht nach (Nutzer W3-07, GF2: Die Besprechung kann sie für weitere
 * Klassen freigeben; vorher G6 nur der Text). Ein getippter ausgegrauter Code zeigt seinen Zähler wie jeder andere.
 * Tor 5, MüB und Steg-Teil teilen sich diese Komponente.
 */
defineProps<{ teile: MaskenTeil[]; entwurf: Entwurf }>()
const emit = defineEmits<{ tippe: [feld: string, code: string] }>()
const { w } = useWkrText()

const anzahl = (e: Entwurf, feld: string, code: string) => (e.codes[feld] ?? []).filter((c) => c === code).length
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
        :data-anzahl="anzahl(entwurf, t.feld, c.code)"
        @click="emit('tippe', t.feld, c.code)"
      >
        <span class="wkr-code-nr">{{ c.code }}</span>
        <!-- Text und Punkte umbrechen gemeinsam: Punkte rechts daneben, notfalls darunter (Befund 1, 21.11.2026). -->
        <span class="wkr-code-mitte">
          <span class="wkr-code-text">{{ c.text }}</span>
          <span v-if="c.aus" class="wkr-code-aus" data-teil="code-aus">{{ w('wkr.geraet.code.aus') }}</span>
          <span class="wkr-code-punkte">{{ w('wkr.geraet.punkte', { n: c.punkte }) }}</span>
        </span>
        <span class="wkr-code-zaehler" data-teil="zaehler">{{ anzahl(entwurf, t.feld, c.code) > 0 ? `×${anzahl(entwurf, t.feld, c.code)}` : '' }}</span>
      </button>
    </section>
  </div>
</template>
