import { BaseScene } from '../core/baseScene.js';
import { audioManager } from '../core/audioManager.js';

/**
 * Scene7Future (占位版)
 * 原计划：愿望输入 + 星星生成 + 收集到一定数量后显示终章祝福。
 * 当前阶段：玩法尚未设计完成，暂时改为占位 -> 点击按钮直接进入终章祝福内容。
 * 终章祝福面板简单呈现“生日快乐”与一段温暖文案，可后续替换为更私密内容。
 */
export class Scene7Future extends BaseScene {
  async init() {
    await super.init();
  }
  async enter() {
    const el = document.createElement('div');
    el.className = 'scene scene-future placeholder';
    el.innerHTML = `
      <h1>场景7：未来愿望（占位）</h1>
      <p class='placeholder-tip'>未来这里会是“写下愿望·点亮星空”的互动。
        当前为占位，为了不打断整条旅程流程，先直接进入最终祝福。</p>
      <button class='go-final' data-debounce='700'>通关游戏 →</button>
    `;

    // 统一使用基类提供的文字不可选封装
    this.applyNoSelect(el);

    try {
      audioManager.playSceneBGM('7', { loop: true, volume: 0.55, fadeIn: 800 });
    } catch (e) {}
    const btn = el.querySelector('.go-final');
    btn.addEventListener('click', () => {
      this.ctx.go('final');
    });
    this.ctx.rootEl.appendChild(el);
  }
  async exit() {
    audioManager.stopBGM('7', { fadeOut: 700 });
  }
}
