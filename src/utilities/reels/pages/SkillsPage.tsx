import { ChevronDown } from 'lucide-react'
import { CopyButton, DownloadButton, PromptBlock, Section } from '../../../components/ui'
import { HYPERFRAMES_COMMAND, SKILLS_INSTALL_PROMPT } from '../data/checklists'
import { SKILLS } from '../data/skills'

export function SkillsPage() {
  return (
    <div className="space-y-6">
      <Section
        title="Instal·lar les tres skills"
        intro="Una skill és una carpeta amb instruccions que Claude Code llig quan li toca eixa tasca. Si tens el zip, el més fàcil és demanar-li-ho a Claude Code."
      >
        <PromptBlock text={SKILLS_INSTALL_PROMPT} />
        <p className="mt-3 text-sm text-muted">
          Han de quedar tres carpetes dins de <code className="font-mono">~/.claude/skills</code>: editor-reels, look-reels i
          efectos-reels. Si no tens el zip, crea les dues primeres a mà amb el text d’ací baix.
        </p>
      </Section>

      {SKILLS.map((skill) => (
        <Section
          key={skill.id}
          title={skill.name}
          intro={skill.purpose}
          aside={
            skill.content ? (
              <div className="flex flex-wrap gap-2">
                <CopyButton text={skill.content} label="Copiar SKILL.md" />
                <DownloadButton filename="SKILL.md" text={skill.content} label="Descarregar" />
              </div>
            ) : undefined
          }
        >
          <p className="text-sm">
            Ruta: <code className="font-mono">{skill.installPath}</code>
          </p>
          {skill.content ? (
            <details className="group mt-3 rounded-lg border border-line bg-sunken">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2 text-sm font-semibold">
                <ChevronDown size={16} className="transition-transform group-open:rotate-180" />
                Veure el text sencer
              </summary>
              <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap border-t border-line p-4 font-mono text-[13px] leading-relaxed">
                {skill.content}
              </pre>
            </details>
          ) : (
            <div className="mt-3 space-y-2">
              <p className="text-sm text-muted">
                Porta una plantilla amb els 29 efectes i només ve al zip. La primera vegada, Claude Code et demanarà permís per a
                instal·lar les skills de Hyperframes, que porten els sons dels efectes. Si ho prefereixes fer tu, a la terminal:
              </p>
              <PromptBlock text={HYPERFRAMES_COMMAND} />
            </div>
          )}
        </Section>
      ))}
    </div>
  )
}
