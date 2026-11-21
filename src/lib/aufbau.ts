import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch, type Ref } from 'vue'

/**
 * Schrittweiser Aufbau langer Listen am Bildschirm (21.11.2026, Meldung des Nutzers: Der erste Klick
 * auf „WKR-Listen“ dauerte ohne jede Rückmeldung sehr lange).
 *
 * Gemessen (Pages-Build, Chromium, 48 Beispielstarter, 188 Druckseiten WKR-Bögen): ein einziger
 * Block von 1,3–2 s, in dem der Browser nichts zeichnen kann. Davon Vue rendert und hängt ein rund
 * 0,7 s (darin die QR-Codes der Seiten, qrcode-generator, rund 0,45 s), das erste Messen im DOM
 * (BogenSeite messen(), erzwungenes Layout aller Blätter) rund 0,6 s, die zweite Runde nach der
 * Messung (Teilung, ResizeObserver) 0,2–0,35 s. Die Berechnung der Bögen selbst (lib/wkrListen.ts,
 * lib/bogen.ts) fällt daneben kaum ins Gewicht. Teuer ist also das Zeichnen – deshalb wird nicht
 * schneller gerechnet, sondern Stück für Stück eingehängt: je Schritt so viele Einträge, dass ein
 * Schritt etwa `zielMs` dauert, dazwischen bekommt der Browser ein Bild (der Balken bewegt sich).
 *
 * Der Stand ist echt: eingehängte Einträge / alle Einträge. Was schon steht, bleibt beim Wechsel der
 * Auswahl stehen (Schlüssel), nur Neues kommt schrittweise dazu.
 *
 * Bis alles steht, druckt nichts: Die Listen melden `fertig`, ListsView sperrt den Knopf, und der
 * Stapel ist `no-print` (Strg+P druckt nur den Hinweis aus components/AufbauBalken.vue). Teilung und
 * Seitenzahlen ändern sich nicht – jeder Bogen misst und teilt sich wie zuvor selbst.
 */
export const AUFBAU = {
  /** Einträge, die sofort mit dem ersten Bild erscheinen – kleine Listen sind damit gleich fertig. */
  ersterSchritt: 3,
  /** Angestrebte Dauer eines Schritts: kurz genug, dass der Balken flüssig läuft. */
  zielMs: 80,
  /** Höchstens so viele Einträge in einem Schritt. */
  hoechstens: 40,
  /** Erst ab dieser Dauer erscheint die Anzeige – sonst blitzte sie bei kleinen Listen nur auf. */
  anzeigeAbMs: 150,
  /**
   * Einmal gezeigt, bleibt die Anzeige mindestens so lange stehen (dann voll) – sonst blitzte sie bei
   * einem Aufbau knapp über `anzeigeAbMs` nur für Millisekunden auf (Prüfung 21.11.2026). Gedruckt
   * werden kann in dieser Zeit schon: Sie hängt an `zeigen`, nicht an `fertig`.
   */
  mindestensMs: 400,
}

let schrittweise = true

/**
 * Schaltet den schrittweisen Aufbau ein oder aus. Die Tests schalten ihn in src/test-setup.ts aus –
 * sie lesen die Bögen gleich nach dem Einhängen; wer den Aufbau selbst prüft, schaltet ihn wieder ein.
 */
export function setzeSchrittweise(an: boolean): void {
  schrittweise = an
}

/** Dem Browser Luft lassen, bis er ein Bild gezeichnet hat; im Hintergrund-Tab (kein rAF) über den Zeitgeber. */
function luft(): Promise<void> {
  return new Promise((weiter) => {
    let erledigt = false
    const los = () => {
      if (erledigt) return
      erledigt = true
      setTimeout(weiter, 0)
    }
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(los)
    setTimeout(los, 50)
  })
}

export interface Aufbau<T> {
  /** Was gerade eingehängt sein soll – in der Reihenfolge der ganzen Liste. */
  sichtbar: Readonly<Ref<T[]>>
  /** Eingehängt / insgesamt. */
  fertigAnzahl: Readonly<Ref<number>>
  gesamt: Readonly<Ref<number>>
  /** Alles steht. */
  fertig: Readonly<Ref<boolean>>
  /** Der nächste Eintrag, der entsteht (für die Zeile unter dem Balken). */
  naechster: Readonly<Ref<T | undefined>>
  /**
   * Die Anzeige zeigen: Der Aufbau läuft schon länger als `anzeigeAbMs` – und bleibt nach dem Ende
   * noch bis `mindestensMs` nach dem Erscheinen stehen. Einhängen also mit `!fertig || zeigen`.
   */
  zeigen: Readonly<Ref<boolean>>
}

/**
 * `liste`: alle Einträge, die am Ende stehen sollen; `schluessel`: stabil je Eintrag (wie `:key`).
 * In einer Komponente aufrufen (räumt beim Aushängen auf).
 */
export function useSchrittweise<T>(liste: Readonly<Ref<readonly T[]>>, schluessel: (x: T) => string): Aufbau<T> {
  // Schlüssel der eingehängten Einträge. Neu gesetzt statt verändert: shallowRef löst so genau einmal aus.
  const gebaut = shallowRef<ReadonlySet<string>>(new Set())
  const zeigen = ref(false)
  let zeitgeber: ReturnType<typeof setTimeout> | undefined
  // Nach dem Ende: wartet die Mindestdauer der Anzeige ab.
  let ausZeitgeber: ReturnType<typeof setTimeout> | undefined
  let gezeigtSeit = 0
  let laeuft = false
  let aktiv = true

  const sichtbar = computed(() => liste.value.filter((x) => gebaut.value.has(schluessel(x))))
  const fertigAnzahl = computed(() => sichtbar.value.length)
  const gesamt = computed(() => liste.value.length)
  const fertig = computed(() => fertigAnzahl.value >= gesamt.value)
  const naechster = computed(() => liste.value.find((x) => !gebaut.value.has(schluessel(x))))

  /** Die nächsten `n` noch fehlenden Einträge einhängen. */
  function nimm(n: number) {
    const neu = new Set(gebaut.value)
    let dazu = 0
    for (const x of liste.value) {
      if (dazu >= n) break
      const k = schluessel(x)
      if (!neu.has(k)) {
        neu.add(k)
        dazu++
      }
    }
    if (dazu > 0) gebaut.value = neu
  }

  function anzeigeAus() {
    clearTimeout(zeitgeber)
    zeitgeber = undefined
    clearTimeout(ausZeitgeber)
    ausZeitgeber = undefined
    if (!zeigen.value) return
    const rest = gezeigtSeit + AUFBAU.mindestensMs - performance.now()
    if (rest <= 0) zeigen.value = false
    else
      ausZeitgeber = setTimeout(() => {
        ausZeitgeber = undefined
        zeigen.value = false
      }, rest)
  }

  function anzeigeAn() {
    zeitgeber = undefined
    if (!aktiv || fertig.value) return
    zeigen.value = true
    gezeigtSeit = performance.now()
  }

  async function weiter() {
    if (laeuft) return
    laeuft = true
    // Beginnt ein neuer Aufbau, während die Anzeige noch ihre Mindestdauer abwartet: Sie bleibt einfach stehen.
    clearTimeout(ausZeitgeber)
    ausZeitgeber = undefined
    if (zeitgeber === undefined && !zeigen.value) zeitgeber = setTimeout(anzeigeAn, AUFBAU.anzeigeAbMs)
    let schritt = Math.min(AUFBAU.hoechstens, AUFBAU.ersterSchritt)
    try {
      while (aktiv && !fertig.value) {
        await luft()
        if (!aktiv) return
        const start = performance.now()
        nimm(schritt)
        // Vue rendert und hängt ein; darin misst jede neue Seite ihr Blatt (erzwungenes Layout).
        await nextTick()
        const dauer = Math.max(1, performance.now() - start)
        schritt = Math.min(AUFBAU.hoechstens, Math.max(1, Math.round((schritt * AUFBAU.zielMs) / dauer)))
      }
    } finally {
      laeuft = false
      if (fertig.value) anzeigeAus()
    }
  }

  watch(
    () => liste.value.map(schluessel),
    (schluessel) => {
      const da = new Set(schluessel)
      // Was nicht mehr in der Liste steht, ist ausgehängt – kommt es wieder, entsteht es neu.
      const bleibt = [...gebaut.value].filter((k) => da.has(k))
      if (!schrittweise) {
        gebaut.value = da
        return
      }
      if (bleibt.length !== gebaut.value.size) gebaut.value = new Set(bleibt)
      // Das erste Bild bringt gleich ein paar Einträge mit (kleine Listen: alles, ohne Anzeige).
      if (bleibt.length === 0) nimm(AUFBAU.ersterSchritt)
      if (!fertig.value) void weiter()
      else anzeigeAus()
    },
    { immediate: true },
  )

  onBeforeUnmount(() => {
    aktiv = false
    clearTimeout(zeitgeber)
    clearTimeout(ausZeitgeber)
  })

  return { sichtbar, fertigAnzahl, gesamt, fertig, naechster, zeigen }
}
