import { sortiert, vergleiche, type Speichermarke, type VerlaufEintrag } from '../lib/verlauf'

/**
 * Der zweite Speicher: eine IndexedDB in diesem Browser, neben dem localStorage.
 *
 * Wozu: Der Browser schreibt den localStorage gebündelt und verzögert auf die Platte; bei einem
 * harten Abbruch fehlen die letzten Änderungen. Eine IndexedDB-Transaktion ist dagegen nach
 * wenigen Millisekunden abgeschlossen. Und sie hat Platz für mehr als einen Stand – den Verlauf.
 *
 * Aufbau (alles nur auf diesem Gerät; nichts davon geht in Sicherung oder Vorlage):
 * - `stand` / `aktuell`: die Marke des jetzigen Stands und wo sein Text liegt.
 * - `verlauf`: je Eintrag die Angaben (Zeit, was sich geändert hat, Name) – klein, für die Liste.
 * - `verlaufStand`: je Eintrag der Stand als Text, genau wie im localStorage – groß, wird nur
 *   beim Start und beim Wiederherstellen gelesen.
 *
 * Der jetzige Stand ist in aller Regel zugleich der des jüngsten Verlaufseintrags. Sein Text
 * liegt deshalb nur EINMAL (beim Eintrag), `aktuell` zeigt darauf: Je Tastendruck wird so ein
 * Text geschrieben statt zwei. Nur wenn es zu einer Speicherung keinen Eintrag gibt, liegt der
 * Text unter einem eigenen Schlüssel.
 *
 * Gespeichert wird der Text, den der Store für den localStorage ohnehin gebildet hat: Der
 * Browser muss ihn nur kopieren, nicht noch einmal den ganzen Stand zerlegen.
 */
export const ZWEIT_DB = 'alcatraz'
const STAND = 'stand'
const VERLAUF = 'verlauf'
const STAENDE = 'verlaufStand'
const AKTUELL = 'aktuell'
/** Schlüssel in `verlaufStand` für den jetzigen Stand, wenn kein Verlaufseintrag ihn trägt. */
const OHNE_EINTRAG = '·aktuell'

/** Was unter `aktuell` liegt: die Marke und der Schlüssel des Texts in `verlaufStand`. */
interface Zeiger extends Speichermarke {
  id: string
}

export interface Aktuell extends Speichermarke {
  json: string
}

export interface Schreibauftrag {
  aktuell?: Aktuell
  /** Neue oder fortgeschriebene Einträge des Verlaufs mit ihrem Stand. */
  eintraege?: { eintrag: VerlaufEintrag; json: string }[]
  /** Vorher den ganzen Verlauf löschen, auch die benannten Stände („Alles zurücksetzen“). */
  leeren?: boolean
  /**
   * Nur schreiben, wenn `aktuell` neuer ist als das, was liegt. Für den Abgleich beim Start: Ein
   * anderes Fenster kann inzwischen weiter sein – dessen Stand darf nicht überschrieben werden.
   */
  nurWennNeuer?: boolean
}

export interface Zweitspeicher {
  liesAktuell(): Promise<Aktuell | null>
  /** Alles in EINER Transaktion: Stand und Verlauf passen immer zusammen. `false`: wegen `nurWennNeuer` nicht geschrieben. */
  schreibe(auftrag: Schreibauftrag): Promise<boolean>
  /** Einträge des Verlaufs, jüngste zuerst. */
  eintraege(): Promise<VerlaufEintrag[]>
  stand(id: string): Promise<string | null>
  /** Löscht Einträge samt ihrem Stand – nie den, auf dem der jetzige Stand liegt. */
  loesche(ids: readonly string[]): Promise<void>
  schliesse(): void
}

function anfrage<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((ok, fehler) => {
    r.onsuccess = () => ok(r.result)
    r.onerror = () => fehler(r.error)
  })
}

function abschluss(tx: IDBTransaction): Promise<void> {
  return new Promise((ok, fehler) => {
    tx.oncomplete = () => ok()
    tx.onerror = () => fehler(tx.error)
    tx.onabort = () => fehler(tx.error ?? new Error('abgebrochen'))
  })
}

/**
 * Öffnet den zweiten Speicher. `null`, wenn es ihn nicht gibt: Browser ohne IndexedDB, privates
 * Fenster oder `file://` in manchen Browsern, gesperrter oder kaputter Speicher. Wirft nie – die
 * Anwendung läuft dann wie bisher mit dem localStorage allein.
 */
export function oeffneZweitspeicher(fabrik: IDBFactory | undefined | null, geduld = 4000): Promise<Zweitspeicher | null> {
  return new Promise((fertig) => {
    if (!fabrik) return fertig(null)
    let entschieden = false
    const ende = (db: IDBDatabase | null) => {
      if (entschieden) {
        // Kam die Datenbank erst nach Ablauf der Geduld: wieder schließen, niemand nutzt sie.
        db?.close()
        return
      }
      entschieden = true
      clearTimeout(uhr)
      fertig(db ? huelle(db) : null)
    }
    // Manche Browser antworten im privaten Fenster gar nicht – dann nicht ewig „wird geprüft“.
    const uhr = setTimeout(() => ende(null), geduld)
    try {
      const r = fabrik.open(ZWEIT_DB, 1)
      r.onupgradeneeded = () => {
        const db = r.result
        if (!db.objectStoreNames.contains(STAND)) db.createObjectStore(STAND)
        if (!db.objectStoreNames.contains(VERLAUF)) db.createObjectStore(VERLAUF, { keyPath: 'id' })
        if (!db.objectStoreNames.contains(STAENDE)) db.createObjectStore(STAENDE)
      }
      r.onsuccess = () => {
        const db = r.result
        // Eine spätere Fassung mit neuem Aufbau der Datenbank soll nicht an diesem Fenster hängen.
        db.onversionchange = () => db.close()
        ende(db)
      }
      r.onerror = () => ende(null)
      r.onblocked = () => ende(null)
    } catch {
      ende(null)
    }
  })
}

function huelle(db: IDBDatabase): Zweitspeicher {
  /**
   * `strict`: Die Transaktion gilt erst als abgeschlossen, wenn die Daten auf der Platte sind
   * (Chromium schreibt sonst „relaxed“ – das übersteht ein Beenden des Browsers, aber nicht
   * sicher einen Stromausfall). Das kostet Zeit im Hintergrund, nicht beim Tippen. Browser, die
   * die Angabe nicht kennen, übergehen sie.
   */
  const schreibend = (namen: string[]) => {
    try {
      return db.transaction(namen, 'readwrite', { durability: 'strict' })
    } catch (e) {
      if (e instanceof TypeError) return db.transaction(namen, 'readwrite')
      throw e
    }
  }

  return {
    liesAktuell() {
      return new Promise((ok, fehler) => {
        const tx = db.transaction([STAND, STAENDE], 'readonly')
        let ergebnis: Aktuell | null = null
        const r = tx.objectStore(STAND).get(AKTUELL)
        r.onsuccess = () => {
          const z = r.result as Partial<Zeiger> | undefined
          if (!z || typeof z.id !== 'string' || typeof z.folge !== 'number' || typeof z.zeit !== 'number') return
          const { folge, zeit } = z
          const t = tx.objectStore(STAENDE).get(z.id)
          t.onsuccess = () => {
            if (typeof t.result === 'string') ergebnis = { folge, zeit, json: t.result }
          }
        }
        tx.oncomplete = () => ok(ergebnis)
        tx.onerror = () => fehler(tx.error)
        tx.onabort = () => fehler(tx.error ?? new Error('abgebrochen'))
      })
    },

    async schreibe(auftrag) {
      const tx = schreibend([STAND, VERLAUF, STAENDE])
      const fertig = abschluss(tx)
      const setze = () => {
        if (auftrag.leeren) {
          tx.objectStore(VERLAUF).clear()
          tx.objectStore(STAENDE).clear()
        }
        for (const { eintrag, json } of auftrag.eintraege ?? []) {
          tx.objectStore(VERLAUF).put(eintrag)
          tx.objectStore(STAENDE).put(json, eintrag.id)
        }
        if (auftrag.aktuell) {
          const { folge, zeit, json } = auftrag.aktuell
          // Trägt ein Eintrag dieses Auftrags denselben Text, zeigt `aktuell` auf ihn.
          const id = auftrag.eintraege?.find((e) => e.json === json)?.eintrag.id
          if (id === undefined) tx.objectStore(STAENDE).put(json, OHNE_EINTRAG)
          else tx.objectStore(STAENDE).delete(OHNE_EINTRAG)
          tx.objectStore(STAND).put({ folge, zeit, id: id ?? OHNE_EINTRAG } satisfies Zeiger, AKTUELL)
        }
      }
      let geschrieben = true
      if (auftrag.nurWennNeuer && auftrag.aktuell) {
        const neu = auftrag.aktuell
        // Im Rückruf selbst weiterschreiben: Nur dort ist die Transaktion sicher noch offen.
        const r = tx.objectStore(STAND).get(AKTUELL)
        r.onsuccess = () => {
          const liegt = r.result as Speichermarke | undefined
          if (liegt && vergleiche(neu, liegt) <= 0) geschrieben = false
          else setze()
        }
      } else {
        setze()
        // Sofort abschließen, statt auf die Antworten der einzelnen Aufträge zu warten: Beim
        // Verlassen der Seite bleibt dafür keine Zeit mehr. (Ältere Browser schließen von selbst ab.)
        tx.commit?.()
      }
      await fertig
      return geschrieben
    },

    async eintraege() {
      return sortiert((await anfrage(db.transaction(VERLAUF, 'readonly').objectStore(VERLAUF).getAll())) as VerlaufEintrag[])
    },

    async stand(id) {
      const wert = await anfrage(db.transaction(STAENDE, 'readonly').objectStore(STAENDE).get(id))
      return typeof wert === 'string' ? wert : null
    },

    loesche(ids) {
      if (ids.length === 0) return Promise.resolve()
      const tx = schreibend([STAND, VERLAUF, STAENDE])
      const fertig = abschluss(tx)
      const r = tx.objectStore(STAND).get(AKTUELL)
      r.onsuccess = () => {
        const liegt = (r.result as Partial<Zeiger> | undefined)?.id
        for (const id of ids) {
          if (id === liegt) continue
          tx.objectStore(VERLAUF).delete(id)
          tx.objectStore(STAENDE).delete(id)
        }
      }
      return fertig
    },

    schliesse: () => db.close(),
  }
}
