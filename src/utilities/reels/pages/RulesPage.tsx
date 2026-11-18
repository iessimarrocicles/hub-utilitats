import { Section } from '../../../components/ui'
import { MISTAKES, RULES } from '../data/checklists'

export function RulesPage() {
  return (
    <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
      <Section title="Errors que cal evitar">
        <ul className="divide-y divide-line">
          {MISTAKES.map((m) => (
            <li key={m.title} className="py-3">
              <p className="font-semibold">{m.title}</p>
              <p className="text-muted">{m.text}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Tres regles">
        <ol className="space-y-4">
          {RULES.map((r, i) => (
            <li key={r} className="flex gap-4">
              <span className="display text-4xl text-accent">{i + 1}</span>
              <p className="pt-1">{r}</p>
            </li>
          ))}
        </ol>
      </Section>
    </div>
  )
}
