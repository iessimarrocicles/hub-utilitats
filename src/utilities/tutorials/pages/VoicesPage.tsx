import { CheckCircle2, Upload, Volume2, XCircle } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Button, Field, Notice, PromptBlock, Section } from '../../../components/ui'
import { serverFileUrl, tutorialsApi, type TutorialMeta } from '../api'
import type { TtsEngineId, VoiceOptions } from '../types'

const HELP: Record<TtsEngineId, { title: string; text: string; setup?: string }> = {
  kokoro: {
    title: 'Kokoro-82M · local, processador',
    text: 'Model lleuger que va més ràpid que el temps real amb el teu i7-1360P (4 fils). Tres veus en castellà. És l’opció per defecte: gratis, privada i sense límits.',
    setup: 'python -m venv .venv\n.venv\\Scripts\\pip install kokoro-onnx soundfile faster-whisper\n# i els fitxers kokoro-v1.0.onnx i voices-v1.0.bin a workspace/models/kokoro',
  },
  f5: {
    title: 'F5-TTS · local, targeta gràfica, la teua veu',
    text: 'Clona una veu a partir d’una mostra de 10-15 s. Usa la RTX 3050 (4 GB) en mitja precisió. Més lent que Kokoro però molt més natural i amb la teua veu.',
    setup: '.venv\\Scripts\\pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu126\n.venv\\Scripts\\pip install f5-tts',
  },
  elevenlabs: {
    title: 'ElevenLabs · al núvol',
    text: 'La millor qualitat i entonació. Gasta crèdits del teu compte. La clau es guarda en un fitxer .env del hub, fora de git.',
    setup: '# fitxer .env a la carpeta del hub\nELEVENLABS_API_KEY=la-teua-clau',
  },
}

export function VoicesPage() {
  const [meta, setMeta] = useState<TutorialMeta | null>(null)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    try {
      setMeta(await tutorialsApi.meta())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])
  useEffect(() => void load(), [load])
  if (!meta) return error ? <Notice>{error}</Notice> : <p className="text-muted">Carregant…</p>

  return (
    <div className="space-y-6">
      {error && <Notice>{error}</Notice>}
      <Section title="Motors de veu" intro="Quan generes un vídeo tries quin s’usa. Ací veus quins estan llestos en aquest ordinador.">
        <div className="grid gap-4 md:grid-cols-3">
          {(Object.keys(HELP) as TtsEngineId[]).map((e) => (
            <div key={e} className="rounded-lg border border-line p-4">
              <div className="flex items-center gap-2">
                {meta.engines[e].ready ? <CheckCircle2 className="text-ok" size={18} /> : <XCircle className="text-take-red" size={18} />}
                <p className="font-semibold">{HELP[e].title}</p>
              </div>
              <p className="mt-1 text-sm text-muted">{HELP[e].text}</p>
              <p className="mt-2 text-xs">{meta.engines[e].detail}</p>
              {!meta.engines[e].ready && HELP[e].setup && (
                <div className="mt-2">
                  <PromptBlock text={HELP[e].setup!} />
                </div>
              )}
              {meta.engines[e].ready && e === 'kokoro' && <SampleButtons voices={meta.kokoroVoices.map((v) => ({ engine: 'kokoro', voice: v.id, speed: 1, name: v.name }))} />}
              {meta.engines[e].ready && e === 'f5' && <SampleButtons voices={meta.f5Voices.map((v) => ({ engine: 'f5', voice: v, speed: 1, name: v }))} />}
            </div>
          ))}
        </div>
      </Section>
      <UploadVoice onDone={load} ready={meta.engines.f5.ready} />
    </div>
  )
}

function SampleButtons({ voices }: { voices: (VoiceOptions & { name: string })[] }) {
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap gap-2">
        {voices.map((v) => (
          <Button
            key={v.voice}
            disabled={!!busy}
            onClick={async () => {
              setBusy(v.voice)
              setError('')
              try {
                const r = await tutorialsApi.voiceSample(v, 'Hola. En este tutorial vas a aprender a usar esta página paso a paso.')
                setUrl(serverFileUrl(r.url))
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e))
              } finally {
                setBusy('')
              }
            }}
          >
            <Volume2 size={14} /> {busy === v.voice ? '…' : v.name}
          </Button>
        ))}
      </div>
      {url && <audio controls autoPlay src={url} className="w-full" />}
      {error && <p className="text-xs text-take-red">{error}</p>}
    </div>
  )
}

function UploadVoice({ onDone, ready }: { onDone: () => void; ready: boolean }) {
  const [name, setName] = useState('')
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [msg, setMsg] = useState('')
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!file) return
    setMsg('Pujant…')
    try {
      const r = await tutorialsApi.uploadVoice(name, text, file)
      setMsg(`Veu «${r.name}» desada.`)
      onDone()
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err))
    }
  }
  return (
    <Section
      title="La teua veu per a F5-TTS"
      intro="Grava 10-15 segons llegint un text en castellà, en un lloc silenciós i amb el to que vols als tutorials. Escriu exactament el que dius."
    >
      {!ready && <Notice>F5-TTS encara no està instal·lat. Pots pujar la mostra igualment.</Notice>}
      <form onSubmit={submit} className="mt-3 grid gap-3 md:grid-cols-2">
        <Field label="Nom de la veu">
          <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="la-meua-veu" className="w-full rounded-md border border-line bg-sunken px-3 py-2" />
        </Field>
        <Field label="Fitxer d’àudio">
          <input required type="file" accept="audio/*,video/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </Field>
        <div className="md:col-span-2">
          <Field label="Text exacte de la mostra">
            <textarea required rows={3} value={text} onChange={(e) => setText(e.target.value)} className="w-full rounded-md border border-line bg-sunken px-3 py-2" />
          </Field>
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" variant="primary">
            <Upload size={16} /> Desar la veu
          </Button>
          {msg && <span className="text-sm text-muted">{msg}</span>}
        </div>
      </form>
    </Section>
  )
}
