import { EventBus } from './core/eventBus.js';
import { SceneManager } from './core/sceneManager.js';
import { Scene1Intro } from './scenes/scene1_intro.js';
import { Scene0Register } from './scenes/scene0_register.js';
import { Scene2Exam } from './scenes/scene2_exam.js';
import { Scene3Timeline } from './scenes/scene3_timeline.js';
import { Scene4Confession } from './scenes/scene4_confession.js';
import { Scene5Date } from './scenes/scene5_date.js';
import { Scene6Scarf } from './scenes/scene6_scarf.js';
import { Scene7Future } from './scenes/scene7_future.js';
import { TransitionScene } from './scenes/scene_transition.js';
import { Scene8Final } from './scenes/scene8_final.js';
// (后续场景将在实现后追加 import)

const bus = new EventBus();
const rootEl = document.getElementById('app');
const sceneManager = new SceneManager(rootEl, bus);

const FORCE_REGISTER_ALWAYS = true; // 是否默认进入注册页面
const ENABLE_PRELOAD_SCREEN = true; // 是否启用首屏资源预加载

async function preloadAssets() {
  try {
    const resp = await fetch('./data/asset_manifest.json?_=' + Date.now());
    if (!resp.ok) throw new Error('manifest load fail');
    const manifest = await resp.json();
    const tasks = [];
    const progress = { done: 0, total: 0 };
    const addTask = (p) => {
      progress.total++;
      tasks.push(
        p.finally(() => {
          progress.done++;
          updateProgress(progress);
        })
      );
    };
    const updateProgressBar = document.getElementById('preload-progress');
    function updateProgress(pr) {
      if (updateProgressBar) {
        const ratio = pr.total ? pr.done / pr.total : 0;
        updateProgressBar.style.setProperty('--p', (ratio * 100).toFixed(2));
        updateProgressBar.textContent = `加载中 ${(ratio * 100).toFixed(0)}%`;
      }
    }
    (manifest.images || []).forEach((src) => {
      addTask(
        new Promise((res) => {
          const img = new Image();
          img.onload = img.onerror = () => res();
          img.src = src;
        })
      );
    });
    (manifest.audio || []).forEach((src) => {
      addTask(
        new Promise((res) => {
          try {
            const a = new Audio();
            a.preload = 'auto';
            a.src = src; // 不直接 play，部分策略会报错
            // 通过 metadata 事件认为足够
            const timer = setTimeout(() => res(), 4000);
            a.addEventListener('loadeddata', () => {
              clearTimeout(timer);
              res();
            });
            a.addEventListener('error', () => {
              clearTimeout(timer);
              res();
            });
          } catch (e) {
            res();
          }
        })
      );
    });
    await Promise.all(tasks);
  } catch (e) {
    /* 忽略预加载失败，直接进入 */
  }
}

function mountPreloadScreen() {
  if (!ENABLE_PRELOAD_SCREEN) return null;
  const wrap = document.createElement('div');
  wrap.id = 'preload-screen';
  wrap.style.cssText =
    'position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:radial-gradient(circle at 40% 40%, #ffe5ec,#ffc0d2,#ffb0c9);z-index:10000;font-family:BirthdayFont,system-ui,sans-serif;color:#6a2d3a;';
  /*
    首屏加载器（Inline）：
    - 将 SVG 环形加载动画、进度条与说明文案作为一个连续的模板字符串插入到 DOM
    - 所有必要的 CSS 动画与 keyframes 保留为内联样式，方便在不修改全局样式文件的情况下使用
    - HTML 内部也加入了中文注释，便于日后维护理解结构（标题、SVG、进度、说明、内联样式）
  */
  // 注：下面把 SVG 加载动画和必要的内联 CSS 直接嵌入到首屏预加载 DOM 中，
  // 以便无需额外 CSS 文件即可展示漂亮的环形进度动画。
  // SVG 动画来自设计稿：多个同心圆环配合 stroke-dasharray 与动画关键帧实现脉冲/移动效果。
  wrap.innerHTML = `<div style="text-align:center;display:flex;flex-direction:column;gap:1.2rem;align-items:center;">
    <h1 style="margin:0;font-size:clamp(1.6rem,5vw,2.6rem);letter-spacing:1px;">回忆旅程准备中…</h1>
    <!--
      以下为加载器主体：
      - SVG 环形动画（居中显示）
      - 进度条（置于 SVG 下方）
      - 说明文案（位于最下方）
    -->
    <div style="display:flex;flex-direction:column;align-items:center;gap:.9rem;">
      <!-- SVG 环形加载器（请勿拆分该节点，动画依赖 class 名称与结构） -->
      <svg class="pl" width="96" height="96" viewBox="0 0 240 240" aria-hidden="true" style="display:block;margin:0 auto;">
        <circle class="pl__ring pl__ring--a" cx="120" cy="120" r="105" fill="none" stroke="#f42f25" stroke-width="20" stroke-dasharray="0 660" stroke-dashoffset="-330" stroke-linecap="round"></circle>
        <circle class="pl__ring pl__ring--b" cx="120" cy="120" r="35" fill="none" stroke="#f49725" stroke-width="20" stroke-dasharray="0 220" stroke-dashoffset="-110" stroke-linecap="round"></circle>
        <circle class="pl__ring pl__ring--c" cx="85" cy="120" r="70" fill="none" stroke="#255ff4" stroke-width="20" stroke-dasharray="0 440" stroke-linecap="round"></circle>
        <circle class="pl__ring pl__ring--d" cx="155" cy="120" r="70" fill="none" stroke="#f42582" stroke-width="20" stroke-dasharray="0 440" stroke-linecap="round"></circle>
      </svg>
      <!-- 进度显示（文字与背景层） -->
      <div id='preload-progress' style="--p:0;background:rgba(255,255,255,.5);backdrop-filter:blur(6px);padding:.9rem 1.4rem;border-radius:18px;min-width:220px;max-width:80vw;font-size:.9rem;position:relative;overflow:hidden;text-align:center;">
        <!-- 进度填充层（宽度由 --p CSS 变量驱动） -->
        <span style="position:absolute;inset:0;background:linear-gradient(90deg,#ff8fb5,#ff6f9d);width:calc(var(--p)*1%);mix-blend-mode:multiply;opacity:.35;pointer-events:none;transition:width .35s;" ></span>
        加载中 0%
      </div>
    </div>
    <!-- 额外说明文字 -->
    <div style="font-size:.7rem;opacity:.75;">（首屏资源预热，避免进入后首段音乐与图片卡顿）</div>
    <!-- Inline CSS for SVG loader animation: 保持内联，便于不改动外部样式文件直接运行 -->
    <style>
      .pl { width: 6em; height: 6em; }
      .pl__ring { animation: ringA 2s linear infinite; }
      .pl__ring--a { stroke: #f42f25; }
      .pl__ring--b { animation-name: ringB; stroke: #f49725; }
      .pl__ring--c { animation-name: ringC; stroke: #255ff4; }
      .pl__ring--d { animation-name: ringD; stroke: #f42582; }
      @keyframes ringA {
        from, 4% { stroke-dasharray: 0 660; stroke-width: 20; stroke-dashoffset: -330; }
        12% { stroke-dasharray: 60 600; stroke-width: 30; stroke-dashoffset: -335; }
        32% { stroke-dasharray: 60 600; stroke-width: 30; stroke-dashoffset: -595; }
        40%,54% { stroke-dasharray: 0 660; stroke-width: 20; stroke-dashoffset: -660; }
        62% { stroke-dasharray: 60 600; stroke-width: 30; stroke-dashoffset: -665; }
        82% { stroke-dasharray: 60 600; stroke-width: 30; stroke-dashoffset: -925; }
        90%, to { stroke-dasharray: 0 660; stroke-width: 20; stroke-dashoffset: -990; }
      }
      @keyframes ringB {
        from,12% { stroke-dasharray: 0 220; stroke-width: 20; stroke-dashoffset: -110; }
        20% { stroke-dasharray: 20 200; stroke-width: 30; stroke-dashoffset: -115; }
        40% { stroke-dasharray: 20 200; stroke-width: 30; stroke-dashoffset: -195; }
        48%,62% { stroke-dasharray: 0 220; stroke-width: 20; stroke-dashoffset: -220; }
        70% { stroke-dasharray: 20 200; stroke-width: 30; stroke-dashoffset: -225; }
        90% { stroke-dasharray: 20 200; stroke-width: 30; stroke-dashoffset: -305; }
        98%, to { stroke-dasharray: 0 220; stroke-width: 20; stroke-dashoffset: -330; }
      }
      @keyframes ringC {
        from { stroke-dasharray: 0 440; stroke-width: 20; stroke-dashoffset: 0; }
        8% { stroke-dasharray: 40 400; stroke-width: 30; stroke-dashoffset: -5; }
        28% { stroke-dasharray: 40 400; stroke-width: 30; stroke-dashoffset: -175; }
        36%,58% { stroke-dasharray: 0 440; stroke-width: 20; stroke-dashoffset: -220; }
        66% { stroke-dasharray: 40 400; stroke-width: 30; stroke-dashoffset: -225; }
        86% { stroke-dasharray: 40 400; stroke-width: 30; stroke-dashoffset: -395; }
        94%, to { stroke-dasharray: 0 440; stroke-width: 20; stroke-dashoffset: -440; }
      }
      @keyframes ringD {
        from,8% { stroke-dasharray: 0 440; stroke-width: 20; stroke-dashoffset: 0; }
        16% { stroke-dasharray: 40 400; stroke-width: 30; stroke-dashoffset: -5; }
        36% { stroke-dasharray: 40 400; stroke-width: 30; stroke-dashoffset: -175; }
        44%,50% { stroke-dasharray: 0 440; stroke-width: 20; stroke-dashoffset: -220; }
        58% { stroke-dasharray: 40 400; stroke-width: 30; stroke-dashoffset: -225; }
        78% { stroke-dasharray: 40 400; stroke-width: 30; stroke-dashoffset: -395; }
        86%, to { stroke-dasharray: 0 440; stroke-width: 20; stroke-dashoffset: -440; }
      }
    </style>
`;
  document.body.appendChild(wrap);
  return wrap;
}

function removePreloadScreen() {
  const el = document.getElementById('preload-screen');
  if (el) {
    el.style.opacity = '0';
    el.style.transition = 'opacity .5s';
    setTimeout(() => el.remove(), 520);
  }
}

function context() {
  return { rootEl, bus, go: (name, data) => sceneManager.go(name, data) };
}

sceneManager.register('register', () => new Scene0Register(context()));
sceneManager.register('intro', () => new Scene1Intro(context()));
sceneManager.register('exam', () => new Scene2Exam(context()));
sceneManager.register('timeline', () => new Scene3Timeline(context()));
sceneManager.register('confession', () => new Scene4Confession(context()));
sceneManager.register('date', () => new Scene5Date(context()));
sceneManager.register('scarf', () => new Scene6Scarf(context()));
sceneManager.register('future', () => new Scene7Future(context()));
sceneManager.register('final', () => new Scene8Final(context()));
// 新增：转场中介场景（用于动画 & BGM 交叉淡出缓冲）
sceneManager.register('transition', () => new TransitionScene(context())); // 仍保留手动可用

window.addEventListener('DOMContentLoaded', async () => {
  let preloadWrap = null;
  if (ENABLE_PRELOAD_SCREEN) {
    preloadWrap = mountPreloadScreen();
    await preloadAssets();
  }
  // 若已注册过直接进入 intro，否则进入 register 仪式页
  const has = localStorage.getItem('hasRegistered') === '1';
  const params = new URLSearchParams(location.search);
  const force = params.get('forceRegister') === '1';
  if (force) {
    localStorage.removeItem('hasRegistered');
  }
  const goRegister = FORCE_REGISTER_ALWAYS ? true : force || !has;
  sceneManager.go(goRegister ? 'register' : 'intro');

  if (preloadWrap) {
    removePreloadScreen();
  }
});

/**
 * 全局点击防抖：
 * 任何元素加上 data-debounce="毫秒" 即可在该时间窗口内拒绝再次点击。
 * 适用场景：防止用户连续猛点导致：
 *  - 重复场景跳转
 *  - 重复动画/计时器启动
 *  - 注册“我忘了”按钮被疯狂连点提前暴露全部线索
 */
window.addEventListener(
  'click',
  (e) => {
    const target = e.target.closest('[data-debounce]');
    if (!target) return;
    const dur = parseInt(target.getAttribute('data-debounce'), 10) || 400;
    // 若仍在冷却中，阻止后续监听器执行（含按钮默认行为）
    if (target._debouncing) {
      e.stopImmediatePropagation();
      e.preventDefault();
      return;
    }
    target._debouncing = true;
    target.classList.add('debouncing');
    setTimeout(() => {
      target._debouncing = false;
      target.classList.remove('debouncing');
    }, dur);
  },
  true
); // 捕获阶段，尽早拦截

// 全局快捷键：Ctrl + Alt + R 清除注册标记并回注册场景（调试/重看仪式）
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.altKey && (e.key === 'r' || e.key === 'R')) {
    localStorage.removeItem('hasRegistered');
    sceneManager.go('register');
  }
});
