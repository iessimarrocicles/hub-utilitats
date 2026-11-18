# Editor automàtic de reels — disseny

## Per què
L'usuari vol donar uns reels de referència, pujar un reel gravat amb el mòbil i rebre una edició automàtica que puga valorar i retocar abans del vídeo final. La versió anterior només generava prompts per a Claude Code.

## Decisions de l'usuari
- El motor de decisions és el Claude Code local (`claude -p`), amb el pla de pagament de l'usuari. No s'usa clau d'API.

## Abast
- Sí: biblioteca de referències amb anàlisi d'estil, pujada del vídeo en brut, transcripció, proposta de talls i subtítols, previsualització, edició de la proposta, render final i còpia neta.
- No, de moment: els 29 efectes de Hyperframes, la desaparició de la persona, el canvi de color amb una frase. Continuen disponibles com a prompts.
- Anti-objectiu: talls a mitja paraula, o un vídeo final que no es puga revisar abans.

## Arquitectura
- `server/` és un servidor Node local (port 8787) en TypeScript. Node 26 l'executa sense compilar.
- Els fitxers viuen a `workspace/` (fora de git): `references/`, `projects/<id>/`, `fonts/`.
- Les tasques llargues són treballs en memòria que la interfície consulta cada segon.
- La interfície (Vite) parla amb el servidor per HTTP. Si el servidor no respon, ensenya com arrancar-lo.

## Flux
1. **Referències.** ffmpeg n'extrau fotogrames (0,5 s, 1,5 s, 3 s i cada 3 s) i mesura la freqüència de canvis de pla. Claude Code mira els fotogrames i torna un look estructurat, que es pot aplicar a la fitxa de marca.
2. **Vídeo en brut.** ffprobe detecta la rotació i l'HDR. Whisper fa una transcripció paraula per paraula i ffmpeg detecta els silencis.
3. **Proposta.** Claude Code rep les paraules numerades i torna, per índex de paraula, els trams que es queden, els que es lleven amb el motiu, els blocs de subtítols amb la paraula destacada i el ganxo de dues línies. Per evitar-ne el consum, la crida va aïllada: sense MCP, sense configuració i sense eines.
4. **Temps.** El servidor converteix índexs en segons. Deixa 0,1 s d'aire, divideix els trams on hi ha pauses de més de 0,4 s i mai talla dins d'una paraula.
5. **Revisió.** Previsualització a 540×960. L'usuari activa o desactiva trams, ajusta els segons, edita subtítols i el ganxo, i regenera.
6. **Final.** 1080×1920 a 30 fps, H.264 CRF 21, `+faststart`, sense metadades, àudio a −14 LUFS. També genera `<nom>-limpio.mp4` sense textos ni logo.

## Límits coneguts
- La paraula destacada es marca amb color i negreta. La caixa per paraula de la guia necessitaria Pillow.
- Whisper funciona amb el processador: uns minuts per minut de vídeo.
