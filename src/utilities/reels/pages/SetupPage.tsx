import { Checklist } from '../../../components/Checklist'
import { PromptBlock, Section } from '../../../components/ui'
import { INSTALL_PROMPT, RECORDING, REQUIREMENTS, WORKSPACE } from '../data/checklists'

export function SetupPage() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Section title="El que necessites" intro="Una sola vegada. Les marques es queden guardades.">
        <Checklist storageKey="hub.reels.check.requirements" items={REQUIREMENTS} />
      </Section>

      <Section title="Prepara el lloc de treball">
        <Checklist storageKey="hub.reels.check.workspace" items={WORKSPACE} />
        <div className="mt-4">
          <p className="mb-2 text-sm font-semibold">Prompt d’instal·lació</p>
          <PromptBlock text={INSTALL_PROMPT} />
        </div>
      </Section>

      <div className="lg:col-span-2">
        <Section
          title="Grava pensant en l’edició"
          intro="Repassa-la abans de cada gravació."
        >
          <Checklist storageKey="hub.reels.check.recording" items={RECORDING} resettable />
        </Section>
      </div>
    </div>
  )
}
