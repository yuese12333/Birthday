import { BaseScene } from '../core/baseScene.js';
import { audioManager } from '../core/audioManager.js';

/**
 * TransitionScene
 * 用途：在两个主要场景之间提供情绪化转场动画 & 音频淡出/淡入缓冲区。
 * 约定：enter(data) => { next: string 要进入的场景, style?: string 动画风格key }
 * 扩展：后续可增加不同 style：'heart','fade','petal','memory' 等。
 */
export class TransitionScene extends BaseScene {
  constructor(ctx) {
    super(ctx);
    this.duration = 3000; // ms 动画时长（展示心跳与提示 3 秒后进入下一场景）
  }
  async enter(data) {
    const { rootEl } = this.ctx;
    const next = data?.next || 'intro';
    const requestedStyle = data?.style || 'heart';
    const originalStyle = requestedStyle; // 用于音效推断 & data-style
    // 视觉复用：flash12 目前沿用 heart 的粒子 & 心跳视觉
    const visualStyle = requestedStyle === 'flash12' ? 'heart' : requestedStyle;
    const flashImages = Array.isArray(data?.images) ? data.images : [];
    const customTip = data?.tip;
    const explicitDuration = typeof data?.duration === 'number';
    if (explicitDuration) {
      this.duration = data.duration;
    }

    // 过渡：停止上一场景 BGM
    try {
      audioManager.stopAll({ fadeOut: 600 });
    } catch (e) {}
    // 独特音效策略：优先级（仅保留新命名）
    // 1. data.sound 显式传入路径
    // 2. flash_<from><to>.{mp3,wav,ogg}
    // 3. transition_<style>.{wav,mp3,ogg}
    // 4. flash45 特例：flash_45.(mp3|wav|ogg)
    // 5. 若 data.useBGM === true 则忽略一次性音效，使用默认 transition BGM
    // 6. 最终回退：若以上均失败，flash45 静默，其它播放过渡 BGM
    const useBGM = data?.useBGM === true;
    const explicit = data?.sound;
    const tryCandidates = [];
    if (explicit) tryCandidates.push(explicit);
    if (!explicit && !useBGM) {
      // 2) scene_<from><to> 自动命名：需要来源场景 id（__fromScene）与 next 目标
      const fromId = data?.__fromScene; // 可能是 'intro','exam','timeline','confession','date','scarf','future' 等
      // 简单映射：提取第一个数字若存在否则用首字母序列化；你可按需改成一个显式字典
      const mapToCode = (id) => {
        if (!id) return null;
        const m = id.match(/(\d+)/);
        if (m) return m[1];
        // 自定义非数字 id -> 固定序列（可扩展）
        const order = [
          'register',
          'intro',
          'exam',
          'timeline',
          'confession',
          'date',
          'scarf',
          'future',
        ];
        const idx = order.indexOf(id);
        return idx >= 0 ? idx.toString() : id.slice(0, 1);
      };
      const fromCode = mapToCode(fromId);
      const toCode = mapToCode(next);
      if (fromCode && toCode) {
        // 2) 新命名 flash_<from><to>
        ['.mp3', '.wav', '.ogg'].forEach((ext) =>
          tryCandidates.push(`./assets/audio/flash_${fromCode}${toCode}${ext}`)
        );
      }
      // 3) transition_<style>
      const base = `./assets/audio/transition_${originalStyle}`;
      ['.wav', '.mp3', '.ogg'].forEach((ext) => tryCandidates.push(base + ext));
      // 4) flash45 特例
      if (originalStyle === 'flash45') {
        ['.mp3', '.wav', '.ogg'].forEach((ext) =>
          tryCandidates.push(`./assets/audio/flash_45${ext}`)
        );
      }
    }
    // 支持显式指定一次性音效的音量（data.soundVolume: 0.0 - 1.0），优先使用该值
    const explicitSoundVolume =
      typeof data?.soundVolume === 'number' && !Number.isNaN(data.soundVolume)
        ? Math.max(0, Math.min(1, data.soundVolume))
        : null;
    let playedOneShot = false;
    // 保存一次性音效引用，便于在结束时停止
    let oneShotAudio = null;
    if (!useBGM) {
      for (const cand of tryCandidates) {
        try {
          const a = new Audio(cand);
          a.volume =
            explicitSoundVolume != null
              ? explicitSoundVolume
              : originalStyle === 'flash45'
              ? 0.85
              : 0.75;
          const playPromise = a.play();
          if (playPromise) {
            playPromise.then(() => {}).catch(() => {});
          }
          oneShotAudio = a;
          playedOneShot = true;
          break;
        } catch (e) {
          /* continue */
        }
      }
    }
    if (useBGM || (!playedOneShot && originalStyle !== 'flash45')) {
      // 回退到简易 BGM（非循环）
      try {
        audioManager.playSceneBGM('transition', { loop: false, volume: 0.5, fadeIn: 400 });
      } catch (e) {}
    }

    rootEl.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'transition-wrapper';
    wrap.setAttribute('data-style', originalStyle); // 保留原请求 style（区分 flash12 vs heart）
    if (originalStyle === 'flash45') {
      wrap.innerHTML = `
        <div class="flash45-seq"></div>
        <div class="transition-tip">${customTip || '记忆片段闪回…'}</div>`;
    } else if (visualStyle === 'heart') {
      wrap.innerHTML = `
        <div class="pulse-heart"></div>
        <div class="particles"></div>
        <div class="transition-tip">${customTip || '❤ 准备进入下一段小惊喜... ❤'}</div>`;
    } else {
      // 未来其他视觉分支可在此添加
      wrap.innerHTML = `<div class="transition-tip">${customTip || '正在前往下一段...'}</div>`;
    }
    rootEl.appendChild(wrap);

    if (originalStyle === 'flash45') {
      const seqEl = wrap.querySelector('.flash45-seq');
      const imgs = flashImages.length
        ? flashImages
        : [
            './assets/images/memory1.jpg',
            './assets/images/memory2.jpg',
            './assets/images/memory3.jpg',
          ];
      imgs.forEach((src, i) => {
        const f = document.createElement('div');
        f.className = 'flash45-frame';
        // 计算每帧的显示时机：在总时长 this.duration 中，前后各留 300ms 空白
        const totalMs = this.duration || 3000;
        const pad = 300; // ms 前后留白
        const avail = Math.max(0, totalMs - pad * 2);
        const slot = avail / imgs.length;
        const start = pad + i * slot;
        // 将计算结果注入为 CSS 变量（如 850ms）供样式使用
        f.style.setProperty('--delay', `${start}ms`);
        f.style.setProperty('--dur', `${Math.max(80, slot)}ms`);
        f.style.backgroundImage = `url('${src}')`;
        seqEl.appendChild(f);
      });
      // 若未显式指定 duration，则按帧数动态计算
      if (!explicitDuration) {
        const basePer = 260; // ms 每帧
        this.duration = Math.min(4500, Math.max(1800, imgs.length * basePer));
      }
    } else if (visualStyle === 'heart') {
      // 生成粒子
      const particlesEl = wrap.querySelector('.particles');
      for (let i = 0; i < 26; i++) {
        const p = document.createElement('span');
        p.className = 'particle';
        const ang = Math.random() * 360;
        const dist = 40 + Math.random() * 60;
        p.style.setProperty('--tx', `${Math.cos((ang * Math.PI) / 180) * dist}px`);
        p.style.setProperty('--ty', `${Math.sin((ang * Math.PI) / 180) * dist}px`);
        p.style.animationDelay = Math.random() * 0.3 + 's';
        particlesEl.appendChild(p);
      }
    }

    // 超时后进入下个场景（给一个略长缓冲防止闪）
    setTimeout(() => {
      // 在切换场景前立即停止一次性音效，避免残音继续播放
      try {
        if (oneShotAudio) {
          oneShotAudio.pause();
          try {
            oneShotAudio.currentTime = 0;
          } catch (e) {
            /* ignore */
          }
          oneShotAudio = null;
        }
      } catch (e) {}
      // 同时确保回退的 transition BGM 也不会残留（立即停止，无淡出）
      try {
        audioManager.stopBGM && audioManager.stopBGM('transition', { fadeOut: 0 });
      } catch (e) {}
      this.ctx.go(next);
    }, this.duration);
  }
}
