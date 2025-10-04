import { BaseScene } from '../core/baseScene.js';

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
}
