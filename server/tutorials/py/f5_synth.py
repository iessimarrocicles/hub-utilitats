"""Síntesi de veu local amb F5-TTS (GPU) clonant una mostra de veu.

Ús: python f5_synth.py <mostra.wav> <text de la mostra> <encàrrec.json>
L'encàrrec és una llista: [{"text": "...", "out": "escena.wav", "speed": 1.0}]

Model: per defecte el checkpoint en castellà de workspace/models/f5-spanish
(jpgallegoar/F5-Spanish, llicència CC BY-NC 4.0: només ús no comercial).
Variables: HUB_F5_MODEL (arquitectura), HUB_F5_CKPT, HUB_F5_VOCAB.
"""
import json
import os
import sys
import time
from pathlib import Path

import torch
from f5_tts.api import F5TTS

ROOT = Path(__file__).resolve().parents[3]
DEFAULT_DIR = ROOT / "workspace" / "models" / "f5-spanish"


def main() -> None:
    ref_wav, ref_text, job_file = sys.argv[1:4]
    with open(job_file, encoding="utf-8") as f:
        jobs = json.load(f)
    ckpt = os.environ.get("HUB_F5_CKPT") or str(DEFAULT_DIR / "model_1250000.safetensors")
    vocab = os.environ.get("HUB_F5_VOCAB") or str(DEFAULT_DIR / "vocab.txt")
    if not Path(ckpt).exists():
        sys.exit(f"Falta el model de F5-TTS en castellà: {ckpt}")
    t0 = time.time()
    device = "cuda" if torch.cuda.is_available() else "cpu"
    tts = F5TTS(model=os.environ.get("HUB_F5_MODEL", "F5TTS_Base"), ckpt_file=ckpt, vocab_file=vocab, device=device)
    load = time.time() - t0
    out = []
    for job in jobs:
        t = time.time()
        wav, sr, _ = tts.infer(
            ref_wav,
            ref_text,
            job["text"],
            speed=float(job.get("speed", 1.0)),
            nfe_step=32,
            seed=1234,  # mateixa llavor: la veu sona igual en totes les escenes
            remove_silence=False,
            file_wave=job["out"],
            show_info=lambda *a, **k: None,
        )
        out.append({"out": job["out"], "duration": len(wav) / sr, "seconds": time.time() - t})
        if device == "cuda":
            torch.cuda.empty_cache()
    print(json.dumps({"load": load, "device": device, "results": out}))


if __name__ == "__main__":
    main()
