import { BaseScene } from '../core/baseScene.js';
import { audioManager } from '../core/audioManager.js';

export class Scene6Scarf extends BaseScene {
  async init(){
    await super.init();
    this.rows = 8; this.cols = 14; // small grid placeholder
    this.progress = 0; this.total = this.rows * this.cols;
  }
  async enter(){
    const el = document.createElement('div');
    el.className='scene scene-scarf';
    el.innerHTML = `
      <h1>场景6：亲手织的围巾</h1>
      <p>点亮所有格子——模拟我一针一线给你织的过程</p>
      <div class='grid'></div>
      <div class='bar'><span class='fill'></span></div>
      <div class='percent'>0%</div>
      <button class='toNext hidden'>围巾织好啦 →</button>
    `;
    try { audioManager.playSceneBGM('6',{ loop:true, volume:0.6, fadeIn:800 }); } catch(e){}
    const grid = el.querySelector('.grid');
    const fill = el.querySelector('.fill');
    const percent = el.querySelector('.percent');
    for(let r=0;r<this.rows;r++){
      for(let c=0;c<this.cols;c++){
        const cell = document.createElement('div');
        cell.className='stitch';
        cell.addEventListener('pointerenter',()=> this.toggle(cell));
        cell.addEventListener('click',()=> this.toggle(cell,true));
        grid.appendChild(cell);
      }
    }
    // 触摸 / 移动端连续绘制支持：按下后滑动自动点亮
    let painting = false;
    grid.addEventListener('pointerdown',e=>{
      painting = true;
      const cell = e.target.closest('.stitch');
      if(cell) this.toggle(cell,true);
      // 避免触摸滚动页面
      e.preventDefault();
    });
    grid.addEventListener('pointermove',e=>{
      if(!painting) return;
      const elAt = document.elementFromPoint(e.clientX,e.clientY);
      const cell = elAt && elAt.closest('.stitch');
      if(cell) this.toggle(cell,true);
    });
    const stopPaint = ()=> { painting=false; };
    window.addEventListener('pointerup', stopPaint);
    window.addEventListener('pointercancel', stopPaint);
    this.toggle = (cell,force)=>{
      if(cell.classList.contains('on') && !force) return; // pointerenter only lights new
      if(!cell.classList.contains('on')){
        cell.classList.add('on');
        this.progress++;
        const ratio = this.progress/this.total;
        fill.style.width = (ratio*100)+'%';
        percent.textContent = Math.round(ratio*100)+'%';
        if(this.progress === this.total){
          el.querySelector('.toNext').classList.remove('hidden');
        }
      }
    };
    el.querySelector('.toNext').addEventListener('click',()=> this.ctx.go('future'));
    this.ctx.rootEl.appendChild(el);
  }
  async exit(){ audioManager.stopBGM('6',{ fadeOut:600 }); }
}
