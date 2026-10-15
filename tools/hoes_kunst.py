"""
De kunst voor de voorkant van de dvd-hoes (tools/hoes.mjs), uit het laadscherm beeld/laadscherm/tinga_vi.jpg:

  1. de linkerfiguur iets slanker (gevraagd 15 okt 2026: "kan je de personage links ook iets slanker maken"): een
     horizontale vervorming zoals 'liquify' in een fotobewerker (zie `slanker`). Alleen de linkercontour (schouder, arm, pak,
     been) gaat naar binnen; het hoofd en de rechterkant (die raakt de figuur ernaast) blijven zoals ze zijn. En zijn gezicht
     iets minder breed (`gezicht`): wangen, mond en kaak zacht naar het midden, de ogen en de bril niet; en de onderkin een paar
     pixels op (`kin`), en de rimpels op de huid gladder (`huid`).   2. bijsnijden tot het paneel van de voorkant (132,5 × 189 mm met afloop), zonder het logo rechtsboven;
  3. met Lanczos naar 300 dpi (1565 × 2232 px) en een lichte verscherping.

Gebruik: python3 tools/hoes_kunst.py   (schrijft docs/hoes/voorkant_kunst.jpg en docs/hoes/slanker_voor_na.jpg)
"""
import numpy as np
from PIL import Image, ImageFilter, ImageEnhance

BRON = 'beeld/laadscherm/tinga_vi.jpg'
UIT = 'docs/hoes/voorkant_kunst.jpg'

# de linkerfiguur in het bronbeeld (1402 × 1122)
MIDDEN = 315.0          # x van het midden van zijn bovenlijf: rechts daarvan verandert niets
RAND = 86.0             # zijn linkercontour (schouder en arm) op borsthoogte
SCHUIF = 27.0           # zoveel komt die contour naar binnen (≈ 6 % van zijn breedte)
MAST = 70.0             # tot hier (de mast van de boot, x ≈ 57) schuift de achtergrond in elke rij gelijk mee: hij blijft recht
HOOFD = 220.0           # in de rijen van het hoofd: vanaf hier niets veranderd (zijn hoofd loopt van x ≈ 230 tot 365)
NEK_VAN, NEK_TOT = 330, 410   # de overgang van het hoofd (niets) naar de schouders (de volle vervorming)


def glad(t):
    t = np.clip(t, 0.0, 1.0)
    return t * t * (3 - 2 * t)


# het gezicht van de linkerfiguur (gevraagd: "kan je het gezicht ook iets minder overdreven maken"): wangen en kaak iets smaller
GEZICHT_X = 298.0       # de neus
GEZICHT_R = 95.0        # tot hier opzij (voorbij de oren) is het weer zoals het was
GEZICHT_VOL = 0.65      # tot hier (deel van GEZICHT_R) de volle factor: de wangen lopen tot ≈ 58 px van de neus
GEZICHT_KRACHT = 0.11   # zoveel verder naar buiten bemonsteren: de kaaklijn komt ≈ 6 px per kant naar binnen
# van boven naar beneden: niets tot onder de bril (y 280), vol bij de wangen en de mond (320–355), weer niets bij de kraag (385)
GEZICHT_Y = (280, 320, 355, 385)


def gezicht(beeld):
    """Wangen, mond en kaak naar het midden; de ogen, de bril en het voorhoofd blijven zoals ze zijn."""
    a = np.asarray(beeld).astype(np.float32)
    h, w, _ = a.shape
    xs = np.arange(w, dtype=np.float32)
    d = xs - GEZICHT_X
    t = np.abs(d) / GEZICHT_R
    g = np.where(t < GEZICHT_VOL, 1.0, 1.0 - glad((t - GEZICHT_VOL) / (1.0 - GEZICHT_VOL)))
    y0, y1, y2, y3 = GEZICHT_Y
    uit = a.copy()
    for y in range(y0, y3 + 1):
        vy = glad((y - y0) / (y1 - y0)) if y < y1 else (1.0 if y <= y2 else 1.0 - glad((y - y2) / (y3 - y2)))
        bronx = GEZICHT_X + d * (1.0 + GEZICHT_KRACHT * vy * g)
        assert np.all(np.diff(bronx) > 0), 'de vervorming van het gezicht vouwt het beeld'
        for c in range(3):
            uit[y, :, c] = np.interp(np.clip(bronx, 0, w - 1), xs, a[y, :, c])
    return Image.fromarray(np.clip(uit, 0, 255).astype(np.uint8))


# de onderkin iets op: tussen de mond en de kraag (KIN_VAN tot KIN_TOT) iets omhoog bemonsteren, de mond zelf niet
KIN_VAN, KIN_MIDDEN, KIN_TOT = 338, 362, 392
KIN_OP = 4.0            # px: zoveel komt de kinlijn omhoog
KIN_X, KIN_R = 298.0, 70.0


def kin(beeld):
    a = np.asarray(beeld).astype(np.float32)
    h, w, _ = a.shape
    uit = a.copy()
    ys = np.arange(h, dtype=np.float32)
    for x in range(int(KIN_X - KIN_R), int(KIN_X + KIN_R) + 1):
        gx = 1.0 - glad(abs(x - KIN_X) / KIN_R)
        # een bult van 0 bij KIN_VAN en KIN_TOT tot KIN_OP bij KIN_MIDDEN: uitvoer-y bemonstert y + verschuiving
        v = np.where(ys < KIN_MIDDEN, glad((ys - KIN_VAN) / (KIN_MIDDEN - KIN_VAN)), 1.0 - glad((ys - KIN_MIDDEN) / (KIN_TOT - KIN_MIDDEN)))
        v = np.where((ys > KIN_VAN) & (ys < KIN_TOT), v, 0.0)
        bron = ys + KIN_OP * gx * v
        assert np.all(np.diff(bron) > 0), 'de kin vouwt het beeld'
        for c in range(3):
            uit[:, x, c] = np.interp(np.clip(bron, 0, h - 1), ys, a[:, x, c])
    return Image.fromarray(np.clip(uit, 0, 255).astype(np.uint8))


# rimpels weg (gevraagd: "kan je ook wat rimpels weghalen"): op de huid een mediaan- en een lichte vervaging, gemengd door een
# zacht masker. Het masker dekt het voorhoofd, onder de ogen, de wangen met de lachlijnen en de kin, maar niet de bril, de ogen,
# de wenkbrauwen, de mond en de randen van het gezicht: die blijven scherp. HUID_KRACHT laat wat van de tekening over.
HUID_KRACHT = 0.78
HUID_DEKT = [            # ellipsen (midden x, midden y, halve breedte, halve hoogte) in het bronbeeld
    (300, 247, 46, 18),  # het voorhoofd
    (266, 309, 17, 12), (333, 309, 17, 12),   # wangen onder de bril
    (276, 330, 14, 15), (322, 330, 14, 15),   # de lachlijnen naast neus en mond
    (300, 352, 26, 11),  # de kin
    (262, 296, 10, 4), (337, 296, 10, 4),     # wallen onder de glazen
    (299, 266, 10, 7),   # de fronslijntjes tussen de wenkbrauwen
]
HUID_VRIJ = [
    (300, 286, 70, 11),  # de bril en de ogen
    (300, 328, 22, 6),   # de mond
    (298, 312, 9, 10),   # de neusvleugels
]


def huid(beeld):
    from PIL import ImageDraw
    w, h = beeld.size
    masker = Image.new('L', (w, h), 0)
    t = ImageDraw.Draw(masker)
    for (x, y, rx, ry) in HUID_DEKT:
        t.ellipse((x - rx, y - ry, x + rx, y + ry), fill=255)
    for (x, y, rx, ry) in HUID_VRIJ:
        t.ellipse((x - rx, y - ry, x + rx, y + ry), fill=0)
    masker = masker.filter(ImageFilter.GaussianBlur(5))
    glad_beeld = beeld.filter(ImageFilter.MedianFilter(5)).filter(ImageFilter.GaussianBlur(1.3))
    m = (np.asarray(masker).astype(np.float32) / 255.0 * HUID_KRACHT)[..., None]
    a, b = np.asarray(beeld).astype(np.float32), np.asarray(glad_beeld).astype(np.float32)
    return Image.fromarray(np.clip(a * (1 - m) + b * m, 0, 255).astype(np.uint8))


def slanker(beeld):
    """
    Per rij een stuksgewijs lineaire afbeelding van uitvoer-x naar bron-x. Twee rijen knopen:
      - het hoofd: links van MAST alles SCHUIF naar rechts, daarna tot HOOFD de lucht en de boom iets ingedrukt, verder niets;
      - de schouders en lager: links van de contour alles SCHUIF naar rechts, de contour van RAND naar RAND + SCHUIF, en van
        daar tot MIDDEN het lichaam gelijkmatig smaller.
    Tussen de nek en de schouders mengen de twee. Links van MAST is de afbeelding in elke rij dezelfde, dus wat daar staat
    (de mast, de kade) blijft recht en wordt niet uitgerekt: het schuift alleen op.
    """
    a = np.asarray(beeld).astype(np.float32)
    h, w, _ = a.shape
    xs = np.arange(w, dtype=np.float32)
    kop = np.interp(xs, [0, MAST, HOOFD, w - 1], [-SCHUIF, MAST - SCHUIF, HOOFD, w - 1])
    lijf = np.interp(xs, [0, RAND + SCHUIF, MIDDEN, w - 1], [-SCHUIF, RAND, MIDDEN, w - 1])
    for k in (kop, lijf):
        assert np.all(np.diff(k) > 0), 'de vervorming vouwt het beeld'
    uit = np.empty_like(a)
    for y in range(h):
        wy = glad((y - NEK_VAN) / (NEK_TOT - NEK_VAN))
        bronx = np.clip((1 - wy) * kop + wy * lijf, 0, w - 1)
        for c in range(3):
            uit[y, :, c] = np.interp(bronx, xs, a[y, :, c])
    return Image.fromarray(np.clip(uit, 0, 255).astype(np.uint8))


def main():
    im = Image.open(BRON).convert('RGB')
    slank = slanker(kin(gezicht(huid(im))))
    W, H = 1565, 2232
    h = im.height
    w = round(h * W / H)
    x0 = 55                       # tot ~x 840: beide mannen, de heli, de neus van de BX; het logo begint bij x ≈ 895
    def maak(b):
        krop = b.crop((x0, 0, x0 + w, h))
        groot = krop.resize((W, H), Image.LANCZOS).filter(ImageFilter.UnsharpMask(radius=2, percent=60, threshold=2))
        return ImageEnhance.Color(groot).enhance(1.05)
    na = maak(slank)
    na.save(UIT, quality=94)
    # een vergelijking voor en na, naast elkaar, klein
    voor = maak(im)
    vgl = Image.new('RGB', (W // 2 * 2 + 20, H // 2), (20, 10, 35))
    vgl.paste(voor.resize((W // 2, H // 2)), (0, 0))
    vgl.paste(na.resize((W // 2, H // 2)), (W // 2 + 20, 0))
    vgl.save('docs/hoes/slanker_voor_na.jpg', quality=85)
    kop = (210, 190, 390, 400)
    a1, a2 = im.crop(kop).resize((540, 630), Image.LANCZOS), slank.crop(kop).resize((540, 630), Image.LANCZOS)
    k = Image.new('RGB', (1100, 630), (20, 10, 35)); k.paste(a1, (0, 0)); k.paste(a2, (560, 0))
    k.save('docs/hoes/gezicht_voor_na.jpg', quality=88)
    # de breedte van de figuur gemeten op borsthoogte (y = 560 in de bron): de eerste donkerblauwe pixel van links
    def linkerrand(b, y=560):
        rij = np.asarray(b)[y].astype(int)
        donker = (rij[:, 2] > rij[:, 0] + 15) & (rij.sum(axis=1) < 260)     # het donkerblauwe pak
        for x in range(60, 300):
            if donker[x:x + 6].all():
                return x
        return None
    print(f'{UIT}: {na.size}; linkerrand pak op borsthoogte {linkerrand(im)} → {linkerrand(slank)} px (bron)')


if __name__ == '__main__':
    main()
