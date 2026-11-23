(()=>{"use strict";
const opts=window.__BOOKROOM_ANALYTICS__;
if(!opts?.enabled || opts.provider!=="goatcounter" || !/^[a-z0-9-]{3,48}$/.test(opts.site_code||""))return;
const base="https://"+opts.site_code+".goatcounter.com";
const today=new Intl.DateTimeFormat("en-CA",{timeZone:opts.timezone||"Australia/Sydney",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const count=async(path,start)=>{
  const url=base+"/counter/"+encodeURIComponent(path)+".json"+(start?"?start="+encodeURIComponent(start):"");
  const response=await fetch(url,{method:"GET",mode:"cors",cache:"no-cache"});
  if(!response.ok)throw Error("No available public counter");
  const obj=await response.json();
  const text=String(obj.count??"").trim();
  if(!/^[\d,. ]+$/.test(text))throw Error("Invalid counter");
  return text;
};
const bindings=[
  ...[...document.querySelectorAll("[data-visit-total]")].map(el=>[el,"TOTAL",null]),
  ...[...document.querySelectorAll("[data-visit-today]")].map(el=>[el,"TOTAL",today]),
  ...[...document.querySelectorAll("[data-view-count]")].map(el=>[el,location.pathname,null])
];
for(const [el,path,start] of bindings){
 count(path,start).then(value=>{
   if(el.hasAttribute("data-view-count"))el.textContent="本篇浏览 "+value;
   else el.textContent=value;
 }).catch(()=>{
   el.textContent=el.hasAttribute("data-view-count")?"阅读统计暂不可用":"—";
 });
}
})();