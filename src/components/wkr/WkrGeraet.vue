<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Locale } from '../../i18n'
import type { ErfassungsQuelle } from '../../geraete/erfassen'
import { liesAnsicht, maskeGewaehlt, merkeProbe, mitMaskenWahl, probeErledigt, schreibeAnsicht, type Ablage, type GeraetAnsicht, type RaumBezug } from '../../geraete/ablage'
import { maskenArt, probeMaske } from '../../wkr/maske'
import { probeBild } from '../../wkr/bild'
import { parcoursSvg } from '../../lib/parcoursQuelle'
import { anordnung as ordne, type Spalte } from '../../wkr/anordnung'
import { erlaubteMasken, maskeAufGeraet, wirksameMaske, type MaskenWahl } from '../../wkr/maskenWahl'
import { liesListe, teileVon } from '../../wkr/liste'
import { WKR_ANNAHMEN } from '../../wkr/annahmen'
import type { ListenAufgabe } from '../../geraete/aufgaben'
import WkrMaske from './WkrMaske.vue'
import WkrPruefliste from './WkrPruefliste.vue'
import WkrProbe from './WkrProbe.vue'
import WkrRuhe from './WkrRuhe.vue'
import { stelleWkrText } from './texte'
import { useFenster, useWirksamerModus } from './systemModus'
import { wachHinweisWeg } from './gedaechtnis'
import '../../styles/wkr-geraet.css'

/**
 * Wurzel der WKR-Maske auf einem Gerät (W3.3, Plan docs/plan-wkr-w3.md §5, 21.11.2026). Ohne Store: Die Quelle ist
 * die echte Erfassung (geraete/erfassen.ts, über GeraetFreigabe) oder die Übung ohne Netz (geraete/uebung.ts) –
 * beide mit derselben Schnittstelle. Je eigener Liste ein Reiter (Pad mit zwei Listen, F15); GeraetFreigabe kann
 * eine Liste vorgeben (`nurListe`, dann ohne eigene Reiter).
 *
 * Ansicht aus der Geräteablage (ablage.ts `alcatraz.geraet.ansicht`): seit 21.11.2026 „Wie Gerät“ als Vorgabe (GF1,
 * Nutzer P-18/W3-01: Hell/Dunkel des Systems, live über systemModus.ts; vorher Sonne, G1), Hand, Sprache;
 * seit 22.11.2026 auch die Bojen-Folge je Liste (`bojenFolge`: Rückweg gedreht/Fahrtfolge/untereinander), die Maske
 * und Probe bekommen (vorher „Wie der Parcours liegt“, `bojen`, entfernt); seit 24.11.2026 ebenso die Lage des Bilds je
 * Liste (`bildLage`: Steg unten/links/oben/rechts, BL3).
 * Die Sprache der Maske ist die der Liste (F13, G9: zweisprachig → deutsch), umgeschaltet über die Ansicht – nie die
 * der Geräte-Oberfläche. Farben nur über --wkr-* (styles/wkr-geraet.css) je `data-modus` – dem wirksamen Modus
 * (`data-wahl` trägt die Wahl, auch `geraet`).
 *
 * W3.4 (21.11.2026): „Mehr → Ansicht/Sprache“ schreibt hier die Ansicht (schreibeAnsicht; nimmt der Speicher sie nicht,
 * gilt sie bis zum Neuladen). Der WKR-Name des Abschlusses wird gemerkt (G12) – in der Übung nicht (dort bleibt nur
 * die Ansicht, G13). Probe (G10): nach dem ersten Erhalt der Sicht einer Liste einmal je Raum und Liste (ablage.ts
 * `probe`; nur mit `raum`, also nie in der Übung von selbst), jederzeit über „Mehr → Probe“; sie ersetzt die Maske,
 * bis sie fertig oder übersprungen ist, und schickt nichts.
 *
 * W5.1 (22.11.2026, Plan docs/plan-wkr-w5.md §4, WKR_ANNAHMEN PD1–PD6, MW1–MW3): Die Anordnung kommt aus
 * wkr/anordnung.ts (Fenstergröße live über useFenster, Geräteart aus der Kopplung `quelle.typ`): `data-anordnung`
 * handy | padQuer | padHoch, Spalten nebeneinander (`data-teil="spalten"`, je `.wkr-spalte`), was nicht passt als Reiter
 * der letzten Spalte (Handy: wie bisher unten). Ein Gerät für den ganzen Steg zeigt auf dem Pad Ablegen und Anlegen als
 * zwei Spalten. Bei einer Spalte eine eigene Seitenspalte (WkrMaske `seite` rechts/unten), sonst kompakt je Spalte.
 * Racecourse A + B mit demselben nächsten Start (Runde, Attempt, Paar): ein Rundenband über beiden (PD4). Probe von
 * selbst je Spalte, die ihre noch nicht hatte (je Maske, MW3). Maskenwahl (F14): Vorgabe/`fest` aus der Aufgabe, die
 * Wahl des WKR gerätelokal je Raum und Liste (ablage.ts `masken`, MW2) – wirksam über wkr/maskenWahl.ts.
 *
 * W5.3 (22.11.2026, KN7/KN8): Eine Liste ohne Lauf (Sicht mit `bestand`, Knoten am Tisch) zeigt WkrPruefliste statt
 * WkrMaske – ohne Schlange, Takt und Probe (wkr/maske.ts probeMaske übergeht die Prüfliste).
 */
const props = defineProps<{
  quelle: ErfassungsQuelle
  /** Ablage der Ansicht (Tests: eigener Speicher); Vorgabe localStorage. */
  ablage?: Ablage | null
  /** Nur diese Liste zeigen (GeraetFreigabe mit eigenen Reitern). */
  nurListe?: string
  /** Meldung der Start-Freigabe für den Bereich einer Liste (öffentliche Sicht). */
  meldungFuer?: (liste: string) => string | null
  /** Raum des gekoppelten Geräts – für die Probe einmal je Raum und Liste (G10). Ohne (Übung): keine Probe von selbst. */
  raum?: RaumBezug | null
  /**
   * Der Bildschirm lässt sich nicht wach halten (GeraetApp, lib/wachBleiben.ts) – N7 vom Feldtest 21.11.2026: Über
   * http://192.168…:5173 gibt es keine Wake Lock, das Handy sperrte mitten in der Erfassung. Gut sichtbar oben.
   */
  bildschirmKannAus?: boolean
}>()
const emit = defineEmits<{ uebungEnde: [] }>()

/** Ablage wie übergeben; `undefined` = Vorgabe (localStorage), `null` = keine. */
const ablage = () => (props.ablage === undefined ? undefined : props.ablage)
const ansicht = ref(liesAnsicht(ablage()))
const modus = useWirksamerModus(() => ansicht.value.modus)
function setzeAnsicht(aenderung: Partial<GeraetAnsicht>): void {
  schreibeAnsicht(aenderung, ablage())
  const neu: GeraetAnsicht = { ...ansicht.value }
  for (const [k, v] of Object.entries(aenderung) as [keyof GeraetAnsicht, unknown][]) {
    if (v === undefined) delete neu[k]
    else (neu as unknown as Record<string, unknown>)[k] = v
  }
  ansicht.value = neu
}
/** Erklärung der Übung auf- oder zugeklappt – nur bei einer Änderung merken (das erste `toggle` kommt beim Einhängen). */
function erklaerungUmschalten(e: Event): void {
  const zu = !(e.target as HTMLDetailsElement).open
  if (zu !== !!ansicht.value.uebungErklaerungZu) setzeAnsicht({ uebungErklaerungZu: zu ? true : undefined })
}
function merkeName(name: string): void {
  if (!props.quelle.uebung) setzeAnsicht({ name })
}
// Abgemeldete Listen (Nutzer 21.11.2026) bleiben als Reiter mit der Ruhe-Ansicht da, auch wenn der Bedienrechner die
// Aufgabe schon genommen hat – Entwürfe und „Zuletzt“ sollen lesbar bleiben (WKR_ANNAHMEN.abmeldenWieEntfernen).
const abgemeldet = computed(() => props.quelle.abgemeldet.value)
const listen = computed<ListenAufgabe[]>(() => {
  const eigene = props.quelle.listen.value
  const weg = abgemeldet.value.filter((a) => !eigene.some((l) => l.liste === a.liste))
  return [...eigene, ...weg.map((a): ListenAufgabe => ({ art: 'liste', liste: a.liste, ...(a.teil ? { teil: a.teil } : {}) }))]
})
const reiter = ref<string | null>(null)
const aktiv = computed(() => {
  const gesucht = props.nurListe ?? reiter.value
  return listen.value.find((a) => a.liste === gesucht) ?? (props.nurListe ? null : (listen.value[0] ?? null))
})
const sicht = computed(() => (aktiv.value ? (props.quelle.sichten.value[aktiv.value.liste] ?? null) : null))

const sprache = computed<Locale>(() => ansicht.value.sprache ?? (sicht.value?.sprache === 'en' ? 'en' : 'de'))
const { w } = stelleWkrText(sprache)

const titelVon = (liste: string) => props.quelle.sichten.value[liste]?.titel || abgemeldet.value.find((a) => a.liste === liste)?.titel || '…'

// --- Anordnung (W5.1, PD1–PD3) ---
const fenster = useFenster()
/** Die Listen, die dieses Fenster zeigt: alle eigenen bzw. die vorgegebene (`nurListe`). */
const sichtbar = computed(() => (props.nurListe ? listen.value.filter((a) => a.liste === props.nurListe) : listen.value))
const anordnung = computed(() =>
  ordne({
    breite: fenster.value.breite,
    hoehe: fenster.value.hoehe,
    typ: props.quelle.typ ?? null,
    listen: sichtbar.value.map((a) => a.liste),
    // Ganzer Steg (ohne Teil) – an der Kennung erkannt, nicht an der Sicht: sonst sprängen die Spalten, wenn sie kommt.
    teile: sichtbar.value.filter((a) => !a.teil && !!teileVon(liesListe(a.liste)?.typeId ?? '')).map((a) => a.liste),
  }),
)
const pad = computed(() => anordnung.value.art !== 'handy')
const aufgabeVon = (liste: string) => listen.value.find((a) => a.liste === liste) ?? null
/** Je Spalte die gezeigte Aufgabe – die letzte mit Reitern zeigt die gewählte (wie bisher der aktive Reiter). */
interface SpaltenInhalt {
  spalte: Spalte
  aufgabe: ListenAufgabe
  reiter: boolean
}
const spalten = computed<SpaltenInhalt[]>(() => {
  const a = anordnung.value
  return a.spalten.flatMap((s, i) => {
    const reiterHier = i === a.spalten.length - 1 && a.reiter.length > 0
    const liste = reiterHier ? (a.reiter.find((l) => l === reiter.value) ?? a.reiter[0]) : s.liste
    const aufgabe = aufgabeVon(liste)
    return aufgabe ? [{ spalte: reiterHier ? { liste } : s, aufgabe, reiter: reiterHier }] : []
  })
})
const reiterListen = computed(() => anordnung.value.reiter)
const sichtVon = (liste: string) => props.quelle.sichten.value[liste] ?? null
/** Liste ohne Lauf (am Tisch, W5.3): die Sicht trägt den Bestand – dann die Prüfliste statt der Maske mit Schlange. */
const istPruefliste = (liste: string) => !!sichtVon(liste)?.bestand
const spracheWahlVon = (liste: string) => (ansicht.value.sprache && sichtVon(liste)?.andere?.sprache === ansicht.value.sprache ? 'andere' : 'liste')
const abmeldungVon = (liste: string) => abgemeldet.value.find((a) => a.liste === liste) ?? null
const seiteVon = computed(() => anordnung.value.seite ?? (pad.value ? ('kompakt' as const) : null))

// --- Maskenwahl (F14, MW1–MW2) ---
const bojenListe = (liste: string) => Object.values(sichtVon(liste)?.klassen ?? {}).some((k) => !!k?.felder && maskenArt(k.felder) === 'bojen')
/** Reine Zeit-Liste (W5.4): feste Art Ziffernblock – keine Maskenwahl (W5.5, MW1). */
const zeitListe = (liste: string) => {
  const mit = Object.values(sichtVon(liste)?.klassen ?? {}).filter((k) => !!k?.felder)
  return mit.length > 0 && mit.every((k) => maskenArt(k!.felder!) === 'zeit')
}
function maskenVon(a: ListenAufgabe): { erlaubt: MaskenWahl[]; wirksam: MaskenWahl; fest: boolean; aus: MaskenWahl[] } {
  const l = { bojen: bojenListe(a.liste), pad: pad.value, zeit: zeitListe(a.liste) }
  const wahl = maskeGewaehlt(ansicht.value, props.raum ?? null, a.liste)
  const erlaubt = erlaubteMasken(l)
  // TB1 (W5.5, 22.11.2026): „Tabelle“ auf dem Handy sichtbar, aber ausgegraut – der WKR sieht, dass es sie gibt.
  return { erlaubt, wirksam: wirksameMaske(l, { vorgabe: a.maske, fest: !!a.fest, wahl }), fest: !!a.fest, aus: erlaubt.filter((m) => !maskeAufGeraet(m, l.pad)) }
}
function waehleMaske(liste: string, m: MaskenWahl): void {
  setzeAnsicht(mitMaskenWahl(ansicht.value, props.raum ?? null, liste, m))
}

// --- Probe (G10; seit W5.1 je Spalte und je Maske, MW3) ---
// Bojen-Listen haben seit W4.2 (21.11.2026) ihre eigenen Probe-Schritte (WkrProbe, P11).
// W5.2 (22.11.2026, MW3): Mit wirksamer Maske „Bild“ übt die Probe am Bild – an der Klasse mit den meisten Zeilen unter
// denen mit vollständigem Bild (wkr/bild.ts probeBild); hat keine eines (BD2), die Probe der Knöpfe.
const probeBildVon = (liste: string) => {
  const s = sichtVon(liste)
  const a = aufgabeVon(liste)
  return s && a && maskenVon(a).wirksam === 'bild' ? probeBild(s, parcoursSvg, spracheWahlVon(liste)) : null
}
const probeAufbauVon = (liste: string) => {
  const s = sichtVon(liste)
  return probeBildVon(liste)?.aufbau ?? (s ? probeMaske(s, spracheWahlVon(liste)) : null)
}
const probeTeilVon = (a: ListenAufgabe) => (sichtVon(a.liste)?.teile ? (a.teil ?? 'ab') : undefined)
/** Listen, deren Probe gerade läuft. */
const proben = ref<ReadonlySet<string>>(new Set())
watch(
  () => spalten.value.map((x) => `${x.aufgabe.liste}|${!!sichtVon(x.aufgabe.liste)}|${!!probeAufbauVon(x.aufgabe.liste)}|${maskenVon(x.aufgabe).wirksam}`).join(','),
  () => {
    const r = props.raum
    if (!r || props.quelle.entzogen.value) return
    const neu = new Set(proben.value)
    for (const { aufgabe } of spalten.value) {
      const l = aufgabe.liste
      if (!sichtVon(l) || !probeAufbauVon(l) || abmeldungVon(l)) continue
      // TB2 (W5.5): Die Tabelle ist für Geübte – keine Probe von selbst.
      if (WKR_ANNAHMEN.tabelleOhneProbe && maskenVon(aufgabe).wirksam === 'text') continue
      if (!probeErledigt(r, l, ablage(), maskenVon(aufgabe).wirksam)) neu.add(l)
    }
    if (neu.size !== proben.value.size) proben.value = neu
  },
  { immediate: true },
)
function starteProbe(liste: string): void {
  if (probeAufbauVon(liste)) proben.value = new Set([...proben.value, liste])
}
function probeFertig(liste: string): void {
  const neu = new Set(proben.value)
  neu.delete(liste)
  proben.value = neu
  const a = aufgabeVon(liste)
  if (props.raum) merkeProbe(props.raum, liste, ablage(), a ? maskenVon(a).wirksam : 'knoepfe')
}
// --- Bildschirm kann ausgehen (N7): „Ausblenden“ gilt bis zum Neuladen, auch über den Neuaufbau (Reiterwechsel). ---
const wachWeg = ref(wachHinweisWeg.weg)
function blendeWachAus(): void {
  wachWeg.value = wachHinweisWeg.weg = true
}
/** Ohne https (http im WLAN) hat der Browser gar keine Sperre – dann sagt der Satz auch warum. */
const ohneHttps = typeof window !== 'undefined' && window.isSecureContext === false

// --- PD4: ein Rundenband über Racecourse A und B, wenn beide denselben Start als nächsten haben ---
const rundenBand = computed<string | null>(() => {
  if (!WKR_ANNAHMEN.rundenBandBeiGleichemPaar || spalten.value.length < 2) return null
  const kopf = (liste: string) => props.quelle.schlange.value[liste]?.[0] ?? null
  const parallel = spalten.value.filter((x) => !!liesListe(x.aufgabe.liste)?.racecourse)
  if (parallel.length !== 2) return null
  const [a, b] = parallel.map((x) => ({ l: liesListe(x.aufgabe.liste)!, k: kopf(x.aufgabe.liste) }))
  if (a.l.bereich !== b.l.bereich || a.l.typeId !== b.l.typeId || a.l.racecourse === b.l.racecourse) return null
  return a.k && b.k && a.k.key === b.k.key ? a.k.titel : null
})
const imBand = (liste: string) => !!rundenBand.value && !!liesListe(liste)?.racecourse
</script>

<template>
  <div
    class="wkr-geraet"
    data-teil="wkr-geraet"
    :data-modus="modus"
    :data-wahl="ansicht.modus"
    :data-hand="ansicht.hand"
    :data-uebung="quelle.uebung || undefined"
    :data-anordnung="anordnung.art"
    :data-spalten="spalten.length"
    :lang="sprache"
  >
    <p v-if="bildschirmKannAus && !wachWeg" class="wkr-band wkr-band--warn" role="status" data-teil="wach-hinweis">
      <span>
        <b>{{ w('wkr.geraet.wach.titel') }}</b>
        {{ w(ohneHttps ? 'wkr.geraet.wach.ohneHttps' : 'wkr.geraet.wach.tipp') }}
      </span>
      <button type="button" class="wkr-knopf" data-ziel="klein" data-action="wach-ausblenden" @click="blendeWachAus">{{ w('wkr.geraet.wach.ausblenden') }}</button>
    </p>
    <!-- Übung (Nutzer 21.11.2026, W3-15, GF4): Erklärung in der Übung selbst, einklappbar, gemerkt je Gerät. -->
    <details v-if="quelle.uebung" class="wkr-uebung-erklaerung" data-teil="uebung-erklaerung" :open="!ansicht.uebungErklaerungZu" @toggle="erklaerungUmschalten">
      <summary class="wkr-knopf" data-ziel="klein">{{ w('wkr.geraet.uebung.erklaerung.titel') }}</summary>
      <p>{{ w('wkr.geraet.uebung.erklaerung', { n: WKR_ANNAHMEN.uebungStarts }) }}</p>
    </details>
    <WkrRuhe v-if="quelle.entzogen.value" art="entzogen" :entwuerfe="quelle.entwuerfe.value" />
    <WkrRuhe v-else-if="!aktiv" art="keine-liste" />
    <template v-else>
      <p v-if="rundenBand" class="wkr-band wkr-runden-band" role="status" data-teil="runden-band">
        <b>{{ rundenBand }}</b>
      </p>
      <div class="wkr-spalten" data-teil="spalten" :style="{ '--wkr-spalten': String(spalten.length) }">
        <div v-for="x in spalten" :key="`${x.reiter ? 'reiter' : x.spalte.liste}|${x.spalte.teil ?? ''}`" class="wkr-spalte" :data-liste="x.aufgabe.liste" :data-steg-teil="x.spalte.teil">
          <!-- Pad: Reiter der Listen, die sich diese Spalte teilen, oben in der Spalte (Handy: unten wie bisher). -->
          <nav v-if="x.reiter && pad" class="wkr-listenreiter" role="tablist" :aria-label="w('wkr.geraet.listen')" data-teil="listen-reiter">
            <button
              v-for="l in reiterListen"
              :key="l"
              type="button"
              role="tab"
              class="wkr-knopf"
              data-ziel="klein"
              data-action="liste-reiter"
              :data-liste="l"
              :aria-selected="l === x.aufgabe.liste"
              @click="reiter = l"
            >
              {{ titelVon(l) }}
            </button>
          </nav>
          <WkrRuhe
            v-if="abmeldungVon(x.aufgabe.liste)"
            :key="`abmeldung|${x.aufgabe.liste}`"
            art="abmeldung"
            :liste="abmeldungVon(x.aufgabe.liste)!.titel || titelVon(x.aufgabe.liste)"
            :bereich="abmeldungVon(x.aufgabe.liste)!.bereich"
            :entwuerfe="quelle.entwuerfe.value.filter((e) => e.liste === x.aufgabe.liste)"
            :zuletzt="quelle.zuletzt.value.filter((z) => z.liste === x.aufgabe.liste).slice(0, WKR_ANNAHMEN.zuletztLeiste)"
          />
          <WkrProbe
            v-else-if="proben.has(x.aufgabe.liste) && probeAufbauVon(x.aufgabe.liste)"
            :key="`probe|${x.aufgabe.liste}`"
            :aufbau="probeAufbauVon(x.aufgabe.liste)!"
            :bild="probeBildVon(x.aufgabe.liste)?.zuordnung ?? null"
            :pad="pad"
            :teil="probeTeilVon(x.aufgabe)"
            :hand="ansicht.hand"
            :uebung="quelle.uebung"
            :bojen-folge="ansicht.bojenFolge?.[x.aufgabe.liste]"
            :bild-lage="ansicht.bildLage?.[x.aufgabe.liste] ?? null"
            @fertig="probeFertig(x.aufgabe.liste)"
          />
          <WkrPruefliste
            v-else-if="istPruefliste(x.aufgabe.liste)"
            :key="`pruef|${x.aufgabe.liste}`"
            :quelle="quelle"
            :aufgabe="x.aufgabe"
            :sprache-wahl="spracheWahlVon(x.aufgabe.liste)"
            :hand="ansicht.hand"
            :pad="pad"
            :name="ansicht.name ?? ''"
            @name="merkeName"
          />
          <WkrMaske
            v-else
            :key="`${x.aufgabe.liste}|${x.spalte.teil ?? ''}`"
            :quelle="quelle"
            :aufgabe="x.aufgabe"
            :sprache-wahl="spracheWahlVon(x.aufgabe.liste)"
            :hand="ansicht.hand"
            :modus="ansicht.modus"
            :name="ansicht.name ?? ''"
            :bojen-folgen="ansicht.bojenFolge"
            :bild-lagen="ansicht.bildLage"
            :meldung="meldungFuer?.(x.aufgabe.liste) ?? null"
            :seite="seiteVon"
            :steg-teil="x.spalte.teil"
            :ohne-lauf="imBand(x.aufgabe.liste)"
            :masken="maskenVon(x.aufgabe)"
            @ansicht="setzeAnsicht"
            @name="merkeName"
            @probe="starteProbe(x.aufgabe.liste)"
            @maske="(m) => waehleMaske(x.aufgabe.liste, m)"
            @uebung-ende="emit('uebungEnde')"
          />
        </div>
      </div>
    </template>
    <!-- Nutzer 21.11.2026 (W3-15, GF4): „Übung beenden“ unter den Knöpfen (erreicht beim Hochziehen) statt Neuladen. -->
    <div v-if="quelle.uebung" class="wkr-uebung-ende" data-teil="uebung-ende-unten">
      <button type="button" class="wkr-knopf wkr-knopf--breit" data-ziel="klein" data-action="uebung-beenden" @click="emit('uebungEnde')">{{ w('wkr.geraet.uebung.beenden') }}</button>
    </div>
    <nav v-if="!pad && !quelle.entzogen.value && reiterListen.length > 1" class="wkr-listenreiter" role="tablist" :aria-label="w('wkr.geraet.listen')" data-teil="listen-reiter">
      <button
        v-for="l in reiterListen"
        :key="l"
        type="button"
        role="tab"
        class="wkr-knopf"
        data-ziel="klein"
        data-action="liste-reiter"
        :data-liste="l"
        :aria-selected="l === aktiv?.liste"
        @click="reiter = l"
      >
        {{ titelVon(l) }}
      </button>
    </nav>
  </div>
</template>
