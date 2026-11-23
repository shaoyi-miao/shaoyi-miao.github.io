(()=>{"use strict";
const cfg=window.__BOOKROOM_BACKEND__;
if(!cfg||location.origin!=="https://shaoyi-miao.github.io"||!location.pathname.startsWith("/bookroom/"))return;
if(window.__bookroomVisitStarted)return;window.__bookroomVisitStarted=true;
const path=location.pathname.replace(/index\.html$/,"").replace(/\/?$/,"/");
const event=crypto.randomUUID();
async function visit(){
 const r=await fetch(cfg.endpoint,{method:"POST",headers:{"Content-Type":"application/json","apikey":cfg.key},body:JSON.stringify({action:"visit",path,event}),cache:"no-store",keepalive:true});
 if(!r.ok)throw Error("visit "+r.status);
 const data=await r.json();
 for(const k of ["total","today","page"])if(!Number.isSafeInteger(Number(data[k]))||Number(data[k])<0)throw Error("invalid counter");
 const fmt=n=>Number(n).toLocaleString("zh-CN");
 document.querySelectorAll("[data-visit-total]").forEach(e=>e.textContent=fmt(data.total));
 document.querySelectorAll("[data-visit-today]").forEach(e=>e.textContent=fmt(data.today));
 document.querySelectorAll("[data-view-count]").forEach(e=>{e.textContent="本篇阅读 "+fmt(data.page);e.style.removeProperty("display");});
 document.querySelectorAll("[data-visit-section]").forEach(e=>e.style.removeProperty("display"));
}
visit().catch(()=>{});
})();