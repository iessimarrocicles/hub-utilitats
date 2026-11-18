import type { BrandProfile } from '../model'
import type { LookResult } from './types'

/**
 * Passa el look de les referències a la fitxa de marca.
 * Amb keepColors, es respecten els colors que ja tenia l'usuari: s'agafa l'estil, no la marca d'un altre.
 */
export function applyLook(brand: BrandProfile, look: LookResult, keepColors: boolean): BrandProfile {
  const next = structuredClone(brand)
  if (!keepColors) next.colors = { ...look.colors }
  next.fonts.title.family = look.titleFont
  next.fonts.title.file = `fonts/${look.titleFont.replace(/\s+/g, '')}.ttf`
  next.fonts.body.family = look.bodyFont
  next.fonts.body.file = `fonts/${look.bodyFont.replace(/\s+/g, '')}.ttf`
  next.hook.position = look.hook.position
  next.hook.size = look.hook.size
  next.subtitles.size = look.subtitles.size
  next.subtitles.highlightStyle = look.subtitles.highlightStyle
  next.subtitles.box = look.subtitles.box
  next.subtitles.height = look.subtitles.height
  if (!keepColors) next.subtitles.color = look.subtitles.color
  next.logo.corner = look.logoCorner
  next.transitions = look.transitions
  next.sound = look.sound
  return next
}
