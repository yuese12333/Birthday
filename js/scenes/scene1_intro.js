import { BaseScene } from '../core/baseScene.js';

export class Scene1Intro extends BaseScene {
  async enter(){
    const el = document.createElement('div');
    el.className = 'scene scene-intro';
    el.innerHTML = `
      <h1>穿越回高中</h1>
      <p>我：为了给你准备一个最特别的生日礼物，我竟然……时空裂开了！</p>
      <p>她（过去）：……（看起来有点紧张）</p>
      <div class="choices">
        <button data-mood="+15">“别怕，我来陪你，一切都会好的。”</button>
        <button data-mood="+5">“先深呼吸，给你一个拥抱。”</button>
        <button data-mood="-5">“要不我们先写作业？”</button>
      </div>
      <div class="mood-wrapper"><div class="mood-bar"><span class="fill"></span></div><small>安抚值</small></div>
    `;
    this.mood = 0;
    this.target = 30;
    const fill = el.querySelector('.fill');
    el.querySelectorAll('button').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const delta = parseInt(btn.dataset.mood,10);
        this.mood += delta;
        if(this.mood < 0) this.mood = 0;
        const ratio = Math.min(1,this.mood/this.target);
        fill.style.width = (ratio*100)+'%';
        if(delta < 0){
          btn.classList.add('shake');
          setTimeout(()=>btn.classList.remove('shake'),500);
        }
        if(this.mood >= this.target){
          setTimeout(()=> this.ctx.go('exam'), 600);
        }
      });
    });
    this.ctx.rootEl.appendChild(el);
  }
}
