// Zusammengelegte Positionen: Eine Position mit `ersetzt` übernimmt die Aufgaben
// mehrerer anderer, z. B. Tor 5 und die Parcoursüberwachung auf einer Liste. Sie gilt
// in jedem Aufbau, der alle ersetzten Positionen enthält. Läuft auch ohne Bundler
// (scripts/check-config.ts).

/** Die Position, die in einem Aufbau mit diesen Positionen zusammenlegen kann. */
export function findeKombi<P extends { ersetzt?: string[] }>(aufbauPositionen: string[], positionen: P[]): P | undefined {
  return positionen.find((p) => !!p?.ersetzt?.length && p.ersetzt.every((id) => aufbauPositionen.includes(id)))
}

/** Die erste ersetzte Position wird zur Kombi-Position, die übrigen entfallen. */
export function kombiReihenfolge(order: string[], positionId: string, ersetzt: string[]): string[] {
  const erste = order.findIndex((id) => ersetzt.includes(id))
  return order.flatMap((id, i) => (i === erste ? [positionId] : ersetzt.includes(id) ? [] : [id]))
}
