import { BaseScene } from '../core/baseScene.js';
import { audioManager } from '../core/audioManager.js';

/**
 * 场景3（占位版）
 * 说明：原计划为“大学时间线拖拽排序”玩法，现阶段玩法尚未设计 / 调整中。
 * 暂时仅展示占位文案 + “进入下一幕”按钮，方便流程连续。
 * 后续落地玩法时：可替换为时间线事件外部 JSON 驱动 + 桌面拖拽 / 触摸对调交互。
 */
export class Scene3Timeline extends BaseScene {
  async init(){ await super.init(); }
  async enter(){
    const el = document.createElement('div');
    el.className='scene scene-timeline scene-placeholder';
    el.innerHTML = `
      <h1>场景3：大学时间线（占位）</h1>
      <p class='placeholder-note'>玩法设计中…… 此处将来放 “回忆事件排序 / 触摸交换” 等互动。<br/>目前先跳过以保持整体流程连贯。</p>
      <button class='go-next' data-debounce>进入下一幕</button>
    `;
    try { audioManager.playSceneBGM('3',{ loop:true, volume:0.55, fadeIn:700 }); } catch(e) { /* ignore */ }
    el.querySelector('.go-next').addEventListener('click',()=> this.ctx.go('confession'));
    this.ctx.rootEl.appendChild(el);
  }
  async exit(){ audioManager.stopBGM('3',{ fadeOut:500 }); }
}
