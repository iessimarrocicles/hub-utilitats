/** Els 29 efectes de la skill efectos-reels (pas 7 de la guia). */
export interface Effect {
  id: number
  name: string
  description: string
  /** Frase per a demanar-lo a Claude Code. */
  phrase: string
  /** Depén de com de bé Hyperframes et retalla del fons. */
  needsCutout: boolean
  /** Necessita els tres segons d'habitació buida del pas 1. */
  needsEmptyRoom?: boolean
  /** Nota pràctica de la guia. */
  tip?: string
  /** 'efectes': vídeo dels 20 efectes. 'canvis': vídeo dels 10 canvis. */
  origin: 'efectes' | 'canvis'
}

export const EFFECTS: Effect[] = [
  { id: 1, name: 'Òrbita', description: 'Icones d’edició que giren en una òrbita al voltant del teu cap i passen per darrere.', phrase: 'Posa una òrbita d’icones al voltant del meu cap.', needsCutout: true, origin: 'efectes' },
  { id: 2, name: 'Xat a pantalla completa', description: 'El teu vídeo entra en un xat de Claude que va marcant el que fa.', phrase: 'Fica el meu vídeo en un xat de Claude que va marcant el que fa.', needsCutout: false, origin: 'efectes' },
  { id: 3, name: 'Eixir del marc', description: 'El vídeo s’encongeix fins a una foto i el teu cap ix per davant de la vora.', phrase: 'Fes que el meu cap isca del marc.', needsCutout: true, origin: 'efectes' },
  { id: 4, name: 'Zoom de colp', description: 'La imatge s’acosta de sobte.', phrase: 'Fes un zoom de colp.', needsCutout: false, origin: 'efectes' },
  { id: 5, name: 'Llista que apareix', description: 'Píndoles amb ticks que ixen una a una a un costat.', phrase: 'Fes aparéixer una llista amb ticks a un costat.', needsCutout: false, origin: 'efectes' },
  { id: 6, name: 'Pluja de titulars', description: 'Tires de titulars que entren volant al teu voltant, algunes per darrere.', phrase: 'Fes entrar titulars volant al meu voltant, alguns per darrere de mi.', needsCutout: true, origin: 'efectes' },
  { id: 7, name: 'Portal', description: 'Un cercle darrere del cap amb un pla obert dins, i la càmera s’hi fica sense tall.', phrase: 'Posa un cercle darrere del meu cap i fica’t dins sense tall.', needsCutout: true, origin: 'efectes' },
  { id: 8, name: 'Corba de creixement', description: 'Una corba que puja i un comptador d’1× a 10×.', phrase: 'Posa una corba de creixement amb un comptador d’1× a 10×.', needsCutout: true, origin: 'efectes' },
  { id: 9, name: 'Plató', description: 'S’apaga l’habitació, s’encenen uns focus i ix el cartell EN DIRECTE.', phrase: 'Apaga l’habitació i encén uns focus de plató amb un cartell d’EN DIRECTE.', needsCutout: true, origin: 'efectes' },
  { id: 10, name: 'Vídeo damunt', description: 'El teu vídeo en la pantalla d’un programa d’edició i un altre clip que entra damunt.', phrase: 'Mostra’m en la pantalla d’un editor i fica aquest clip damunt.', needsCutout: false, tip: 'Si no li passes un clip, n’usa un d’exemple.', origin: 'efectes' },
  { id: 11, name: 'Retallable', description: 'Tu com a adhesiu amb vora blanca sobre fons taronja, amb una estrela i un cercle blau.', phrase: 'Retalla’m com un adhesiu sobre un fons taronja.', needsCutout: true, origin: 'efectes' },
  { id: 12, name: 'Efecte vertigen', description: 'El fons s’acosta i tu no.', phrase: 'Fes un efecte vertigen: que el fons s’acoste i jo no.', needsCutout: true, origin: 'efectes' },
  { id: 13, name: 'Portada de revista', description: 'El teu vídeo com a portada, amb el teu nom per darrere del cap.', phrase: 'Fes que el meu vídeo siga la portada d’una revista, amb el nom darrere del meu cap.', needsCutout: true, origin: 'efectes' },
  { id: 14, name: 'Vidre líquid', description: 'Una lent de vidre que passa per la cara i l’amplia.', phrase: 'Passa una lent de vidre líquid per la meua cara.', needsCutout: false, origin: 'efectes' },
  { id: 15, name: 'Zoom i tall', description: 'Zoom ràpid a la cara i tall.', phrase: 'Fes un zoom ràpid a la meua cara i talla.', needsCutout: false, origin: 'efectes' },
  { id: 16, name: 'Croma', description: 'Darrere teu, una tela verda de plató.', phrase: 'Posa darrere de mi una tela verda de plató.', needsCutout: true, origin: 'efectes' },
  { id: 17, name: 'Vidre trencat', description: 'La imatge s’esquerda per davant teu i es trenca a trossos.', phrase: 'Trenca la imatge com un vidre.', needsCutout: true, origin: 'efectes' },
  { id: 18, name: 'Zoom de càmera', description: 'Un visor de càmera amb REC i el zoom pujant.', phrase: 'Posa un visor de càmera amb el zoom pujant.', needsCutout: false, origin: 'efectes' },
  { id: 19, name: 'Dins del mòbil', description: 'El teu vídeo dins d’un mòbil, amb la pantalla de Reels.', phrase: 'Fica el meu vídeo dins d’un mòbil.', needsCutout: false, origin: 'efectes' },
  { id: 20, name: 'Llista final', description: 'Els efectes marcant-se un a un.', phrase: 'Acaba amb la llista dels efectes marcant-se un a un.', needsCutout: false, origin: 'efectes' },
  { id: 21, name: 'Més càlid', description: 'Els colors s’escalfen i entra un destell taronja per un costat.', phrase: 'Fes-lo més càlid.', needsCutout: false, origin: 'canvis' },
  { id: 22, name: 'Més fosc', description: 'L’habitació s’apaga i tu quedes il·luminat.', phrase: 'Fes-lo més fosc i que només quede il·luminat jo.', needsCutout: true, origin: 'canvis' },
  { id: 23, name: 'Els meus millors vídeos flotant', description: 'Sis portades dels teus vídeos pugen i floten al teu voltant, unes per darrere i altres per davant.', phrase: 'Posa els meus millors vídeos flotant al meu voltant.', needsCutout: true, tip: 'Passa-li les portades. Si no, usa fotogrames del mateix vídeo.', origin: 'canvis' },
  { id: 24, name: 'Talls molt ràpids', description: 'Un tall cada dècima de segon, amb altres enquadraments i altres moments del vídeo.', phrase: 'Fes-me talls molt ràpids.', needsCutout: false, origin: 'canvis' },
  { id: 25, name: 'Subtítols enormes', description: 'La primera paraula, gegant, per darrere del cap, i la resta de colp per davant.', phrase: 'Posa subtítols enormes, amb la primera paraula darrere del meu cap.', needsCutout: true, tip: 'Que la primera paraula siga llarga: si és curta, el cap la tapa.', origin: 'canvis' },
  { id: 26, name: 'Subtítols menuts', description: 'Un subtítol diminut i una lupa que l’amplia.', phrase: 'Posa subtítols menuts amb una lupa que els amplie.', needsCutout: false, origin: 'canvis' },
  { id: 27, name: 'Que desaparega', description: 'Et desfàs en pols i queda l’habitació buida.', phrase: 'Que desaparega jo en pols i quede l’habitació buida.', needsCutout: true, needsEmptyRoom: true, origin: 'canvis' },
  { id: 28, name: 'Logos del que nomenes', description: 'Les icones de les apps que dius ixen al voltant del cap.', phrase: 'Que isquen els logos del que nomene.', needsCutout: true, tip: 'Porta Claude, ChatGPT, Gemini, Instagram, TikTok, YouTube, Canva, Figma, Notion, Meta, ElevenLabs i Premiere.', origin: 'canvis' },
  { id: 29, name: 'Carrusel', description: 'El vídeo passa a ser la primera foto d’un carrusel d’Instagram i llisca a la segona i la tercera.', phrase: 'Converteix aquest tros en un carrusel d’Instagram.', needsCutout: false, origin: 'canvis' },
]

export function getEffect(id: number): Effect | undefined {
  return EFFECTS.find((e) => e.id === id)
}
