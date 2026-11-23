(()=>{"use strict";
const cfg=window.__BOOKROOM_BACKEND__;if(!cfg)return;
async function call(payload){
 const r=await fetch(cfg.endpoint,{method:"POST",headers:{"Content-Type":"application/json","apikey":cfg.key},body:JSON.stringify(payload),cache:"no-store"});
 let data;try{data=await r.json()}catch{throw Error("unavailable")}
 if(!r.ok)throw Error(r.status===429?"rate":"unavailable");
 return data;
}
for(const node of document.querySelectorAll("[data-comments-topic]")){
 const topic=node.dataset.commentsTopic,list=node.querySelector("[data-comments-list]"),form=node.querySelector("form"),msg=node.querySelector("[data-comment-status]");
 if(!list||!form||!msg)continue;
 function status(s){list.replaceChildren();const p=document.createElement("p");p.className="comments-status";p.textContent=s;list.append(p)}
 async function load(){
  try{
   const data=await call({action:"comments",topic});if(!Array.isArray(data))throw Error("invalid");
   if(!data.length){status("暂无留言");return;}
   list.replaceChildren();
   for(const c of data.slice(0,100)){
    if(typeof c.body!=="string")continue;
    const article=document.createElement("article");article.className="comment-card";
    const head=document.createElement("div");head.className="comment-head";
    const author=document.createElement("strong");author.textContent=c.display_name||"匿名读者";
    const time=document.createElement("time");const dt=new Date(c.created_at);
    if(!isNaN(dt.getTime())){time.dateTime=dt.toISOString();time.textContent=dt.toLocaleDateString("zh-CN")}
    const body=document.createElement("p");body.className="comment-body";body.textContent=c.body;
    head.append(author,time);article.append(head,body);list.append(article);
   }
  }catch{status("暂时无法加载留言")}
 }
 form.addEventListener("submit",async e=>{
  e.preventDefault();if(form.dataset.busy==="1")return;
  const fields=new FormData(form),body=String(fields.get("body")||"").trim();
  if(!body||body.length>1500){msg.textContent="请输入1–1500字留言。";return;}
  const button=form.querySelector("button[type=submit]");
  form.dataset.busy="1";button.disabled=true;msg.textContent="正在提交…";
  try{
   const data=await call({action:"submit",topic,name:String(fields.get("name")||"").trim(),body,website:String(fields.get("website")||"")});
   if(data.status!=="pending")throw Error("unavailable");
   form.reset();msg.textContent="留言已提交，审核后显示。";
  }catch(e){msg.textContent=e.message==="rate"?"留言过于频繁，请稍后再试。":"提交失败，请稍后重试。";}
  finally{form.dataset.busy="0";button.disabled=false;}
 });
 load();
}
})();