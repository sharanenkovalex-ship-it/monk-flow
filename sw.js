// MonkFlow: офлайн-кэш. При обновлении меняй VERSION (build.py делает это сам).
const VERSION="mf-20261025171641";
const SHELL=["./","index.html","manifest.webmanifest","icon-192.png","icon-512.png","apple-touch-icon.png","seed.json","fonts/archivo-black-latin-400-normal.woff2","fonts/cinzel-latin-600-normal.woff2","fonts/cinzel-latin-700-normal.woff2","fonts/ibm-plex-mono-cyrillic-500-normal.woff2","fonts/ibm-plex-mono-cyrillic-600-normal.woff2","fonts/ibm-plex-mono-latin-500-normal.woff2","fonts/ibm-plex-mono-latin-600-normal.woff2","fonts/ibm-plex-sans-cyrillic-400-normal.woff2","fonts/ibm-plex-sans-cyrillic-500-normal.woff2","fonts/ibm-plex-sans-cyrillic-600-normal.woff2","fonts/ibm-plex-sans-cyrillic-700-normal.woff2","fonts/ibm-plex-sans-latin-400-normal.woff2","fonts/ibm-plex-sans-latin-500-normal.woff2","fonts/ibm-plex-sans-latin-600-normal.woff2","fonts/ibm-plex-sans-latin-700-normal.woff2","fonts/manrope-cyrillic-400-normal.woff2","fonts/manrope-cyrillic-500-normal.woff2","fonts/manrope-cyrillic-600-normal.woff2","fonts/manrope-cyrillic-700-normal.woff2","fonts/manrope-latin-400-normal.woff2","fonts/manrope-latin-500-normal.woff2","fonts/manrope-latin-600-normal.woff2","fonts/manrope-latin-700-normal.woff2"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(VERSION).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{
  const r=e.request;if(r.method!=="GET")return;
  const u=new URL(r.url);
  // страница: сначала сеть (чтобы подтянуть обновление), без сети — из кэша
  if(r.mode==="navigate"){e.respondWith(fetch(r).then(res=>{const c=res.clone();caches.open(VERSION).then(x=>x.put("index.html",c));return res}).catch(()=>caches.match("index.html")));return}
  // видео: Safari просит куски файла (Range) — отдаём их из кэша, файл целиком кладём в кэш один раз
  if(u.pathname.endsWith(".mp4")){e.respondWith(videoResp(r,u));return}
  // остальное и шрифты Google: из кэша, иначе из сети с сохранением
  e.respondWith(caches.match(r).then(hit=>hit||fetch(r).then(res=>{if(res.ok||res.type==="opaque"){const c=res.clone();caches.open(VERSION).then(x=>x.put(r,c))}return res})));
});
async function videoResp(r,u){
  const c=await caches.open(VERSION);
  let full=await c.match(u.pathname,{ignoreSearch:true});
  if(!full){try{const res=await fetch(u.pathname);if(res.status!==200)return res;await c.put(u.pathname,res.clone());full=res}catch(e){return new Response("",{status:504})}}
  const buf=await full.clone().arrayBuffer(),n=buf.byteLength,type=full.headers.get("Content-Type")||"video/mp4";
  const m=/bytes=(\d*)-(\d*)/.exec(r.headers.get("Range")||"");
  if(!m)return new Response(buf,{status:200,headers:{"Content-Type":type,"Content-Length":String(n),"Accept-Ranges":"bytes"}});
  let a=m[1]===""?Math.max(0,n-+m[2]):+m[1],b=m[1]===""||m[2]===""?n-1:Math.min(+m[2],n-1);
  return new Response(buf.slice(a,b+1),{status:206,headers:{"Content-Type":type,"Content-Length":String(b-a+1),"Content-Range":`bytes ${a}-${b}/${n}`,"Accept-Ranges":"bytes"}});
}
