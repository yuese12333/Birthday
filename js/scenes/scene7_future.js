import { BaseScene } from '../core/baseScene.js';

export class Scene7Future extends BaseScene {
  async init(){
    await super.init();
    this.wishes = [];
    this.required = 5; // 占位：需要多少愿望
  }
  async enter(){
    const el = document.createElement('div');
    el.className='scene scene-future';
    el.innerHTML = `
      <h1>场景7：我们的未来</h1>
      <p>在星空中点击放下一颗星，并写下一个愿望 (收集 ${this.required} 个)</p>
      <div class='sky'></div>
      <div class='wish-panel'>
        <input class='wish-input' maxlength='30' placeholder='输入愿望...' />
        <button class='add' disabled>放一颗星</button>
      </div>
      <div class='wish-list'></div>
      <div class='final hidden'>
        <h2>生日快乐</h2>
        <p class='message'>占位：最终告白——感谢我们走过的每一段路。过去治愈了不安，现在点亮了期待，未来我会继续好好喜欢你。<br/>让我们回到现实里，把这份心意继续写在生活里。</p>
        <div class='celebrate'><canvas class='confetti' width='320' height='200'></canvas></div>
        <p class='reality-note'>（真正的故事正在进行中。）</p>
      </div>
    `;
    const sky = el.querySelector('.sky');
    const input = el.querySelector('.wish-input');
    const addBtn = el.querySelector('.add');
    const list = el.querySelector('.wish-list');
    const finalBox = el.querySelector('.final');

    input.addEventListener('input',()=>{
      addBtn.disabled = !input.value.trim();
    });

    addBtn.addEventListener('click',()=>{
      const text = input.value.trim();
      if(!text) return;
      input.value=''; addBtn.disabled=true;
      this.wishes.push(text);
      // create star
      const star = document.createElement('span');
      star.className='star';
      star.style.left = Math.random()*90 + '%';
      star.style.top = Math.random()*70 + '%';
      star.title = text;
      sky.appendChild(star);
      // list item
      const li = document.createElement('div');
      li.className='wish-item';
      li.textContent = '★ '+ text;
      list.appendChild(li);
      if(this.wishes.length >= this.required){
        finalBox.classList.remove('hidden');
        this.launchConfetti(finalBox.querySelector('.confetti'));
      }
    });
    // 不再提供重开按钮
    this.ctx.rootEl.appendChild(el);
  }
  launchConfetti(canvas){
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const pieces = Array.from({length:90}).map(()=> ({
      x: Math.random()*W,
      y: Math.random()*-H,
      size: 6+Math.random()*6,
      color: ['#ff6f90','#ffd36f','#ffffff','#ffa6c5'][Math.floor(Math.random()*4)],
      vy: 1+Math.random()*2.2,
      vx: -1+Math.random()*2,
      rot: Math.random()*Math.PI,
      vr: -0.15+Math.random()*0.3,
      shape: Math.random()>0.5?'rect':'circle'
    }));
    let frames=0;
    const draw=()=>{
      frames++; ctx.clearRect(0,0,W,H);
      pieces.forEach(p=>{
        p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.vy += 0.01;
        if(p.y > H+20){ p.y = -20; p.x = Math.random()*W; }
        ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot); ctx.fillStyle=p.color;
        if(p.shape==='rect') ctx.fillRect(-p.size/2,-p.size/2,p.size,p.size);
        else { ctx.beginPath(); ctx.arc(0,0,p.size/2,0,Math.PI*2); ctx.fill(); }
        ctx.restore();
      });
      if(frames < 60*25) requestAnimationFrame(draw); // ~25s
    };
    draw();
  }
}
