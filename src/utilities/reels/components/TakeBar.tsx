import { STEPS, type ReelProject, type StepId } from '../model'

/**
 * Barra de presa: com la línia de temps de la guia, però per al procés.
 * Cada tram és un pas. Fet = ple, el següent = taronja, pendent = buit.
 */
export function TakeBar({
  project,
  size = 'md',
  selected,
  onSelect,
}: {
  project: ReelProject
  size?: 'sm' | 'md'
  selected?: StepId
  onSelect?: (id: StepId) => void
}) {
  const next = STEPS.find((s) => !project.steps[s.id])?.id

  return (
    <div
      className={`flex gap-[3px] ${size === 'sm' ? '' : 'rounded-lg bg-[#1d2330] p-[3px]'}`}
      role={onSelect ? 'tablist' : undefined}
      aria-label={onSelect ? 'Passos del reel' : `Progrés: ${STEPS.filter((s) => project.steps[s.id]).length} de ${STEPS.length} passos`}
    >
      {STEPS.map((step) => {
        const done = project.steps[step.id]
        const isNext = step.id === next
        if (size === 'sm') {
          const bar = done ? 'bg-accent' : isNext ? 'bg-take-amber' : 'bg-take-grey/35'
          return <span key={step.id} className={`h-2 flex-1 rounded-sm ${bar}`} title={step.label} />
        }
        const tone = done
          ? 'bg-[#4a63f0] text-white'
          : isNext
            ? 'bg-take-amber text-black'
            : 'bg-white/10 text-white/80'
        const isSelected = selected === step.id
        return (
          <button
            key={step.id}
            type="button"
            role="tab"
            aria-selected={isSelected}
            onClick={() => onSelect?.(step.id)}
            className={`relative flex min-w-0 flex-1 flex-col items-start rounded-md px-2 py-2 text-left sm:px-3 ${tone} ${
              isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-[#1d2330]' : 'opacity-90 hover:opacity-100'
            }`}
          >
            <span className="text-[11px] opacity-80">{done ? 'Fet' : isNext ? 'Ara' : 'Pendent'}</span>
            <span className="headline w-full truncate text-base sm:text-lg">{step.short}</span>
          </button>
        )
      })}
    </div>
  )
}
