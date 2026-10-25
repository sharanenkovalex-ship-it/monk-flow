# Сборка: python3 tools/build.py из корня репозитория. Исходник приложения — src/app.html.
import json,re,shutil,time,os
os.chdir(os.path.join(os.path.dirname(__file__),'..'))
from PIL import Image,ImageDraw,ImageFont
src=open('src/app.html').read()
local=open('src/local.js').read()
ver="mf-"+time.strftime("%Y%m%d%H%M%S")
# голова страницы
head=src[:src.index('<style>')]
body=src[src.index('<style>'):]
head=head.replace('<meta name="claude:viewport-fit-sides" content="cover">','')
# шрифты лежат в fonts/: убираем Google Fonts, @font-face вставляем прямо в страницу
head=re.sub(r'<link rel="stylesheet" href="https://fonts\.googleapis\.com[^>]*>','<style>'+open('fonts/fonts.css').read()+'</style>',head)
FONTS=[f'fonts/{f}' for f in sorted(os.listdir('fonts')) if f.endswith('.woff2')]
page=f'''<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#16130f">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="MonkFlow">
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<link rel="icon" href="icon-192.png">
{head.strip()}
<style>[hidden]{{display:none!important}}html{{-webkit-text-size-adjust:100%}}body{{margin:0;padding-top:env(safe-area-inset-top,0px)}}</style>
<script>{local}</script>
</head>
<body>
{body}
<script>if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{{}}));</script>
</body>
</html>'''
open('index.html','w').write(page)
open('sw.js','w').write(open('src/sw.js').read().replace('__VERSION__',ver).replace('"seed.json"]','"seed.json",'+','.join(f'"{f}"' for f in FONTS)+']'))
json.dump({"name":"MonkFlow","short_name":"MonkFlow","start_url":"./","scope":"./","display":"standalone","orientation":"portrait","background_color":"#060606","theme_color":"#060606","lang":"ru",
  "icons":[{"src":"icon-192.png","sizes":"192x192","type":"image/png"},{"src":"icon-512.png","sizes":"512x512","type":"image/png"},{"src":"icon-512.png","sizes":"512x512","type":"image/png","purpose":"maskable"}]},open('manifest.webmanifest','w'),ensure_ascii=False)
F='/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf'
def icon(n,path):
    im=Image.new('RGB',(n,n),'#16130f');d=ImageDraw.Draw(im)
    f=ImageFont.truetype(F,int(n*.5));b=d.textbbox((0,0),"M",font=f)
    d.text(((n-(b[2]-b[0]))/2-b[0],(n-(b[3]-b[1]))/2-b[1]),"M",font=f,fill='#ef8a2a')
    im.save(path)
if os.path.exists('src/icon-source.png'):
    src_icon=Image.open('src/icon-source.png').convert('RGB')
    for n,path in ((192,'icon-192.png'),(512,'icon-512.png'),(180,'apple-touch-icon.png')):src_icon.resize((n,n),Image.LANCZOS).save(path)
else:
    icon(192,'icon-192.png');icon(512,'icon-512.png');icon(180,'apple-touch-icon.png')
print(ver,os.path.getsize('index.html'))

shutil.copy('src/seed.json','seed.json')
