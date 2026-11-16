import { onBeforeUnmount, onMounted, readonly, ref, type Ref } from 'vue'

/**
 * Die Uhr eines Bildschirms: `Date.now()` in einem Takt, solange die Komponente steht (Betrieb, Etappe E3).
 *
 * Wartezeiten („ca. in“, „Zeit bis zum Vorsteg“) und „seit m:ss“ rechnet der Bildschirm aus der Sicht und
 * dieser Uhr (betrieb/prognose.ts) – nie der Reducer, nie der Store, nie die Sicht: Sonst änderte sich der
 * Stand jede Sekunde, jede Änderung würde gespeichert, und die Anzeigetafel zeichnete ständig neu (Kritik K28).
 * Ein entferntes Gerät (ab E6) addiert seinen Versatz zur Zeit des Hosts dazu; am Bedienrechner ist er 0.
 */
export function useUhr(takt = 1000): Readonly<Ref<number>> {
  const jetzt = ref(Date.now())
  let zeitgeber: ReturnType<typeof setInterval> | undefined
  onMounted(() => {
    jetzt.value = Date.now()
    zeitgeber = setInterval(() => (jetzt.value = Date.now()), takt)
  })
  onBeforeUnmount(() => clearInterval(zeitgeber))
  return readonly(jetzt)
}
