# Genera ../index.html (la app de GitHub Pages) a partir de out/Index.html. Uso (desde fuente/): python3 build/github.py
API = 'https://script.google.com/macros/s/AKfycby8EZUeAZkRSVIvwKjsK8W-A4bT4zSrq8WIbQKHNKjRRf1UMNfkBizxOifVOU_Ubgq4/exec'
s = open('out/Index.html').read()
assert s.count("'__API_URL__'") == 1
s = s.replace("'__API_URL__'", "'" + API + "'")
cab = '''<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<meta name="theme-color" content="#231E1F">
<meta name="robots" content="noindex">
'''
inst = '''<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/png" href="iconos/favicon.png">
<link rel="apple-touch-icon" href="iconos/apple-touch-icon.png">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Stock EOL">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
'''
t = '<title>El Otro Lado · Stock</title>\n'
assert s.startswith(t)
s = cab + t + inst + s[len(t):]
s = s.rstrip('\n') + "\n<script>if('serviceWorker' in navigator){addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));}</script>\n"
open('../index.html', 'w').write(s)
print('index.html', len(s) // 1024, 'KB')
