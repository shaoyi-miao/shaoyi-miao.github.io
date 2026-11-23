(()=>{"use strict";
for(const button of document.querySelectorAll("[data-share-page]")){
 button.addEventListener("click",async()=>{
   const url=location.href.split("#")[0].split("?")[0];
   const title=document.title;
   try{
     if(navigator.share){await navigator.share({title,url});return;}
     if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(url);button.textContent="链接已复制 ✓";return;}
   }catch(err){if(err?.name==="AbortError")return;}
   const fallback=document.createElement("a");fallback.href=url;fallback.textContent=url;
   button.replaceWith(fallback);
 });
}
})();