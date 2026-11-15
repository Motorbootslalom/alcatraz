/* global STAND */
/*
 * Offline-Speicher für das Programm (Service Worker). Diese Datei ist die Vorlage: Beim Build
 * setzt scripts/offline-speicher.ts die Zeile `const STAND = …` davor – Fassung, Kennung und
 * die Liste ALLER ausgelieferten Dateien mit ihrer Prüfsumme. Ändert sich eine Datei, ändert
 * sich die Liste und damit diese Datei; daran erkennt der Browser eine neue Fassung.
 *
 * Bewusst von Hand statt mit Workbox: vier Dateien, eine Strategie (alles vorab, nichts
 * nachladen), und das Verhalten bei einer neuen Fassung soll hier nachlesbar sein.
 *
 * WELCHE FASSUNG AUSGELIEFERT WIRD, hängt NICHT daran, welcher Service Worker gerade läuft:
 *
 * - Jede Fassung liegt vollständig in ihrem EIGENEN Cache (Name mit ihrer Kennung). Daneben
 *   liegt ihre Dateiliste im Merk-Cache, damit auch ein späterer Service Worker sie prüfen kann.
 * - Ein Zeiger „gültige Fassung“ (ebenfalls im Merk-Cache) nennt die Kennung, aus deren Cache
 *   geantwortet wird – nie ein Gemisch aus alt und neu.
 * - Den Zeiger setzt nur die Seite (`uebernehmen`: der Knopf „Update“, oder der Start bei leerem
 *   Stand = keine Starter). Der Service Worker setzt ihn selbst nur, wenn es keinen gibt
 *   (allererste Einrichtung) oder er ins Leere zeigt.
 *
 * Warum so: Einen wartenden Service Worker aktiviert der Browser, sobald kein Fenster mehr offen
 * ist – nach einem Neustart des Rechners mitten im Wettkampf liefe sonst ungefragt die neue
 * Fassung. Das lässt sich nicht verbieten. Mit dem Zeiger ist es gleichgültig: Auch der neue
 * Service Worker liefert die alte Fassung aus ihrem Cache, bis jemand „Update“ drückt.
 *
 * Deshalb bedient ein neuer Service Worker Seiten einer älteren Fassung (und nach `uebernehmen`
 * kurz umgekehrt). Was beide teilen, ändert seine Bedeutung nicht von einer Fassung zur nächsten:
 * - Namen der Caches und Aufbau des Merk-Caches (`gueltig`, `stand/<Kennung>`);
 * - Nachrichten: `{ typ: 'stand' }` → `{ typ: 'stand', gueltig, eigen }` (je `{ kennung, fassung,
 *   commitZeit, zeit, dateien, fehlend, eindatei }`); `{ typ: 'uebernehmen' }` →
 *   `{ typ: 'uebernommen', ok, kennung }` und an alle Fenster `{ typ: 'gewechselt', kennung }`.
 * Einen Übergang von Fassungen vor dem Zeiger gibt es nicht (Entscheidung des Nutzers vom
 * 15.11.2026: Die Anwendung ist noch in Entwicklung).
 */

// Auf derselben Adresse (github.io) liegen weitere Anwendungen; Caches gelten je Adresse.
// Der Pfad im Namen sorgt dafür, dass hier nur die eigenen Caches aufgeräumt werden.
const BASIS = self.registration.scope
const PFAD = new URL(BASIS).pathname
const PREFIX = `alcatraz-offline|${PFAD}|`
// Zeiger und Dateilisten. Der Name beginnt bewusst NICHT mit PREFIX: `raeumeAuf` löscht, was so
// beginnt und weder der gültigen noch der eigenen Fassung gehört.
const MERK = `alcatraz-fassung|${PFAD}`

const adr = (pfad) => new URL(pfad, BASIS).href
// Eine Adresse, die es als Datei nie gibt – der Merk-Cache wird nie ausgeliefert.
const merkAdr = (name) => new URL(`__fassung__/${name}`, BASIS).href

async function liesMerk(name) {
  try {
    const treffer = await (await caches.open(MERK)).match(merkAdr(name))
    return treffer ? await treffer.json() : undefined
  } catch {
    return undefined
  }
}

async function schreibeMerk(name, wert) {
  await (await caches.open(MERK)).put(merkAdr(name), new Response(JSON.stringify(wert), { headers: { 'content-type': 'application/json' } }))
}

/** Kennung der gültigen Fassung; `undefined`, solange es keinen Zeiger gibt. */
async function zeiger() {
  const z = await liesMerk('gueltig')
  return z && typeof z.kennung === 'string' ? z.kennung : undefined
}

/** Fassung, Zeiten und Dateiliste zu einer Kennung – die eigene oder eine gemerkte. */
async function standVon(kennung) {
  return kennung === STAND.kennung ? STAND : liesMerk(`stand/${kennung}`)
}

async function hex(puffer) {
  const summe = await crypto.subtle.digest('SHA-256', puffer)
  return [...new Uint8Array(summe)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function fehlende(s) {
  const cache = await caches.open(PREFIX + s.kennung)
  const da = new Set((await cache.keys()).map((r) => r.url))
  return s.dateien.filter(([pfad]) => !da.has(adr(pfad)))
}

/**
 * Holt, was im Cache einer Fassung fehlt. Am Browser-Cache vorbei (`no-store`), und nur, was zur
 * Liste passt: Liefert der Server während einer Veröffentlichung noch die alte Datei (oder längst
 * eine neuere), schlägt das Füllen fehl und wird beim nächsten Mal wiederholt – statt eine
 * Fassung aus zwei Ständen zu mischen.
 */
async function fuellen(s) {
  const cache = await caches.open(PREFIX + s.kennung)
  const offen = await fehlende(s)
  await Promise.all(
    offen.map(async ([pfad, summe]) => {
      const antwort = await fetch(adr(pfad), { cache: 'no-store' })
      if (!antwort.ok) throw new Error(`${pfad}: ${antwort.status}`)
      const inhalt = await antwort.arrayBuffer()
      if ((await hex(inhalt)) !== summe) throw new Error(`${pfad}: anderer Stand als die Liste`)
      // Neu verpackt: Eine umgeleitete Antwort dürfte der Browser nicht als Seite ausliefern.
      const kopf = new Headers()
      for (const name of ['content-type', 'last-modified']) {
        const wert = antwort.headers.get(name)
        if (wert) kopf.set(name, wert)
      }
      await cache.put(adr(pfad), new Response(inhalt, { headers: kopf }))
    }),
  )
}

/** Läuft schon ein Füllen derselben Fassung, wird darauf gewartet statt dieselben Dateien ein zweites Mal zu holen. */
const laufend = new Map()
function fuellenEinmal(s) {
  let lauf = laufend.get(s.kennung)
  if (!lauf) {
    lauf = fuellen(s).finally(() => laufend.delete(s.kennung))
    laufend.set(s.kennung, lauf)
  }
  return lauf
}

/** Füllt nach, was fehlt; `true`, wenn die Fassung danach vollständig ist. Scheitern ist kein Fehler. */
async function vervollstaendige(s) {
  if ((await fehlende(s)).length === 0) return true
  return fuellenEinmal(s).then(
    async () => (await fehlende(s)).length === 0,
    () => false,
  )
}

async function beschreibe(s) {
  return {
    kennung: s.kennung,
    fassung: s.fassung,
    commitZeit: s.commitZeit ?? '',
    zeit: s.zeit ?? '',
    dateien: s.dateien.length,
    fehlend: (await fehlende(s)).length,
    // Liegt die Ein-Datei-Fassung daneben (Pages), kann die Seite sie auch ohne Netz anbieten.
    eindatei: s.dateien.some(([pfad]) => pfad === 'alcatraz.html'),
  }
}

/**
 * Was die Seite wissen will: `gueltig` ist die Fassung, die ausgeliefert wird – dieselbe, aus
 * deren Cache `antwort` liefert (der Zeiger, ohne ihn die eigene); fehlt nur, wenn ihre Liste
 * verloren ist. `eigen` ist die dieses Service Workers.
 */
async function stand() {
  const s = await standVon((await zeiger()) ?? STAND.kennung)
  return { typ: 'stand', gueltig: s ? await beschreibe(s) : undefined, eigen: await beschreibe(STAND) }
}

/**
 * Löscht die Caches und Dateilisten, die niemand mehr braucht: alles außer der gültigen Fassung
 * und der eigenen. Nicht, solange eine weitere Fassung lädt – ihr halb gefüllter Cache ginge mit.
 */
async function raeumeAuf(gueltig) {
  if (self.registration.installing) return
  const bleibt = new Set([PREFIX + gueltig, PREFIX + STAND.kennung])
  for (const name of await caches.keys()) {
    if (name.startsWith(PREFIX) && !bleibt.has(name)) await caches.delete(name)
  }
  const merk = await caches.open(MERK)
  const vorsilbe = merkAdr('stand/')
  for (const anfrage of await merk.keys()) {
    if (anfrage.url.startsWith(vorsilbe) && !bleibt.has(PREFIX + anfrage.url.slice(vorsilbe.length))) await merk.delete(anfrage)
  }
}

async function alleFenster(nachricht) {
  for (const fenster of await self.clients.matchAll({ type: 'window', includeUncontrolled: true })) fenster.postMessage(nachricht)
}

/** Wird wahr, sobald dieser Service Worker aktiviert ist (nur in dem Lauf, in dem es geschieht). */
let melde
const aktiviert = new Promise((fertig) => (melde = fertig))
const pause = (ms) => new Promise((fertig) => setTimeout(fertig, ms))

self.addEventListener('install', (ereignis) => {
  ereignis.waitUntil(
    (async () => {
      await fuellen(STAND)
      // Erst nach dem Füllen: Eine Liste im Merk-Cache heißt, dass die Fassung einmal vollständig war.
      await schreibeMerk(`stand/${STAND.kennung}`, STAND)
    })(),
  )
})

self.addEventListener('activate', (ereignis) => {
  ereignis.waitUntil(
    (async () => {
      let gueltig = await zeiger()
      // Kein Zeiger: allererste Einrichtung. Ein Zeiger ins Leere (Cache oder Liste gelöscht)
      // hilft niemandem. In beiden Fällen gilt diese Fassung. Sonst bleibt der Zeiger, wo er
      // ist: Dieser Service Worker liefert dann die ÄLTERE Fassung aus, bis „Update“ ihn umsetzt.
      if (gueltig === undefined || !(await caches.has(PREFIX + gueltig)) || !(await standVon(gueltig))) {
        gueltig = STAND.kennung
        await schreibeMerk('gueltig', { kennung: gueltig })
      }
      await raeumeAuf(gueltig)
      // Beim allerersten Mal gilt der Speicher sofort für das offene Fenster.
      await self.clients.claim()
      melde()
    })(),
  )
})

self.addEventListener('message', (ereignis) => {
  const typ = ereignis.data && ereignis.data.typ
  const antworte = (nachricht) => (ereignis.ports[0] ?? ereignis.source)?.postMessage(nachricht)
  if (typ === 'uebernehmen') {
    // Diese Fassung wird die gültige. Nur vollständig – sonst bleibt alles, wie es ist.
    ereignis.waitUntil(
      (async () => {
        let ok = false
        try {
          ok = await vervollstaendige(STAND)
          if (ok) {
            await schreibeMerk(`stand/${STAND.kennung}`, STAND)
            await schreibeMerk('gueltig', { kennung: STAND.kennung })
          }
        } catch {
          ok = false
        }
        if (!ok) return antworte({ typ: 'uebernommen', ok, kennung: STAND.kennung })
        // Wartet dieser Service Worker noch, löst er den alten gleich ab. Für die Auslieferung ist
        // das nicht nötig – jeder liest den Zeiger –, aber so läuft danach der neue Service Worker
        // (und räumt den Cache der alten Fassung auf). Kurz darauf gewartet, bevor die Seite
        // Antwort bekommt und neu lädt: Mitten in ihrem Neuladen schöbe der Browser den Wechsel
        // sonst auf, bis der alte Service Worker zur Ruhe kommt.
        await self.skipWaiting()
        if (self.serviceWorker?.state !== 'activated') await Promise.race([aktiviert, pause(1500)])
        antworte({ typ: 'uebernommen', ok, kennung: STAND.kennung })
        // Die anderen Fenster laufen noch mit der alten Fassung: Sie zeigen den Hinweis, neu zu laden.
        await alleFenster({ typ: 'gewechselt', kennung: STAND.kennung })
        await raeumeAuf(STAND.kennung)
      })(),
    )
  } else if (typ === 'stand') {
    ereignis.waitUntil(
      (async () => {
        const kennung = await zeiger()
        const gueltig = kennung === undefined ? undefined : await standVon(kennung)
        // Hat der Browser Dateien verworfen, wird nachgefüllt (ohne Netz bleibt es beim Versuch;
        // die gültige Fassung lässt sich nur nachfüllen, solange der Server sie noch ausliefert).
        const vorher = [gueltig, STAND].filter(Boolean)
        const fehlte = (await Promise.all(vorher.map(async (s) => (await fehlende(s)).length > 0))).some(Boolean)
        if (!fehlte) {
          antworte(await stand())
          // Läuft dieser Service Worker und wartet keine weitere Fassung, darf Liegengebliebenes weg.
          if (kennung !== undefined && self.registration.active && !self.registration.waiting) await raeumeAuf(kennung)
          return
        }
        const voll = (await Promise.all(vorher.map(vervollstaendige))).every(Boolean)
        antworte(await stand())
        // Auf einer langsamen Verbindung wartet die Seite nicht so lange auf die Antwort. Ist jetzt
        // alles da, erfahren es alle Fenster von selbst. Nur dann: Eine Meldung nach einem
        // gescheiterten Versuch stieße ohne Netz den nächsten an, ohne Ende.
        if (voll) await alleFenster(await stand())
      })(),
    )
  }
})

async function antwort(anfrage, pfad) {
  // Bei jeder Anfrage nachgelesen statt gemerkt: Nach `uebernehmen` gilt der neue Zeiger sofort,
  // gleich welcher Service Worker gerade antwortet.
  const kennung = (await zeiger()) ?? STAND.kennung
  const cache = await caches.open(PREFIX + kennung)
  const treffer = await cache.match(adr(pfad))
  // Was nicht zur Liste gehört (oder verworfen wurde), kommt aus dem Netz – wie ohne Speicher.
  return treffer ?? fetch(anfrage)
}

self.addEventListener('fetch', (ereignis) => {
  const anfrage = ereignis.request
  if (anfrage.method !== 'GET' || !anfrage.url.startsWith(BASIS)) return
  // Ohne Abfrageteil und Sprungmarke; der Ordner selbst ist die Startseite.
  const pfad = new URL(anfrage.url).pathname.slice(PFAD.length) || 'index.html'
  ereignis.respondWith(antwort(anfrage, pfad))
})
