/**
 * Scene3 — 心动瞬间（数织 Nonogram）
 *
 * 设计要点：
 * - 从预生成的 puzzles JSON 加载若干关（固定为 4 关）
 * - matrix 为 0/1 二值矩阵，1 表示应涂色的格子
 * - 矩阵尺寸可变但每项必须为相同宽度
 *
 * 数据契约：
 * - 文件路径：默认从 `data/scene3_puzzles.json` 加载，期望形如 { puzzles: [ ... ] }
 * - 每个 puzzle 必须包含 matrix 和 image（或 meta.image）
 * - 本场景强制使用 EXACT_LEVELS = 4（REQUIRED_LEVELS），多余项会被截断，不足则报错
 *
 * 核心行为：
 * - 渲染：根据 matrix 生成行/列线索（run-length），渲染线索区与交互网格
 * - 交互：左键/触摸 = 涂色或擦除（拖拽支持）；右键/长按 = 标记
 * - 判定：当每个格子的涂色状态严格匹配 matrix（无缺漏且无多涂）时判定为完成。
 *
 * Completion animation / collage
 * - 完成时将淡入该关的原始图片（reveal image），随后图片会"分裂"并飞入四个角的槽位。
 * - 当四个槽位均被填入图片后，overlay 将淡出并显示最终拼贴图像（由常量 FINAL_COLLAGE_SRC 指定）。
 * - 关键常量：REVEAL_FADE_MS, SPLIT_ANIM_MS, COLLAGE_FADE_MS, FINAL_COLLAGE_FADE_MS, FINAL_COLLAGE_SRC
 */

import { BaseScene } from '../core/baseScene.js';
import { audioManager } from '../core/audioManager.js';
import { achievements } from '../core/achievements.js';

export class Scene3Timeline extends BaseScene {
  async init() {
    await super.init();
  }
  async enter() {
    const CONFIG = {
      puzzleSrc: 'data/scene3_puzzles.json', // puzzles JSON 路径
      showRuleHelp: true,
    };

    // 写死为固定关卡数（四关）；所有循环/判定统一引用 REQUIRED_LEVELS
    const REQUIRED_LEVELS = 4;
    // 显式动画时间设定（毫秒）
    const REVEAL_FADE_MS = 900; // 图片淡入时长
    const SPLIT_ANIM_MS = 700; // 分裂飞向角落动画时长
    const COLLAGE_FADE_MS = 900; // 四张拼贴淡出时长
    const FINAL_COLLAGE_FADE_MS = 900; // 最终合集图片淡入时长
    const FINAL_COLLAGE_SRC = 'assets/images/scene3_0.png';

    const root = document.createElement('div');
    root.className = 'scene scene-nonogram';
    // 捕获当前场景实例，供内部嵌套函数安全引用
    const scene = this;
    // 使用 BaseScene 公共方法统一禁用文字选择
    this.applyNoSelect(root);

    // 分裂并定位图片的辅助工具（包含持久化的十字分割线 + 4 个固定槽位）
    // 写死逻辑：四关四图，按当前关卡索引固定映射到四角（不再使用累计计数）。
    function hideRevealImmediate() {
      const revealImgNow = gridScroller.querySelector('.nonogram-reveal-img');
      if (!revealImgNow) return;
      try {
        const prevTrans = revealImgNow.style.transition || '';
        revealImgNow.style.transition = 'none';
        revealImgNow.classList.remove('show');
        revealImgNow.style.opacity = '0';
        revealImgNow.setAttribute('aria-hidden', 'true');
        revealImgNow.hidden = true;
        // 重置层级，避免在下一题遮盖网格
        revealImgNow.style.zIndex = '';
        revealImgNow.style.pointerEvents = 'none';
        try {
          delete revealImgNow.dataset.splitStarted;
        } catch (e) {}
        void revealImgNow.offsetHeight; // force reflow
        setTimeout(() => {
          revealImgNow.style.transition = prevTrans;
        }, 50);
      } catch (e) {
        /* ignore */
      }
    }

    // 确保存在分裂 overlay，若已存在则复用
    function ensureSplitOverlay() {
      let overlay = gridScroller.querySelector('.split-overlay');
      if (overlay) return overlay;
      overlay = document.createElement('div');
      overlay.className = 'split-overlay';
      // 初始隐藏 overlay（不可见），待图片淡入完成后再显示
      overlay.hidden = true;
      // 初始透明度设为 0，配合 hidden 属性彻底隐藏
      try {
        overlay.style.opacity = '0';
      } catch (e) {}
      // 确保分裂层不遮挡交互，且层级低于网格（由 JS 提升网格 z-index）
      try {
        overlay.style.pointerEvents = 'none';
        overlay.style.zIndex = '0';
        overlay.style.position = overlay.style.position || 'absolute';
      } catch (e) {}
      // 中心容器：承载 4 个槽位与十字分割线
      const slots = document.createElement('div');
      slots.className = 'split-slots';
      // 创建 4 个带明确定位类名的槽位，确保逻辑顺序可映射到四个角
      const slotPosClasses = [
        'slot-bottom-left',
        'slot-top-left',
        'slot-bottom-right',
        'slot-top-right',
      ];
      for (let i = 0; i < 4; i++) {
        const s = document.createElement('div');
        s.className = 'split-slot ' + slotPosClasses[i];
        s.dataset.idx = String(i);
        slots.appendChild(s);
      }
      // 十字分割线（纵 / 横）
      const vline = document.createElement('div');
      vline.className = 'split-line vline';
      const hline = document.createElement('div');
      hline.className = 'split-line hline';
      overlay.appendChild(slots);
      overlay.appendChild(vline);
      overlay.appendChild(hline);
      gridScroller.appendChild(overlay);
      return overlay;
    }

    function hideSplitOverlay() {
      const overlay = gridScroller.querySelector('.split-overlay');
      if (!overlay) return;
      try {
        overlay.hidden = true;
        overlay.style.opacity = '0';
        overlay.style.transition = '';
        delete overlay.dataset.fading;
      } catch (e) {
        /* defensive */
      }
    }

    // 显示最终拼贴大图
    function showFinalCollageImage() {
      try {
        if (!FINAL_COLLAGE_SRC) return;
        const existing = gridScroller.querySelector('.final-collage-img');
        if (existing) {
          if (existing.dataset.visible) return;
        }
        const img = existing || document.createElement('img');
        img.className = 'final-collage-img';
        img.src = FINAL_COLLAGE_SRC;
        img.alt = '';
        img.dataset.visible = '0';
        img.hidden = true;
        try {
          img.style.position = img.style.position || 'absolute';
          img.style.top = '0';
          img.style.left = '0';
          img.style.right = '0';
          img.style.bottom = '0';
          img.style.margin = 'auto';
          img.style.pointerEvents = 'none';
          img.style.maxWidth = '100%';
          img.style.maxHeight = '100%';
          img.style.transition = `opacity ${FINAL_COLLAGE_FADE_MS}ms ease`;
          img.style.opacity = '0';
          img.style.zIndex = '2';
        } catch (e) {}
        if (!existing) gridScroller.appendChild(img);
        const startFade = () => {
          img.hidden = false;
          void img.offsetHeight;
          try {
            img.style.opacity = '1';
          } catch (e) {}
          img.dataset.visible = '1';
        };
        if (img.complete && img.naturalWidth > 0) {
          requestAnimationFrame(startFade);
        } else {
          img.addEventListener('load', () => requestAnimationFrame(startFade), { once: true });
        }
      } catch (e) {
        /* defensive */
      }
    }

    // 当所有槽位已有拼贴图时，淡出整个 overlay（拼接大图淡出）
    function fadeOutCollageIfComplete() {
      try {
        const ov = ensureSplitOverlay();
        if (!ov) return;
        const slots = ov.querySelectorAll('.split-slot');
        if (!slots || slots.length === 0) return;
        // 检查每个槽位是否已有 .split-locked
        let allFilled = true;
        for (const s of slots) {
          if (!s.querySelector('.split-locked')) {
            allFilled = false;
            break;
          }
        }
        if (!allFilled) return;
        // 所有槽位已放入图片 -> 启动淡出（防止重复触发）
        if (ov.dataset.fading) return;
        ov.dataset.fading = '1';
        try {
          ov.style.transition = `opacity ${COLLAGE_FADE_MS}ms ease`;
        } catch (e) {}
        // 触发过渡到透明
        requestAnimationFrame(() => {
          ov.style.opacity = '0';
          ov.hidden = false;
        });
        const onEnd = (ev) => {
          if (ev && ev.propertyName && ev.propertyName !== 'opacity') return;
          ov.removeEventListener('transitionend', onEnd);
          try {
            ov.hidden = true;
          } catch (e) {}
          // 可选：清空 overlay 内容以减小内存占用
          try {
            const slotsContainer = ov.querySelector('.split-slots');
            if (slotsContainer) slotsContainer.innerHTML = '';
          } catch (e) {}
          showFinalCollageImage();
        };
        ov.addEventListener('transitionend', onEnd);
        // 兜底：如果 transitionend 未触发，仍在 COLLAGE_FADE_MS + 200ms 后强制隐藏
        setTimeout(() => {
          try {
            const wasHidden = ov.hidden;
            if (!ov.hidden) ov.hidden = true;
            const sc = ov.querySelector('.split-slots');
            if (sc) sc.innerHTML = '';
            if (!wasHidden) showFinalCollageImage();
          } catch (e) {}
        }, COLLAGE_FADE_MS + 250);
      } catch (e) {
        /* defensive */
      }
    }

    // 启动图片分裂飞向角落动画
    // now accepts an optional callback doneCb which will be called after the
    // temporary image finishes animating into its slot (i.e. the "move to corner" finished).
    function startSplitForSrc(src, doneCb) {
      if (!src) return;
      // 仅允许已定义范围内的关卡触发分裂动画
      if (currentIndex < 0 || currentIndex >= REQUIRED_LEVELS) {
        hideRevealImmediate();
        return;
      }
      const overlay = ensureSplitOverlay();
      try {
        overlay.hidden = false;
        requestAnimationFrame(() => {
          try {
            overlay.style.opacity = '1';
            overlay.style.transition = '';
          } catch (e) {}
        });
      } catch (e) {
        /* defensive */
      }
      // 复制后立即让绑定图片消失，避免与飞行动画重叠
      hideRevealImmediate();
      // 创建一个临时 <img>，初始居中摆放；原图已被隐藏从视觉上消失
      const tmp = document.createElement('img');
      tmp.className = 'split-temp';
      tmp.src = src;
      tmp.alt = '';
      // 基础样式，确保可见并不拦截交互
      try {
        tmp.style.position = tmp.style.position || 'absolute';
        tmp.style.pointerEvents = 'none';
        // 提升到最上层，确保飞行动画在揭示图与控件之上可见
        tmp.style.zIndex = '4';
      } catch (e) {}
      // 将临时图放到 overlay 末尾，保证层级正确
      overlay.appendChild(tmp);
      const start = () => {
        // 使用 requestAnimationFrame 强制一次布局后再启动动画，避免初始跳变
        requestAnimationFrame(() => {
          // “写死”的四关：按当前关卡索引固定映射到四角
          // 逻辑顺序：0->左下,1->左上,2->右下,3->右上
          // DOM 2x2 顺序：0=左上,1=右上,2=左下,3=右下
          const logical = currentIndex % REQUIRED_LEVELS;
          const logicalToDom = [2, 0, 3, 1];
          const domIdx = logicalToDom[logical];
          animateToSlot(tmp, domIdx, () => {
            const slotEl = overlay.querySelector(`.split-slot[data-idx='${domIdx}']`);
            if (slotEl) {
              // 覆盖旧内容，保持每个槽位只有一张
              slotEl.innerHTML = '';
              const finalImg = document.createElement('img');
              finalImg.className = 'split-locked';
              finalImg.src = src;
              finalImg.alt = '';
              slotEl.appendChild(finalImg);
            }
            if (tmp && tmp.parentElement) tmp.parentElement.removeChild(tmp);
            // 每次放入槽位后检查是否已完成四图拼接，若是则触发淡出
            try {
              fadeOutCollageIfComplete();
            } catch (e) {}
            // Notify caller that the "move to corner" animation for this reveal has completed
            try {
              if (typeof doneCb === 'function') doneCb();
            } catch (e) {}
            // 如果当前是最后一题（第四题），在分裂动画完成后记录成就事件供判定
            try {
              const isFinal =
                typeof puzzles !== 'undefined' &&
                Array.isArray(puzzles) &&
                currentIndex === puzzles.length - 1;
              if (isFinal) {
                const payload = { hintUse: hintUses[currentIndex] || 0, index: currentIndex };
                try {
                  achievements.recordEvent('scene3:final_complete', payload);
                } catch (e) {}
              }
            } catch (e) {}
          });
        });
      };
      // 确保图片已加载后再计算位移与缩放，避免 0 宽高导致动画不可见
      if (tmp.complete && tmp.naturalWidth > 0) {
        start();
      } else {
        let started = false;
        const once = () => {
          if (started) return;
          started = true;
          start();
        };
        tmp.addEventListener('load', once, { once: true });
        // 双保险：部分情况下缓存图片不会触发 load 事件
        setTimeout(once, 100);
      }
    }

    // 将 imgEl 分裂并飞向指定槽位（slotIdx 0-3），完成后调用 cb
    function animateToSlot(imgEl, slotIdx, cb) {
      const overlay = imgEl.parentElement;
      const slot = overlay.querySelector(`.split-slot[data-idx='${slotIdx}']`);
      if (!slot) {
        if (cb) cb();
        return;
      }
      // 保证 imgEl 采用 CSS '.split-temp' 绝对定位并初始居中
      imgEl.classList.add('animating');
      // 显式指定过渡时间，确保不同环境下一致
      try {
        imgEl.style.transition = `transform ${SPLIT_ANIM_MS}ms ease`;
      } catch (e) {}
      // 通过读取起点与目标槽位的矩形信息计算平移与缩放值
      const startRect = imgEl.getBoundingClientRect();
      const slotRect = slot.getBoundingClientRect();
      const overlayRect = overlay.getBoundingClientRect();
      // 计算覆盖层坐标系下：目标中心点与起始中心点
      const targetCenterX = slotRect.left + slotRect.width / 2 - overlayRect.left;
      const targetCenterY = slotRect.top + slotRect.height / 2 - overlayRect.top;
      const startCenterX = startRect.left + startRect.width / 2 - overlayRect.left;
      const startCenterY = startRect.top + startRect.height / 2 - overlayRect.top;
      // 平移增量（向量）
      const dx = targetCenterX - startCenterX;
      const dy = targetCenterY - startCenterY;
      // 缩放：根据槽位与临时图尺寸比计算（宽/高 取最小比值）
      const scale = Math.min(slotRect.width / startRect.width, slotRect.height / startRect.height);
      // 应用 transform 触发过渡动画
      imgEl.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;
      // 监听过渡结束，完成后固定在槽位
      const onEnd = (ev) => {
        if (ev.propertyName && (ev.propertyName === 'transform' || ev.propertyName === 'width')) {
          imgEl.removeEventListener('transitionend', onEnd);
          if (cb) cb();
        }
      };
      imgEl.addEventListener('transitionend', onEnd);
    }

    // 样式已抽取至全局 css/styles.css 中的 Scene 3 Nonogram 段落，不再动态注入。
    root.innerHTML = `
      <h1 class='title'>场景3：心动瞬间 <span class='puzzle-progress' style="font-size:.6em; font-weight:500; margin-left:.6em; color:#c03; vertical-align:middle;">(0/0)</span></h1>
      <div class='nonogram-shell'>
        <div class='quad corner'></div>
        <div class='quad top-clues-area'><div class='top-inner'></div></div>
        <div class='quad left-clues-area'><div class='left-inner'></div></div>
        <div class='quad grid-scroller'><div class='grid-container'></div></div>
      </div>
      <div class='controls'>
        <button class='btn-reset' data-debounce>重置</button>
        <button class='btn-hint' data-debounce>提示</button>
        ${CONFIG.showRuleHelp ? `<button class='btn-rules' data-debounce>规则说明</button>` : ''}
        <button class='btn-next hidden' data-debounce>进入下一幕</button>
        <button class='bgm-btn intro-bgm' title='好听的音乐' style='margin-left:auto;'>♪</button>
      </div>
      <div class='status-msg'></div>
      <div class='rules-overlay hidden'>
        <div class='rules-box'>
          <h2>数织规则</h2>
          <div class='rules-content'>
            <p><strong>核心元素</strong></p>
            <p>网格由固定行列组成；每格最终状态：涂色 或 留白（可标记为特殊颜色）。</p>
            <p><strong>行 / 列提示数</strong>：每个数字表示一段连续涂色块的长度；多个数字之间至少有 1 个留白格隔开。提示“0” 表示该行 / 列全部留白。</p>
            <p><strong>规则</strong></p>
            <ul>
              <li>提示顺序 = 涂色块出现顺序。</li>
              <li>相邻数字代表的涂色块之间 ≥ 1 个留白。</li>
              <li>不得多出或缺少涂色格。</li>
            </ul>
            <p><strong>提示</strong>：随机点亮一个尚未涂色的正确格；若已涂满所有应涂色格但仍未完成（说明存在多涂），随机取消一个错涂并以特殊颜色标记。</p>
            <p><strong>胜利条件</strong>：所有行与列的涂色分布与各自提示数完全匹配。</p>
            <p><strong>操作</strong>：左键=涂色/清除；右键=标记；拖拽连续涂色或擦除。</p>
          </div>
          <div class='rules-actions'><button class='close-rules'>关闭</button></div>
        </div>
      </div>
      <p class='tips'>左键：涂色/清除；右键：标记；拖拽批量操作。</p>
    `;
    this.ctx.rootEl.appendChild(root);

    const topCluesEl = root.querySelector('.top-clues-area .top-inner'); // 上提示数
    const leftCluesEl = root.querySelector('.left-clues-area .left-inner'); // 左提示数
    const gridContainer = root.querySelector('.grid-container'); // 交互网格
    const gridScroller = gridContainer.parentElement; // .grid-scroller 外层滚动容器
    // 确保网格容器层级高于分裂层，避免完成后的拼贴遮盖下一题
    try {
      gridContainer.style.position = gridContainer.style.position || 'relative';
      gridContainer.style.zIndex = '1';
    } catch (e) {}
    // 确保控件始终在最上层，避免被图片/拼贴遮挡
    try {
      const controls = root.querySelector('.controls');
      if (controls) {
        controls.style.position = controls.style.position || 'relative';
        controls.style.zIndex = '3';
      }
    } catch (e) {}
    let btnReset = root.querySelector('.btn-reset'); // 重置按钮
    let btnHint = root.querySelector('.btn-hint'); // 提示按钮
    let btnRules = root.querySelector('.btn-rules'); // 规则说明按钮
    let btnNext = root.querySelector('.btn-next'); // 下一题(下一幕)按钮

    // 无障碍兼容：确保按钮元素具有正确的 role/tabindex
    function ensureBtnAccessible(btn) {
      if (!btn) return;
      try {
        if (!btn.hasAttribute('role')) btn.setAttribute('role', 'button');
        if (!btn.hasAttribute('tabindex')) btn.setAttribute('tabindex', '0');
        if (btn.classList.contains('hidden')) btn.setAttribute('aria-hidden', 'true');
        else btn.removeAttribute('aria-hidden');
      } catch (e) {
        /* defensive */
      }
    }
    ensureBtnAccessible(btnNext);
    const statusMsg = root.querySelector('.status-msg'); // 状态消息
    const rulesOverlay = root.querySelector('.rules-overlay'); // 规则说明遮罩

    // BGM 按钮绑定：在 DOM 插入后安全执行
    try {
      const btnBgm = root.querySelector('.bgm-btn'); // BGM 切换按钮
      if (btnBgm) {
        ensureBtnAccessible(btnBgm);
        // 按照 Scene1 的模式延迟启动 BGM：播放并保存 audio 对象
        let bgmAudio;
        try {
          bgmAudio = audioManager.playSceneBGM('3', { loop: true, volume: 0.55, fadeIn: 700 });
        } catch (e) {
          console.warn('[Nonogram] 播放 BGM 失败：', e);
        }
        btnBgm.addEventListener('click', () => {
          try {
            if (bgmAudio && bgmAudio.paused) {
              bgmAudio.play().catch(() => {});
              audioManager.globalMuted = false;
              bgmAudio.muted = false;
              btnBgm.classList.remove('muted');
              return;
            }
            const muted = audioManager.toggleMute();
            btnBgm.classList.toggle('muted', muted);
          } catch (e) {
            /* defensive */
          }
        });
      }
    } catch (e) {
      /* defensive */
    }

    // 优先尝试加载预生成 JSON；失败则回退到运行时图像生成
    let puzzles = [];
    let currentIndex = 0; // 基于 0 的当前谜题索引
    // 每关的提示使用次数统计（用于触发成就 3-0）
    let hintUses = [];
    // 初始化谜题数据
    function initPuzzle() {
      if (CONFIG.puzzleSrc) {
        fetch(CONFIG.puzzleSrc, { cache: 'no-store' })
          .then((r) => {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.json();
          })
          .then((json) => {
            if (Array.isArray(json.puzzles) && json.puzzles.length > 0) {
              // 排序确保按 meta.index 顺序
              let list = json.puzzles.slice().sort((a, b) => {
                const ia = a.meta && a.meta.index ? a.meta.index : 0; // 默认 0，放前面
                const ib = b.meta && b.meta.index ? b.meta.index : 0; // 默认 0，放前面
                return ia - ib;
              });
              // 将关卡数量“写死”为 4 关，多余截断；不足则报错
              if (list.length > REQUIRED_LEVELS) list = list.slice(0, REQUIRED_LEVELS);
              if (list.length < REQUIRED_LEVELS) {
                throw new Error(
                  `[Nonogram] 本幕已固定为 4 关，但当前仅提供 ${list.length} 关。请在 data/scene3_puzzles.json 准备 4 个 puzzles。`
                );
              }
              // 强制每关必须有图片
              if (list.some((p) => !(p.meta && p.meta.image) && !p.image)) {
                throw new Error('[Nonogram] 本幕每关必须包含图片字段(meta.image 或 image)。');
              }
              puzzles = list.map((p) => ({
                meta: p.meta || {},
                matrix: p.matrix,
                image: (p.meta && p.meta.image) || p.image,
              }));
              // 初始化每关的 hint 计数
              try {
                hintUses = new Array(puzzles.length).fill(0);
              } catch (e) {
                hintUses = [];
              }
            } else if (json.matrix) {
              // 单谜题不符合“写死 4 关”需求
              throw new Error('[Nonogram] 本幕已固定为 4 关，但当前 JSON 仅包含单个 matrix。');
            } else {
              throw new Error('缺少 puzzles 或 matrix');
            }
            currentIndex = 0;
            loadCurrentPuzzle();
          })
          .catch((err) => {
            console.warn('[Nonogram] 预生成 JSON 加载失败，回退到图片生成:', err);
            runtimeImageBuild(err && err.message ? String(err.message) : undefined);
          });
      } else {
        runtimeImageBuild();
      }
    }
    function loadCurrentPuzzle() {
      if (!puzzles.length) return;
      const p = puzzles[currentIndex]; // 当前谜题
      const matrix = p.matrix;
      if (!matrix) throw new Error('当前 puzzle 缺少 matrix');
      hideSplitOverlay();
      // 清除上一题残留的完成状态类与标记
      gridContainer.classList.remove(
        'completed-locked',
        'grid-fade-out',
        'grid-jump',
        'grid-heartbeat'
      );
      delete gridContainer.dataset.animDone;
      gridContainer.style.opacity = '';
      const h = matrix.length;
      const w = matrix[0].length; // 高度与宽度
      const rowClues = buildClues(matrix); // 行线索
      const colClues = buildClues(transpose(matrix)); // 列线索
      // 准备用于完成后淡入的原始揭示图片（不触发 overlay 分裂）
      let revealImg = gridScroller.querySelector('.nonogram-reveal-img');
      if (!revealImg) {
        revealImg = document.createElement('img');
        revealImg.className = 'nonogram-reveal-img';
        // 可访问性：提供 alt 与 title（若为装饰图可设置为空 alt）
        revealImg.alt = p.meta && p.meta.title ? p.meta.title : p.image ? 'nonogram reveal' : '';
        revealImg.title = p.meta && p.meta.title ? p.meta.title : '';
        gridScroller.insertBefore(revealImg, gridScroller.firstChild); // 放在 gridContainer 前面以便位于下层
        // 基础样式：不拦截点击，绝对定位
        try {
          revealImg.style.position = revealImg.style.position || 'absolute';
          revealImg.style.pointerEvents = 'none';
        } catch (e) {}
      }
      revealImg.src = p.image || '';
      // 默认隐藏图片层，待完成动画时再展示并淡入
      revealImg.hidden = true;
      revealImg.classList.remove('show');
      try {
        delete revealImg.dataset.splitStarted;
      } catch (e) {}
      // 重置样式基线，避免上一次动画残留影响下一题
      try {
        revealImg.style.zIndex = '';
        revealImg.style.opacity = '0';
        revealImg.style.transition = `opacity ${REVEAL_FADE_MS}ms ease`;
      } catch (e) {}
      // 新题目开始时确保线索区域可见（防止上一题完成后被隐藏）
      topCluesEl.classList.remove('clues-hidden');
      leftCluesEl.classList.remove('clues-hidden');
      // 保留 split-overlay 及已放入的图片，跨题累积显示
      renderPuzzle(matrix, rowClues, colClues, w, h);
      // 更新按钮文案
      if (currentIndex < puzzles.length - 1) {
        btnNext.textContent = '下一题';
      } else {
        btnNext.textContent = '进入下一幕';
      }
      // 更新进度文本
      const progEl = root.querySelector('.puzzle-progress'); // 谜题进度文本
      if (progEl) {
        progEl.textContent = `(${currentIndex + 1}/${puzzles.length})`;
      }
      const btnNextEl = root.querySelector('.btn-next'); // 下一题按钮
      if (btnNextEl) {
        btnNextEl.classList.add('hidden');
        try {
          delete btnNextEl.dataset.ready;
        } catch (e) {}
      }
      // 移除可能残留的“回到通关页面”按钮（避免重复或旧按钮在新题加载时残留）
      try {
        const oldFinal = root.querySelector('.btn-go-final');
        if (oldFinal) oldFinal.remove();
      } catch (e) {}
      statusMsg.textContent = '';
      // 新题启用重置按钮（通过显示/隐藏控制）
      if (btnReset) btnReset.classList.remove('hidden');
      // 新题启用提示按钮
      if (btnHint) btnHint.classList.remove('hidden');
    }

    // 已移除运行时图片生成功能；编辑器现在仅使用预生成的 JSON
    function runtimeImageBuild(msg) {
      gridContainer.textContent =
        msg ||
        '本幕已固定为 4 关且每关需包含图片。请配置 data/scene3_puzzles.json（puzzles[4]，每项含 matrix 与 image）。';
    }

    initPuzzle();

    // 运行时根据图片构建数织功能已移除；仅保留通过 JSON 加载并渲染的路径。
    function renderPuzzle(matrix, rowClues, colClues, w, h) {
      // 为避免多次 addEventListener 累积，克隆按钮以清除旧监听。
      function replaceButton(oldBtn) {
        if (!oldBtn || !oldBtn.parentNode) return oldBtn;
        const wasDebouncing = !!oldBtn._debouncing || oldBtn.classList.contains('debouncing');
        const newBtn = oldBtn.cloneNode(true);
        // DOM 中替换旧按钮节点，移除旧事件监听
        oldBtn.parentNode.replaceChild(newBtn, oldBtn);
        // 清理防抖残留状态（避免克隆后仍然被视作正在防抖）
        try {
          newBtn._debouncing = false;
          newBtn.classList.remove('debouncing');
        } catch (e) {}
        // 再次补充无障碍属性
        ensureBtnAccessible(newBtn);
        return newBtn;
      }
      btnReset = replaceButton(btnReset);
      if (btnHint) btnHint = replaceButton(btnHint);
      if (btnRules) btnRules = replaceButton(btnRules);
      btnNext = replaceButton(btnNext);
      // 保证本地引用同步到最新 DOM 节点
      btnNext = root.querySelector('.btn-next');
      // 确保克隆后的按钮仍然具备无障碍属性
      ensureBtnAccessible(btnNext);
      // 统一刷新按钮后的引用（调试日志已移除）
      // rowClues / colClues 已由上层传入，避免重复声明冲突
      const sizing = autoCellSize(w, h, 640, 480, 32, 14); // 计算单元格像素尺寸（受最大/最小限制）
      gridContainer.style.setProperty('--cell-size', sizing.cell + 'px');
      renderRowClues(leftCluesEl, rowClues, sizing.cell);
      renderColClues(topCluesEl, colClues, sizing.cell);
      const api = buildGrid(
        gridContainer,
        matrix,
        (changedX, changedY) => {
          updateRowHighlight(changedY);
          updateColHighlight(changedX);

          // 计算当前填色与原矩阵的反转比例（实时检测）
          try {
            const cells = gridContainer.querySelectorAll('.cell');
            if (cells && cells.length > 0) {
              let total = 0;
              let invertedCount = 0;
              for (let yy = 0; yy < h; yy++) {
                for (let xx = 0; xx < w; xx++) {
                  total++;
                  const idx = yy * w + xx;
                  const cell = cells[idx];
                  const should = matrix[yy][xx];
                  const filled = cell && cell.classList.contains('filled');
                  if ((filled && !should) || (!filled && should)) invertedCount++;
                }
              }
              const inversionRatioNow = total > 0 ? invertedCount / total : 0;
              const completelyNow = inversionRatioNow === 1;
              if (completelyNow) {
                try {
                  achievements.recordEvent('scene3:puzzle_inverted', {
                    index: currentIndex,
                    inversionRatio: 1,
                    completelyInverted: true,
                  });
                } catch (e) {}
              }
            }
          } catch (e) {
            /* defensive */
          }

          if (checkComplete(matrix, gridContainer)) {
            statusMsg.textContent = '完成！';
            enableNextButton();
            // 在触发完成动画前，统计本次的 inversion 信息并上报成就事件
            try {
              const cells = gridContainer.querySelectorAll('.cell');
              let total = 0;
              let invertedCount = 0;
              for (let yy = 0; yy < h; yy++) {
                for (let xx = 0; xx < w; xx++) {
                  total++;
                  const idx = yy * w + xx;
                  const cell = cells[idx];
                  const should = matrix[yy][xx];
                  const filled = cell && cell.classList.contains('filled');
                  if ((filled && !should) || (!filled && should)) invertedCount++;
                }
              }
              const inversionRatio = total > 0 ? invertedCount / total : 0;
              const completelyInverted = inversionRatio === 1;
              try {
                achievements.recordEvent('scene3:puzzle_complete', {
                  index: currentIndex,
                  hintUse: Array.isArray(hintUses) ? hintUses[currentIndex] || 0 : 0,
                  inversionRatio,
                  completelyInverted,
                });
              } catch (e) {}
            } catch (e) {}

            runCompletionAnimation();
          } else {
            statusMsg.textContent = '';
          }
        },
        sizing.cell
      );
      // 提示：
      // - 若未涂满所有“应涂色”的格：随机点亮一个仍需涂色的正确格；
      // - 若已涂满所有应涂色格但仍未完成（说明存在多涂）：随机取消一个错涂并以特殊颜色“标记”。
      function revealOneCorrect() {
        if (checkComplete(matrix, gridContainer)) return; // 已完成则不再提供提示

        const missing = []; // 需要涂色但尚未涂的格（matrix=1 且 未 filled）
        const overfills = []; // 错涂的格（matrix=0 却 filled）

        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const shouldFill = matrix[y][x] === 1;
            const cellEl = gridContainer.querySelector(`.cell[data-x='${x}'][data-y='${y}']`);
            if (!cellEl) continue;
            const isFilled = cellEl.dataset.state === 'filled';
            if (shouldFill && !isFilled) {
              missing.push({ x, y, el: cellEl });
            } else if (!shouldFill && isFilled) {
              overfills.push({ x, y, el: cellEl });
            }
          }
        }

        if (missing.length > 0) {
          // 优先帮助玩家“补齐”一个正确格
          const pick = missing[Math.floor(Math.random() * missing.length)];
          pick.el.dataset.state = 'filled';
          pick.el.className = 'cell filled';
          updateRowHighlight(pick.y);
          updateColHighlight(pick.x);
        } else if (overfills.length > 0) {
          // 全部正确格已填满，但仍未完成：说明存在多填 → 随机清除一个错填并标记为 X
          const pick = overfills[Math.floor(Math.random() * overfills.length)];
          // 取消填色并标记
          pick.el.dataset.state = 'marked';
          pick.el.className = 'cell marked';
          updateRowHighlight(pick.y);
          updateColHighlight(pick.x);
        } else {
          // 理论上不会进入此分支（既无缺失也无多填但未完成），稳妥返回
          return;
        }

        if (checkComplete(matrix, gridContainer)) {
          statusMsg.textContent = '完成！';
          enableNextButton();
          runCompletionAnimation();
        }
      }

      // 统一启用进入下一幕按钮的方法，防止被克隆或属性残留导致禁用
      function enableNextButton() {
        const btn = root.querySelector('.btn-next');
        // 设置按钮 ready 状态，等待完成动画后显示
        if (!btn) return;
        // 标记按钮已准备好（ready），但不要在此处直接将其显示。
        // 显示时机由 runCompletionAnimation 在图片淡入后统一控制。
        try {
          btn.dataset.ready = '1';
        } catch (e) {}
        ensureBtnAccessible(btn);
        // 若存在全局通关印记且当前按钮为“进入下一幕”（即最后一题），在按钮旁创建并显示“回到通关页面”
        try {
          const completed =
            typeof localStorage !== 'undefined' &&
            localStorage.getItem &&
            localStorage.getItem('birthday_completed_mark') === 'true';
          // 仅当 btn 的文本为 '进入下一幕' 时才显示快速回到通关页面的按钮
          const isEnterNextScene =
            btn && btn.textContent && btn.textContent.trim() === '进入下一幕';
          if (completed && isEnterNextScene) {
            if (!root.querySelector('.btn-go-final')) {
              const btnFinal = document.createElement('button');
              btnFinal.className = 'btn-go-final';
              btnFinal.textContent = '回到通关页面';
              btnFinal.style.cssText =
                'margin-left:.6rem;padding:.5rem .9rem;border-radius:6px;background:#6ab04c;color:#fff;border:none;cursor:pointer;';
              btnFinal.addEventListener('click', () => {
                try {
                  scene.ctx.go('final');
                } catch (e) {
                  console.warn('[Nonogram] 跳转到 final 失败：', e);
                }
              });
              btn.insertAdjacentElement('afterend', btnFinal);
              ensureBtnAccessible(btnFinal);
            }
          } else {
            // 非最后一题或未通关印记时移除可能存在的快速跳转按钮
            const old = root.querySelector('.btn-go-final');
            if (old) old.remove();
          }
        } catch (e) {
          console.warn('[Nonogram] 检查通关印记时出错', e);
        }
      }

      // 完成时的动画效果（淡出 + 心跳 + 揭示图片淡入 + 分裂飞散）
      function updateRowHighlight(y) {
        const rowRuns = extractRuns(gridContainer, y, 'row');
        const el = leftCluesEl.children[y];
        if (!el) return;
        const status = evaluateRuns(rowRuns, rowClues[y]);
        el.classList.remove('clue-ok', 'clue-over', 'clue-done');
        if (status === 'ok') el.classList.add('clue-ok');
        else if (status === 'over') el.classList.add('clue-over');
      }

      // 列线索高亮更新
      function updateColHighlight(x) {
        const colRuns = extractRuns(gridContainer, x, 'col');
        const el = topCluesEl.children[x];
        if (!el) return;
        const status = evaluateRuns(colRuns, colClues[x]);
        el.classList.remove('clue-ok', 'clue-over', 'clue-done');
        if (status === 'ok') el.classList.add('clue-ok');
        else if (status === 'over') el.classList.add('clue-over');
      }
      // 初始全部刷新
      for (let y = 0; y < h; y++) updateRowHighlight(y);
      for (let x = 0; x < w; x++) updateColHighlight(x);
      btnReset.addEventListener('click', () => {
        // 若当前题已完成（动画已触发），重置无效
        if (gridContainer.dataset.animDone) return;
        api.reset();
        statusMsg.textContent = '';
        btnNext.classList.add('hidden');
        // 重置动画状态（包括新规范的心跳 / 淡出 / 图片）
        delete gridContainer.dataset.animDone;
        gridContainer.classList.remove(
          'completed-locked',
          'grid-fade-out',
          'grid-jump',
          'grid-heartbeat'
        );
        gridContainer.style.opacity = '';
        const revealImg2 = gridScroller.querySelector('.nonogram-reveal-img');
        if (revealImg2) {
          revealImg2.classList.remove('show');
          try {
            delete revealImg2.dataset.splitStarted;
          } catch (e) {}
        }
        // 不再移除 split overlay，保持已完成图片
        // 重置线索高亮
        topCluesEl.classList.remove('clues-hidden');
        leftCluesEl.classList.remove('clues-hidden');
        for (let y = 0; y < h; y++) updateRowHighlight(y);
        for (let x = 0; x < w; x++) updateColHighlight(x);
      });
      if (btnHint) {
        // 直接响应点击，按钮的可见性由 hidden 类控制
        btnHint.addEventListener('click', () => {
          try {
            hintUses[currentIndex] = (hintUses[currentIndex] || 0) + 1;
          } catch (e) {}
          revealOneCorrect();
        });
      }
      // 原图查看按钮与遮罩已移除
      if (btnRules) {
        btnRules.addEventListener('click', () => rulesOverlay.classList.remove('hidden'));
      }
      if (rulesOverlay) {
        rulesOverlay
          .querySelector('.close-rules')
          .addEventListener('click', () => rulesOverlay.classList.add('hidden'));
      }
      btnNext.addEventListener('click', () => {
        // 点击下一题或进入下一幕时的通用处理：立即移除上一题的 reveal 图片（不做淡出过渡）
        hideRevealImmediate();
        // 点击时隐藏 overlay（若存在）
        hideSplitOverlay();
        // 重置状态以便下一题使用
        topCluesEl.classList.remove('clues-hidden');
        leftCluesEl.classList.remove('clues-hidden');

        // 如果当前不是最后一题，则前往下一题；否则进入下一幕场景
        if (
          typeof currentIndex === 'number' &&
          typeof puzzles !== 'undefined' &&
          currentIndex < puzzles.length - 1
        ) {
          currentIndex++;
          if (currentIndex >= puzzles.length) currentIndex = puzzles.length - 1;
          loadCurrentPuzzle();
        } else {
          // 使用上面捕获的 scene 引用，确保 this 指向正确
          try {
            scene.ctx.go('confession');
          } catch (e) {
            console.warn('[Nonogram] 无法跳转到 confession：', e);
          }
        }
      });
    }

    // 工具函数区域 --------------------------
    function buildClues(m) {
      return m.map((row) => {
        const clues = [];
        let run = 0;
        for (const v of row) {
          if (v === 1) {
            run++;
          } else if (run > 0) {
            clues.push(run);
            run = 0;
          }
        }
        if (run > 0) clues.push(run);
        return clues.length ? clues : [0];
      });
    }

    // 矩阵转置
    function transpose(m) {
      const h = m.length,
        w = m[0].length;
      const out = Array.from({ length: w }, () => Array(h).fill(0));
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[x][y] = m[y][x];
      return out;
    }

    // ===== 新线索渲染 =====
    function renderRowClues(container, clues, cell) {
      container.innerHTML = '';
      clues.forEach((c) => {
        const div = document.createElement('div');
        div.className = 'row-clue';
        div.style.height = cell + 'px';
        div.textContent = c.join(' ');
        container.appendChild(div);
      });
    }

    // 列线索渲染
    function renderColClues(container, clues, cell) {
      container.innerHTML = '';
      const maxLen = Math.max(...clues.map((c) => c.length));
      container.style.setProperty('--cols', clues.length);
      container.style.setProperty('--cell-size', cell + 'px');
      for (let x = 0; x < clues.length; x++) {
        const col = document.createElement('div');
        col.className = 'col-clue';
        col.style.width = cell + 'px';
        const arr = clues[x];
        for (let i = 0; i < maxLen - arr.length; i++) {
          const blank = document.createElement('span');
          blank.className = 'blank';
          col.appendChild(blank);
        }
        for (const num of arr) {
          const sp = document.createElement('span');
          sp.textContent = num === 0 && arr.length === 1 ? '0' : String(num);
          col.appendChild(sp);
        }
        container.appendChild(col);
      }
    }

    // ===== 新网格构建 & 交互 =====
    function buildGrid(container, matrix, onChange, cell) {
      container.innerHTML = '';
      const h = matrix.length,
        w = matrix[0].length;
      container.style.setProperty('--rows', h);
      container.style.setProperty('--cols', w);
      container.style.gridTemplateColumns = `repeat(${w}, ${cell}px)`;
      container.style.gridTemplateRows = `repeat(${h}, ${cell}px)`;
      container.classList.add('nonogram-grid');
      // 二维 cells 数组，用于内部引用（不强制预填充）
      const cells = Array.from({ length: h }, () => new Array(w));
      let dragMode = null; // 当前拖拽模式：'fill'=填色 'erase'=清除 'mark'=标记 'unmark'=去标记
      let mouseDown = false;
      container.addEventListener('contextmenu', (e) => e.preventDefault());

      // 根据当前 dragMode 应用对应操作
      function applyAction(cDiv) {
        if (!cDiv) return;
        const st = cDiv.dataset.state || ''; // 当前格状态
        if (dragMode === null) {
          // 第一次按下时决定具体模式（根据起始格状态推断）
          if (st === 'filled') dragMode = 'erase';
          else if (st === 'marked') dragMode = 'unmark';
          else dragMode = 'fill';
        }
        if (dragMode === 'fill') setFilled(cDiv, true);
        else if (dragMode === 'erase') setFilled(cDiv, false);
        else if (dragMode === 'mark') setMarked(cDiv, true);
        else if (dragMode === 'unmark') setMarked(cDiv, false);
      }

      // 设置格子为填色或清除
      function setFilled(cellDiv, val) {
        if (val) {
          cellDiv.dataset.state = 'filled';
          cellDiv.className = 'cell filled';
        } else {
          cellDiv.dataset.state = '';
          cellDiv.className = 'cell';
        }
      }

      // 设置格子为标记或取消标记
      function setMarked(cellDiv, val) {
        if (val) {
          cellDiv.dataset.state = 'marked';
          cellDiv.className = 'cell marked';
        } else {
          cellDiv.dataset.state = '';
          cellDiv.className = 'cell';
        }
      }

      // 处理鼠标或触摸拖拽
      function handlePointer(e) {
        if (!mouseDown) return;
        const target = e.target.closest('.cell');
        if (target) {
          applyAction(target);
          onChange(+target.dataset.x, +target.dataset.y);
        }
      }
      window.addEventListener('mouseup', () => {
        mouseDown = false;
        dragMode = null;
      });
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const div = document.createElement('div');
          div.className = 'cell';
          div.style.width = div.style.height = cell + 'px';
          div.dataset.x = x;
          div.dataset.y = y;
          div.addEventListener('mousedown', (e) => {
            mouseDown = true;
            if (e.button === 2) {
              dragMode = div.dataset.state === 'marked' ? 'unmark' : 'mark';
              applyAction(div);
            } else if (e.button === 0) {
              dragMode = null; // 置空以便 applyAction 自动推断
              applyAction(div);
            }
            onChange(x, y);
          });
          div.addEventListener('mouseenter', handlePointer);
          div.addEventListener('touchstart', (e) => {
            e.preventDefault();
            dragMode = null;
            applyAction(div);
            onChange(x, y);
          });
          cells[y][x] = div;
          container.appendChild(div);
        }
      }
      return {
        reset() {
          for (let y = 0; y < h; y++)
            for (let x = 0; x < w; x++) {
              const c = cells[y][x];
              c.dataset.state = '';
              c.className = 'cell';
            }
        },
      };
    }

    // 评估当前行/列的 runs 相对 clue 的状态
    function autoCellSize(w, h, maxW, maxH, maxCell, minCell) {
      // 策略：在给定显示最大宽高范围内求单元格合适边长（夹在最小/最大像素之间）
      let cell = Math.floor(Math.min(maxCell, Math.max(minCell, Math.min(maxW / w, maxH / h))));
      return { cell };
    }

    // 检查当前填色是否完成（完全匹配 matrix）
    function checkComplete(solution, container) {
      for (const cell of container.querySelectorAll('.cell')) {
        const x = +cell.dataset.x,
          y = +cell.dataset.y;
        const shouldFill = solution[y][x] === 1;
        const isFilled = cell.dataset.state === 'filled';
        if (shouldFill && !isFilled) return false; // 必须填的没填
        if (!shouldFill && isFilled) return false; // 多填
      }
      return true;
    }

    // 简化完成动画：锁定 -> 网格淡出 -> 图片淡入
    function runCompletionAnimation() {
      if (gridContainer.dataset.animDone) return;
      gridContainer.dataset.animDone = '1';
      const GRID_FADE_DURATION = 600; // 网格淡出耗时（毫秒）
      gridContainer.classList.add('completed-locked', 'grid-fade-out');
      // 完成后隐藏重置和提示按钮（不再使用 disabled）
      if (btnReset) {
        btnReset.classList.add('hidden');
        ensureBtnAccessible(btnReset);
      }
      if (btnHint) {
        btnHint.classList.add('hidden');
        ensureBtnAccessible(btnHint);
      }
      const revealImg = gridScroller.querySelector('.nonogram-reveal-img');
      // 若存在有效图片则安排淡入，否则直接解锁“下一题”按钮
      setTimeout(() => {
        if (revealImg && revealImg.getAttribute('src')) {
          // 显示图片时隐藏数字线索以突出图像
          topCluesEl.classList.add('clues-hidden');
          leftCluesEl.classList.add('clues-hidden');
          // 提升揭示图片层级，保证淡入可见
          try {
            revealImg.style.zIndex = '2';
          } catch (e) {}
          // 在开始淡入前设置过渡并取消 hidden，使其参与过渡
          try {
            revealImg.style.transition = `opacity ${REVEAL_FADE_MS}ms ease`;
          } catch (e) {}
          revealImg.hidden = false;
          // 强制一次 reflow，确保接下来的 opacity 过渡不会被合并
          void revealImg.offsetHeight;
          revealImg.classList.add('show');
          // 同步设置目标不透明，确保 transition 有实际变化
          try {
            revealImg.style.opacity = '1';
          } catch (e) {}
          // 图片淡入结束后启动“分裂→四角缩放定位”动画
          try {
            if (!revealImg.dataset.splitStarted) {
              let fired = false;
              const go = () => {
                if (fired) return;
                fired = true;
                try {
                  revealImg.dataset.splitStarted = '1';
                } catch (e) {}
                // 图片淡入完成：显示 overlay（hidden=false），随后执行分裂动画
                try {
                  const ov = ensureSplitOverlay();
                  if (ov) {
                    ov.hidden = false;
                    requestAnimationFrame(() => {
                      try {
                        ov.style.opacity = '1';
                        ov.style.transition = '';
                      } catch (e) {}
                    });
                  }
                } catch (e) {}
                // 启动分裂并在移动到角落动画结束时通过 doneCb 显示下一题按钮
                startSplitForSrc(revealImg.getAttribute('src'), showNextButtonDelayed);
              };
              const onTrans = (ev) => {
                if (!ev || ev.propertyName === 'opacity') {
                  revealImg.removeEventListener('transitionend', onTrans);
                  clearTimeout(fallbackTimer);
                  go();
                }
              };
              revealImg.addEventListener('transitionend', onTrans);
              // 兜底：部分设备/样式下可能不会触发 transitionend
              const fallbackTimer = setTimeout(go, REVEAL_FADE_MS + 150);
            }
          } catch (e) {
            /* defensive */
          }
        }
        // 淡出/淡入流程结束后再次显示“下一题”按钮
        // 要求：若有揭示图片，则在图片 opacity 过渡结束后再延迟 200ms 显示；否则保留原超时行为
        const btn = root.querySelector('.btn-next');
        // 完成动画结束后调度显示下一题按钮
        if (!btn) return;
        // Helper：在 200ms 后显示按钮（仅当其被标记为 ready）
        const showNextButtonDelayed = () => {
          try {
            setTimeout(() => {
              try {
                const b = root.querySelector('.btn-next');
                if (b && b.dataset && b.dataset.ready === '1') b.classList.remove('hidden');
              } catch (e) {}
            }, 200);
          } catch (e) {}
        };
        try {
          // 显示时机：若存在揭示图片，则 showNextButtonDelayed 已在 startSplitForSrc 的 doneCb 中被调用。
          // 否则立即在未有图片的路径下显示（前提：按钮已标记为 ready）。
          if (!(revealImg && revealImg.getAttribute && revealImg.getAttribute('src'))) {
            try {
              if (btn.dataset && btn.dataset.ready === '1') btn.classList.remove('hidden');
            } catch (e) {}
          }
        } catch (e) {
          console.warn('[Nonogram] scheduling btnNext show failed', e);
          try {
            btn.classList.remove('hidden');
          } catch (e) {}
        }
      }, GRID_FADE_DURATION);
    }

    // 提取当前行/列的填色 runs 数组
    function extractRuns(grid, index, mode) {
      const cells = [];
      if (mode === 'row') {
        cells.push(...grid.querySelectorAll(`.cell[data-y='${index}']`));
        cells.sort((a, b) => +a.dataset.x - +b.dataset.x);
      } else {
        cells.push(...grid.querySelectorAll(`.cell[data-x='${index}']`));
        cells.sort((a, b) => +a.dataset.y - +b.dataset.y);
      }
      const runs = [];
      let run = 0;
      for (const c of cells) {
        if (c.dataset.state === 'filled') {
          run++;
        } else if (run > 0) {
          runs.push(run);
          run = 0;
        }
      }
      if (run > 0) runs.push(run);
      return runs.length ? runs : [0];
    }
    // 数组内容完全相等（长度与每项均相等）
    function arraysEqual(a, b) {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
      return true;
    }
    // 评估当前填色 runs 相对 clue 的状态: ok | over | partial
    function evaluateRuns(runs, clues) {
      // 特殊：空行表示 [0]
      if (runs.length === 1 && runs[0] === 0) {
        if (clues.length === 1 && clues[0] === 0) return 'ok';
        return 'partial';
      }
      const sumRuns = runs.reduce((a, b) => a + b, 0);
      const sumClues = clues.reduce((a, b) => a + b, 0);
      // 基本超限：段过多 / 总和超
      if (runs.length > clues.length) return 'over';
      if (sumRuns > sumClues) return 'over';
      // 若已完全匹配（顺序长度都一致）直接 ok
      if (arraysEqual(runs, clues)) return 'ok';
      // 允许当前 runs 对应 clues 的一个保持顺序的子序列
      // 贪心：对每个 run 找到下一个 >= run 的 clue
      let ci = 0; // 线索数组当前尝试匹配的位置指针
      for (const r of runs) {
        let found = false;
        while (ci < clues.length) {
          if (clues[ci] >= r) {
            found = true;
            ci++;
            break;
          }
          ci++; // 跳过更短的 clue（因为该 clue 不可能再满足 r）
        }
        if (!found) return 'over'; // 找不到可容纳该 run 的 clue => 超出
        if (r > Math.max(...clues)) return 'over'; // 防御：比所有 clue 都大
      }
      // 通过子序列匹配，尚未违规 => partial
      return 'partial';
    }
  }
  async exit() {
    audioManager.stopBGM('3', { fadeOut: 500 });
  }
}
