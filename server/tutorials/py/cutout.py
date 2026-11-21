"""Lleva el fons d'una imatge per a la miniatura.

Ús: python cutout.py <entrada> <eixida.png>
Si la imatge ja té transparència, només la retalla als marges i la desa en PNG.
Escriu a stdout un JSON amb {"removed": bool, "width": int, "height": int}.
"""
import json
import sys

from PIL import Image


def has_transparency(img: Image.Image) -> bool:
    if img.mode not in ("RGBA", "LA") and not (img.mode == "P" and "transparency" in img.info):
        return False
    alpha = img.convert("RGBA").getchannel("A")
    # Transparent de veritat: almenys un 5 % de píxels quasi invisibles.
    hist = alpha.histogram()
    return sum(hist[:16]) > 0.05 * alpha.width * alpha.height


def main() -> None:
    src, out = sys.argv[1:3]
    img = Image.open(src)
    img.load()
    removed = False
    if has_transparency(img):
        result = img.convert("RGBA")
    else:
        from rembg import new_session, remove  # importació lenta: només quan cal

        # isnet-general-use retalla bé objectes i persones; el model es descarrega la primera vegada.
        session = new_session("isnet-general-use")
        result = remove(img.convert("RGB"), session=session, post_process_mask=True)
        removed = True
    # Retalla els marges buits perquè la imatge ocupe tot l'espai de la miniatura.
    box = result.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()
    if box:
        result = result.crop(box)
    # Prou gran per a 4K, però sense fitxers enormes.
    result.thumbnail((2400, 2400))
    result.save(out, "PNG", optimize=True)
    print(json.dumps({"removed": removed, "width": result.width, "height": result.height}))


if __name__ == "__main__":
    main()
