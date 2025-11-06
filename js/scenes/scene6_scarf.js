import { BaseScene } from '../core/baseScene.js';
import { audioManager } from '../core/audioManager.js';

/**
 * Scene6Scarf -> 华容道玩法
 * 两关：
 * 1. 传统华容道：不同尺寸方块，核心目标块移动到出口位置。
 * 2. 数字华容道：4x4 数字滑块排列成 1..15 + 空白。
 *
 * 设计目标：最小可玩版本，提供基本拖/点移动，胜利后显示继续按钮。
 */
export class Scene6Scarf extends BaseScene {
  async init() {
    await super.init();
  }

  constructor(ctx) {
    super(ctx);
    this.levelIndex = 0; // 0: 经典 1: 数字
    this.levels = this._buildLevels();
    this.current = null; // 当前关数据运行时状态
    this.rootEl = null;
    // 数字关计时挑战相关
    this._numericFirstCleared = false; // 是否已经第一次通关过数字关
    this._timingActive = false;
    this._timingStart = null;
    this._timerRaf = null;
    this._timerEl = null;
  }

  _buildLevels() {
    // 经典华容道：使用 5x4 布局（列x行），出口在底部中间。
    // blocks: {id,w,h,x,y,type,target?}
    const classic = {
      type: 'classic',
      cols: 6,
      rows: 6,
      // 明确指定禁止行（0-based）：指初始布局中某行（例如 G2 下面一行）
      forbiddenRow: 5,
      // 将出口下移一格（y 从 4 -> 5）以便目标块需要再下移一格才能胜利
      // 注意：cols 改为 6，但 exit.x 保持原位置（可按需调整）
      exit: { x: 1, y: 5, w: 2, h: 1 }, // 目标块需覆盖此区域并“下移出”判定胜利
      // 所有滑块都为 1x2（竖）或 2x1（横）——使用布尔字段 horizontal 表示横向（true）或竖向（false）
      blocks: [
        { id: 'A', horizontal: true, x: 1, y: 1, type: 'target' }, // 目标块（红色）
        { id: 'B', horizontal: false, x: 0, y: 0 },
        { id: 'C', horizontal: false, x: 3, y: 0 },
        { id: 'E', horizontal: true, x: 1, y: 0 },
        { id: 'F', horizontal: false, x: 0, y: 2 },
        { id: 'G', horizontal: false, x: 3, y: 2 },
        { id: 'D', horizontal: true, x: 1, y: 3 },
        { id: 'H', horizontal: true, x: 1, y: 4 },
      ],
    };
    // 数字华容道：4x4，空白用 0。
    const numeric = {
      type: 'numeric',
      size: 4,
      tiles: this._shuffleNumeric(4), // 初始随机，确保可解（简单：如果不可解则交换除0外任意两数）
    };
    return [classic, numeric];
  }

  _shuffleNumeric(n) {
    // 我们希望空白（0）始终位于右下角（最后一个位置）。
    // 生成 1..(n*n-1) 的随机排列并保证可解性（当空白在最后一行且宽度为偶数时，
    // 可解性条件等价于逆序数为偶数）。为简单起见：生成随机排列，若逆序为奇数则交换前两项以修正为偶数。
    const count = n * n - 1;
    const arr = Array.from({ length: count }, (_, i) => i + 1); // 1..15
    // Fisher-Yates 洗牌
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    // 计算逆序数（仅对非零元素）
    let inv = 0;
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        if (arr[i] > arr[j]) inv++;
      }
    }
    // 当空白位于最后一格（右下）并且 n 为偶数时，可解性需要逆序数为偶数
    if (n % 2 === 0 && inv % 2 === 1) {
      // 调整为偶数逆序：简单交换前两项
      if (arr.length >= 2) [arr[0], arr[1]] = [arr[1], arr[0]];
      else {
        // 极端情况（n=1 或 0），不太可能，但确保返回初始状态
      }
    }
    // 最后将 0 放到末尾
    arr.push(0);
    return arr;
  }

  _isSolvable15(a) {
    const size = Math.sqrt(a.length);
    let inv = 0;
    for (let i = 0; i < a.length; i++) {
      if (a[i] === 0) continue;
      for (let j = i + 1; j < a.length; j++) {
        if (a[j] === 0) continue;
        if (a[i] > a[j]) inv++;
      }
    }
    const blankRowFromBottom = size - Math.floor(a.indexOf(0) / size); // 1-based
    if (size % 2 === 1) {
      return inv % 2 === 0; // 奇数宽度：逆序偶数可解
    } else {
      // 偶数宽度： (空行从底数奇 && 逆序偶) 或 (空行从底数偶 && 逆序奇)
      const oddBlank = blankRowFromBottom % 2 === 1;
      const evenInv = inv % 2 === 0;
      return (oddBlank && evenInv) || (!oddBlank && !evenInv);
    }
  }

  async enter() {
    this.rootEl = document.createElement('div');
    this.rootEl.className = 'scene scene-scarf hrd';
    this.applyNoSelect(this.rootEl);
    this._injectStyle();
    try {
      audioManager.playSceneBGM('6', { loop: true, volume: 0.6, fadeIn: 600 });
    } catch (e) {}
    this.ctx.rootEl.appendChild(this.rootEl);
    this.loadLevel(this.levelIndex);
  }

  loadLevel(idx) {
    this.levelIndex = idx;
    const def = this.levels[idx];
    if (def.type === 'classic') {
      this.current = JSON.parse(JSON.stringify(def)); // 深拷贝
      // 如果关卡定义内显式给出 forbiddenRow，则使用之（使规则与具体方块 id 解耦）
      if (typeof this.current.forbiddenRow === 'number') {
        this.current._forbiddenRow = this.current.forbiddenRow;
      }
      // 将 blocks 中的 horizontal 字段转换为运行时的 w/h（兼容旧字段）
      this.current.blocks = this.current.blocks.map((b) => {
        const nb = Object.assign({}, b);
        if (typeof nb.horizontal === 'boolean') {
          if (nb.horizontal) {
            nb.w = 2;
            nb.h = 1;
          } else {
            nb.w = 1;
            nb.h = 2;
          }
          delete nb.horizontal;
        } else {
          // 保持已有 w/h
        }
        return nb;
      });
      this._renderClassic();
    } else if (def.type === 'numeric') {
      // 每次进入/重开数字关都重新洗牌以保证随机性
      def.tiles = this._shuffleNumeric(def.size);
      this.current = JSON.parse(JSON.stringify(def));
      this._renderNumeric();
    }
  }

  _clearRoot() {
    this.rootEl.innerHTML = '';
  }

  _renderHeader(title) {
    const bar = document.createElement('div');
    bar.className = 'hrd-top-bar';
    bar.innerHTML = `
      <h1>场景6：华容道 - ${title}</h1>
      <div class='hrd-controls'>
        <button data-act='restart'>重开关卡</button>
      </div>
    `;
    bar
      .querySelector('[data-act=restart]')
      .addEventListener('click', () => this.loadLevel(this.levelIndex));
    this.rootEl.appendChild(bar);
  }

  _renderClassic() {
    this._clearRoot();
    this._renderHeader('经典布局');
    const { cols, rows, blocks, exit } = this.current;
    const wrap = document.createElement('div');
    wrap.className = 'hrd-board classic';
    // 可视上左右各扩展一列，但逻辑移动仍使用 this.current.cols
    const visualOffset = 1;
    const visualCols = cols + visualOffset * 2;
    wrap.style.setProperty('--cols', visualCols);
    wrap.style.setProperty('--rows', rows);

    const grid = document.createElement('div');
    grid.className = 'hrd-grid';
    // 添加一个可视边框，围绕逻辑的 cols x (rows-1) 或指定的滑块初始区域
    // visualOffset 用于将边框位置与可视化网格对齐
    const playAreaBorder = document.createElement('div');
    playAreaBorder.className = 'play-area-border';
    // 边框使用 grid-area 放置：覆盖逻辑列范围并垂直覆盖前 (rows - 1) 行（通常顶端活动区域）
    // visualOffset 用于将边框位置与可视化网格对齐
    const borderTop = 1; // y = 0 -> row 1
    const borderLeft = 1 + visualOffset; // x = 0 -> col (visualOffset + 1)
    // 覆盖到逻辑上前 (rows - 1) 行的底部：因为 exit 可能在最后一行
    const borderBottom = rows - 1 + 1 + 1; // (rows-1) 0-based -> +1 for grid -> +1 exclusive
    const borderRight = visualOffset + cols + 1; // 视觉上覆盖到右侧对应列（包含所有逻辑列）
    playAreaBorder.style.gridArea = `${borderTop} / ${borderLeft} / ${borderBottom} / ${borderRight}`;
    grid.appendChild(playAreaBorder);
    // 经典关取消背景空格子，仅显示出口与方块
    // 出口标记
    const exitEl = document.createElement('div');
    exitEl.className = 'exit';
    exitEl.style.gridArea = `${exit.y + 1} / ${exit.x + visualOffset + 1} / ${
      exit.y + exit.h + 1
    } / ${exit.x + visualOffset + exit.w + 1}`;
    grid.appendChild(exitEl);

    // 方块元素
    blocks.forEach((b) => {
      const blockEl = document.createElement('div');
      blockEl.className = 'block' + (b.type === 'target' ? ' target' : '');
      blockEl.dataset.id = b.id;
      blockEl.style.gridArea = `${b.y + 1} / ${b.x + visualOffset + 1} / ${b.y + b.h + 1} / ${
        b.x + visualOffset + b.w + 1
      }`;
      blockEl.textContent = b.id;
      // 点击选中
      blockEl.addEventListener('click', () => this._selectBlock(b.id));
      // pointerdown 用于开始拖动（支持鼠标与触控）
      blockEl.addEventListener('pointerdown', (ev) => this._startDrag(ev, b));
      grid.appendChild(blockEl);
    });

    wrap.appendChild(grid);
    const hint = document.createElement('p');
    hint.className = 'hrd-hint';
    hint.textContent = '点击一个方块然后使用方向键移动（若可行），目标块移出底部出口即胜利。';
    wrap.appendChild(hint);
    this.rootEl.appendChild(wrap);
    this.selectedBlock = null;

    // 键盘监听
    this._bindKeyHandler();
  }

  _selectBlock(id) {
    // 更新选中样式
    const prev = this.selectedBlock;
    this.selectedBlock = id;
    if (prev) {
      const pel = this.rootEl.querySelector(`.block[data-id='${prev}']`);
      if (pel) pel.classList.remove('selected');
    }
    const el = this.rootEl.querySelector(`.block[data-id='${id}']`);
    if (el) el.classList.add('selected');
  }

  _startDrag(ev, block) {
    ev.preventDefault();
    // 记录拖动起点
    this._dragState = {
      id: block.id,
      startX: ev.clientX,
      startY: ev.clientY,
      gridRect: this.rootEl.querySelector('.hrd-grid').getBoundingClientRect(),
    };
    // 确保选中
    this._selectBlock(block.id);
    // 监听 pointerup 在 window 上
    const up = (e) => {
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointermove', move);
      this._endDrag(e);
    };
    const move = (e) => {
      // 可在此添加拖动过程中视觉反馈（略）
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  _endDrag(ev) {
    if (!this._dragState) return;
    const s = this._dragState;
    const dx = ev.clientX - s.startX;
    const dy = ev.clientY - s.startY;
    const grid = this.rootEl.querySelector('.hrd-grid');
    // 使用视觉列数/行数来计算单元尺寸（考虑 visualOffset 扩展）
    const cols = this.current.cols;
    const rows = this.current.rows;
    const rect = s.gridRect || grid.getBoundingClientRect();
    // 若 grid 的 --cols 是视觉列数，则以其为准来计算 cell 大小
    const styleCols = parseInt(getComputedStyle(grid).getPropertyValue('--cols')) || cols;
    const styleRows = parseInt(getComputedStyle(grid).getPropertyValue('--rows')) || rows;
    const cellW = rect.width / styleCols;
    const cellH = rect.height / styleRows;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const threshold = Math.min(cellW, cellH) * 0.25; // 至少四分之一格
    let dir = null;
    if (absX < threshold && absY < threshold) {
      // 视为点击，不移动
      this._dragState = null;
      return;
    }
    if (absX > absY) {
      dir = dx > 0 ? 'ArrowRight' : 'ArrowLeft';
    } else {
      dir = dy > 0 ? 'ArrowDown' : 'ArrowUp';
    }
    // 执行一次移动（单格）
    const id = s.id;
    const b = this.current.blocks.find((x) => x.id === id);
    if (!b) {
      this._dragState = null;
      return;
    }
    let mv = { dx: 0, dy: 0 };
    if (dir === 'ArrowLeft') mv.dx = -1;
    else if (dir === 'ArrowRight') mv.dx = 1;
    else if (dir === 'ArrowUp') mv.dy = -1;
    else if (dir === 'ArrowDown') mv.dy = 1;
    if (this._canMoveBlock(b, mv.dx, mv.dy)) {
      b.x += mv.dx;
      b.y += mv.dy;
      this._updateClassicBlockEl(b);
      this._checkClassicWin();
    }
    this._dragState = null;
  }

  _bindKeyHandler() {
    if (this._keyBound) return;
    this._keyBound = true;
    window.addEventListener('keydown', (e) => {
      if (!this.current) return;
      if (this.current.type === 'classic') {
        this._handleClassicMove(e.key);
      } else if (this.current.type === 'numeric') {
        this._handleNumericMove(e.key);
      }
    });
  }

  _handleClassicMove(key) {
    if (!this.selectedBlock) return;
    const b = this.current.blocks.find((x) => x.id === this.selectedBlock);
    if (!b) return;
    let dx = 0,
      dy = 0;
    // 支持 Arrow Keys 与 WASD（大小写）
    if (key === 'ArrowLeft' || key === 'a' || key === 'A') dx = -1;
    else if (key === 'ArrowRight' || key === 'd' || key === 'D') dx = 1;
    else if (key === 'ArrowUp' || key === 'w' || key === 'W') dy = -1;
    else if (key === 'ArrowDown' || key === 's' || key === 'S') dy = 1;
    else return;
    if (dx === 0 && dy === 0) return;
    if (this._canMoveBlock(b, dx, dy)) {
      b.x += dx;
      b.y += dy;
      this._updateClassicBlockEl(b);
      this._checkClassicWin();
    }
  }

  _canMoveBlock(b, dx, dy) {
    const { cols, rows, blocks } = this.current;
    const nx = b.x + dx;
    const ny = b.y + dy;
    if (nx < 0 || ny < 0 || nx + b.w > cols || ny + b.h > rows) {
      // 允许目标块向下“出界”作为胜利判定前一步：ny + h == rows 且 dy >0 && b.type==='target'
      if (
        !(
          b.type === 'target' &&
          dy > 0 &&
          b.x === this.current.exit.x &&
          b.w === this.current.exit.w &&
          b.y + b.h === rows
        )
      )
        return false;
    }
    // 规则：G2 下面的那一行（G2.y + G2.h）不允许除了 A 以外的方块占据任何格子
    // 优先使用载入时记录的固定 forbidden row（如果存在），否则动态从当前 G2 计算
    const forbiddenRow =
      this.current && typeof this.current._forbiddenRow === 'number'
        ? this.current._forbiddenRow
        : blocks.find((x) => x.id === 'G2')
        ? blocks.find((x) => x.id === 'G2').y + blocks.find((x) => x.id === 'G2').h
        : null;
    if (forbiddenRow !== null && forbiddenRow !== undefined) {
      if (b.id !== 'A') {
        const top = ny;
        const bottom = ny + b.h - 1;
        if (top <= forbiddenRow && bottom >= forbiddenRow) return false;
      }
    }
    // 碰撞检测（忽略自身）
    return blocks.every((other) => {
      // 忽略自身比较：使用 id 比较以防对象引用不一致
      if (other.id === b.id) return true;
      const ox = other.x,
        oy = other.y,
        ow = other.w,
        oh = other.h;
      const overlapX = nx < ox + ow && nx + b.w > ox;
      const overlapY = ny < oy + oh && ny + b.h > oy;
      if (overlapX && overlapY) return false;
      return true;
    });
  }

  _updateClassicBlockEl(b) {
    const el = this.rootEl.querySelector(`.block[data-id='${b.id}']`);
    if (el) {
      const visualOffset = 1;
      el.style.gridArea = `${b.y + 1} / ${b.x + visualOffset + 1} / ${b.y + b.h + 1} / ${
        b.x + visualOffset + b.w + 1
      }`;
    }
  }

  _checkClassicWin() {
    const target = this.current.blocks.find((x) => x.type === 'target');
    const { exit, rows } = this.current;
    // 胜利：目标块底边位于最后一行且下一步可向下移动出界（或已经下移出界）
    if (target.y + target.h === rows && target.x === exit.x && target.w === exit.w) {
      this._showWin(() => this._afterAllWin());
    }
  }

  _afterAllWin() {
    // 如果是第一关胜利，进入第二关；如果第二关胜利，进入下一场景
    if (this.levelIndex === 0) {
      this.loadLevel(1);
    } else {
      this.ctx.go('future');
    }
  }

  _renderNumeric() {
    
    this._clearRoot();
    this._renderHeader('数字滑块');
    const { size, tiles } = this.current;
    const wrap = document.createElement('div');
    wrap.className = 'hrd-board numeric';
    wrap.style.setProperty('--cols', size);
    wrap.style.setProperty('--rows', size);
    const grid = document.createElement('div');
    grid.className = 'hrd-grid';
    // 数字关不再渲染背景空格子，只展示数字块，减少视觉冗余
    tiles.forEach((val, i) => {
      if (val === 0) return; // 空白
      const tileEl = document.createElement('div');
      tileEl.className = 'num-tile';
      const r = Math.floor(i / size);
      const c = i % size;
      tileEl.style.gridArea = `${r + 1} / ${c + 1} / ${r + 2} / ${c + 2}`;
      tileEl.textContent = val;
      tileEl.addEventListener('click', () => this._tryMoveNumeric(r, c));
      grid.appendChild(tileEl);
    });
    wrap.appendChild(grid);
    this.rootEl.appendChild(wrap);
    this._bindKeyHandler();
  }

  _findNumericBlank() {
    const idx = this.current.tiles.indexOf(0);
    const size = this.current.size;
    return { r: Math.floor(idx / size), c: idx % size };
  }

  _handleNumericMove(key) {
    const blank = this._findNumericBlank();
    let tr = blank.r,
      tc = blank.c;
    // 支持 Arrow 与 WASD（W 上, S 下, A 左, D 右）
    if (key === 'ArrowUp' || key === 'w' || key === 'W')
      tr = blank.r + 1; // 空白向上移动 = 与下方块交换
    else if (key === 'ArrowDown' || key === 's' || key === 'S') tr = blank.r - 1;
    else if (key === 'ArrowLeft' || key === 'a' || key === 'A') tc = blank.c + 1;
    else if (key === 'ArrowRight' || key === 'd' || key === 'D') tc = blank.c - 1;
    else return;
    this._tryMoveNumeric(tr, tc);
  }

  _tryMoveNumeric(r, c) {
    const { size, tiles } = this.current;
    if (r < 0 || c < 0 || r >= size || c >= size) return;
    const blank = this._findNumericBlank();
    const manhattan = Math.abs(blank.r - r) + Math.abs(blank.c - c);
    if (manhattan !== 1) return; // 必须相邻
    // 交换
    const blankIdx = blank.r * size + blank.c;
    const tileIdx = r * size + c;
    [tiles[blankIdx], tiles[tileIdx]] = [tiles[tileIdx], tiles[blankIdx]];
    this._updateNumericTiles();
    this._checkNumericWin();
  }

  _updateNumericTiles() {
    const { size, tiles } = this.current;
    // 清除现有数字元素
    const grid = this.rootEl.querySelector('.numeric .hrd-grid');
    grid.querySelectorAll('.num-tile').forEach((el) => el.remove());
    tiles.forEach((val, i) => {
      if (val === 0) return;
      const r = Math.floor(i / size);
      const c = i % size;
      const tileEl = document.createElement('div');
      tileEl.className = 'num-tile';
      tileEl.style.gridArea = `${r + 1} / ${c + 1} / ${r + 2} / ${c + 2}`;
      tileEl.textContent = val;
      tileEl.addEventListener('click', () => this._tryMoveNumeric(r, c));
      grid.appendChild(tileEl);
    });
  }

  _checkNumericWin() {
    const { tiles } = this.current;
    for (let i = 0; i < tiles.length - 1; i++) {
      if (tiles[i] !== i + 1) return;
    }
    if (tiles[tiles.length - 1] !== 0) return;
    // 如果处于计时挑战模式，优先走计时胜利流程
    if (this._timingActive) {
      const elapsed = this._stopTiming();
      if (elapsed !== null) {
        this._showTimedWin(elapsed);
        return;
      }
    }
    // 首次通过数字关：弹窗仅“确认”，不直接跳转；确认后在页面出现“计时挑战”和“跳转下一幕”按钮
    if (this.levelIndex === 1 && !this._numericFirstCleared) {
      this._numericFirstCleared = true;
      this._showNumericFirstWin();
    } else {
      this._showWin(() => this._afterAllWin());
    }
  }
  _showNumericFirstWin() {
    const box = document.createElement('div');
    box.className = 'hrd-win';
    box.innerHTML = `<div class='inner'>🎉 数字华容道 通过！<button class='confirm-btn'>确认</button></div>`;
    this.rootEl.appendChild(box);
    box.querySelector('.confirm-btn').addEventListener('click', () => {
      box.remove();
      this._injectPostNumericWinButtons();
    });
  }

  _injectPostNumericWinButtons() {
    // 在顶部控制区添加“计时挑战”和“跳转下一幕”按钮，若已存在则先清理旧的
    const controls = this.rootEl.querySelector('.hrd-top-bar .hrd-controls');
    if (!controls) return;
    // 避免重复添加
    if (controls.querySelector('[data-act=timing]')) return;
    const timingBtn = document.createElement('button');
    timingBtn.textContent = '计时挑战';
    timingBtn.dataset.act = 'timing';
    const nextBtn = document.createElement('button');
    nextBtn.textContent = '跳转下一幕';
    nextBtn.dataset.act = 'goto-next';
    controls.appendChild(timingBtn);
    controls.appendChild(nextBtn);
    timingBtn.addEventListener('click', () => {
      // 开启倒计时挑战
      this._startNumericChallengeCountdown();
    });
    nextBtn.addEventListener('click', () => {
      // 直接跳转下一幕（不再弹出确认弹窗）
      this._afterAllWin();
    });
  }

  _startNumericChallengeCountdown() {
    // 显示 3 秒倒计时在屏幕中央，然后重开数字关并开始计时器
    const box = document.createElement('div');
    box.className = 'hrd-win';
    box.innerHTML = `<div class='inner'><div class='countdown'>3</div></div>`;
    this.rootEl.appendChild(box);
    let count = 3;
    const iv = setInterval(() => {
      count -= 1;
      const el = box.querySelector('.countdown');
      if (el) el.textContent = String(count > 0 ? count : 'Go!');
      if (count <= 0) {
        clearInterval(iv);
        box.remove();
        // 重新开始数字关（洗牌并渲染）并开始计时
        this.loadLevel(1);
        // 允许一帧后开始计时以保证 UI 渲染
        requestAnimationFrame(() => this._startTiming());
      }
    }, 1000);
  }

  _startTiming() {
    if (this._timingActive) return;
    this._timingActive = true;
    this._timingStart = performance.now();
    // 在界面上显示计时器（顶部）
    this._timerEl = document.createElement('div');
    this._timerEl.className = 'hrd-timer';
    this._timerEl.style.cssText =
      'position:fixed;top:12px;right:12px;background:rgba(0,0,0,0.6);color:#fff;padding:6px 10px;border-radius:6px;z-index:9999;';
    this._timerEl.textContent = '计时: 0.00s';
    document.body.appendChild(this._timerEl);
    const update = () => {
      if (!this._timingActive) return;
      const now = performance.now();
      const sec = (now - this._timingStart) / 1000;
      // 显示到毫秒 (3 位小数)
      if (this._timerEl) this._timerEl.textContent = `计时: ${sec.toFixed(3)}s`;
      this._timerRaf = requestAnimationFrame(update);
    };
    this._timerRaf = requestAnimationFrame(update);
  }

  _stopTiming() {
    if (!this._timingActive) return null;
    this._timingActive = false;
    const elapsed = (performance.now() - this._timingStart) / 1000;
    this._timingStart = null;
    if (this._timerRaf) cancelAnimationFrame(this._timerRaf);
    this._timerRaf = null;
    if (this._timerEl) {
      this._timerEl.remove();
      this._timerEl = null;
    }
    return elapsed;
  }

  _showTimedWin(elapsed) {
    // 在弹窗中显示胜利与用时，并比较 localStorage 最佳成绩
    const bestKey = 'hrd_numeric_best';
    const best = parseFloat(localStorage.getItem(bestKey)) || 0;
    let newRecord = false;
    if (best === 0 || elapsed < best) {
      localStorage.setItem(bestKey, String(elapsed));
      newRecord = true;
    }
    const box = document.createElement('div');
    box.className = 'hrd-win';
    box.innerHTML = `
      <div class='inner'>
        <div>🎉 胜利！</div>
        <div>用时: ${elapsed.toFixed(3)}s</div>
        ${newRecord ? "<div style='color:#d32f2f;font-weight:bold'>新纪录！</div>" : ''}
        <button class='confirm-btn'>确认</button>
      </div>
    `;
    this.rootEl.appendChild(box);
    box.querySelector('.confirm-btn').addEventListener('click', () => {
      box.remove();
      // 不跳转，重新确保顶部存在“计时挑战”和“跳转下一幕”按钮
      this._injectPostNumericWinButtons();
    });
  }

  _showWin(cb) {
    const box = document.createElement('div');
    box.className = 'hrd-win';
    box.innerHTML = `<div class='inner'>🎉 胜利！<button class='next-btn'>继续</button></div>`;
    this.rootEl.appendChild(box);
    box.querySelector('.next-btn').addEventListener('click', () => {
      box.remove();
      cb && cb();
    });
  }

  _injectStyle() {
    if (document.getElementById('hrd-style')) return;
    const style = document.createElement('style');
    style.id = 'hrd-style';
    style.textContent = `
      .scene-scarf.hrd { padding: 20px; }
      .hrd-top-bar { display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:12px; }
      .hrd-top-bar h1 { font-size:20px;margin:0; }
      .hrd-controls button { margin-right:8px;padding:4px 10px; }
      .hrd-board { max-width:500px;margin:0 auto; }
      .hrd-grid { display:grid;grid-template-columns:repeat(var(--cols), 80px);grid-template-rows:repeat(var(--rows), 80px);gap:4px;position:relative; }
      .hrd-grid .cell { width:80px;height:80px;background:#f3f3f3;border-radius:6px;box-shadow:inset 0 0 2px #bbb; }
  .play-area-border { box-shadow: 0 0 0 4px rgba(43,140,255,0.12) inset, 0 0 0 2px rgba(43,140,255,0.22); border-radius:10px; pointer-events:none; }
      .hrd-grid .exit { background: repeating-linear-gradient(45deg,#ffe0e0,#ffe0e0 6px,#ffcaca 6px,#ffcaca 12px);opacity:0.9;border:2px dashed #ff5252;border-radius:6px; }
      .block { background:#87c5ff;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:bold;color:#124e7a;box-shadow:0 2px 4px rgba(0,0,0,.25);cursor:pointer;user-select:none; }
      .block.selected { outline:3px solid #2b8cff; transform: translateY(-2px); }
  .block.target { background:#e53935;color:#fff;border:2px solid rgba(0,0,0,0.08); }
      .hrd-hint { text-align:center;margin-top:8px;font-size:12px;color:#666; }
      .num-tile { background:#ffe08a;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:22px;color:#7a4e12;box-shadow:0 2px 4px rgba(0,0,0,.25);cursor:pointer;user-select:none; }
      .hrd-win { position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.45); }
      .hrd-win .inner { background:#fff;padding:24px 32px;border-radius:12px;font-size:20px;display:flex;flex-direction:column;align-items:center;gap:14px; }
      .hrd-win button { padding:6px 16px;font-size:16px; }
      @media (max-width:600px){ .hrd-grid { grid-template-columns:repeat(var(--cols), 60px);grid-template-rows:repeat(var(--rows), 60px); } .hrd-grid .cell { width:60px;height:60px; } }
    `;
    document.head.appendChild(style);
  }

  async exit() {
    audioManager.stopBGM('6', { fadeOut: 500 });
  }
}
