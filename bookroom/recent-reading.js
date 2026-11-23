(()=>{'use strict';
const key='bookroom.recent-chapter.v1';
try{
 const reader=document.querySelector('#readerV7[data-mode="public-trial"]');
 if(reader&&/^[BV][0-9]{2}-C[0-9]{3}$/.test(reader.dataset.chapter)){localStorage.setItem(key,reader.dataset.chapter);return;}
 const box=document.querySelector('[data-recent-reading]'),link=box?.querySelector('[data-recent-link]');
 if(!link)return;
 const id=localStorage.getItem(key);
 const row=Array.from(document.querySelectorAll('[data-free-chapter]')).find(e=>e.dataset.freeChapter===id);
 if(row){link.href=row.href;link.textContent=row.querySelector('strong').textContent;box.hidden=false;}
}catch{}
})();
