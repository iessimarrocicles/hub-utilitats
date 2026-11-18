import { AlertTriangle, CheckCircle2, Loader2, PlugZap, ShieldQuestion, XCircle } from 'lucide-react'
import { useState } from 'react'
import { Button, Field, PromptBlock } from '../../../components/ui'
import { DEFAULT_SERVER, isPublicOrigin, serverUrl, setServerUrl, type Health, type LocalNetworkPermission } from './api'
import type { Job } from './types'

export function ServerStatus({
  state,
  health,
  onRetry,
  permission,
}: {
  state: 'checking' | 'online' | 'offline'
  health: Health | null
  onRetry: () => void
  permission: LocalNetworkPermission
}) {
  const [editing, setEditing] = useState(false)
  const [url, setUrl] = useState(serverUrl())
  const publicPage = isPublicOrigin()

  if (state !== 'online' && publicPage && (permission === 'prompt' || permission === 'denied')) {
    return (
      <div className="rounded-xl border border-take-amber/60 bg-panel p-5">
        <div className="flex items-start gap-3">
          <ShieldQuestion className="mt-0.5 shrink-0 text-take-amber" />
          <div className="max-w-[65ch]">
            <p className="headline text-xl">Chrome ha de deixar que aquesta pàgina parle amb el teu ordinador</p>
            {permission === 'prompt' ? (
              <p className="mt-1 text-muted">
                Aquesta pàgina està publicada a Internet i el servidor de vídeo està al teu ordinador. Chrome t’ha de preguntar si li
                dones accés als dispositius de la xarxa local. Accepta-ho en l’avís de la barra d’adreces i torna a provar. Si no veus
                l’avís, recarrega la pàgina.
              </p>
            ) : (
              <p className="mt-1 text-muted">
                Chrome té bloquejat l’accés a la xarxa local per a aquesta pàgina. Fes clic en la icona que hi ha a l’esquerra de
                l’adreça, obri «Configuració del lloc» i permet «Xarxa local». Després recarrega la pàgina.
              </p>
            )}
            <p className="mt-2 text-sm text-muted">
              També pots usar el hub des de l’ordinador, sense permisos: arranca’l amb <code className="font-mono">npm start</code> i
              obri <code className="font-mono">http://localhost:5173</code>.
            </p>
            <Button className="mt-3" onClick={onRetry}>
              Tornar a provar
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (state === 'checking') {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-line bg-panel px-4 py-3 text-sm text-muted">
        <Loader2 size={16} className="animate-spin" /> Buscant el servidor local…
      </div>
    )
  }

  if (state === 'offline') {
    return (
      <div className="rounded-xl border border-take-amber/60 bg-panel p-5">
        <div className="flex items-start gap-3">
          <PlugZap className="mt-0.5 shrink-0 text-take-amber" />
          <div className="min-w-0 flex-1">
            <p className="headline text-xl">El servidor local no està en marxa</p>
            <p className="mt-1 max-w-[65ch] text-muted">
              L’edició automàtica necessita un programa al teu ordinador que treballa amb ffmpeg, Whisper i Claude Code. Obri una
              terminal a la carpeta del hub i arranca’l amb aquesta ordre:
            </p>
            <div className="mt-3 max-w-xl">
              <PromptBlock text="npm start" />
            </div>
            <p className="mt-3 text-sm text-muted">
              Arranca el servidor i la interfície alhora. Si només vols el servidor, usa <code className="font-mono">npm run server</code>.
            </p>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <Button onClick={onRetry}>Tornar a provar</Button>
              {editing ? (
                <>
                  <div className="w-64">
                    <Field label="Adreça del servidor">
                      <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={DEFAULT_SERVER} />
                    </Field>
                  </div>
                  <Button
                    variant="primary"
                    onClick={() => {
                      setServerUrl(url)
                      setEditing(false)
                      onRetry()
                    }}
                  >
                    Desar l’adreça
                  </Button>
                </>
              ) : (
                <button type="button" className="text-sm text-muted underline" onClick={() => setEditing(true)}>
                  Canviar l’adreça ({serverUrl()})
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const tools = health?.tools
  const missing = [
    !tools?.ffmpeg && 'ffmpeg',
    !tools?.whisper && 'Whisper (pip install openai-whisper)',
    !tools?.claude && 'Claude Code',
  ].filter(Boolean)
  if (missing.length > 0) {
    return (
      <div className="flex items-start gap-3 rounded-lg bg-warn-bg px-4 py-3 text-sm text-warn-ink">
        <AlertTriangle size={18} className="mt-0.5 shrink-0" />
        <span>Servidor en marxa, però falta: {missing.join(', ')}. Instal·la-ho i torna a provar.</span>
      </div>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
      <span className="inline-flex items-center gap-1.5 text-ok">
        <CheckCircle2 size={16} /> Servidor local en marxa
      </span>
      <span>ffmpeg, Whisper i {tools?.claude}</span>
    </div>
  )
}

export function JobProgress({ job }: { job: Job }) {
  if (job.status === 'error') {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-take-red/50 bg-panel p-4">
        <XCircle className="mt-0.5 shrink-0 text-take-red" size={20} />
        <div className="min-w-0">
          <p className="font-semibold">No s’ha pogut acabar</p>
          <pre className="mt-1 whitespace-pre-wrap break-words font-sans text-sm text-muted">{job.error}</pre>
        </div>
      </div>
    )
  }
  if (job.status === 'done') return null
  const pct = job.progress == null ? null : Math.round(job.progress * 100)
  return (
    <div className="rounded-lg border border-line bg-panel p-4" role="status" aria-live="polite">
      <div className="flex items-center gap-2">
        <Loader2 size={18} className="shrink-0 animate-spin text-accent" />
        <p className="font-semibold">{job.stage}</p>
        {pct != null && <span className="ml-auto font-mono text-sm text-muted">{pct}%</span>}
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-sunken">
        {pct == null ? (
          <div className="h-full w-1/3 animate-pulse rounded-full bg-accent/60" />
        ) : (
          <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${pct}%` }} />
        )}
      </div>
    </div>
  )
}

export function formatSeconds(s: number): string {
  const m = Math.floor(s / 60)
  const sec = s - m * 60
  return `${m}:${sec.toFixed(1).padStart(4, '0')}`
}
