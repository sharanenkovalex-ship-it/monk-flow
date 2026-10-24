// MonkFlow, локальная версия: данные в IndexedDB этого устройства вместо базы Claude.
// Подменяет window.claude.use("db") и use("assets") тем же интерфейсом, что ждёт приложение.
(function(){
  const DBN="monkflow",DOCS="docs",BLOBS="blobs";
  let dbp=null;
  const open=()=>dbp||(dbp=new Promise((res,rej)=>{
    const r=indexedDB.open(DBN,1);
    r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains(DOCS))d.createObjectStore(DOCS);if(!d.objectStoreNames.contains(BLOBS))d.createObjectStore(BLOBS)};
    r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);
  }));
  const req=r=>new Promise((res,rej)=>{r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
  async function store(name,mode){const d=await open();return d.transaction(name,mode).objectStore(name)}
  const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));

  async function allDocs(prefix){
    const s=await store(DOCS,"readonly");
    const range=prefix?IDBKeyRange.bound(prefix,prefix+"￿"):undefined;
    const [keys,vals]=await Promise.all([req(s.getAllKeys(range)),req(s.getAll(range))]);
    return keys.map((k,i)=>[k,vals[i]]);
  }
  function collection(name){
    let ord=null,lim=null;
    const q={
      orderBy(f,dir){ord=[f,dir];return q},
      limit(n){lim=n;return q},
      async get(){
        let rows=(await allDocs(name+"/")).filter(([k])=>k.indexOf("/",name.length+1)<0)
          .map(([k,v])=>({id:k.slice(name.length+1),v}));
        if(ord){const [f,dir]=ord,m=dir==="desc"?-1:1;rows.sort((a,b)=>{const x=a.v?.[f]??"",y=b.v?.[f]??"";return x<y?-m:x>y?m:0})}
        if(lim!=null)rows=rows.slice(0,lim);
        return {docs:rows.map(r=>({id:r.id,data:()=>clone(r.v)}))};
      }
    };
    return q;
  }
  function doc(path){
    return {
      id:path.split("/").pop(),
      async get(){const s=await store(DOCS,"readonly");const v=await req(s.get(path));return {exists:v!==undefined,data:()=>clone(v)}},
      async set(v){const s=await store(DOCS,"readwrite");await req(s.put(clone(v),path))},
      async delete(){const s=await store(DOCS,"readwrite");await req(s.delete(path))}
    };
  }
  const dbApi={collection,doc};

  // видео, загруженные с телефона: файл в IndexedDB, адрес — object URL
  const urls={};
  async function preloadBlobs(){
    const s=await store(BLOBS,"readonly");
    const [keys,vals]=await Promise.all([req(s.getAllKeys()),req(s.getAll())]);
    keys.forEach((k,i)=>{urls[k]=URL.createObjectURL(vals[i])});
  }
  const assetsApi={
    async upload(file){
      if(file.size>200*1024*1024){const e=new Error("too_large");e.code="too_large";throw e}
      const id="v"+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
      const s=await store(BLOBS,"readwrite");await req(s.put(file,id));
      urls[id]=URL.createObjectURL(file);return {id};
    },
    async delete(id){const s=await store(BLOBS,"readwrite");await req(s.delete(id));if(urls[id]){URL.revokeObjectURL(urls[id]);delete urls[id]}}
  };

  // первый запуск: переносим данные из seed.json (выгрузка из версии в Claude)
  async function seed(){
    const s=await store(DOCS,"readonly");
    if(await req(s.count()))return;
    try{
      const r=await fetch("seed.json",{cache:"no-store"});if(!r.ok)return;
      const j=await r.json();await putAll(j.docs||{});
    }catch(e){}
  }
  async function putAll(docs){
    const d=await open();
    await new Promise((res,rej)=>{const t=d.transaction(DOCS,"readwrite"),s=t.objectStore(DOCS);
      for(const [k,v] of Object.entries(docs))s.put(v,k);t.oncomplete=res;t.onerror=()=>rej(t.error)});
  }
  const ready=(async()=>{await seed();await preloadBlobs()})();

  // резервная копия: все записи в один JSON-файл
  async function exportFile(){
    const docs=Object.fromEntries(await allDocs());
    const d=new Date(),pad=n=>String(n).padStart(2,"0");
    const name=`monkflow-${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}.json`;
    const blob=new Blob([JSON.stringify({app:"MonkFlow",v:1,at:d.toISOString(),docs})],{type:"application/json"});
    const file=new File([blob],name,{type:"application/json"});
    if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],title:name});return "shared"}
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();
    setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},2000);return "saved";
  }
  async function importFile(f){
    const j=JSON.parse(await f.text());
    if(j?.app!=="MonkFlow"||!j.docs)throw new Error("bad");
    const d=await open();
    await new Promise((res,rej)=>{const t=d.transaction(DOCS,"readwrite"),s=t.objectStore(DOCS);s.clear();
      for(const [k,v] of Object.entries(j.docs))s.put(v,k);t.oncomplete=res;t.onerror=()=>rej(t.error)});
    return Object.keys(j.docs).length;
  }

  window.MF_LOCAL={blobURL:id=>urls[id]||"",exportFile,importFile};
  window.claude={use:async n=>{await ready;return n==="db"?dbApi:n==="assets"?assetsApi:null}};
  // просим браузер не удалять данные при нехватке места
  try{navigator.storage?.persist?.()}catch(e){}
})();
