import { computed, effectScope, ref, shallowRef, watch } from 'vue'
import type { PunktId, Sprache } from '../types'
import { WKR_ANNAHMEN } from '../wkr/annahmen'
import { maskeFuer } from '../wkr/maske'
import type { ListenSicht, ListenStart } from '../wkr/sicht'
import { teileVon, type ListenTeil } from '../wkr/liste'
import { uebungsSchritt, uebungsSicht, uebungsStand, type UebungsStand } from '../wkr/uebung'
import type { ListenAufgabe } from './aufgaben'
import type {
  EigenerAbschluss,
  EntwurfEintrag,
  ErfassungsQuelle,
  MaskenZeile,
  PruefZeile,
  Pruefung,
  SchlangenEintrag,
  ZeilenStufe,
  ZuletztZeile,
} from './erfassen'

/**
 * Übungs-Kern der WKR-Maske (W3, Plan docs/plan-wkr-w3.md §4.2, G13, 21.11.2026): dieselbe Schnittstelle wie die
 * echte Erfassung ({@link ErfassungsQuelle}), aber **ohne Transport, ohne Ablage, ohne Store** – kein WebSocket, kein
 * fetch, nichts im localStorage (die Ansicht legt die Oberfläche selbst ab). Die Sicht kommt aus wkr/uebung.ts
 * (erfundene Starts ohne Namen); jede Zeile bekommt nach WKR_ANNAHMEN.uebungQuittungMs ihre Quittung, die Zeile zum
 * `uebungRueckfrageBei`. Start einmal eine Beispiel-Rückfrage; alle `uebungTaktSek` rückt ein Start nach.
 */

export interface UebungsOptionen {
  regelwerk: string
  typeId: string
  /** Steg: nur Ablegen bzw. Anlegen üben (F16); ohne = ganzer Steg. */
  teil?: ListenTeil
  /** Sprache der Liste; Vorgabe die des Regelwerks. */
  sprache?: Sprache
  /** Uhr (Tests); Vorgabe Date.now. */
  uhr?: () => number
  /** Takt für neue Starts in ms (Vorgabe WKR_ANNAHMEN.uebungTaktSek). */
  taktMs?: number
}

interface UebZeile {
  z: number
  s: string
  sn?: string
  klasse: string | null
  t?: ListenTeil
  k?: true
  punkt: PunktId | null
  zellen: Record<string, string>
  /** „Nicht vorbeigekommen“ (W4.3, R8): ohne Zellen, wie im echten Kern. */
  n?: true
  stufe: ZeilenStufe
  /** Stand der Übung vor dieser Zeile – zum Zurückholen, solange nichts anderes geschah. */
  vorher: UebungsStand
  nachher: UebungsStand
}

export function oeffneUebung(o: UebungsOptionen): ErfassungsQuelle {
  const uhr = o.uhr ?? Date.now
  const teil = o.teil && teileVon(o.typeId) ? o.teil : undefined
  let stand = uebungsStand(o.regelwerk, o.typeId, o.sprache)
  const kennung = uebungsSicht(stand).liste
  const aufgabe: ListenAufgabe = { art: 'liste', liste: kennung, ...(teil ? { teil } : {}) }
  const sichten = shallowRef<Readonly<Record<string, ListenSicht | null>>>({ [kennung]: uebungsSicht(stand) })
  const rev = ref(0)
  let zeilen: UebZeile[] = []
  const abschl: EigenerAbschluss[] = []
  const entw = new Map<string, { sn?: string; zellen: Record<string, string> }>()
  const timer = new Set<ReturnType<typeof setTimeout>>()
  let naechsteZ = Math.max(1, Math.floor(uhr()))
  let neue = 0
  let gestoppt = false

  const sicht = () => sichten.value[kennung]!
  const setzeStand = (neu: UebungsStand, status?: ListenSicht['status']) => {
    stand = neu
    const s = uebungsSicht(stand)
    s.status = status ?? sicht().status
    sichten.value = { [kennung]: s }
  }
  const spaeter = (ms: number, f: () => void) => {
    const t = setTimeout(() => {
      timer.delete(t)
      if (!gestoppt) f()
    }, ms)
    timer.add(t)
  }
  const geaendert = () => rev.value++

  const scope = effectScope(true)
  const takt = setInterval(() => {
    if (gestoppt || sicht().status !== 'aktiv') return
    setzeStand(uebungsSchritt(stand, null))
  }, o.taktMs ?? WKR_ANNAHMEN.uebungTaktSek * 1000)

  const eigen = (liste: string) => liste === kennung
  const startVon = (s: string): ListenStart | undefined => [...sicht().schlange, ...sicht().danach].find((x) => x.key === s)

  /** Quittung nach kurzer Zeit; die Zeile zum n-ten Start bekommt einmal die Beispiel-Rückfrage (G13). */
  function quittiere(z: UebZeile, rueckfrage: boolean) {
    spaeter(WKR_ANNAHMEN.uebungQuittungMs, () => {
      if (!zeilen.includes(z)) return
      if (rueckfrage) {
        const [feld, wert] = Object.entries(z.zellen).find(([, w]) => w !== '') ?? Object.entries(z.zellen)[0] ?? ['', '']
        const aufbau = z.klasse ? maskeFuer(sicht(), z.klasse as never) : null
        const anders = aufbau?.teile.find((t) => t.feld === feld)?.codes.find((c) => c.code !== wert)?.code ?? (wert === '' ? '1' : '')
        z.stufe = { stufe: 'rueckfrage', zellen: [{ feld, lauf: startVon(z.s)?.lauf ?? 'manoevrieren/1', steht: anders }] }
      } else z.stufe = { stufe: 'uebernommen' }
      geaendert()
    })
  }

  function neueZeile(z: Omit<UebZeile, 'z' | 'stufe' | 'vorher' | 'nachher'>, vorher: UebungsStand): number {
    const zeile: UebZeile = { ...z, z: naechsteZ++, stufe: { stufe: 'unterwegs', gesendet: true }, vorher, nachher: stand }
    zeilen.push(zeile)
    zeilen = zeilen.slice(-WKR_ANNAHMEN.zuletzt)
    if (!z.k) neue++
    // Die Beispiel-Rückfrage braucht ein Feld – eine Zeile „nicht vorbeigekommen“ hat keins.
    quittiere(zeile, !z.k && !z.n && neue === WKR_ANNAHMEN.uebungRueckfrageBei)
    geaendert()
    return zeile.z
  }

  const stufeLesen = () => void rev.value
  const listen = scope.run(() => computed(() => [aufgabe]))!
  const passt = (s: ListenStart, t: ListenTeil | undefined) => (t ? !s.teile?.[t] : !(s.teile?.ab && s.teile?.an))
  const schlange = scope.run(() =>
    computed(() => ({ [kennung]: sicht().schlange.filter((s) => passt(s, teil)).map((s): SchlangenEintrag => ({ ...s })) })),
  )!
  const stufen = scope.run(() =>
    computed(() => {
      stufeLesen()
      return Object.fromEntries(zeilen.map((z) => [z.z, z.stufe])) as Record<number, ZeilenStufe>
    }),
  )!
  const zuletzt = scope.run(() =>
    computed(() => {
      stufeLesen()
      return zeilen
        .slice()
        .reverse()
        .map((z): ZuletztZeile => ({
          z: z.z,
          liste: kennung,
          s: z.s,
          ...(z.sn !== undefined ? { sn: z.sn } : {}),
          ...(z.t ? { teil: z.t } : {}),
          punkt: z.punkt,
          korrektur: !!z.k,
          zellen: { ...z.zellen },
          stufe: z.stufe,
          ...(z.n ? { nv: true as const } : {}),
        }))
    }),
  )!
  const entwuerfe = scope.run(() =>
    computed(() => {
      stufeLesen()
      return [...entw.entries()].map(([k, e]): EntwurfEintrag => {
        const i = k.lastIndexOf('|')
        const t = k.slice(i + 1)
        return { liste: kennung, s: k.slice(0, i), ...(t === 'ab' || t === 'an' ? { teil: t } : {}), ...(e.sn !== undefined ? { sn: e.sn } : {}), zellen: { ...e.zellen } }
      })
    }),
  )!
  const ek = (s: string, t: ListenTeil | undefined) => `${s}|${t ?? ''}`
  const wartend = scope.run(() =>
    computed(() => {
      stufeLesen()
      return zeilen.filter((z) => z.stufe.stufe === 'unterwegs').length
    }),
  )!
  // Wie im Kern (geraete/erfassen.ts): seit wann etwas ohne Quittung wartet, über einen Reiterwechsel hinweg.
  const wartendSeit = shallowRef<number | null>(null)
  scope.run(() => watch(() => wartend.value > 0, (ja) => (wartendSeit.value = ja ? (wartendSeit.value ?? Date.now()) : null)))

  /**
   * Werte der Zeilen eines Starts übereinander: ein leerer Wert eines ANDEREN Steg-Teils löscht nicht, was ein Teil
   * gesetzt hat (gemeinsame Disq./Bemerkung, Prüfbefund W3 21.11.2026 – wie geraete/erfassen.ts mit `wt`).
   */
  function stapel(reihe: readonly UebZeile[]): Record<string, string> {
    const out: Record<string, string> = {}
    const von = new Map<string, ListenTeil | undefined>()
    for (const z of reihe) {
      for (const [f, w] of Object.entries(z.zellen)) {
        if (w === '' && von.has(f) && von.get(f) !== undefined && von.get(f) !== z.t) continue
        out[f] = w
        von.set(f, z.t)
      }
    }
    return out
  }

  function pruefung(liste: string, punkt: PunktId, t?: ListenTeil): Pruefung {
    if (!eigen(liste)) return { zeilen: [], offen: [], x: [], nichtVorbei: [] }
    const jeStart = new Map<string, PruefZeile>()
    for (const z of zeilen) {
      if (z.punkt !== punkt || (t !== undefined && z.t !== undefined && z.t !== t)) continue
      const zellen = stapel(zeilen.filter((x) => x.s === z.s && x.punkt === punkt && x.z <= z.z && (t === undefined || x.t === undefined || x.t === t)))
      // Die jüngste Zeile des Starts entscheidet: „nicht vorbeigekommen“ oder doch vorbei (Korrektur).
      jeStart.set(z.s, { s: z.s, ...(z.sn !== undefined ? { sn: z.sn } : {}), klasse: z.klasse, zellen, stufe: z.stufe, x: Object.values(zellen).some((w) => w.split(/[\s,;/]+/).includes('X')), nv: !!z.n })
    }
    const out = [...jeStart.values()]
    const offen = sicht().punkt?.id === punkt ? sicht().schlange.filter((s) => !s.vorab && !s.entfaellt && passt(s, t)).map((s) => ({ ...s })) : []
    return { zeilen: out, offen, x: out.filter((z) => z.x).map((z) => z.sn ?? z.s), nichtVorbei: out.filter((z) => z.nv).map((z) => z.sn ?? z.s) }
  }

  function status(liste: string, st: ListenSicht['status']): number | null {
    if (gestoppt || !eigen(liste)) return null
    setzeStand(stand, st)
    return naechsteZ++
  }

  return {
    uebung: true,
    verbunden: scope.run(() => computed(() => true))!,
    verbindung: scope.run(() => computed(() => 'verbunden' as const))!,
    entzogen: scope.run(() => computed(() => false))!,
    listen,
    sichten,
    schlange,
    schlangeTeil: (liste, t) => (eigen(liste) && sicht().teile ? sicht().schlange.filter((s) => passt(s, t)).map((s) => ({ ...s })) : []),
    stufen,
    zuletzt,
    hinweise: scope.run(() => computed(() => ({ [kennung]: [] })))!,
    abschluesse: scope.run(() =>
      computed(() => {
        stufeLesen()
        return abschl.slice().reverse()
      }),
    )!,
    wartend,
    getrenntSeit: shallowRef(null),
    wartendSeit,
    schicke(liste, zeile: MaskenZeile) {
      if (gestoppt || !eigen(liste) || typeof zeile.s !== 'string' || zeile.s === '') return null
      if (teil && zeile.teil && zeile.teil !== teil) return null
      const t = teil ?? zeile.teil
      const start = startVon(zeile.s)
      const vorher = stand
      // Punkt vor dem Schritt: Mit der letzten Nummer beginnt sonst schon der nächste Lauf.
      const punkt = sicht().punkt?.id ?? null
      entw.delete(ek(zeile.s, t))
      // Ein Teil-Gerät übt allein: Den anderen Teil erledigt „das andere Handy“ gleich mit, sonst stauten sich die
      // Starts in der Übung. Nur das Gerät für den ganzen Steg erledigt je Teil.
      setzeStand(uebungsSchritt(stand, { s: zeile.s, ...(!teil && t ? { teil: t } : {}) }))
      const nv = zeile.nv === true
      return neueZeile({ s: zeile.s, ...(start ? { sn: start.startNr } : {}), klasse: start?.klasse ?? null, ...(t ? { t } : {}), punkt, zellen: nv ? {} : { ...zeile.zellen }, ...(nv ? { n: true as const } : {}) }, vorher)
    },
    stand(z) {
      const alt = zeilen.find((x) => x.z === z)
      if (!alt) return null
      return stapel(zeilen.filter((x) => x.s === alt.s && x.punkt === alt.punkt && (x.t === undefined || alt.t === undefined || x.t === alt.t)))
    },
    korrigiere(z, zellen) {
      const alt = zeilen.find((x) => x.z === z)
      if (gestoppt || !alt) return null
      // Die Rückfrage gilt mit der Korrektur als beantwortet (in der Übung entscheidet niemand am Bedienrechner).
      if (alt.stufe.stufe === 'rueckfrage') alt.stufe = { stufe: 'uebernommen', nachRueckfrage: true }
      return neueZeile({ s: alt.s, ...(alt.sn !== undefined ? { sn: alt.sn } : {}), klasse: alt.klasse, ...(alt.t ? { t: alt.t } : {}), k: true, punkt: alt.punkt, zellen: { ...alt.zellen, ...zellen } }, stand)
    },
    pausiere: (liste) => status(liste, 'pausiert'),
    meldeAb: (liste) => status(liste, 'abgemeldet'),
    weiter: (liste) => status(liste, 'aktiv'),
    schliesseAb(liste, punkt, name, restPapier) {
      if (gestoppt || !eigen(liste) || typeof name !== 'string' || name.trim() === '' || name.trim().length > WKR_ANNAHMEN.nameMax) return null
      const a: EigenerAbschluss = { id: naechsteZ++, liste, punkt, stufe: 'unterwegs' }
      abschl.push(a)
      const offen = pruefung(liste, punkt, teil).offen.length > 0
      spaeter(WKR_ANNAHMEN.uebungQuittungMs, () => {
        if (offen && !restPapier) {
          a.stufe = 'abgelehnt'
          a.grund = 'offen'
        } else a.stufe = 'angenommen'
        geaendert()
      })
      geaendert()
      return a.id
    },
    gesehen() {},
    entwurf(liste, s, t) {
      const e = eigen(liste) ? entw.get(ek(s, t)) : undefined
      return e ? { ...e.zellen } : null
    },
    merkeEntwurf(liste, s, t, zellen) {
      if (gestoppt || !eigen(liste) || typeof s !== 'string' || s === '') return false
      const k = ek(s, t)
      entw.delete(k)
      if (Object.values(zellen).some((w) => w !== '')) {
        const sn = startVon(s)?.startNr
        entw.set(k, { ...(sn !== undefined ? { sn } : {}), zellen: { ...zellen } })
      }
      geaendert()
      return true
    },
    verwirfEntwurf(liste, s, t) {
      if (eigen(liste) && entw.delete(ek(s, t))) geaendert()
    },
    entwuerfe,
    holeZurueck(z) {
      const alt = zeilen.find((x) => x.z === z)
      // Nur ohne Quittung und solange danach nichts geschah (sonst stünde die Übung anders da).
      if (gestoppt || !alt || alt.stufe.stufe !== 'unterwegs' || alt.nachher !== stand) return null
      zeilen = zeilen.filter((x) => x !== alt)
      if (!alt.k) neue--
      setzeStand(alt.vorher)
      if (Object.values(alt.zellen).some((w) => w !== '')) entw.set(ek(alt.s, alt.t), { ...(alt.sn !== undefined ? { sn: alt.sn } : {}), zellen: { ...alt.zellen } })
      geaendert()
      return { s: alt.s, zellen: { ...alt.zellen }, ...(alt.t ? { teil: alt.t } : {}) }
    },
    pruefung,
    stop() {
      if (gestoppt) return
      gestoppt = true
      clearInterval(takt)
      for (const t of timer) clearTimeout(t)
      timer.clear()
      scope.stop()
    },
  }
}
