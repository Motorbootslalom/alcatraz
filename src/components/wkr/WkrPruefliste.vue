<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import type { ClassId } from '../../types'
import type { BestandEintrag, ErfassungsQuelle, PruefZeile } from '../../geraete/erfassen'
import type { ListenAufgabe } from '../../geraete/aufgaben'
import { entwurfAus, fertig, leererEntwurf, maskeFuer, pruefOffen, punkteVon, tippePruef, zellenAus, type Entwurf, type MaskenAufbau, type PruefWahl } from '../../wkr/maske'
import { OHNE_PUNKT } from '../../wkr/abschluss'
import WkrAbschluss from './WkrAbschluss.vue'
import WkrKopf from './WkrKopf.vue'
import WkrRuhe from './WkrRuhe.vue'
import WkrZiffern from './WkrZiffern.vue'
import { stufeZeichen, useWkrText } from './texte'

/**
 * Knoten-Prüfliste am Tisch (W5.3, Plan docs/plan-wkr-w5.md §6.2, 22.11.2026, WKR_ANNAHMEN KN3/KN7/KN8) – die Maske
 * einer Liste OHNE Lauf. Es fährt kein Boot: keine Schlange der Startfolge, keine Starterkarte, kein Overlay, kein
 * Startwechsel-Takt. Der WKR tippt die Startnummer über WkrZiffern (eigene Tasten), sieht Klasse und „offen 14 / 38“,
 * setzt je Knoten ✓ (gebunden = leere Zelle) oder ✗ (Fehlerpunkte, „5“) und schickt erst, wenn jeder Knoten gesetzt
 * ist (Hauptknopf vorher gesperrt mit „noch 2 offen“). Danach leert sich das Nummernfeld; darunter steht klein, was mit
 * der letzten Zeile geschah (Stufe aus dem Kern: ↑ unterwegs, ✓ übernommen, ! Rückfrage, ✗ abgelehnt).
 *
 * Eine Nummer, die dieses Gerät schon geschickt hat, öffnet die Korrektur (Grundlage `quelle.stand(z)` wie in WkrMaske:
 * ✓-Knoten stehen dort nicht, weil leere Zellen ohne `vorher` nie hinausgehen – fehlende Knoten gelten daher als ✓).
 * Erledigt ohne eigene Zeile (vom Bedienrechner abgetippt bzw. ein anderes Gerät): Hinweis, Abschicken trotzdem
 * möglich (der Bedienrechner fragt bei Abweichung zurück). Auf dem Pad stehen die offenen Nummern rechts zum
 * Antippen, auf dem Handy aufklappbar darunter. „Liste abschließen“ (KN5) schließt die ganze Liste (Punkt `ohne`),
 * offene Starter nur mit „Rest auf Papier“ (WkrAbschluss).
 *
 * Liest nur die ErfassungsQuelle (echte Erfassung oder Übung), nie einen Store; Werte nur über wkr/maske.ts zellenAus.
 */
const props = defineProps<{
  quelle: ErfassungsQuelle
  aufgabe: ListenAufgabe
  spracheWahl: 'liste' | 'andere'
  hand: 'rechts' | 'links'
  /** Pad-Anordnung (W5.1): offene Nummern als Spalte daneben. */
  pad?: boolean
  /** Vorbelegter WKR-Name für den Abschluss (G12). */
  name?: string
}>()
const emit = defineEmits<{ name: [name: string] }>()
const { w } = useWkrText()

const liste = computed(() => props.aufgabe.liste)
const sicht = computed(() => props.quelle.sichten.value[liste.value] ?? null)
const bestand = computed<BestandEintrag[]>(() => props.quelle.bestand.value[liste.value] ?? [])
const offen = computed(() => bestand.value.filter((b) => !b.erledigt))
/** Buchstaben vor den Startnummern („E“, „D“) – je einer eine Taste (wie WkrAusweichen, K8). */
const buchstaben = computed(() => [...new Set(bestand.value.flatMap((b) => [...b.startNr.toUpperCase()].filter((c) => /[A-Z]/.test(c))))].sort())

// --- Nummer und Treffer ---
const nr = ref('')
const treffer = computed(() => {
  const n = nr.value.trim().toUpperCase()
  return n === '' ? null : (bestand.value.find((b) => b.startNr.toUpperCase() === n) ?? null)
})
/** Die Nummer ist vollständig getippt, aber nicht auf der Liste (erst, wenn keine längere Nummer mehr passt). */
const unbekannt = computed(() => {
  const n = nr.value.trim().toUpperCase()
  return n !== '' && !treffer.value && !bestand.value.some((b) => b.startNr.toUpperCase().startsWith(n))
})
const aufbau = computed<MaskenAufbau | null>(() => (sicht.value && treffer.value ? maskeFuer(sicht.value, treffer.value.klasse, props.spracheWahl) : null))
const klassenTitel = computed(() => {
  const k = treffer.value?.klasse
  if (!k) return ''
  return (props.spracheWahl === 'andere' ? sicht.value?.andere?.klassen[k]?.titel : undefined) ?? sicht.value?.klassen[k]?.titel ?? k
})
/** Korrektur: Dieses Gerät hat für den Starter schon eine Zeile (KN8). */
const korrekturZ = computed(() => (treffer.value?.erledigt && treffer.value.z !== undefined ? treffer.value.z : null))
const anderswoErledigt = computed(() => !!treffer.value?.erledigt && korrekturZ.value === null)

// --- Entwurf: neu je Starter; in der Korrektur aus dem eigenen Stand ---
const entwurf = shallowRef<Entwurf>(leererEntwurf())
watch(
  () => `${treffer.value?.key ?? ''}|${korrekturZ.value ?? ''}|${aufbau.value?.art ?? ''}`,
  () => {
    const a = aufbau.value
    const z = korrekturZ.value
    if (!a || z === null) {
      entwurf.value = leererEntwurf()
      return
    }
    // Leere Zellen gehen ohne `vorher` nie hinaus: Was im Stand fehlt, war ✓ (die Zeile ging nur vollständig).
    const stand = props.quelle.stand(z) ?? {}
    entwurf.value = entwurfAus({ ...Object.fromEntries(a.pruef.map((p) => [p.feld, ''])), ...stand }, a)
  },
  { immediate: true },
)
function setze(feld: string, wahl: PruefWahl): void {
  const a = aufbau.value
  if (a) entwurf.value = tippePruef(entwurf.value, a, feld, wahl)
}
const nochOffen = computed(() => (aufbau.value ? pruefOffen(entwurf.value, aufbau.value) : 0))
const summe = computed(() => (aufbau.value ? punkteVon(entwurf.value, aufbau.value) : 0))
const darf = computed(() => !!aufbau.value && aufbau.value.art === 'pruefliste' && fertig(entwurf.value, aufbau.value))

// --- Abschicken (KN8: kein Takt, Nummernfeld leer, Rückmeldung klein darunter) ---
const letzte = ref<{ nr: string; z: number } | null>(null)
const letzteStufe = computed(() => (letzte.value ? (props.quelle.stufen.value[letzte.value.z] ?? null) : null))
function abschicken(): void {
  const a = aufbau.value
  const t = treffer.value
  if (!a || !t || !darf.value) return
  const zellen = zellenAus(entwurf.value, a)
  const z = korrekturZ.value !== null ? props.quelle.korrigiere(korrekturZ.value, zellen) : props.quelle.schicke(liste.value, { s: t.key, zellen })
  if (z === null) return
  letzte.value = { nr: t.startNr, z }
  nr.value = ''
}

// --- Liste abschließen (KN5) ---
const abschluss = ref(false)
const abgeschlossen = computed(() => !!sicht.value?.abgeschlossen.includes(OHNE_PUNKT))
const eigenerAbschluss = computed(() => props.quelle.abschluesse.value.find((a) => a.liste === liste.value && a.punkt === OHNE_PUNKT && a.stufe !== 'abgelehnt') ?? null)
const zeileText = (z: PruefZeile): { klasse: string; codes: string; punkte: number | null } => {
  const k = z.klasse && sicht.value ? maskeFuer(sicht.value, z.klasse as ClassId, props.spracheWahl) : null
  const fehler = k ? k.pruef.filter((p) => (z.zellen[p.feld] ?? '') !== '').map((p) => p.titel) : []
  return { klasse: k?.titel ?? z.klasse ?? '', codes: fehler.length ? `✗ ${fehler.join(', ')}` : '✓', punkte: k ? punkteVon(entwurfAus(z.zellen, k), k) : null }
}
const korrigierbar = computed(() => new Set(bestand.value.filter((b) => b.z !== undefined).map((b) => b.key)))
function korrigiereAusPruefung(s: string): void {
  const b = bestand.value.find((x) => x.key === s)
  if (!b) return
  abschluss.value = false
  nr.value = b.startNr
}

const status = computed(() => sicht.value?.status ?? 'aktiv')
const stufeText = computed(() => {
  const s = letzteStufe.value
  return s ? `${stufeZeichen(s)} ${w(`wkr.geraet.stufe.${s.stufe}`)}` : ''
})
</script>

<template>
  <div class="wkr-maske wkr-pruefliste" data-teil="maske" data-maske="pruefliste" :data-liste="liste" :data-pad="pad || undefined">
    <WkrRuhe v-if="!sicht" art="warte" />
    <template v-else>
      <WkrKopf
        :titel="sicht.titel"
        :bereich="sicht.bereich"
        :lauf="null"
        :invers="false"
        :uebung="quelle.uebung"
        :verbindung="quelle.verbindung.value"
        :getrennt-sek="0"
        :wartend="quelle.wartend.value"
        :ohne-quittung="false"
        :papier-ab="null"
        :hinweis="null"
      />
      <WkrRuhe v-if="sicht.modus === 'papier'" art="papier" />
      <WkrRuhe v-else-if="status !== 'aktiv'" :art="status === 'pausiert' ? 'pausiert' : 'abgemeldet'" @weiter="quelle.weiter(liste)" />
      <WkrAbschluss
        v-else-if="abschluss"
        :quelle="quelle"
        :liste="liste"
        :listen-titel="sicht.titel"
        :punkt="OHNE_PUNKT"
        :punkt-titel="sicht.punkt?.titel ?? ''"
        :name="quelle.uebung ? (name ?? '') : quelle.wkrName(liste).name || (name ?? '')"
        :zeile-text="zeileText"
        :korrigierbar="korrigierbar"
        @korrigiere="korrigiereAusPruefung"
        @zurueck="abschluss = false"
        @name="(n) => emit('name', n)"
      />
      <div v-else class="wkr-pruef-rahmen">
        <div class="wkr-pruef-haupt">
          <p class="wkr-pruef-kopf" data-teil="pruef-kopf">
            <span data-teil="pruef-nr">{{ w('wkr.geraet.pruef.nr') }} {{ nr || '–' }}</span>
            <span v-if="treffer" data-teil="pruef-klasse">{{ klassenTitel }}</span>
            <span data-teil="pruef-offen">{{ w('wkr.geraet.pruef.offen', { n: sicht.offen?.n ?? offen.length, m: sicht.offen?.m ?? bestand.length }) }}</span>
          </p>
          <WkrZiffern v-model="nr" :buchstaben="buchstaben" :titel="w('wkr.geraet.pruef.nr')" />
          <p v-if="unbekannt" class="wkr-band wkr-band--warn" role="alert" data-teil="pruef-unbekannt">{{ w('wkr.geraet.pruef.unbekannt', { nr }) }}</p>
          <p v-else-if="korrekturZ !== null" class="wkr-band wkr-band--hinweis" role="status" data-teil="pruef-korrektur">{{ w('wkr.geraet.pruef.korrektur', { nr: treffer!.startNr }) }}</p>
          <p v-else-if="anderswoErledigt" class="wkr-band wkr-band--hinweis" role="status" data-teil="pruef-erledigt">{{ w('wkr.geraet.pruef.erledigt', { nr: treffer!.startNr }) }}</p>
          <p v-if="letzte && stufeText" class="wkr-hinweis" role="status" data-teil="pruef-letzte" :data-stufe="letzteStufe?.stufe">
            {{ w('wkr.geraet.pruef.letzte', { nr: letzte.nr, stand: stufeText }) }}
          </p>

          <ul v-if="aufbau && aufbau.art === 'pruefliste'" class="wkr-pruef-knoten" data-teil="pruef-knoten">
            <li v-for="p in aufbau.pruef" :key="p.feld" class="wkr-pruef-knoten-zeile" :data-feld="p.feld" :data-wahl="entwurf.pruef[p.feld] ?? 'offen'">
              <span class="wkr-pruef-knoten-titel">{{ p.titel }}</span>
              <button
                type="button"
                class="wkr-knopf wkr-pruef-wahl"
                data-ziel="gross"
                data-action="pruef-ok"
                :data-feld="p.feld"
                :aria-pressed="entwurf.pruef[p.feld] === 'ok'"
                @click="setze(p.feld, 'ok')"
              >
                ✓ {{ w('wkr.geraet.pruef.richtig') }}
              </button>
              <button
                type="button"
                class="wkr-knopf wkr-pruef-wahl wkr-pruef-wahl--fehler"
                data-ziel="gross"
                data-action="pruef-fehler"
                :data-feld="p.feld"
                :aria-pressed="entwurf.pruef[p.feld] === 'fehler'"
                @click="setze(p.feld, 'fehler')"
              >
                ✗ {{ w('wkr.geraet.pruef.falsch', { n: p.punkte }) }}
              </button>
            </li>
          </ul>
        </div>

        <!-- Offene Nummern: Pad rechts, Handy aufklappbar darunter (KN8). -->
        <aside v-if="pad" class="wkr-pruef-seite" data-teil="pruef-offene">
          <h3>{{ w('wkr.geraet.pruef.offene', { n: offen.length }) }}</h3>
          <div class="wkr-pruef-nummern">
            <button v-for="b in offen" :key="b.key" type="button" class="wkr-knopf" data-ziel="klein" data-action="pruef-waehle" :data-start="b.key" @click="nr = b.startNr">{{ b.startNr }}</button>
          </div>
        </aside>
        <details v-else-if="offen.length > 0" class="wkr-pruef-seite" data-teil="pruef-offene">
          <summary class="wkr-knopf" data-ziel="klein">{{ w('wkr.geraet.pruef.offene', { n: offen.length }) }}</summary>
          <div class="wkr-pruef-nummern">
            <button v-for="b in offen" :key="b.key" type="button" class="wkr-knopf" data-ziel="klein" data-action="pruef-waehle" :data-start="b.key" @click="nr = b.startNr">{{ b.startNr }}</button>
          </div>
        </details>

        <footer class="wkr-fuss" :class="{ 'wkr-fuss--links': hand === 'links' }" data-teil="fuss" :data-hand="hand">
          <div class="wkr-fuss-neben">
            <button
              v-if="!abgeschlossen && !eigenerAbschluss"
              type="button"
              class="wkr-knopf"
              data-ziel="klein"
              data-action="pruef-abschliessen"
              @click="abschluss = true"
            >
              {{ w('wkr.geraet.abschluss') }}
            </button>
            <span v-else class="wkr-hinweis" data-teil="pruef-abgeschlossen">{{ w('wkr.geraet.pruef.abgeschlossen') }}</span>
          </div>
          <button type="button" class="wkr-knopf wkr-knopf--haupt" data-ziel="gross" data-action="haupt" :disabled="!darf" @click="abschicken">
            <template v-if="!aufbau">{{ w('wkr.geraet.pruef.tippen') }}</template>
            <template v-else-if="nochOffen > 0">{{ w('wkr.geraet.pruef.nochOffen', { n: nochOffen }) }}</template>
            <template v-else>{{ w(korrekturZ !== null ? 'wkr.geraet.pruef.korrigieren' : 'wkr.geraet.pruef.abschicken', { n: summe }) }}</template>
          </button>
        </footer>
      </div>
    </template>
  </div>
</template>
