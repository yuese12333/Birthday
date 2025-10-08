import { BaseScene } from '../core/baseScene.js';
import { audioManager } from '../core/audioManager.js';

/**
 * Scene8Final 终章（占位）
 * 作用：集中展示最终祝福 / 旅程结束文案。
 * 后续可在此：
 *  - 汇总前面场景统计（答题、协同、成就）
 *  - 展示动态生成的个性化段落 / 图片拼贴 / 流光动画
 *  - 添加“再走一遍旅程”或“下载纪念图”功能
 */
export class Scene8Final extends BaseScene {
  async init(){ await super.init(); }
  async enter(){
    const el = document.createElement('div');
    el.className='scene scene-final placeholder';
    el.innerHTML = `
      <h1>终章：生日快乐 🎉</h1>
      <p class='final-line'>这一段回忆旅程到这里暂告一段落，但我们正在写的真实日常还在继续。</p>
      <p class='final-line'>谢谢你一直愿意被我认真地喜欢，也谢谢未来的我们继续携带耐心与温柔。</p>
      <div class='final-actions'>
        <button class='replay' data-debounce='800'>重新开始旅程</button>
      </div>
      <p class='note'>( 占位终章：后续将加入统计汇总 / 个性化语料 / 成就展示 / 图片拼贴 )</p>
    `;
    try { audioManager.playSceneBGM('7',{ loop:true, volume:0.55, fadeIn:800 }); } catch(e){}
    el.querySelector('.replay').addEventListener('click',()=>{
      // 清除仅限一次性的占位状态（若需要）然后回到开场
      // 不强制清除 hasRegistered，以便直接体验；若想重走仪式，可手动 ctrl+alt+R
      this.ctx.go('intro');
    });
    this.ctx.rootEl.appendChild(el);
  }
  async exit(){ audioManager.stopBGM('7',{ fadeOut:600 }); }
}