"""
De beelden voor de installer en het icoon van Tinga.exe, gemaakt uit de kunst van de dvd-hoes (docs/hoes/voorkant_kunst.jpg).
Ze komen in dist/installer/ (staat in .gitignore): ze horen bij het inpakken, niet bij het spel, en worden elke build opnieuw
gemaakt. Geen afbeeldingsbestanden in de repo erbij (CLAUDE.md).

  tinga.ico              het icoon: een T in de kleuren van de titel, 16 tot 256 px
  wizard_100.bmp ...     het beeld links in de wizard van Inno Setup (164 × 314 en de grotere maten voor hoge dpi)
  klein_100.bmp ...      het kleine beeld rechtsboven (55 × 55 en groter)

Gebruik: python installer/beelden.py   (Pillow nodig)
"""
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

UIT = 'dist/installer'
KUNST = 'docs/hoes/voorkant_kunst.jpg'
os.makedirs(UIT, exist_ok=True)


def lettertype(px):
    for naam in ('Inter-Black.ttf', 'arialbd.ttf', 'DejaVuSans-Bold.ttf', 'LiberationSans-Bold.ttf'):
        for map_ in ('', '/usr/share/fonts/truetype/dejavu/', 'C:/Windows/Fonts/', '/usr/share/fonts/truetype/liberation/'):
            try:
                return ImageFont.truetype(map_ + naam, px)
            except OSError:
                pass
    return ImageFont.load_default()


def verloop(w, h, boven=(255, 210, 122), onder=(224, 64, 138)):
    im = Image.new('RGB', (w, h))
    d = ImageDraw.Draw(im)
    for y in range(h):
        t = y / max(1, h - 1)
        d.line([(0, y), (w, y)], fill=tuple(round(boven[i] + (onder[i] - boven[i]) * t) for i in range(3)))
    return im


def icoon(n):
    """Een donkerpaarse tegel met een T in het verloop van de titel."""
    s = 4 * n
    tegel = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(tegel)
    d.rounded_rectangle((0, 0, s - 1, s - 1), radius=s // 5, fill=(42, 20, 70, 255))
    masker = Image.new('L', (s, s), 0)
    f = lettertype(int(s * 0.78))
    ImageDraw.Draw(masker).text((s / 2, s * 0.53), 'T', font=f, fill=255, anchor='mm')
    tegel.paste(verloop(s, s).convert('RGBA'), (0, 0), masker)
    return tegel.resize((n, n), Image.LANCZOS)


def main():
    maten = [16, 24, 32, 48, 64, 128, 256]
    groot = icoon(256)
    groot.save(f'{UIT}/tinga.ico', sizes=[(m, m) for m in maten])

    kunst = Image.open(KUNST).convert('RGB')
    # het grote beeld links: de twee mannen, met TINGA onderin
    for schaal, (w, h) in {100: (164, 314), 150: (246, 459), 200: (328, 628), 250: (410, 797)}.items():
        k = kunst.copy()
        r = w / h
        kw = round(k.height * r)
        k = k.crop(((k.width - kw) // 2, 0, (k.width - kw) // 2 + kw, k.height)).resize((w, h), Image.LANCZOS)
        d = ImageDraw.Draw(k, 'RGBA')
        for y in range(int(h * 0.62), h):
            d.line([(0, y), (w, y)], fill=(14, 6, 28, int(235 * (y - h * 0.62) / (h * 0.38))))
        tekst = Image.new('L', (w, h), 0)
        ImageDraw.Draw(tekst).text((w / 2, h * 0.86), 'TINGA', font=lettertype(int(w * 0.25)), fill=255, anchor='mm')
        k.paste(verloop(w, h, (255, 230, 170), (255, 122, 89)), (0, 0), tekst)
        ImageDraw.Draw(k).text((w / 2, h * 0.75), 'GTA VI', font=lettertype(int(w * 0.11)), fill=(255, 255, 255), anchor='mm')
        k.save(f'{UIT}/wizard_{schaal}.bmp')
    for schaal, n in {100: 55, 150: 83, 200: 110, 250: 138}.items():
        # (een bmp heeft geen doorzichtigheid: op wit, de achtergrond van de wizard)
        Image.alpha_composite(Image.new('RGBA', (n, n), (255, 255, 255, 255)), icoon(n)).convert('RGB').save(f'{UIT}/klein_{schaal}.bmp')
    print('installerbeelden in', UIT, ':', sorted(os.listdir(UIT)))


if __name__ == '__main__':
    main()
