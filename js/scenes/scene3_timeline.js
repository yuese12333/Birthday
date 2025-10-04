import { BaseScene } from '../core/baseScene.js';

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
    const list = el.querySelector('.draggable');
    const render = ()=>{
      list.innerHTML='';
      this.items.forEach(it=>{
        const li = document.createElement('li');
        li.draggable=true; li.dataset.id=it.id; li.textContent=it.text; list.appendChild(li);
      });
    };
    render();
    let dragEl=null;
    list.addEventListener('dragstart',e=>{ dragEl=e.target; e.dataTransfer.effectAllowed='move'; });
    list.addEventListener('dragover',e=>{ e.preventDefault(); const target = e.target.closest('li'); if(!target||target===dragEl) return; const rect = target.getBoundingClientRect(); const next = (e.clientY - rect.top)/(rect.height) > .5; list.insertBefore(dragEl, next? target.nextSibling: target); });
    list.addEventListener('dragend',()=>{
      // update internal order
      [...list.children].forEach((li,i)=>{ const item = this.items.find(x=>x.id==li.dataset.id); item.userOrder = i+1; });
    });
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
}
