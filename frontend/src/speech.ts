// Read steps aloud. Inside the AuraHealth Android app a native bridge (window.AuraNative) speaks with the
// phone's own text-to-speech; in a browser the Web Speech API is used if it exists. Offline speech depends on
// the phone having an English voice installed.

interface NativeBridge {
  speak?: (text: string) => void
  stopSpeaking?: () => void
}

const native = () => (window as unknown as { AuraNative?: NativeBridge }).AuraNative

export const canSpeak = () => !!native()?.speak || 'speechSynthesis' in window

export function speak(text: string) {
  const bridge = native()
  if (bridge?.speak) {
    bridge.speak(text)
    return
  }
  if (!('speechSynthesis' in window)) return
  const synth = window.speechSynthesis
  synth.cancel()
  const utter = new SpeechSynthesisUtterance(text)
  const voices = synth.getVoices()
  utter.voice = voices.find((v) => v.lang === 'en-IN') ?? voices.find((v) => v.lang.startsWith('en')) ?? null
  utter.lang = utter.voice?.lang ?? 'en-IN'
  utter.rate = 0.95
  synth.speak(utter)
}

export function stopSpeaking() {
  const bridge = native()
  if (bridge?.stopSpeaking) bridge.stopSpeaking()
  else if ('speechSynthesis' in window) window.speechSynthesis.cancel()
}
