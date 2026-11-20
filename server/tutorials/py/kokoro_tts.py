"""Síntesi de veu local amb Kokoro-82M (ONNX, CPU).

Ús: python kokoro_tts.py <model.onnx> <voices.bin> <encàrrec.json>
L'encàrrec és una llista: [{"text": "...", "out": "escena.wav", "voice": "ef_dora", "speed": 1.0}]
Escriu a stdout un JSON amb la durada de cada fitxer.
"""
import json
import os
import sys
import time

import onnxruntime as ort
import soundfile as sf
from kokoro_onnx import Kokoro


def main() -> None:
    model, voices, job_file = sys.argv[1:4]
    with open(job_file, encoding="utf-8") as f:
        jobs = json.load(f)
    t0 = time.time()
    # En CPU híbrides (nuclis P + E) va més ràpid amb pocs fils: 4 en un i7-1360P.
    opts = ort.SessionOptions()
    opts.intra_op_num_threads = int(os.environ.get("HUB_KOKORO_THREADS", "4"))
    providers = [p for p in ("CUDAExecutionProvider", "CPUExecutionProvider") if p in ort.get_available_providers()]
    session = ort.InferenceSession(model, opts, providers=providers)
    kokoro = Kokoro.from_session(session, voices)
    kokoro.create("Hola.", voice="ef_dora", lang="es")  # escalfament
    load = time.time() - t0
    out = []
    for job in jobs:
        t = time.time()
        samples, rate = kokoro.create(
            job["text"], voice=job.get("voice", "ef_dora"), speed=float(job.get("speed", 1.0)), lang="es"
        )
        sf.write(job["out"], samples, rate)
        dur = len(samples) / rate
        out.append({"out": job["out"], "duration": dur, "seconds": time.time() - t})
    print(json.dumps({"load": load, "results": out}))


if __name__ == "__main__":
    main()
