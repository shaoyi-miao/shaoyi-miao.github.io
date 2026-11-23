(()=>{'use strict';
const root=document.getElementById('readerV7');if(!root)return;
const src=document.getElementById('reader-demo-data');if(!src)throw Error('Missing test paragraphs');
const content=JSON.parse(src.textContent).paragraphs;
const paragraphs=content.map(t=>Array.from(t));
const prefix=[0];paragraphs.forEach(p=>prefix.push(prefix.at(-1)+p.length));
const total=prefix.at(-1),title=root.dataset.title||'阅读排版样章',chapterId=root.dataset.chapter||'DEMO';
const A=document.getElementById('paperA'),B=document.getElementById('paperB');
const status=document.getElementById('pageStatus');const spread=document.getElementById('readerSpread');
let size=18,two=true,book=true,night=false,anchor=0,pages=[],pageIndex=0,kind='continuous';
function e(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
const isMobile=()=>matchMedia('(max-width: 820px)').matches;
const canTwo=()=>window.innerWidth>1050;
function partsHtml(parts){return parts.map(x=>'<p class="'+(x.start===0?'reader-paragraph-start':'reader-paragraph-continuation')+'">'+e(paragraphs[x.i].slice(x.start,x.end).join(''))+'</p>').join('')}
function pageContent(p,number){const note=root.dataset.mode==='public-trial'?'免费公开试读 · 完整文章':root.dataset.mode==='private-trial'?'作者私有试读校样 · 未获公开许可':'此处仅展示排版测试文字，真实章节正文未公开。';const first=p.first?`<h2>${e(title)}</h2><div class="epigraph">${note}</div>`:'';
return `<div class="paper-meta">${e(chapterId)} · ${root.dataset.mode==='public-trial'?'免费阅读':root.dataset.mode==='private-trial'?'私有审核':'阅读器内部预览'}</div><div class="paper-body ${book?'':'modern'}">${first}${partsHtml(p.parts)}</div><div class="paper-num">${number}</div>`}
function calculate(){const measure=A,pg=[];let i=0,at=0;const position=()=>prefix[i]+at;let overflow=false;
function fits(parts,first){measure.innerHTML=pageContent({parts,first},pg.length+1);const body=measure.querySelector('.paper-body');return body.scrollHeight<=body.clientHeight+1}
while(i<paragraphs.length&&pg.length<250){const start=position(),parts=[],first=pg.length===0;
while(i<paragraphs.length){if(at>=paragraphs[i].length){i++;at=0;continue}
const full={i,start:at,end:paragraphs[i].length};if(fits([...parts,full],first)){parts.push(full);i++;at=0;continue}
let lo=0,hi=paragraphs[i].length-at;while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(fits([...parts,{i,start:at,end:at+mid}],first))lo=mid;else hi=mid-1}
if(lo>0){parts.push({i,start:at,end:at+lo});at+=lo;if(at===paragraphs[i].length){i++;at=0}}break}
if(position()===start){overflow=true;break}pg.push({parts,first,start,end:position()})}
if(overflow||i<paragraphs.length) return null;
return pg}
function continuous(){kind='continuous';spread.classList.add('one');A.style.height='auto';A.style.overflow='visible';const p={first:true,parts:paragraphs.map((q,i)=>({i,start:0,end:q.length}))};A.innerHTML=pageContent(p,1);B.hidden=true;B.innerHTML='';status.textContent='连续阅读 · 全部'+total+'字';document.getElementById('prevPage').disabled=true;document.getElementById('nextPage').disabled=true}
function render(index){if(kind==='continuous')return;const useTwo=two&&canTwo();const max=pages.length-1;pageIndex=Math.min(Math.max(0,index),max);if(useTwo)pageIndex=Math.floor(pageIndex/2)*2;
const p=pages[pageIndex];A.innerHTML=pageContent(p,pageIndex+1);B.hidden=!(useTwo&&pages[pageIndex+1]);B.innerHTML=B.hidden?'':pageContent(pages[pageIndex+1],pageIndex+2);
anchor=p.start;const end=Math.min(pageIndex+(useTwo?2:1),pages.length);
status.textContent=`${pageIndex+1}${useTwo&&end>pageIndex+1?'–'+end:''} / ${pages.length} 页`;
document.getElementById('prevPage').disabled=pageIndex===0;document.getElementById('nextPage').disabled=end>=pages.length;
try{localStorage.setItem('reader-v7-'+chapterId,JSON.stringify({anchor,size,book,two,night}))}catch(ex){}
}
function redraw(){root.style.setProperty('--reading-size',size+'px');root.classList.toggle('night',night);spread.classList.toggle('one',!(two&&canTwo()));
if(isMobile()){continuous();return}A.style.height='';A.style.overflow='';B.hidden=false;
const fitted=calculate();if(!fitted){continuous();status.textContent='已切换连续阅读，以保证文字完整';return}
pages=fitted;kind='pages';const idx=pages.findIndex(p=>anchor>=p.start&&anchor<p.end);render(idx>=0?idx:Math.max(0,pages.length-1))}
function move(n){if(kind==='pages'){render(pageIndex+n*((two&&canTwo())?2:1));}}
document.getElementById('prevPage').addEventListener('click',()=>move(-1));
document.getElementById('nextPage').addEventListener('click',()=>move(1));
document.getElementById('lessFont').addEventListener('click',()=>{anchor=pages[pageIndex]?.start||0;size=Math.max(15,size-1);redraw()});
document.getElementById('moreFont').addEventListener('click',()=>{anchor=pages[pageIndex]?.start||0;size=Math.min(24,size+1);redraw()});
document.getElementById('fontToggle').addEventListener('click',ev=>{anchor=pages[pageIndex]?.start||0;book=!book;ev.target.textContent=book?'书卷字体':'现代字体';redraw()});
document.getElementById('pageToggle').addEventListener('click',ev=>{anchor=pages[pageIndex]?.start||0;two=!two;ev.target.textContent=two?'双页':'单页';redraw()});
document.getElementById('nightToggle').addEventListener('click',()=>{night=!night;redraw()});
document.getElementById('tocToggle').addEventListener('click',()=>{document.querySelector('.reader-flex').classList.toggle('toc-open')});
let resizeTask;window.addEventListener('resize',()=>{clearTimeout(resizeTask);resizeTask=setTimeout(redraw,180)});
try{const saved=JSON.parse(localStorage.getItem('reader-v7-'+chapterId)||'{}');anchor=Number(saved.anchor)||0;size=Number(saved.size)||18;book=saved.book!==false;two=saved.two!==false;night=!!saved.night;}catch(ex){}
redraw();document.documentElement.dataset.readerReady='1';
// Non-private diagnostics for automated layout checks only.
window.__readerTest={get stats(){return{kind,pages:pages.length,total,anchor,size,first:pages[0]?.start,last:pages.at(-1)?.end}},get flattened(){return pages.flatMap(p=>p.parts.map(s=>paragraphs[s.i].slice(s.start,s.end).join(''))).join('')}};
})();