"""
Proef bij 16 okt 2026 (npm run menubeeldtest): het beeld van het hoofdmenu en het laadscherm (beeld/laadscherm/tinga_vi.jpg) heeft
dezelfde linkerfiguur als de dvd-hoes. Gevraagd: "Je hebt voor de dvd cover de persoon links bijgewerkt. Doe dit ook voor het
hoofdmenu foto zodat het netjes aansluit op de rest."

  1. het menubeeld bestaat, is het onbewerkte beeld (docs/hoes/tinga_vi_bron.jpg) min de strook links zonder bron (MENU_RAND),
     zonder uitgerekte kolommen links, en is niet groter dan 600 kB;
  2. de linkerfiguur is slanker: zijn linkercontour op borsthoogte ligt ~27 px verder naar binnen, net als op de hoes;
  3. het is precies de bewerking van de hoes: het menubeeld tegen de bewerking uit tools/hoes_kunst.py, overal binnen de ruis
     van jpg;
  4. de rest van het beeld is niet aangeraakt: rechts van de linkerfiguur (x ≥ 420) gelijk aan het onbewerkte beeld;
  5. het gezicht is bewerkt (de rimpels, de kaak), het hoofd staat op dezelfde plek.

Maakt ook docs/screenshots/menubeeld_voor_na.jpg (het onbewerkte en het nieuwe menubeeld naast elkaar, en het gezicht groot).

Gebruik: python3 tools/menubeeldtest.py
"""
import os
import sys
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import hoes_kunst as K  # noqa: E402

fout = 0


def ok(goed, wat, extra=''):
    global fout
    print(f"{'  ok  ' if goed else ' FOUT '} {wat}{' — ' + str(extra) if extra != '' else ''}")
    if not goed:
        fout += 1


bron = Image.open(K.BRON).convert('RGB')
menu = Image.open(K.MENU).convert('RGB')
R = K.MENU_RAND          # het menubeeld begint R px verder naar rechts (de strook zonder bron is eraf)
A, M = np.asarray(bron).astype(np.int16)[:, R:], np.asarray(menu).astype(np.int16)

print('\n--- 1. het bestand ---')
kb = os.path.getsize(K.MENU) / 1024
ok(menu.size == (bron.width - R, bron.height), f'het menubeeld is het onbewerkte beeld min de {R} px links zonder bron', f'{menu.size} / {bron.size}')
# geen uitgerekte strook links: de eerste kolommen verschillen onderling (niet één kolom herhaald)
links = np.abs(np.diff(np.asarray(menu).astype(np.int16)[:, :12], axis=1)).mean()
ok(links > 2, 'links geen uitgerekte strook (de kolommen verschillen)', f'{links:.2f}')
ok(kb <= 600, 'en is niet groter dan 600 kB', f'{kb:.0f} kB')


def linkerrand(a, y=560):
    rij = a[y].astype(int)
    donker = (rij[:, 2] > rij[:, 0] + 15) & (rij.sum(axis=1) < 260)
    for x in range(60, 300):
        if donker[x:x + 6].all():
            return x
    return None


print('\n--- 2. de linkerfiguur slanker ---')
r0, r1 = linkerrand(np.asarray(bron)), linkerrand(np.asarray(menu)) + R
ok(r0 is not None and r1 is not None and 20 <= r1 - r0 <= 34, 'zijn linkercontour op borsthoogte ~27 px naar binnen, zoals op de hoes', f'{r0} → {r1} px')

print('\n--- 3. dezelfde bewerking als de hoes ---')
verwacht = np.asarray(K.slanker(K.kin(K.gezicht(K.huid(bron))))).astype(np.int16)[:, R:]
d = np.abs(M - verwacht)
ok(d.mean() < 1.5 and np.percentile(d, 99.9) < 24, 'het menubeeld is de bewerking uit tools/hoes_kunst.py (binnen de ruis van jpg)', f'gemiddeld {d.mean():.2f}, 99,9 % onder {np.percentile(d, 99.9):.0f}')

print('\n--- 4. de rest niet aangeraakt ---')
X = 420 - R
dr = np.abs(M[:, X:] - A[:, X:])
ok(dr.mean() < 1.5, 'rechts van de linkerfiguur (x ≥ 420) gelijk aan het onbewerkte beeld', f'gemiddeld {dr.mean():.2f}')
dl = np.abs(M[:, :X] - A[:, :X])
ok(dl.mean() > 3, 'links (de figuur) wel veranderd', f'gemiddeld {dl.mean():.2f}')

print('\n--- 5. het gezicht ---')
# de fijne tekening op de huid: het gemiddelde verschil tussen buurpixels, op het midden van het voorhoofd en de wangen
def tekening(a, y0, y1, x0, x1):
    v = a[y0:y1, x0:x1].astype(np.float32).mean(axis=2)
    return (np.abs(np.diff(v, axis=0)).mean() + np.abs(np.diff(v, axis=1)).mean()) / 2
huid = [(242, 252, 278, 322), (302, 316, 256, 276), (302, 316, 324, 344)]   # het voorhoofd en de twee wangen onder de bril
huid_v = sum(tekening(np.asarray(bron), *h) for h in huid) / 3
huid_n = sum(tekening(np.asarray(menu), h[0], h[1], h[2] - R, h[3] - R) for h in huid) / 3
ok(huid_n < huid_v * 0.85, 'de huid gladder: de rimpels op voorhoofd en wangen minder scherp', f'tekening {huid_v:.2f} → {huid_n:.2f}')
oog = np.abs(M[280:292, 250 - R:350 - R] - A[280:292, 250 - R:350 - R]).mean()
ok(oog < 6, 'de bril en de ogen op hun plek', f'verschil {oog:.2f}')

# de foto: voor en na naast elkaar, en het gezicht groot
B, H = bron.size
vgl = Image.new('RGB', (B * 2 + 20, H + 20 + 420), (20, 10, 35))
vgl.paste(bron, (0, 0))
vgl.paste(menu, (B + 20, 0))
kop = (190, 170, 410, 430)
vgl.paste(bron.crop(kop).resize((355, 420), Image.LANCZOS), (B - 375, H + 20))
vgl.paste(menu.crop((kop[0] - R, kop[1], kop[2] - R, kop[3])).resize((355, 420), Image.LANCZOS), (B + 20 + 20, H + 20))
vgl = vgl.resize((vgl.width // 2, vgl.height // 2), Image.LANCZOS)
vgl.save('docs/screenshots/menubeeld_voor_na.jpg', quality=88)
print('docs/screenshots/menubeeld_voor_na.jpg')

print(f'\n{fout} fout(en)' if fout else '\nalles goed')
sys.exit(1 if fout else 0)
