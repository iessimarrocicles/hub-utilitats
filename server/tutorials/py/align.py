"""Temps de cada paraula d'una locució amb faster-whisper.

Ús: python align.py <model> <encàrrec.json>
L'encàrrec és una llista: [{"wav": "escena.wav", "text": "text conegut"}]
Escriu a stdout: [{"wav": "...", "words": [{"w": "Hola", "start": 0.1, "end": 0.4}]}]
El text conegut s'usa com a context: el servidor torna a posar l'ortografia original.
"""
import json
import subprocess
import sys

import numpy as np
from faster_whisper import WhisperModel


def load_16k(path: str) -> np.ndarray:
    """Decodifica amb ffmpeg: evita les incompatibilitats de versió de PyAV."""
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", "16000", "-"],
        check=True,
        capture_output=True,
    ).stdout
    return np.frombuffer(raw, dtype=np.float32)


def main() -> None:
    model_name, job_file = sys.argv[1:3]
    with open(job_file, encoding="utf-8") as f:
        jobs = json.load(f)
    model = WhisperModel(model_name, device="cpu", compute_type="int8")
    out = []
    for job in jobs:
        segments, _ = model.transcribe(
            load_16k(job["wav"]),
            language="es",
            word_timestamps=True,
            initial_prompt=job.get("text", "")[:800],
            vad_filter=False,
            beam_size=5,
        )
        words = []
        for seg in segments:
            for w in seg.words or []:
                words.append({"w": w.word.strip(), "start": round(w.start, 3), "end": round(w.end, 3)})
        out.append({"wav": job["wav"], "words": words})
    # ASCII: la consola de Windows no sempre escriu en UTF-8.
    print(json.dumps(out))


if __name__ == "__main__":
    main()
