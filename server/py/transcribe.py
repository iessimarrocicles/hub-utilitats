"""Transcripció paraula per paraula amb Whisper.

Ús: python transcribe.py <audio.wav> <model> <idioma|auto> <eixida.json>
"""
import json
import sys
import warnings

warnings.filterwarnings("ignore")


def main() -> None:
    audio, model_name, language, out_path = sys.argv[1:5]
    import whisper  # importació lenta: després de validar els arguments

    model = whisper.load_model(model_name)
    result = model.transcribe(
        audio,
        language=None if language in ("", "auto") else language,
        word_timestamps=True,
        fp16=False,
        verbose=False,
        # Sense condicionar, Whisper no s'empassa les preses repetides.
        condition_on_previous_text=False,
    )
    words = []
    for seg in result.get("segments", []):
        for w in seg.get("words", []):
            text = w["word"].strip()
            if text:
                words.append({"text": text, "start": round(w["start"], 3), "end": round(w["end"], 3)})
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({"language": result.get("language"), "words": words}, f, ensure_ascii=False)


if __name__ == "__main__":
    main()
