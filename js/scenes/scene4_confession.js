import { BaseScene } from '../core/baseScene.js';
import { audioManager } from '../core/audioManager.js';

/**
 * 场景4（占位版）
 * 原“表白分支”玩法暂未最终定稿。先放占位说明，保留流程连续性。
 * 未来可能形态：多段真实表白台词 + 分支回答影响后续彩蛋 / 成就。
 */
export class Scene4Confession extends BaseScene {
  async enter(){
    const el = document.createElement('div');
    el.className = 'scene scene-confession scene-placeholder';
    el.innerHTML = `
      <h1>场景4：表白（占位）</h1>
      <p class='placeholder-note'>此处未来将呈现多段渐进表白与互动分支。<br/>当前为占位页面，仅用于衔接下一幕。</p>
      <div style='margin:.8rem 0 1.2rem;'>
        <button class='bgm-btn confession-bgm' title='好听的音乐' data-debounce style='width:46px;height:36px;font-size:.95rem;'>♪</button>
      </div>
      <button class='go-next' data-debounce>进入下一幕</button>
    `;

    // 统一使用基类提供的文字不可选封装
    this.applyNoSelect(el);

    // 播放 BGM（占位，可换成未来表白专属 BGM）
    const bgmAudio = audioManager.playSceneBGM('4',{ loop:true, volume:0.55, fadeIn:800 });
    const bgmBtn = el.querySelector('.confession-bgm');
    bgmBtn.addEventListener('click',()=>{
      if(!bgmAudio) return;
      if(bgmAudio.paused){ bgmAudio.play().catch(()=>{}); bgmBtn.classList.remove('muted'); }
      else { bgmAudio.pause(); bgmBtn.classList.add('muted'); }
    });
    el.querySelector('.go-next').addEventListener('click',()=>{
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
    this.ctx.rootEl.appendChild(el);
  }
  async exit(){
    audioManager.stopBGM('4',{ fadeOut:600 });
  }
}
