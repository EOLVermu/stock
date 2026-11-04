# Genera los iconos de la app (pantalla de inicio de Android/iPhone) a partir del logo.
# Uso (desde fuente/): python3 build/iconos.py  -> escribe en ../iconos/
from PIL import Image
BG=(35,31,32)
logo=Image.open('build/logo_hd.jpg').convert('RGB')
def normal(n): return logo.resize((n,n),Image.LANCZOS)
def conmargen(n, parte=0.72):
    # Android recorta el icono en círculo: el logo va en el centro con margen del mismo color
    c=Image.new('RGB',(n,n),BG); m=int(n*parte)
    c.paste(logo.resize((m,m),Image.LANCZOS),((n-m)//2,(n-m)//2)); return c
for n in (192,512): normal(n).save(f'../iconos/icono-{n}.png')
for n in (192,512): conmargen(n).save(f'../iconos/icono-adaptable-{n}.png')
conmargen(180,0.86).save('../iconos/apple-touch-icon.png')
normal(48).save('../iconos/favicon.png')
