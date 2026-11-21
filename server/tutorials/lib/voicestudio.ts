/**
 * VoiceStudio (https://voicestudio.sh): aplicació local de codi obert amb molts motors de veu
 * darrere d'una API compatible amb OpenAI a http://localhost:3900.
 * Només torna àudio: el temps de cada paraula el calcula després l'alineació amb Whisper.
 */

/** Màxim de caràcters per petició que accepta POST /v1/audio/speech. */
export const VOICESTUDIO_MAX_CHARS = 4096

export interface VoiceStudioVoice {
  id: string
  name: string
}

export function speechRequest(o: { text: string; voice: string; speed: number; model: string }) {
  return {
    // «tts-1» és l'àlies del motor que tingues actiu a VoiceStudio.
    model: o.model || 'tts-1',
    input: o.text,
    voice: o.voice || 'default',
    speed: o.speed,
    response_format: 'wav',
    language: 'es',
  }
}

/**
 * Llig la llista de GET /v1/audio/voices. La documentació no en fixa el format,
 * així que s'accepta una llista directa o dins de «voices» o «data», amb camps habituals.
 */
export function parseVoices(data: unknown): VoiceStudioVoice[] {
  const list = Array.isArray(data)
    ? data
    : Array.isArray((data as { voices?: unknown })?.voices)
      ? (data as { voices: unknown[] }).voices
      : Array.isArray((data as { data?: unknown })?.data)
        ? (data as { data: unknown[] }).data
        : []
  const out: VoiceStudioVoice[] = []
  for (const item of list) {
    if (typeof item === 'string') {
      out.push({ id: item, name: item })
      continue
    }
    const v = item as Record<string, unknown>
    const id = String(v.id ?? v.voice_id ?? v.voice ?? v.name ?? '').trim()
    if (!id) continue
    out.push({ id, name: String(v.name ?? v.display_name ?? id) })
  }
  if (!out.some((v) => v.id === 'default')) out.unshift({ id: 'default', name: 'Veu per defecte del motor actiu' })
  return out
}
