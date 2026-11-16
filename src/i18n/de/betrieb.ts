/**
 * Betrieb am Wettkampftag (Plan vom 16.11.2026): die Start-Freigabe am Bedienrechner (`betrieb.*`, Sprache
 * der Oberfläche), die Anzeigetafel selbst (`anzeige.*`, in der Sprache der Tafel über tIn – wie die Listen)
 * und die Arten einer Meldung (`meldung.*`). Begriffe: „Anzeigetafel“, nicht „Tafel“ – das ist das
 * Aushangbrett; „Start-Freigabe“ ist der Steg, der die Starts freigibt. Ab E6 kommt `geraete.*` dazu.
 * Die Einstellungen der Anzeigetafel stehen unter `listopt.anzeige.*` (listenoptionen.ts).
 */
export default {
  'betrieb.title': 'Start-Freigabe',
  'betrieb.hint':
    'Hier wird freigegeben, wer als Nächstes startet. Die Anzeigetafel zeigt es sofort – in einem eigenen Fenster, etwa auf einem zweiten Bildschirm. Die Folge der Starts ist die der festgeschriebenen Verzahnung, Lauf für Lauf.',
  'betrieb.oeffnen': 'Anzeigetafel öffnen',
  'betrieb.oeffnen.hint': 'Öffnet ein eigenes Fenster; dort schaltet die Taste F auf Vollbild.',
  'betrieb.oeffnen.bereich': 'Eigene Anzeigetafel',
  'betrieb.oeffnen.bereichTitel': 'Eine Anzeigetafel nur für {name} öffnen',
  'betrieb.einstellungen': 'Einstellungen der Anzeigetafel',
  'betrieb.vorVerzahnung':
    'Die Start-Freigabe beginnt, wenn die Verzahnung festgeschrieben ist – erst dann stehen Startnummern und Folge der Starts fest:',
  'betrieb.geloest':
    'Die Verzahnung ist nicht mehr festgeschrieben: „Nächster Start“ und „Lauf beginnen“ ruhen, bis sie wieder festgeschrieben ist. Zurück, Meldungen und Zurücksetzen gehen weiter:',
  'betrieb.leer': 'Noch fährt kein Starter auf einem Parcours.',
  'betrieb.zuruecksetzen': 'Betrieb zurücksetzen',
  'betrieb.zuruecksetzen.frage': 'Betrieb zurücksetzen?',
  'betrieb.zuruecksetzen.text':
    'Begonnene Läufe, gezeigte Starts und Meldungen aller Parcours werden gelöscht; die Anzeigetafel steht wieder auf „bereit“. Starter, Verzahnung und erfasste Werte bleiben.',
  'betrieb.zuruecksetzen.ja': 'Zurücksetzen',
  'betrieb.imBoot': 'Im Boot',
  'betrieb.keiner': 'Noch kein Start gezeigt.',
  'betrieb.geloescht': 'Starter gelöscht – die Anzeigetafel zeigt „bereit“.',
  'betrieb.davor': 'davor',
  'betrieb.naechster': 'Als Nächstes',
  'betrieb.lauf': 'Lauf {n}',
  'betrieb.laeufe': 'Läufe {von}–{bis}',
  'betrieb.laufend': '{punkt} läuft',
  'betrieb.offen': 'noch {n} Start | noch {n} Starts',
  'betrieb.nichtBegonnen': 'Noch kein Lauf begonnen.',
  'betrieb.punktZuEnde': '{punkt} ist zu Ende – die Anzeigetafel bleibt auf dem letzten Start stehen.',
  'betrieb.alleZuEnde': 'Alle Läufe sind zu Ende.',
  'betrieb.zeigen': 'Nächster Start',
  'betrieb.zurueck': 'Zurück',
  'betrieb.zurueck.title': 'Den zuletzt gezeigten Start zurücknehmen',
  'betrieb.beginnen': 'Lauf {n} beginnen',
  'betrieb.beginnen.laeufe': 'Läufe {von}–{bis} beginnen',
  'betrieb.beginnen.frage': 'Nächsten Lauf beginnen?',
  'betrieb.beginnen.text':
    'Im laufenden Lauf ist noch {n} Start offen. Er bleibt freigegeben und kommt vor den Starts des neuen Laufs dran. | Im laufenden Lauf sind noch {n} Starts offen. Sie bleiben freigegeben und kommen vor den Starts des neuen Laufs dran.',
  'betrieb.nachzuholen': 'Nachzuholen',
  'betrieb.nachzuholen.hint':
    'Starts vor dem zuletzt gezeigten, die noch nicht dran waren – nach einer Nachmeldung, einem entfernten X oder einem verpassten Lauf. Sie kommen nie von selbst als Nächstes.',
  'betrieb.nachzuholen.zeigen': 'Jetzt zeigen',
  'betrieb.meldung': 'Meldung',
  'betrieb.meldung.hint': 'Störung und Pause stehen auf der Anzeigetafel statt des Starters, ein Hinweis steht darunter.',
  'betrieb.meldung.platzhalter': 'Text für die Anzeigetafel …',
  'betrieb.meldung.setzen': 'Meldung zeigen',
  'betrieb.meldung.alle': 'Auf allen Parcours zeigen',
  'betrieb.meldung.loeschen': 'Meldung löschen',
  'betrieb.meldung.aktiv': 'Auf der Anzeigetafel ({art}): „{text}“',

  'anzeige.titel': 'Anzeigetafel',
  'anzeige.bereit': 'bereit',
  'anzeige.davor': 'davor',
  'anzeige.keineStarter': 'Noch keine Starter',

  'meldung.info': 'Hinweis',
  'meldung.stoerung': 'Störung',
  'meldung.pause': 'Pause',
} as const satisfies Record<string, string>
