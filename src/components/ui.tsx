import { Check, Copy, Download } from 'lucide-react'
import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { copyText } from '../lib/clipboard'
import { downloadText } from '../lib/download'

type Variant = 'primary' | 'ghost' | 'danger'

export function Button({
  variant = 'ghost',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const styles: Record<Variant, string> = {
    primary: 'bg-accent text-accent-ink hover:brightness-110',
    ghost: 'border border-line bg-panel text-ink hover:border-accent',
    danger: 'border border-take-red/50 bg-panel text-take-red hover:bg-take-red hover:text-white',
  }
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
      {...props}
    />
  )
}

export function CopyButton({ text, label = 'Copiar', disabled }: { text: string; label?: string; disabled?: boolean }) {
  const [done, setDone] = useState(false)
  return (
    <Button
      disabled={disabled || !text}
      onClick={async () => {
        if (await copyText(text)) {
          setDone(true)
          setTimeout(() => setDone(false), 1600)
        }
      }}
      aria-live="polite"
    >
      {done ? <Check size={16} /> : <Copy size={16} />}
      {done ? 'Copiat' : label}
    </Button>
  )
}

export function DownloadButton({ filename, text, label }: { filename: string; text: string; label?: string }) {
  return (
    <Button onClick={() => downloadText(filename, text)} disabled={!text}>
      <Download size={16} />
      {label ?? `Descarregar ${filename}`}
    </Button>
  )
}

/** Bloc de text per a enganxar a Claude Code. */
export function PromptBlock({
  text,
  empty,
  filename,
}: {
  text: string
  empty?: string
  filename?: string
}) {
  return (
    <div className="rounded-lg border border-line bg-sunken">
      {text ? (
        <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-[13px] leading-relaxed">
          {text}
        </pre>
      ) : (
        <p className="p-4 text-sm text-muted">{empty ?? 'Encara no hi ha res a enviar.'}</p>
      )}
      <div className="flex flex-wrap gap-2 border-t border-line p-2">
        <CopyButton text={text} label="Copiar per a Claude Code" />
        {filename && <DownloadButton filename={filename} text={text} />}
      </div>
    </div>
  )
}

export function Section({
  title,
  intro,
  children,
  aside,
}: {
  title: string
  intro?: ReactNode
  children: ReactNode
  aside?: ReactNode
}) {
  return (
    <section className="rounded-xl border border-line bg-panel p-5 md:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-[65ch]">
          <h2 className="headline text-2xl">{title}</h2>
          {intro && <div className="mt-1 text-muted">{intro}</div>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  )
}

export function Notice({ children }: { children: ReactNode }) {
  return <div className="rounded-md bg-warn-bg px-3 py-2 text-sm text-warn-ink">{children}</div>
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  )
}
