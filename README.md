# Hub d'utilitats

Hub personal d'eines per a la feina. Funciona en local i guarda les dades al navegador (localStorage). Encara no hi ha base de dades.

## Arrancar

```bash
npm install
npm start
```

`npm start` arranca la interfície (<http://localhost:5173>) i el servidor local de vídeo (<http://localhost:8787>) alhora.

| Ordre | Què fa |
| --- | --- |
| `npm start` | Interfície i servidor local |
| `npm run dev` | Només la interfície |
| `npm run server` | Només el servidor local |
| `npm test` | Tests (Vitest) |
| `npm run build` | Comprova els tipus de la web i del servidor i genera `dist/` |

## Utilitats

### Edició de reels

**Editor automàtic.** Necessita el servidor local.

1. Puja dos o tres reels que t'agraden i prem «Estudiar l'estil». Claude Code mira els fotogrames i proposa lletres, colors, subtítols i ritme. Pots aplicar-ho a la fitxa de marca, mantenint o no els teus colors.
2. Puja el teu vídeo en brut. Whisper el transcriu paraula per paraula i Claude Code decideix què es queda, què sobra i per què, els subtítols i el ganxo.
3. Revisa la previsualització. Pots recuperar o llevar trams, ajustar-ne els segons, editar subtítols i la paraula destacada, canviar el ganxo, o tornar a editar amb indicacions noves.
4. Genera el vídeo final: 1080×1920, 30 fps, H.264, −14 LUFS, sense metadades de localització. També genera una còpia neta sense textos ni logo, per a la skill efectos-reels.

**Amb prompts.** Cabina de control per al flux de la guia: fitxa de marca (`marca.md`), skills, els 29 efectes i prompts per a enganxar a Claude Code.

## Requisits del servidor local

- Node 24 o posterior. Executa el TypeScript de `server/` sense compilar.
- ffmpeg i ffprobe al PATH, amb libass i zimg. La compilació «full» de gyan.dev les porta.
- Python amb Whisper: `pip install openai-whisper`. La primera transcripció descarrega el model (~460 MB).
- Claude Code instal·lat i amb sessió iniciada. Les crides usen el teu pla, aïllades de connectors i configuració perquè consumisquen poc.

Variables opcionals:

| Variable | Per defecte | Per a què |
| --- | --- | --- |
| `HUB_PORT` | `8787` | Port del servidor |
| `HUB_WORKSPACE` | `./workspace` | On es guarden els vídeos |
| `HUB_WHISPER_MODEL` | `small` | `base` va més ràpid i `medium` encerta més |
| `HUB_CLAUDE_MODEL` | el teu | Model de Claude Code |
| `HUB_PYTHON` | `python` | Intèrpret de Python |

Els vídeos i fitxers de treball viuen a `workspace/`, fora de git. El servidor només escolta a `127.0.0.1`.

La versió publicada a GitHub Pages també pot parlar amb el servidor local si el tens en marxa. Sense servidor, l'editor automàtic explica com arrancar-lo.

## Afegir una utilitat

1. Crea `src/utilities/<id>/` amb les seues pàgines.
2. Registra-la a `src/utilities/registry.ts`.
3. Afig la ruta a `src/App.tsx`.

## Dades

Totes les claus de localStorage comencen per `hub.`. Des de la barra lateral pots fer i restaurar una còpia en JSON. La capa `src/lib/storage.ts` (interfície `Repository`) és el punt on es connectarà Supabase més endavant.

## Nota per a Windows

`npm test` passa per `scripts/vitest.mjs`, que posa la lletra de la unitat en majúscula. Sense això, des d'alguns terminals Vitest carrega mòduls duplicats i tots els tests fallen amb «Cannot read properties of undefined (reading 'config')».
