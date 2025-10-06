import { BaseScene } from '../core/baseScene.js';
import { audioManager } from '../core/audioManager.js';

export class Scene3Timeline extends BaseScene {
  async init(){
    await super.init();
    this.items = [
      { id:1, text:'第一次一起自习', order:2 },
      { id:2, text:'她递给我一支备用笔', order:1 },
      { id:3, text:'我发现自己有点心动', order:3 }
    ];
  }
  async enter(){
    const el = document.createElement('div');
    el.className='scene scene-timeline';
    el.innerHTML = `
      <h1>场景3：喜欢悄悄长出来</h1>
      <p>拖拽排序这些瞬间的顺序</p>
      <ul class='draggable'></ul>
      <button class='check'>检查</button>
      <div class='result'></div>
    `;
    // 通用 BGM 播放（若不存在 scene_3.mp3 文件将静默失败不报错）
    try { audioManager.playSceneBGM('3',{ loop:true, volume:0.55, fadeIn:700 }); } catch(e) { /* ignore */ }
    const list = el.querySelector('.draggable');
    const render = ()=>{
      list.innerHTML='';
      this.items.forEach(it=>{
        const li = document.createElement('li');
        li.draggable=true; li.dataset.id=it.id; li.textContent=it.text; list.appendChild(li);
      });
    };
    render();
    // 桌面：仍使用原生 Drag & Drop
    let dragEl=null;
    list.addEventListener('dragstart',e=>{ dragEl=e.target; e.dataTransfer.effectAllowed='move'; });
    list.addEventListener('dragover',e=>{ e.preventDefault(); const target = e.target.closest('li'); if(!target||target===dragEl) return; const rect = target.getBoundingClientRect(); const next = (e.clientY - rect.top)/(rect.height) > .5; list.insertBefore(dragEl, next? target.nextSibling: target); });
    list.addEventListener('dragend',()=>{
      [...list.children].forEach((li,i)=>{ const item = this.items.find(x=>x.id==li.dataset.id); item.userOrder = i+1; });
    });

    // 移动端适配：点选两次进行交换（避免部分浏览器不支持拖拽）
    let firstTap = null; let tapTimer=null;
    const isTouch = matchMedia('(pointer:coarse)').matches;
    if(isTouch){
      list.classList.add('touch-mode');
      list.querySelectorAll('li').forEach(li=> li.draggable=false); // 禁用原生拖拽
      list.addEventListener('click',e=>{
        const li = e.target.closest('li'); if(!li) return;
        if(!firstTap){
          firstTap = li; li.classList.add('pending');
          tapTimer = setTimeout(()=>{ if(firstTap){ firstTap.classList.remove('pending'); firstTap=null; } }, 3500);
        } else if(firstTap === li){
          // 取消选择
          li.classList.remove('pending'); firstTap=null; clearTimeout(tapTimer);
        } else {
          // 交换 DOM 位置
          const a = firstTap; const b = li;
          const aNext = a.nextSibling===b? a : a.nextSibling;
          list.insertBefore(a,b); // a 移到 b 前
          if(aNext) list.insertBefore(b,aNext); else list.appendChild(b);
          a.classList.remove('pending'); firstTap=null; clearTimeout(tapTimer);
          // 更新内部顺序
          [...list.children].forEach((li,i)=>{ const item = this.items.find(x=>x.id==li.dataset.id); item.userOrder = i+1; });
        }
      });
    }
    el.querySelector('.check').addEventListener('click',()=>{
      const ok = this.items.every(it=> it.userOrder === it.order);
      const result = el.querySelector('.result');
      if(ok){
        result.textContent='原来这些点滴把心动慢慢写满了~';
        setTimeout(()=> this.ctx.go('confession'), 1000);
      } else {
        result.textContent='顺序还不太对，再感受下时间流。';
      }
    });
    this.ctx.rootEl.appendChild(el);
  }
  async exit(){ audioManager.stopBGM('3',{ fadeOut:500 }); }
}
