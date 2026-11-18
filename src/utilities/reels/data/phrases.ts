/** Canvis amb una frase (pas 6 de la guia i pas 9 de la skill editor-reels). */
export interface Phrase {
  id: string
  label: string
  /** Frase que s'envia a Claude Code. */
  ask: string
  /** Què fa Claude amb ella. */
  result: string
  needsEmptyRoom?: boolean
}

export const PHRASES: Phrase[] = [
  { id: 'calid', label: 'Més alegre', ask: 'Fes-lo moltíssim més alegre', result: 'Colors més càlids, amb un abans i un després.' },
  { id: 'fosc', label: 'Més fosc', ask: 'Fes-lo més fosc', result: 'Els colors s’apaguen i els subtítols s’encenen.' },
  { id: 'millors', label: 'Els meus millors vídeos', ask: 'Fica els millors vídeos que tinc', result: 'Els teus reels donant voltes a la part de dalt de la pantalla, sense tapar la cara.' },
  { id: 'revista', label: 'Títols de revista', ask: 'Que els títols semblen la portada d’una revista', result: 'Nom gran amb serifa darrere del cap.' },
  { id: 'rapids', label: 'Talls molt ràpids', ask: 'Fes-me talls molt ràpids', result: 'Alterna pla normal i pla tancat just en els salts de la presa.' },
  { id: 'lent', label: 'Tot molt lent', ask: 'Fes-ho tot molt lent', result: 'Un acostament suau.' },
  { id: 'grans', label: 'Subtítols grans', ask: 'Posa subtítols grans', result: 'Augmenta la mida dels subtítols.' },
  { id: 'menuts', label: 'Subtítols menuts', ask: 'Posa subtítols menuts', result: 'Redueix la mida dels subtítols.' },
  { id: 'desapareixer', label: 'Que desaparega', ask: 'Que desaparega jo', result: 'T’esborra i queda l’habitació buida, amb les paraules que vulgues.', needsEmptyRoom: true },
  { id: 'icones', label: 'Icones', ask: 'Que isquen icones', result: 'Els logos de les eines que nomenes, en la seua paraula.' },
  { id: 'imatges', label: 'Imatges', ask: 'Que isquen imatges', result: 'Un dibuix senzill del que dius.' },
]

export function getPhrase(id: string): Phrase | undefined {
  return PHRASES.find((p) => p.id === id)
}
