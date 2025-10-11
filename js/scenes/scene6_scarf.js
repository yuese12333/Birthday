import { BaseScene } from '../core/baseScene.js';
import { audioManager } from '../core/audioManager.js';

/**
 * Scene6Scarf (占位版)
 * 原计划：连续涂抹点亮格子模拟“织围巾”进度。
 * 现阶段：玩法尚未最终设计，保留占位文案 + 进入下一幕按钮，避免流程断裂。
 * 未来设计草案（留档）：
 *   - 网格像素模板（心形/日期）完成度判定。
 *   - 多色渐变 / 进度驱动色温。
 *   - 最长连续拖动统计 + 手速成就。
 *   - 震动反馈（navigator.vibrate）/ 织线粒子效果。
 */
export class Scene6Scarf extends BaseScene {
  async init() {
    await super.init();
  }
  async enter() {
    const el = document.createElement('div');
    el.className = 'scene scene-scarf placeholder';
    el.innerHTML = `
      <h1>场景6：亲手织的围巾（占位）</h1>
      <p class='placeholder-tip'>
        当前为占位：玩法仍在打磨中，先继续前往下一段旅程吧。
      </p>
      <button class='next-btn' data-debounce='600'>继续 →</button>
    `;

    // 统一使用基类提供的文字不可选封装
    this.applyNoSelect(el);

    try {
      audioManager.playSceneBGM('6', { loop: true, volume: 0.6, fadeIn: 600 });
    } catch (e) {}
    el.querySelector('.next-btn').addEventListener('click', () => this.ctx.go('future'));
    this.ctx.rootEl.appendChild(el);
  }
  async exit() {
    audioManager.stopBGM('6', { fadeOut: 500 });
  }
}
