import { BaseScene } from '../core/baseScene.js';
import { audioManager } from '../core/audioManager.js';

/**
 * TransitionScene
 * 用途：在两个主要场景之间提供情绪化转场动画 & 音频淡出/淡入缓冲区。
 * 约定：enter(data) => { next: string 要进入的场景, style?: string 动画风格key }
 * 扩展：后续可增加不同 style：'heart','fade','petal','memory' 等。
 */
export class TransitionScene extends BaseScene {
  constructor(ctx){
    super(ctx);
  // 调整：根据需求将过渡停留时长从 1.4s 延长到 3s
  this.duration = 3000; // ms 动画时长（展示心跳与提示 3 秒后进入下一场景）
  }
  async enter(data){
    const { rootEl } = this.ctx;
    const next = data?.next || 'intro';
    const style = data?.style || 'heart';

    // 停止当前 BGM（若前一场景在 exit 中没完全淡出，可再保险）
    try { audioManager.stopBGM(800); } catch(e){}

    rootEl.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'transition-wrapper';
    wrap.setAttribute('data-style', style);
    wrap.innerHTML = `
      <div class="pulse-heart"></div>
      <div class="particles"></div>
      <div class="transition-tip">❤ 准备进入下一段小惊喜... ❤</div>
    `;
    rootEl.appendChild(wrap);

    // 生成粒子
    const particlesEl = wrap.querySelector('.particles');
    for(let i=0;i<26;i++){
      const p = document.createElement('span');
      p.className = 'particle';
      const ang = Math.random()*360;
      const dist = 40 + Math.random()*60;
      p.style.setProperty('--tx', `${Math.cos(ang*Math.PI/180)*dist}px`);
      p.style.setProperty('--ty', `${Math.sin(ang*Math.PI/180)*dist}px`);
      p.style.animationDelay = (Math.random()*0.3)+'s';
      particlesEl.appendChild(p);
    }

    // 超时后进入下个场景（给一个略长缓冲防止闪）
    setTimeout(()=>{
      // 在进入 target 场景后由其自行播放新 BGM（保持现有逻辑）
      this.ctx.go(next);
    }, this.duration);
  }
}
