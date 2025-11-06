import { BaseScene } from '../core/baseScene.js';
import { audioManager } from '../core/audioManager.js';

/**
 * 场景4：推箱子
 * 基本规则：玩家( @ ) 用方向键推动箱子( $ ) 到目标点( . ) 上。箱子在目标上显示 * ，玩家在目标上显示 +。
 */
import { achievements } from '../core/achievements.js';

export class Scene4Confession extends BaseScene {
  async enter() {
    const el = document.createElement('div');
    el.className = 'scene scene-confession scene-sokoban';
    el.innerHTML = `
      <h1>场景4：推箱子</h1>
      <div class='soko-wrapper'>
        <div class='soko-grid'></div>
      </div>
  <div style='display:flex;align-items:center;gap:.8rem;margin-top:.8rem;'>
    <button class='bgm-btn confession-bgm' title='音乐' data-debounce style='width:46px;height:36px;font-size:.95rem;'>♪</button>
  <button class='reset-btn hint-btn' data-debounce>提示</button>
    <button class='reset-btn' data-debounce>重置关卡</button>
        <div class='info' style='color:#444;font-size:.9rem;'></div>
        <div style='margin-left:auto;'>
          <button class='go-next' data-debounce style='display:none;'>进入下一幕</button>
        </div>
      </div>
    `;
    this.applyNoSelect(el);

    const gridEl = el.querySelector('.soko-grid');
    const infoEl = el.querySelector('.info');
    const headerEl = el.querySelector('h1');
    // 明确选择没有 .hint-btn 类的重置按钮，避免误选提示按钮
    const resetBtn = el.querySelector('button.reset-btn:not(.hint-btn)');
    const nextBtn = el.querySelector('.go-next');
    const bgmBtn = el.querySelector('.confession-bgm');
    const hintBtn = el.querySelector('.hint-btn');

    // --- 样式注入（若不存在） ---
    if (!document.getElementById('soko-style')) {
      const st = document.createElement('style');
      st.id = 'soko-style';
      st.textContent = `
    .soko-grid{display:inline-grid;gap:6px;background:#f7fafc;padding:10px;border-radius:10px;box-shadow:0 6px 18px rgba(10,20,40,.06);}
    .soko-cell{width:48px;height:48px;display:flex;align-items:center;justify-content:center;border-radius:8px;user-select:none;position:relative;transition:background .12s ease,transform .12s ease;overflow:hidden}
  .soko-wall{background-color:#2f3a45;color:#fff;box-shadow:inset 0 -3px rgba(0,0,0,.12);background-image:url('./assets/images/Wall.png');background-size:cover;background-position:center}
  .soko-floor{background-color:#ffffff;border:1px solid #eef2f5;background-image:url('./assets/images/Ground.png');background-size:cover;background-position:center}
  /* 目标格：底层仍用地面贴图，端点图作为上层叠加 */
  .soko-target{background-color:#fff7e6;border:1px dashed #ffd58a;background-image:url('./assets/images/Ground.png');background-size:cover;background-position:center}
  /* 第四关使用冰面贴图覆盖（注意：第四关索引为 3） */
  .scene-sokoban.level-4 .soko-floor{background-image:url('./assets/images/Ground_Ice.png')}
  .scene-sokoban.level-4 .soko-target{background-image:url('./assets/images/Ground_Ice.png')}
  /* 标记覆盖样式：在标记位置将地板/目标替换为 Ground_Mark.png */
  .soko-floor.marked, .soko-target.marked { background-image: url('./assets/images/Ground_Mark.png') !important; background-size: cover; background-position: center }
  .soko-target::after{content:'';position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:28px;height:28px;background-image:url('./assets/images/EndPoint_Gray.png');background-repeat:no-repeat;background-size:contain;z-index:1;pointer-events:none}
  /* 当使用彩色端点时隐藏默认灰色伪元素 */
  .soko-target.has-colored-endpoint::after{background-image:none}
  .soko-box{}
  .soko-player{}
    .scene-sokoban .go-next{animation:pulseNext 1s ease-in-out infinite alternate}
    @keyframes pulseNext{from{transform:translateY(0)}to{transform:translateY(-3px)}}
    .soko-hint-modal{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:1000}
    .soko-hint-modal .inner{background:#ffffff;padding:18px 22px;max-width:520px;width:92%;line-height:1.6;border-radius:12px;box-shadow:0 10px 30px rgba(10,20,40,.08);font-size:14px;color:#333}
    .soko-hint-modal h2{margin:0 0 .6rem;font-size:20px}
    .soko-hint-modal ul{margin:.2rem 0 .8rem;padding-left:1.1rem}
    .soko-hint-modal li{margin:.25rem 0}
    .soko-toast{position:fixed;left:50%;transform:translateX(-50%);bottom:18px;background:rgba(0,0,0,0.88);color:#fff;padding:10px 14px;border-radius:10px;z-index:1100;font-size:13px;box-shadow:0 10px 30px rgba(10,20,40,.12)}
    .soko-toast.show{opacity:1;transition:opacity .24s ease}
    .soko-toast.hide{opacity:0;transition:opacity .24s ease}
  /* 提示按钮使用与 reset-btn 相同的样式，取消独立外观 */
    /* 视觉重设计：箱子/玩家/目标的图形化样式与小动画 */
    .soko-cell{position:relative}
  .box-inner{width:34px;height:34px;border-radius:6px;background-image:url('./assets/images/Crate_Gray.png');background-size:cover;background-position:center;box-shadow:0 6px 12px rgba(0,0,0,.08);transition:transform .12s ease,box-shadow .12s ease;display:flex;align-items:center;justify-content:center;position:relative;z-index:2}
  .box-inner.on-target{background-image:url('./assets/images/CrateDark_Gray.png');box-shadow:0 8px 16px rgba(0,0,0,.08);transform:scale(1.06)}
  .player-inner{width:36px;height:36px;border-radius:50%;background:linear-gradient(180deg,#6fb8ff,#2b8bff);box-shadow:0 8px 18px rgba(43,139,255,.12);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;transition:transform .12s ease;position:relative;z-index:2}
  .player-inner.on-target{outline:2px solid rgba(43,139,255,.14)}
    .soko-cell .box-inner,.soko-cell .player-inner{display:flex;align-items:center;justify-content:center}
    .soko-cell.move-anim{transition:transform .14s ease}
  .box-inner.moving{pointer-events:none;will-change:transform;}
      `;
      document.head.appendChild(st);
    }
    // 确保 grid 的定位上下文用于绝对定位动画层
    try {
      gridEl.style.position = 'relative';
    } catch (er) {}

    // 动画状态标记（防止并发移动）
    let animating = false;

    // 获取格子 DOM（按行主序存放）
    function getCellEl(r, c) {
      if (!map || !map[0]) return null;
      const cols = map[0].length;
      const idxChild = r * cols + c;
      return gridEl.children[idxChild] || null;
    }

    // 动画化箱子移动：从 (fr,fc) 到 (tr,tc)，完成后调用 cb
    function animateBoxMove(fr, fc, tr, tc, cb) {
      const fromCell = getCellEl(fr, fc);
      const toCell = getCellEl(tr, tc);
      if (!fromCell || !toCell) {
        cb && cb();
        return;
      }
      const bi = fromCell.querySelector('.box-inner');
      if (!bi) {
        cb && cb();
        return;
      }
      animating = true;
      // 克隆视觉元素作为动画层
      const animEl = bi.cloneNode(true);
      animEl.classList.add('moving');
      // 使动画元素绝对定位并放到与 grid 同一容器
      animEl.style.position = 'absolute';
      // 使用 getBoundingClientRect 以避免布局差异导致的位置错位，转换为相对于 gridEl 的坐标
      const gridRect = gridEl.getBoundingClientRect();
      const fromRect = fromCell.getBoundingClientRect();
      const toRect = toCell.getBoundingClientRect();
      const left = fromRect.left - gridRect.left;
      const top = fromRect.top - gridRect.top;
      animEl.style.left = `${left}px`;
      animEl.style.top = `${top}px`;
      animEl.style.width = `${fromRect.width}px`;
      animEl.style.height = `${fromRect.height}px`;
      animEl.style.margin = '0';
      animEl.style.zIndex = '1200';
      // 隐藏原位的箱子视觉，避免重影
      bi.style.visibility = 'hidden';
      gridEl.appendChild(animEl);
      // 将玩家视觉从原位置移动到推箱子后的前置格（fr,fc）
      try {
        const playerOldCell = getCellEl(player.r, player.c);
        const playerEl = playerOldCell && playerOldCell.querySelector('.player-inner');
        if (playerEl) {
          // 移除并放入前格
          try {
            playerOldCell.removeChild(playerEl);
          } catch (er) {}
          // 确保前格上层玩家可见
          try {
            fromCell.appendChild(playerEl);
          } catch (er) {}
        }
      } catch (er) {}

      // 触发布局，然后平移到目标位置
      requestAnimationFrame(() => {
        const dx = toRect.left - fromRect.left;
        const dy = toRect.top - fromRect.top;
        // 初始状态
        animEl.style.transform = `translate(0px, 0px)`;
        // 强制回流以保证后续 transition 能触发
        // eslint-disable-next-line no-unused-expressions
        animEl.offsetWidth;
        animEl.style.transition = 'transform .34s cubic-bezier(.2,.9,.2,1)';
        // 目标位移（相对于 animEl 初始位置）
        animEl.style.transform = `translate(${dx}px, ${dy}px)`;
        const cleanup = () => {
          try {
            animEl.removeEventListener('transitionend', cleanup);
          } catch (e) {}
          try {
            animEl.remove();
          } catch (e) {}
          // 恢复可能隐藏的视觉元素（render 会重建，但尽量清理旧样式）
          try {
            const maybeBi = fromCell.querySelector('.box-inner');
            if (maybeBi) maybeBi.style.visibility = '';
          } catch (e) {}
          animating = false;
          cb && cb();
        };
        animEl.addEventListener('transitionend', cleanup);
        // 保险：在 400ms 后强制清理（防止 transitionend 未触发）
        setTimeout(() => {
          if (animating) cleanup();
        }, 450);
      });
    }

    // --- 关卡数据（从外部 JSON 加载；# 表示墙, @ 玩家, $ 箱子, . 目标, * 箱子在目标, + 玩家在目标, 空格 floor） ---
    // 从外部关卡文件加载（多关卡格式）
    // 期望文件结构： { "levels": [ [ ["#",...], ... ], ... ] }
    const res = await fetch('./data/scene4_sokoban.json', { cache: 'no-cache' });
    const json = await res.json();
    const levels =
      json && Array.isArray(json.levels) ? json.levels : Array.isArray(json) ? json : [];
    // 允许通过 this.ctx.params.levelIndex 或 this.levelIndex 指定要加载的关卡（可选），默认 0
    let levelIndex = 0;
    try {
      if (this && this.ctx && this.ctx.params && typeof this.ctx.params.levelIndex === 'number')
        levelIndex = this.ctx.params.levelIndex;
      else if (typeof this.levelIndex === 'number') levelIndex = this.levelIndex;
    } catch (e) {
      /* ignore */
    }
    // 支持两种关卡格式：简单二维数组，或 { map: [...], type: 'step-limit'|'standard', config: {...} }
    let rawMap = levels[levelIndex] || levels[0];
    let levelType = 'standard';
    let config = {};
    const levelData = levels[levelIndex] || levels[0];
    if (levelData && !Array.isArray(levelData) && levelData.map) {
      rawMap = levelData.map;
      levelType = levelData.type || 'standard';
      config = levelData.config || {};
    }

    // 解析地图
    let map = []; // 存放类型: wall / floor / target
    let boxes = new Set(); // 'r,c'
    let targets = new Set();
    // 彩色映射（仅在特定关卡使用）
    let boxColorMap = new Map(); // key -> 'Red'|'Blue'|'Yellow'
    let targetColorMap = new Map();
    let player = { r: 0, c: 0 };
    // 冰面关卡：标记系统（marker）
    let marker = null; // {r,c} or null

    // 步数限制支持
    let moveCount = 0;
    let maxMoves = typeof config.maxMoves === 'number' ? config.maxMoves : null;
    let movesDisabled = false;
    // 控制锁（用于通关或失败后禁用移动按键）
    let controlsLocked = false;
    // 监听状态标志，避免重复绑定
    let keyHandlerBound = false;
    let spaceHandlerBound = false;

    function updateInfo() {
      if (levelType === 'step-limit' && maxMoves != null) {
        infoEl.textContent = `步数：${moveCount} / ${maxMoves}`;
      }
    }

    // 将 marker 渲染到格子上（render 中会读取此变量）
    function placeMarker() {
      if (!config || !config.maxMarkers) return;
      if (marker) return; // 已有标记
      const key = idx(player.r, player.c);
      // 不能放在箱子或墙上
      if (boxes.has(key) || isWall(player.r, player.c)) return;
      marker = { r: player.r, c: player.c };
      render();
    }
    function removeMarker() {
      if (!marker) return;
      marker = null;
      render();
    }

    // 滑行算法：从 r,c 持续移动直到碰到墙、箱子或标记
    function slideBox(sr, sc, dr, dc) {
      let r = sr,
        c = sc;
      // If the box is already on the marker, stop immediately
      if (marker && marker.r === r && marker.c === c) return { r, c };
      while (true) {
        const nr = r + dr,
          nc = c + dc;
        // stop if next cell is a wall
        if (isWall(nr, nc)) break;
        const nk = idx(nr, nc);
        // stop if another box blocks
        if (boxes.has(nk)) break;
        // if the next cell is the marker, move into it and then stop
        if (marker && marker.r === nr && marker.c === nc) {
          r = nr;
          c = nc;
          break;
        }
        r = nr;
        c = nc;
      }
      return { r, c };
    }

    // 简单的 toast 提示（自动消失）
    function showToast(text, duration = 2200) {
      // 若已存在则先移除
      const existing = document.querySelector('.soko-toast');
      if (existing)
        try {
          existing.remove();
        } catch (e) {}
      const t = document.createElement('div');
      t.className = 'soko-toast show';
      t.textContent = text;
      document.body.appendChild(t);
      setTimeout(() => {
        try {
          t.className = 'soko-toast hide';
        } catch (e) {}
        setTimeout(() => {
          try {
            t.remove();
          } catch (e) {}
        }, 300);
      }, duration);
    }

    // 设置当前关卡（切换用）
    const setLevel = (idx) => {
      levelIndex = idx;
      const ld = levels[levelIndex] || levels[0];
      if (ld && !Array.isArray(ld) && ld.map) {
        rawMap = ld.map;
        levelType = ld.type || 'standard';
        config = ld.config || {};
      } else {
        rawMap = ld;
        levelType = 'standard';
        config = {};
      }
      // reset step-limit state
      moveCount = 0;
      maxMoves = typeof config.maxMoves === 'number' ? config.maxMoves : null;
      movesDisabled = false;
      // ensure reset button enabled when entering a level
      try {
        resetBtn.disabled = false;
        resetBtn.setAttribute('aria-disabled', 'false');
      } catch (e) {}
      // 立即更新并在需要时显示提示（例如步数限制关卡）
      updateInfo();
      if (levelType === 'step-limit' && maxMoves != null) {
        showToast(`本关有步数限制：最多 ${maxMoves} 步`);
      }
      // 根据关卡索引为场景根元素添加/移除 level-4 类（第四关索引为 3）
      try {
        if (levelIndex === 3) el.classList.add('level-4');
        else el.classList.remove('level-4');
      } catch (er) {}
      // 更新标题为关卡名（如果存在）
      try {
        if (ld && ld.name) headerEl.textContent = `场景4：推箱子 — ${ld.name}`;
        else headerEl.textContent = '场景4：推箱子';
      } catch (er) {}
    };

    const idx = (r, c) => `${r},${c}`;

    // 空格键处理器：当 nextBtn 可见时触发下一关/进入下一幕
    const spaceHandler = (e) => {
      const isSpace = e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar';
      if (!isSpace) return;
      if (nextBtn && nextBtn.style && nextBtn.style.display !== 'none') {
        e.preventDefault();
        nextBtn.click();
      }
    };

    function loadLevel() {
      map = [];
      boxes.clear();
      targets.clear();
      boxColorMap.clear();
      targetColorMap.clear();
      // 清除关卡内的标记，确保重置/加载关卡后标记立即消失
      marker = null;
      // 每行必须为字符数组（二维数组格式），不再兼容字符串形式；非数组将抛出错误以便尽早发现数据格式问题
      rawMap.forEach((line, r) => {
        if (!Array.isArray(line)) {
          throw new Error(
            `Scene4: expected map row to be an array of chars at row ${r}, got ${typeof line}`
          );
        }
        const row = [];
        const chars = line;
        for (let c = 0; c < chars.length; c++) {
          // 每一行按字符数组处理
          const ch = chars[c];
          switch (ch) {
            case '#':
              row.push('wall');
              break;
            case '.':
              row.push('target');
              targets.add(idx(r, c));
              break;
            case '$':
              row.push('floor');
              boxes.add(idx(r, c));
              break;
            case '*':
              row.push('target');
              boxes.add(idx(r, c));
              targets.add(idx(r, c));
              break;
            case '@':
              row.push('floor');
              player = { r, c };
              break;
            case '+':
              row.push('target');
              player = { r, c };
              targets.add(idx(r, c));
              break;
            default:
              row.push('floor');
              break;
          }
        }
        map.push(row);
      });

      // 优先使用外部关卡提供的 colorMap（如果有），否则在第三关使用自动分配
      try {
        const ld = levels[levelIndex] || levels[0];
        if (ld && ld.colorMap) {
          const cm = ld.colorMap || {};
          if (cm.targets) {
            for (const key of Object.keys(cm.targets)) {
              try {
                targetColorMap.set(key, cm.targets[key]);
              } catch (er) {}
            }
          }
          if (cm.boxes) {
            for (const key of Object.keys(cm.boxes)) {
              try {
                boxColorMap.set(key, cm.boxes[key]);
              } catch (er) {}
            }
          }
        } else if (levelIndex === 2) {
          const colors = ['Red', 'Blue', 'Yellow'];
          let i = 0;
          for (const t of targets) {
            const color = colors[i % colors.length];
            targetColorMap.set(t, color);
            i += 1;
          }
          // 若箱子位于目标上，继承目标颜色
          for (const b of boxes) {
            if (targetColorMap.has(b)) boxColorMap.set(b, targetColorMap.get(b));
          }
          // 对剩余箱子循环分配颜色
          let j = 0;
          for (const b of boxes) {
            if (!boxColorMap.has(b)) {
              boxColorMap.set(b, colors[j % colors.length]);
              j += 1;
            }
          }
        }
      } catch (er) {
        console.warn('color mapping error', er);
      }
    }

    function isWall(r, c) {
      return map[r] && map[r][c] === 'wall';
    }
    function isTarget(r, c) {
      return map[r] && map[r][c] === 'target';
    }

    function render() {
      const rows = map.length,
        cols = map[0].length;
      gridEl.style.gridTemplateColumns = `repeat(${cols}, 48px)`;
      gridEl.innerHTML = '';
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const k = idx(r, c);
          const cell = document.createElement('div');
          cell.className = 'soko-cell';
          // 基底
          if (map[r][c] === 'wall') cell.classList.add('soko-wall');
          else if (isTarget(r, c)) cell.classList.add('soko-target');
          else cell.classList.add('soko-floor');

          const hasBox = boxes.has(k);
          const isPlayer = player.r === r && player.c === c;
          // 清理内部（防止重复插入）
          // 为不同类型的内容插入专用视觉元素
          if (hasBox) {
            cell.classList.add('soko-box');
            const bi = document.createElement('div');
            bi.className = 'box-inner' + (isTarget(r, c) ? ' on-target' : '');
            // 第三关使用彩色贴图：仅当箱子颜色与目标颜色匹配时才使用暗色贴图
            if (levelIndex === 2) {
              const boxColor = boxColorMap.get(k) || null;
              if (boxColor) {
                if (isTarget(r, c)) {
                  const required = targetColorMap.get(k) || null;
                  if (required && boxColor === required) {
                    bi.style.backgroundImage = `url('./assets/images/CrateDark_${boxColor}.png')`;
                  } else {
                    bi.style.backgroundImage = `url('./assets/images/Crate_${boxColor}.png')`;
                  }
                } else {
                  bi.style.backgroundImage = `url('./assets/images/Crate_${boxColor}.png')`;
                }
                bi.style.backgroundSize = 'cover';
                bi.style.backgroundPosition = 'center';
              } else {
                // 若箱子本身无色，尝试使用目标色（例如刚生成在目标上的箱子）
                const color = targetColorMap.get(k) || null;
                if (color) {
                  const img = isTarget(r, c)
                    ? `./assets/images/CrateDark_${color}.png`
                    : `./assets/images/Crate_${color}.png`;
                  bi.style.backgroundImage = `url('${img}')`;
                  bi.style.backgroundSize = 'cover';
                  bi.style.backgroundPosition = 'center';
                }
              }
            } else {
              // 非第三关沿用灰色资源
              const img = isTarget(r, c)
                ? `./assets/images/CrateDark_Gray.png`
                : `./assets/images/Crate_Gray.png`;
              bi.style.backgroundImage = `url('${img}')`;
              bi.style.backgroundSize = 'cover';
              bi.style.backgroundPosition = 'center';
            }
            cell.appendChild(bi);
          }
          if (isPlayer) {
            cell.classList.add('soko-player');
            const pi = document.createElement('div');
            pi.className = 'player-inner' + (isTarget(r, c) ? ' on-target' : '');
            cell.appendChild(pi);
          }
          // 若目标有颜色映射，插入彩色端点覆盖层并禁用默认伪元素
          if (isTarget(r, c)) {
            const tcolor = targetColorMap.get(k) || null;
            if (tcolor) {
              cell.classList.add('has-colored-endpoint');
              const overlay = document.createElement('div');
              overlay.style.position = 'absolute';
              overlay.style.left = '50%';
              overlay.style.top = '50%';
              overlay.style.transform = 'translate(-50%, -50%)';
              overlay.style.width = '28px';
              overlay.style.height = '28px';
              overlay.style.backgroundImage = `url('./assets/images/EndPoint_${tcolor}.png')`;
              overlay.style.backgroundRepeat = 'no-repeat';
              overlay.style.backgroundSize = 'contain';
              overlay.style.zIndex = '1';
              overlay.style.pointerEvents = 'none';
              cell.appendChild(overlay);
            }
          }
          // 若当前位置为标记位置，则给格子添加 marked 类以使用 Ground_Mark.png 覆盖
          if (marker && marker.r === r && marker.c === c) {
            cell.classList.add('marked');
          }
          gridEl.appendChild(cell);
        }
      }
      return checkWin();
    }

    function move(dr, dc) {
      if (movesDisabled) return;
      const nr = player.r + dr;
      const nc = player.c + dc;
      // 墙阻挡
      if (isWall(nr, nc)) return;
      const frontKey = idx(nr, nc);
      const pushing = boxes.has(frontKey);
      if (!pushing) {
        player.r = nr;
        player.c = nc;
        // 记录步数
        if (levelType === 'step-limit' && maxMoves != null) {
          moveCount += 1;
        }
        // 先渲染并检查是否通关
        const won = render();
        if (won) return;
        updateInfo();
        // 检查是否达到或超出步数上限（未通关视为失败）
        if (levelType === 'step-limit' && maxMoves != null && moveCount >= maxMoves) {
          movesDisabled = true;
          showToast(`步数超限（${moveCount} / ${maxMoves}），请重置关卡重试。`);
          try {
            infoEl.textContent = '';
          } catch (e) {}
          detachKeys();
        }
        return;
      }
      // 推动箱子：看下一个格子
      let br = nr + dr,
        bc = nc + dc;
      if (isWall(br, bc) || boxes.has(idx(br, bc))) return; // 被阻挡
      // 若为冰面关，执行滑行逻辑
      let finalPos = { r: br, c: bc };
      try {
        if (levelType === 'ice-sliding' || (config && config.slideEnabled)) {
          const slid = slideBox(br, bc, dr, dc);
          finalPos = { r: slid.r, c: slid.c };
        }
      } catch (er) {}
      const newKey = idx(finalPos.r, finalPos.c);
      // 动画化箱子移动（仅在滑行/冰面时）: 先在视觉上移动箱子，动画完成后再更新逻辑数据并渲染
      const doUpdate = () => {
        boxes.delete(frontKey);
        // 迁移颜色映射（若存在）
        try {
          if (boxColorMap.has(frontKey)) {
            const col = boxColorMap.get(frontKey);
            boxColorMap.delete(frontKey);
            boxColorMap.set(newKey, col);
          } else if (targetColorMap.has(newKey)) {
            // 如果目标格有颜色，为箱子赋予目标颜色
            boxColorMap.set(newKey, targetColorMap.get(newKey));
          }
          boxes.add(newKey);
        } catch (er) {
          boxes.add(newKey);
        }
        // 玩家前进
        player.r = nr;
        player.c = nc;
        // 记录步数（推动也算一步）
        if (levelType === 'step-limit' && maxMoves != null) {
          moveCount += 1;
        }
        // 先渲染并检测是否通关
        const wonPush = render();
        if (wonPush) return;
        updateInfo();
        if (levelType === 'step-limit' && maxMoves != null && moveCount >= maxMoves) {
          movesDisabled = true;
          showToast(`步数超限（${moveCount} / ${maxMoves}），请重置关卡重试。`);
          try {
            infoEl.textContent = '';
          } catch (e) {}
          detachKeys();
        }
      };

      // 若为冰面或 slideEnabled，且滑行距离大于 0，则先动画化箱子
      if (
        (levelType === 'ice-sliding' || (config && config.slideEnabled)) &&
        (finalPos.r !== br || finalPos.c !== bc)
      ) {
        // 动画期间禁止输入
        animating = true;
        animateBoxMove(br, bc, finalPos.r, finalPos.c, () => {
          animating = false;
          doUpdate();
        });
      } else {
        doUpdate();
      }
    }

    function checkWin() {
      // 所有目标都有箱子（第三关还要求颜色匹配）
      for (const t of targets) {
        if (!boxes.has(t)) return false;
        if (levelIndex === 2) {
          // 目标必须具有颜色映射且箱子颜色需匹配目标颜色
          const requiredColor = targetColorMap.get(t) || null;
          const boxColor = boxColorMap.get(t) || null;
          if (!requiredColor || boxColor !== requiredColor) return false;
        }
      }
      if (levelType === 'step-limit' && maxMoves != null) {
        showToast(`恭喜，完成！ 共使用：${moveCount} 步（上限 ${maxMoves}）`);
      } else {
        showToast('恭喜，完成！');
      }
      try {
        infoEl.textContent = '';
      } catch (e) {}
      // 禁用重置按钮（通关后不能重置当前已完成的关卡）
      try {
        resetBtn.disabled = true;
        resetBtn.setAttribute('aria-disabled', 'true');
      } catch (e) {}
      // 判断是否为最后一关
      const isLast = levelIndex >= levels.length - 1;
      nextBtn.style.display = 'inline-block';
      nextBtn.textContent = isLast ? '进入下一幕' : '下一关';
      // 若为本幕最后一关，立即上报通关事件（用于成就判定），在玩家点击进入下一幕之前就触发
      if (isLast) {
        try {
          achievements.recordEvent('scene4:finished', { levelIndex: levelIndex });
        } catch (e) {}
      }
      detachKeys();
      return true;
    }

    const keyHandler = (e) => {
      if (animating) return;
      // 当被锁定时，仅允许 H / h 切换提示（完成后禁止重置）
      if (controlsLocked) {
        // allow hint always
        if (e.key === 'h' || e.key === 'H') {
          /* allow hint */
          // allow reset (R) only when we're in a failure state caused by movesDisabled
        } else if ((e.key === 'r' || e.key === 'R') && movesDisabled) {
          /* allow reset on failure */
        } else {
          return; // ignore other keys when locked (e.g., movement or R on win)
        }
      }

      let handled = true;
      switch (e.key) {
        case 'ArrowUp':
          move(-1, 0);
          break;
        case 'ArrowDown':
          move(1, 0);
          break;
        case 'ArrowLeft':
          move(0, -1);
          break;
        case 'ArrowRight':
          move(0, 1);
          break;
        case 'w':
        case 'W':
          move(-1, 0);
          break;
        case 's':
        case 'S':
          move(1, 0);
          break;
        case 'a':
        case 'A':
          move(0, -1);
          break;
        case 'd':
        case 'D':
          move(0, 1);
          break;
        case 'r':
        case 'R':
          try {
            achievements.recordEvent('scene4:reset_key', { levelIndex: levelIndex });
          } catch (e) {}
          resetLevel();
          break;
        case 'f':
        case 'F':
          // 切换标记（放置或移除），仅在 ice-sliding 或 slideEnabled 时有效
          if (levelType === 'ice-sliding' || (config && config.slideEnabled)) {
            if (marker) removeMarker();
            else placeMarker();
          }
          break;
        case 'h':
        case 'H':
          // 切换提示模态
          const existingHint = el.querySelector('.soko-hint-modal');
          if (existingHint) {
            try {
              existingHint.remove();
            } catch (e) {}
          } else showHint();
          break;
        default:
          handled = false;
          break;
      }
      if (handled) e.preventDefault();
    };

    function detachKeys() {
      // 锁定控制，保留 keyHandler 监听以允许 H/R 等快捷键
      controlsLocked = true;
    }

    function resetLevel() {
      // 先重新加载关卡并清除标记，再渲染，保证标记不会在下一次移动前残留
      loadLevel();
      marker = null;
      render();
      infoEl.textContent = '';
      nextBtn.style.display = 'none';
      // 恢复步数相关状态
      moveCount = 0;
      maxMoves = typeof config.maxMoves === 'number' ? config.maxMoves : maxMoves;
      movesDisabled = false;
      // 清除标记
      marker = null;
      updateInfo();
      // 解除锁定并确保事件监听已绑定（避免重复绑定）
      controlsLocked = false;
      if (!keyHandlerBound) {
        document.addEventListener('keydown', keyHandler);
        keyHandlerBound = true;
      }
      if (!spaceHandlerBound) {
        document.addEventListener('keydown', spaceHandler);
        spaceHandlerBound = true;
      }
    }

    // 右键支持已移除：标记现在仅由 F 键控制

    // 初始化
    loadLevel();
    render();
    // 根据初始关卡设置场景类（第四关索引为 3）
    try {
      if (levelIndex === 3) el.classList.add('level-4');
      else el.classList.remove('level-4');
    } catch (er) {}
    // 刚进入关卡时立即显示步数信息（若为 step-limit）并弹出提示
    updateInfo();
    if (levelType === 'step-limit' && maxMoves != null) {
      showToast(`本关有步数限制：最多 ${maxMoves} 步`);
    }
    if (!keyHandlerBound) {
      document.addEventListener('keydown', keyHandler);
      keyHandlerBound = true;
    }
    if (!spaceHandlerBound) {
      document.addEventListener('keydown', spaceHandler);
      spaceHandlerBound = true;
    }
    resetBtn.addEventListener('click', () => {
      try {
        achievements.recordEvent('scene4:reset_button', { levelIndex: levelIndex });
      } catch (e) {}
      resetLevel();
    });

    // 提示按钮切换：如果已显示则移除，否则显示
    hintBtn.addEventListener('click', () => {
      const existing = el.querySelector('.soko-hint-modal');
      if (existing) {
        try {
          existing.remove();
        } catch (e) {}
      } else showHint();
    });

    function showHint() {
      if (el.querySelector('.soko-hint-modal')) return; // 已存在
      const modal = document.createElement('div');
      modal.className = 'soko-hint-modal';
      modal.innerHTML = `
        <div class='inner'>
          <h2>玩法提示</h2>
          <ul>
            <li>目标：把所有箱子推到地图上标记的终点（中间有黄色标记的格子）。到位的箱子会变为深色表示已就位。</li>
            <li>操作：使用方向键 或 WASD 移动（推动箱子时箱子会随你前进）。</li>
            <li>步数统计：某些关卡有限制步数，进入关卡会显示“步数：当前 / 上限”。超过上限会失败，需要重置重试。</li>
            <li>重置：按 R 键 或 点击“重置关卡”可以立即重置本关。</li>
            <li>提示：按 H 键 或 点击“提示”按钮可随时打开/关闭本提示窗口。</li>
            <li>音乐：点击左侧的 ♪ 按钮控制背景音乐的播放/暂停。</li>
            <li>通关：所有目标都有箱子时判定通关，界面会出现“下一关”或“进入下一幕”按钮。</li>
          </ul>
          <button class='close-hint' data-debounce>知道了</button>
        </div>`;
      const close = () => {
        try {
          modal.remove();
        } catch (e) {}
      };
      modal.addEventListener('click', (e) => {
        if (e.target === modal) close();
      });
      modal.querySelector('.close-hint').addEventListener('click', close);
      el.appendChild(modal);
    }

    // 播放 BGM
    const bgmAudio = audioManager.playSceneBGM('4', { loop: true, volume: 0.55, fadeIn: 800 });
    bgmBtn.addEventListener('click', () => {
      if (!bgmAudio) return;
      if (bgmAudio.paused) {
        bgmAudio.play().catch(() => {});
        bgmBtn.classList.remove('muted');
      } else {
        bgmAudio.pause();
        bgmBtn.classList.add('muted');
      }
    });

    // 绑定 M 键用于切换 BGM（支持大小写）
    const _soko_m_key_handler = (e) => {
      if (e.key === 'm' || e.key === 'M') {
        try {
          e.preventDefault();
        } catch (er) {}
        if (!bgmAudio) return;
        try {
          if (bgmAudio.paused) {
            bgmAudio.play().catch(() => {});
            bgmBtn.classList.remove('muted');
          } else {
            bgmAudio.pause();
            bgmBtn.classList.add('muted');
          }
        } catch (er) {}
      }
    };
    document.addEventListener('keydown', _soko_m_key_handler);

    // 统一处理 nextBtn 行为：若还有关卡则加载下一关，否则进入下一幕
    nextBtn.addEventListener('click', () => {
      const isLast = levelIndex >= levels.length - 1;
      if (!isLast) {
        // 下一关
        setLevel(levelIndex + 1);
        loadLevel();
        render();
        // 解除锁定并确保事件监听已绑定（避免重复绑定）
        controlsLocked = false;
        if (!keyHandlerBound) {
          document.addEventListener('keydown', keyHandler);
          keyHandlerBound = true;
        }
        if (!spaceHandlerBound) {
          document.addEventListener('keydown', spaceHandler);
          spaceHandlerBound = true;
        }
        nextBtn.style.display = 'none';
        // 保持 infoEl（例如步数显示）不要被清空，以便步数限制直接可见
        updateInfo();
        if (levelType === 'step-limit' && maxMoves != null) {
          showToast(`本关有步数限制：最多 ${maxMoves} 步`);
        }
      } else {
        // 场景过渡到下一幕（保持原有过渡参数）
        this.ctx.go('transition', {
          next: 'date',
          style: 'flash45',
          images: [
            './assets/images/mem_4_4.jpg',
            './assets/images/mem_4_3.jpg',
            './assets/images/mem_4_1.jpg',
            './assets/images/mem_4_2.jpg',
          ],
          duration: 4000,
          sound: './assets/audio/flash_45.wav',
          soundVolume: 0.3,
        });
      }
    });

    // 保存引用做清理
    this._sokoCleanup = () => {
      // 在清理时，移除所有绑定的键盘监听
      try {
        if (keyHandlerBound) document.removeEventListener('keydown', keyHandler);
      } catch (e) {}
      try {
        if (spaceHandlerBound) document.removeEventListener('keydown', spaceHandler);
      } catch (e) {}
      try {
        document.removeEventListener('keydown', _soko_m_key_handler);
      } catch (e) {}
      keyHandlerBound = false;
      spaceHandlerBound = false;
      try {
        resetBtn.replaceWith(resetBtn.cloneNode(true));
      } catch (e) {}
      try {
        bgmBtn.replaceWith(bgmBtn.cloneNode(true));
      } catch (e) {}
    };

    this.ctx.rootEl.appendChild(el);
  }

  async exit() {
    audioManager.stopBGM('4', { fadeOut: 600 });
    if (this._sokoCleanup)
      try {
        this._sokoCleanup();
      } catch (e) {}
  }
}
