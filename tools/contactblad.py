#!/usr/bin/env python3
"""Plakt losse foto's tot een overzichtsblad met bijschriften.

    node tools/propshots.mjs && python3 tools/contactblad.py objecten
    node tools/assets.mjs    && python3 tools/contactblad.py woningen

Levert docs/screenshots/objecten.png respectievelijk woningtypen.png. De
volgorde en de labels komen uit het draaiende spel, zodat het blad dezelfde
indeling heeft als het palet in de editor.
"""
import json
import pathlib
import re
import sys
from PIL import Image, ImageDraw, ImageFont

WORTEL = pathlib.Path(__file__).resolve().parent.parent
SOORT = sys.argv[1] if len(sys.argv) > 1 else 'objecten'

if SOORT == 'woningen':
    BRON = WORTEL / 'shots' / 'assets'
    DOEL = WORTEL / 'docs' / 'screenshots' / 'woningtypen.png'
    KOLOMMEN = 3
    CEL_B, CEL_H = 620, 400
    BIJSCHRIFT = 28
    KOP = 0
    tekst = (WORTEL / 'js' / 'textures.js').read_text(encoding='utf-8')
    blok = re.search(r'export const HOUSE_STYLES = \{.*?\n\};', tekst, re.S).group(0)
    namen = re.findall(r'\n  ([a-z_]+):', blok)
    GROEPEN = ['woning']
    per_groep = {'woning': [(n, n) for n in namen]}
else:
    BRON = WORTEL / 'shots' / 'props'
    DOEL = WORTEL / 'docs' / 'screenshots' / 'objecten.png'
    GROEPEN = ['erf', 'hek', 'straat', 'groen', 'spelen', 'mensen']
    KOLOMMEN = 8
    CEL_B, CEL_H = 240, 200          # ruimte per object, bijschrift inbegrepen
    BIJSCHRIFT = 26
    KOP = 30
    # Bij voorkeur uit de lijst die propshots.mjs meeschrijft: die komt uit het
    # draaiende spel en heeft dus ook de objecten die in een lus staan.
    lijst = BRON / 'lijst.json'
    if lijst.exists():
        objecten = [(n, l, g) for g, n, l in json.loads(lijst.read_text(encoding='utf-8'))]
    else:
        tekst = (WORTEL / 'js' / 'props.js').read_text(encoding='utf-8')
        objecten = re.findall(r"def\('([^']+)',\s*'([^']+)',\s*'([^']+)'", tekst)
    per_groep = {g: [(n, l) for n, l, gr in objecten if gr == g] for g in GROEPEN}

font = ImageFont.load_default()
try:
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 13)
    kopfont = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 17)
except OSError:
    kopfont = font

# hoogte uitrekenen
rijen_totaal = 0
for g in GROEPEN:
    n = len(per_groep[g])
    rijen_totaal += -(-n // KOLOMMEN) if n else 0
hoogte = len(GROEPEN) * KOP + rijen_totaal * CEL_H + 16
blad = Image.new('RGB', (KOLOMMEN * CEL_B, hoogte), (24, 26, 30))
teken = ImageDraw.Draw(blad)

y = 8
for g in GROEPEN:
    items = per_groep[g]
    if not items:
        continue
    if KOP:
        teken.text((10, y + 6), g.upper(), fill=(255, 212, 0), font=kopfont)
    y += KOP
    for i, (naam, label) in enumerate(items):
        kol, rij = i % KOLOMMEN, i // KOLOMMEN
        x0, y0 = kol * CEL_B, y + rij * CEL_H
        pad = BRON / f'{naam}.png'
        if pad.exists():
            im = Image.open(pad).convert('RGB')
            im.thumbnail((CEL_B - 8, CEL_H - BIJSCHRIFT - 8))
            blad.paste(im, (x0 + (CEL_B - im.width) // 2, y0 + 4))
        else:
            teken.text((x0 + 10, y0 + 40), '(geen foto)', fill=(150, 150, 150), font=font)
        b = teken.textbbox((0, 0), label, font=font)
        teken.text((x0 + (CEL_B - (b[2] - b[0])) // 2, y0 + CEL_H - BIJSCHRIFT + 2),
                   label, fill=(228, 228, 228), font=font)
    y += -(-len(items) // KOLOMMEN) * CEL_H

DOEL.parent.mkdir(parents=True, exist_ok=True)
blad.save(DOEL)
print(f'{DOEL} – {blad.width}x{blad.height}, {sum(len(v) for v in per_groep.values())} stuks')
