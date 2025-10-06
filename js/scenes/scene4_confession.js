import { BaseScene } from '../core/baseScene.js';
import { audioManager } from '../core/audioManager.js';

export class Scene4Confession extends BaseScene {
  async enter(){
    const el = document.createElement('div');
    el.className = 'scene scene-confession';
    el.innerHTML = `
      <h1>场景4：那天我鼓起勇气</h1>
      <div style='display:flex;align-items:center;gap:.6rem;margin:.2rem 0 .7rem;'>
        <button class='bgm-btn confession-bgm' title='好听的音乐' style='width:44px;height:34px;font-size:.9rem;'>♪</button>
      </div>
      <div class='dialogue'>
        <p class='line'>我：其实有件事憋在心里很久了……</p>
        <p class='line hidden'>我：和你在一起的每个瞬间都让我想更靠近。</p>
        <p class='line hidden'>我：如果未来能继续这样慢慢走下去，我会很开心。</p>
        <p class='line hidden special'>—— 占位：这里替换为你的真实表白原话 ——</p>
        <div class='choices hidden'>
          <button data-resp='shy'>她：你在说什么啦（假装听不懂）</button>
          <button data-resp='curious'>她：那你喜欢我哪里？</button>
          <button data-resp='ok'>她：我也是这么想的。</button>
        </div>
        <div class='reply hidden'></div>
        <button class='next-btn'>继续</button>
        <button class='secret-btn' aria-label='secret' title='不要点我' style='opacity:.15; position:absolute;top:8px;right:12px;'>★</button>
      </div>
      <button class='toNext hidden'>一起向下一个记忆 →</button>
    `;

  const lines = [...el.querySelectorAll('.line')];
  const bgmBtn = el.querySelector('.confession-bgm');
    let idx = 0;
    const nextBtn = el.querySelector('.next-btn');
    const choices = el.querySelector('.choices');
    const replyBox = el.querySelector('.reply');
    const toNext = el.querySelector('.toNext');
    const secretBtn = el.querySelector('.secret-btn');
    let secretClicks = 0;

    function showLine(i){ lines[i].classList.remove('hidden'); }
    showLine(0);

    nextBtn.addEventListener('click', ()=>{
      idx++;
      if(idx < lines.length){
        showLine(idx);
        if(idx === lines.length -1){
          // 最后一条出现后展示选项
          setTimeout(()=> choices.classList.remove('hidden'), 400);
          nextBtn.classList.add('hidden');
        }
      }
    });

    choices.addEventListener('click', e=>{
      const btn = e.target.closest('button');
      if(!btn) return;
      const type = btn.dataset.resp;
      let text='';
      if(type==='shy') text='我就知道你会装傻，但我会一直说到你相信为止。';
      if(type==='curious') text='喜欢你专注的样子，喜欢你偶尔紧张时的小动作，也喜欢你一切不经意的小细节。';
      if(type==='ok') text='那我们把今天悄悄记成第 N + 1 个起点。';
      replyBox.textContent = text;
      replyBox.classList.remove('hidden');
      toNext.classList.remove('hidden');
    });

    toNext.addEventListener('click', ()=> {
      this.ctx.go('transition',{
        next:'date',
        style:'flash45',
        images:[
          './assets/images/mem_4_1.jpg',
          './assets/images/mem_4_2.jpg',
          './assets/images/mem_4_3.jpg',
          './assets/images/mem_4_4.jpg'
        ],
        duration:4000,
        sound:'./assets/audio/scene_45.wav'
      });
    });

    secretBtn.addEventListener('click', ()=>{
      secretClicks++;
      if(secretClicks === 5){
        const egg = document.createElement('div');
        egg.className = 'easter floating-heart';
        egg.textContent = '彩蛋: 你发现了隐藏星星!';
        el.appendChild(egg);
        setTimeout(()=> egg.remove(), 3000);
      }
    });

    // BGM 播放（若用户首次交互前浏览器阻止，将在点击按钮时恢复）
  const bgmAudio = audioManager.playSceneBGM('4',{ loop:true, volume:0.55, fadeIn:800 });
    if(bgmAudio && bgmAudio.paused){
      // 尝试自动播放，若失败则静音等待一次手势解除
      bgmAudio.play().catch(()=>{/* ignore */});
    }
    bgmBtn.addEventListener('click',()=>{
      if(!bgmAudio) return;
      if(bgmAudio.paused){ bgmAudio.play().catch(()=>{}); bgmBtn.classList.remove('muted'); }
      else { bgmAudio.pause(); bgmBtn.classList.add('muted'); }
    });

    this.ctx.rootEl.appendChild(el);
  }

  async exit(){
    audioManager.stopBGM('scene4',{ fadeOut:600 });
  }
}
