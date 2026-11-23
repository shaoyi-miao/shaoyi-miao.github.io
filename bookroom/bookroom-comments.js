(()=>{"use strict";
const repo="shaoyi-miao/shaoyi-miao.github.io";
const locations=[...document.querySelectorAll("[data-comments-issue]")];
for(const node of locations){
 const id=Number(node.dataset.commentsIssue);
 const list=node.querySelector("[data-comments-list]");
 if(!Number.isSafeInteger(id)||id<=0||!list)continue;
 const endpoint="https://api.github.com/repos/"+repo+"/issues/"+id+"/comments?per_page=30";
 const fallback="https://github.com/"+repo+"/issues/"+id;
 const status=(s)=>{list.replaceChildren();const p=document.createElement("p");p.className="comments-status";p.textContent=s;list.append(p)};
 const text=(t,className)=>{let x=document.createElement("span");x.className=className;x.textContent=t;return x};
 const safeUser=(u)=>/^[A-Za-z0-9-]{1,39}$/.test(u||"")?u:"GitHub 读者";
 const fetchComments=async()=>{
   try{
     const ctl=new AbortController();
     const abort=setTimeout(()=>ctl.abort(),10000);
     let r;
     try {r=await fetch(endpoint,{headers:{"Accept":"application/vnd.github+json"},signal:ctl.signal});}
     finally{clearTimeout(abort);}
     if(!r.ok)throw Error("HTTP "+r.status);
     const comments=await r.json();
     if(!Array.isArray(comments))throw Error("Malformed response");
     list.replaceChildren();
     if(!comments.length){status("目前还没有留言，欢迎成为第一个讨论这篇作品的读者。");return;}
     for(const c of comments.slice(0,30)){
       if(!c||typeof c.body!=="string")continue;
       const article=document.createElement("article");article.className="comment-card";
       const head=document.createElement("div");head.className="comment-head";
       const user=safeUser(c.user&&c.user.login);
       const author=document.createElement("a");author.href="https://github.com/"+encodeURIComponent(user);author.rel="noopener noreferrer";author.target="_blank";author.textContent=user;
       const when=document.createElement("time");
       when.dateTime=c.created_at||"";
       const date=new Date(c.created_at);
       when.textContent=isNaN(date.getTime())?"":new Intl.DateTimeFormat("zh-CN",{year:"numeric",month:"short",day:"numeric"}).format(date);
       head.append(author,when);
       const body=document.createElement("p");body.className="comment-body";body.textContent=c.body;article.append(head,body);list.append(article);
     }
     if(comments.length===30){
       const l=document.createElement("a");l.href=fallback;l.target="_blank";l.rel="noopener noreferrer";l.textContent="查看更多留言 ↗";list.append(l);
     }
   }catch(e){status("暂时无法载入留言。你仍可通过下方链接在 GitHub 查看及发表。");}
 };
 fetchComments();
}
})();