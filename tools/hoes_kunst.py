"""
De kunst voor de voorkant van de dvd-hoes (tools/hoes.mjs), uit het laadscherm beeld/laadscherm/tinga_vi.jpg:

  1. de linkerfiguur iets slanker (gevraagd 15 okt 2026: "kan je de personage links ook iets slanker maken"): een
     horizontale vervorming zoals 'liquify' in een fotobewerker (zie `slanker`). Alleen de linkercontour (schouder, arm, pak,
     been) gaat naar binnen; het hoofd en de rechterkant (die raakt de figuur ernaast) blijven zoals ze zijn.   2. bijsnijden tot het paneel van de voorkant (132,5 × 189 mm met afloop), zonder het logo rechtsboven;
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
    slank = slanker(im)
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
