/**
 * Nur für Tests: ein nachgebauter ntfy-Server (kein echtes Netz) und Hilfen für Host und Geräte (Vorbild der
 * nachgebaute Server in tafel transport/ntfy/transport.test.ts, 16.11.2026 erweitert um `since`, `poll`, mehrere
 * Themen je Abo und die Antwort auf das Veröffentlichen).
 *
 * Er verhält sich, wie ntfy dokumentiert ist: Beim Abonnieren kommt zuerst `open`, dann – mit `since` – das
 * Zwischengespeicherte, danach nur Neues. Was über 4096 Byte geht, wird zum Anhang unter `/file/…`; die Antwort
 * auf das Veröffentlichen ist die Nachricht selbst (mit `attachment.url`). `since` nimmt eine ID, Unix-Sekunden,
 * einen Zeitraum ('70m') oder 'all'.
 */
import { reducer } from '../../../state/reducer'
import { sichtOeffentlich } from '../../../betrieb/sicht'
import { betriebsStand, festgeschrieben, parallelStarter, zeigeNaechsten } from '../../../testHilfen'
import type { AppState, ClassId } from '../../../types'

export const SERVER = 'https://ntfy.test'

interface Gespeichert {
  seq: number
  id: string
  time: number
  topic: string
  body: string
  ereignis: Record<string, unknown>
}

export class NachgebautesNtfy {
  sockets = new Set<NachgebauterSocket>()
  gespeichert: Gespeichert[] = []
  dateien = new Map<string, string>()
  /** Statuscodes, die die nächsten Veröffentlichungen bekommen. */
  antworten: number[] = []
  /** Statuscodes nach der Annahme: ntfy hat die Nachricht, der Absender hört trotzdem einen Fehler (S2). */
  antwortenNachAnnahme: number[] = []
  /** Die nächste Nachricht an dieses Thema erreicht die Abos nicht (bleibt aber im Speicher, wie bei ntfy). */
  verschlucke: string | null = null
  /** Hat der Server Anhänge? Ohne: 413 für alles über 4096 Byte. */
  mitAnhaengen = true
  /** Uhr des Servers gegenüber der echten (für `since` als Zeitraum). */
  versatzMs = 0
  /** Alle GET-Abrufe (Abfragen, Anhänge) und Abo-Adressen – für Prüfungen. */
  abrufe: string[] = []
  abos: string[] = []
  private seq = 0

  jetzt(): number {
    return Date.now() + this.versatzMs
  }

  publish(topic: string, body: string): { status: number; ereignis?: Record<string, unknown> } {
    const status = this.antworten.shift() ?? 200
    if (status !== 200) return { status }
    if (body.length > 4096 && !this.mitAnhaengen) return { status: 413 }
    const seq = ++this.seq
    const id = `m${seq}`
    const ereignis: Record<string, unknown> = { id, time: Math.floor(this.jetzt() / 1000), event: 'message', topic }
    if (body.length > 4096) {
      this.dateien.set(id, body)
      ereignis.message = 'You received a file: attachment.txt'
      ereignis.attachment = { name: 'attachment.txt', size: body.length, url: `${SERVER}/file/${id}.txt` }
    } else {
      ereignis.message = body
    }
    this.gespeichert.push({ seq, id, time: ereignis.time as number, topic, body, ereignis })
    const verschluckt = this.verschlucke === topic
    if (verschluckt) this.verschlucke = null
    else for (const socket of this.sockets) if (socket.themen.includes(topic)) socket.push(JSON.stringify(ereignis))
    const danach = this.antwortenNachAnnahme.shift()
    if (danach !== undefined) return { status: danach }
    return { status: 200, ereignis }
  }

  /** Was seit `since` auf den Themen liegt. */
  seit(themen: string[], since: string | null): Gespeichert[] {
    const auf = this.gespeichert.filter((g) => themen.includes(g.topic))
    if (since === null) return []
    if (since === 'all') return auf
    if (/^\d+$/.test(since)) return auf.filter((g) => g.time >= Number(since))
    const dauer = /^(\d+)([smhd])$/.exec(since)
    if (dauer) {
      const ms = Number(dauer[1]) * { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[dauer[2] as 's' | 'm' | 'h' | 'd']
      return auf.filter((g) => g.time * 1000 >= this.jetzt() - ms)
    }
    const nach = this.gespeichert.find((g) => g.id === since)
    return nach ? auf.filter((g) => g.seq > nach.seq) : auf
  }

  /** Was an ein Thema ging (Anhänge als ihr Inhalt). */
  bodies(topic: string): string[] {
    return this.gespeichert.filter((g) => g.topic === topic).map((g) => g.body)
  }

  /** Eine schon veröffentlichte Nachricht noch einmal einstellen – wie ein Angreifer, der das Thema kennt. */
  wiederhole(topic: string, body: string): void {
    this.publish(topic, body)
  }
}

let ntfy: NachgebautesNtfy

export function neuesNtfy(): NachgebautesNtfy {
  ntfy = new NachgebautesNtfy()
  return ntfy
}

export class NachgebauterSocket {
  readyState = 0
  themen: string[]
  since: string | null
  onopen: (() => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null
  onmessage: ((ev: { data: string }) => void) | null = null

  constructor(readonly url: string) {
    const treffer = /^wss:\/\/ntfy\.test\/([A-Za-z0-9_,-]+)\/ws(?:\?since=([^&]+))?$/.exec(url)
    if (!treffer) throw new Error(`unerwartete Adresse ${url}`)
    this.themen = treffer[1].split(',')
    this.since = treffer[2] ? decodeURIComponent(treffer[2]) : null
    ntfy.sockets.add(this)
    ntfy.abos.push(url)
    setTimeout(() => {
      if (this.readyState === 3) return
      this.readyState = 1
      this.onopen?.()
      this.push(JSON.stringify({ event: 'open', topic: this.themen.join(',') }))
      for (const g of ntfy.seit(this.themen, this.since)) this.push(JSON.stringify(g.ereignis))
    }, 0)
  }

  push(data: string): void {
    setTimeout(() => {
      if (this.readyState === 1) this.onmessage?.({ data })
    }, 0)
  }

  close(): void {
    if (this.readyState === 3) return
    this.readyState = 3
    ntfy.sockets.delete(this)
    setTimeout(() => this.onclose?.(), 0)
  }
}

const antwort = (status: number, text: string) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: new Headers(),
  text: async () => text,
})

export async function nachgebautesFetch(input: string | URL, init?: { method?: string; body?: string }) {
  const url = String(input)
  if (init?.method === 'POST') {
    const topic = url.slice(SERVER.length + 1)
    const r = ntfy.publish(topic, init.body ?? '')
    return antwort(r.status, JSON.stringify(r.ereignis ?? {}))
  }
  ntfy.abrufe.push(url)
  const datei = /^https:\/\/ntfy\.test\/file\/(m\d+)\.txt$/.exec(url)
  if (datei) {
    const body = ntfy.dateien.get(datei[1])
    return body === undefined ? antwort(404, '') : antwort(200, body)
  }
  const abfrage = /^https:\/\/ntfy\.test\/([A-Za-z0-9_,-]+)\/json\?poll=1&since=([^&]+)$/.exec(url)
  if (abfrage) {
    const zeilen = ntfy.seit(abfrage[1].split(','), decodeURIComponent(abfrage[2])).map((g) => JSON.stringify(g.ereignis))
    return antwort(200, zeilen.join('\n'))
  }
  return antwort(404, '')
}

export async function bis(bedingung: () => boolean, ms = 3000): Promise<void> {
  const start = Date.now()
  while (!bedingung()) {
    if (Date.now() - start > ms) throw new Error('Zeit abgelaufen')
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
}

export const ruhe = (ms = 80) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Ein großer Betrieb mit erfundenen Startern (je Klasse 15, Vor<klasse><n>/Nach<klasse><n>, Musterclub),
 * festgeschrieben, Lauf 1 im ersten Bereich begonnen und ein Start gezeigt.
 */
export function grosserBetrieb(): { stand: AppState; bereich: string } {
  const klassen: ClassId[] = ['E', '1', '2', '3', '4', '5', '6', '7']
  let stand = festgeschrieben(betriebsStand(klassen.flatMap((k) => parallelStarter(k, 15))))
  const bereich = sichtOeffentlich(stand).bereiche[0].id
  stand = reducer(stand, { type: 'BETRIEB_BEGINNEN', bereich, punkt: 'lauf:1', zeit: 500 })
  stand = zeigeNaechsten(stand, bereich, 1000)
  return { stand, bereich }
}
