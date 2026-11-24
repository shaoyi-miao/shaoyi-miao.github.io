(()=>{"use strict";
const cfg=window.__BOOKROOM_BACKEND__;if(!cfg)return;
const en=document.documentElement.lang==="en";const tr=(zh,enText)=>en?enText:zh;
async function call(payload){
 const r=await fetch(cfg.endpoint,{method:"POST",headers:{"Content-Type":"application/json","apikey":cfg.key},body:JSON.stringify(payload),cache:"no-store"});
 let data;try{data=await r.json()}catch{throw Error("unavailable")}
 if(!r.ok)throw Error(r.status===429?"rate":"unavailable");
 return data;
}
for(const node of document.querySelectorAll("[data-comments-topic]")){
 const long=node.dataset.discussion==="1",limit=long?6000:1500;
 const topic=node.dataset.commentsTopic,list=node.querySelector("[data-comments-list]"),form=node.querySelector("form"),msg=node.querySelector("[data-comment-status]");
 if(!list||!form||!msg)continue;
 function status(s){list.replaceChildren();const p=document.createElement("p");p.className="comments-status";p.textContent=s;list.append(p)}
 async function load(){
  try{
   const data=await call({action:"comments",topic});if(!Array.isArray(data))throw Error("invalid");
   if(!data.length){status(tr("暂无留言","No responses yet"));return;}
   list.replaceChildren();
   for(const c of data.slice(0,100)){
    if(typeof c.body!=="string")continue;
    const article=document.createElement("article");article.className="comment-card";
    const head=document.createElement("div");head.className="comment-head";
    const author=document.createElement("strong");author.textContent=c.display_name||tr("匿名读者","Anonymous reader");
    const time=document.createElement("time");const dt=new Date(c.created_at);
    if(!isNaN(dt.getTime())){time.dateTime=dt.toISOString();time.textContent=dt.toLocaleDateString(en?"en-AU":"zh-CN")}
    const body=document.createElement("p");body.className="comment-body";body.textContent=c.body;
    head.append(author,time);article.append(head,body);list.append(article);
   }
  }catch{status(tr("暂时无法加载留言","Responses are temporarily unavailable"))}
 }
 form.addEventListener("submit",async e=>{
  e.preventDefault();if(form.dataset.busy==="1")return;
  const fields=new FormData(form),body=String(fields.get("body")||"").trim();
  if(!body||body.length>limit){msg.textContent=tr("请输入1–"+limit+"字。","Please enter 1–"+limit+" characters.");return;}
  const button=form.querySelector("button[type=submit]");
  form.dataset.busy="1";button.disabled=true;msg.textContent=tr("正在提交…","Submitting…");
  try{
   const data=await call({action:long?"submit_discussion":"submit_v2",topic,name:String(fields.get("name")||"").trim(),body,website:String(fields.get("website")||"")});
   if(!["published","pending"].includes(data.status))throw Error("unavailable");
   form.reset();
   if(data.status==="published"){msg.textContent=tr("留言已发表。","Response published.");await load();}
   else msg.textContent=tr("留言已提交，审核后显示。","Response submitted for review.");
  }catch(e){msg.textContent=e.message==="rate"?tr("留言过于频繁，请稍后再试。","Too many submissions. Please try again later."):tr("提交失败，请稍后重试。","Submission failed. Please try again later.");}
  finally{form.dataset.busy="0";button.disabled=false;}
 });
 load();
}
})();