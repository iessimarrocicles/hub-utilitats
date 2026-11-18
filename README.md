# Hub d'utilitats

Hub personal d'eines per a la feina. Funciona en local i guarda les dades al navegador (localStorage). Encara no hi ha base de dades.

## Arrancar

```
npm install
npm run dev
```

Obri l'adreça que mostra Vite (per defecte http://localhost:5173).

| Ordre | Què fa |
|---|---|
| `npm run dev` | Servidor de desenvolupament |
| `npm test` | Tests (Vitest) |
| `npm run build` | Comprova els tipus i genera `dist/` |

## Utilitats

- **Edició de reels**: cabina de control per al flux de la guia `documentacio/claude_editar_reels.pdf`. Gestiona reels, la fitxa de marca (`marca.md`), les skills, els 29 efectes i genera els prompts per a Claude Code. No processa vídeo: això ho fa Claude Code amb ffmpeg, whisper i Hyperframes.

## Afegir una utilitat

1. Crea `src/utilities/<id>/` amb les seues pàgines.
2. Registra-la a `src/utilities/registry.ts`.
3. Afig la ruta a `src/App.tsx`.

## Dades

Totes les claus de localStorage comencen per `hub.`. Des de la barra lateral pots fer i restaurar una còpia en JSON. La capa `src/lib/storage.ts` (interfície `Repository`) és el punt on es connectarà Supabase més endavant.

## Nota per a Windows

`npm test` passa per `scripts/vitest.mjs`, que posa la lletra de la unitat en majúscula. Sense això, des d'alguns terminals Vitest carrega mòduls duplicats i tots els tests fallen amb «Cannot read properties of undefined (reading 'config')».
