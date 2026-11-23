(()=>{"use strict";
const cfg=window.__BOOKROOM_BACKEND__;
if(!cfg||location.origin!=="https://shaoyi-miao.github.io"||!location.pathname.startsWith("/bookroom/"))return;
if(window.__bookroomVisitStarted)return;window.__bookroomVisitStarted=true;
const path=location.pathname.replace(/index\.html$/,"").replace(/\/?$/,"/");
const event=crypto.randomUUID(),storageKey="bookroom.visitor.v1";
const valid=v=>typeof v==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
function storedVisitor(){
 try{
  let id=localStorage.getItem(storageKey);
  if(!valid(id)){id=crypto.randomUUID();localStorage.setItem(storageKey,id);}
  return id;
 }catch{return null;}
}
async function visit(){
 const visitor=navigator.locks?await navigator.locks.request(storageKey,storedVisitor):storedVisitor();
 const payload=visitor?{action:"visit_uv",path,event,visitor}:{action:"visit",path,event};
 const r=await fetch(cfg.endpoint,{method:"POST",headers:{"Content-Type":"application/json","apikey":cfg.key},body:JSON.stringify(payload),cache:"no-store",keepalive:true});
 if(!r.ok)throw Error("visit "+r.status);
 const data=await r.json();
 if(data.metric!=="uv_v1")return;
 for(const k of ["total","today","page"])if(!Number.isSafeInteger(Number(data[k]))||Number(data[k])<0)throw Error("invalid counter");
 const fmt=n=>Number(n).toLocaleString("zh-CN");
 document.querySelectorAll("[data-visit-total]").forEach(e=>{e.textContent=fmt(data.total);const label=e.previousElementSibling;if(label)label.textContent="累计访客";});
 document.querySelectorAll("[data-visit-today]").forEach(e=>{e.textContent=fmt(data.today);const label=e.previousElementSibling;if(label)label.textContent="今日访客";});
 document.querySelectorAll("[data-view-count]").forEach(e=>{e.textContent="本篇阅读 "+fmt(data.page);e.style.removeProperty("display");});
 document.querySelectorAll("[data-visit-section]").forEach(e=>{e.setAttribute("aria-label","网站访客统计");e.style.removeProperty("display");});
}
visit().catch(()=>{});
})();