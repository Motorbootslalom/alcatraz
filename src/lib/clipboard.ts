/** Text in die Zwischenablage legen; `false`, wenn der Browser es verweigert. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
