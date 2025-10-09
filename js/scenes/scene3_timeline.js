import { BaseScene } from '../core/baseScene.js';
import { audioManager } from '../core/audioManager.js';

/**
 * 场景3：数织 / Picross / Nonogram
 * 说明：本场景使用手工/预生成的 puzzle JSON（由离线编辑器产生），渲染并交互玩家解题流程。
 * 实现策略：
 *  1. 从预先生成的 puzzle JSON 中读取 `matrix`（由离线编辑器产生）。
 *  2. 行与列分别做 run-length 编码，得到线索数组 (如 [3,1]) 表示连续块长度；空行为 [0]。
 *  3. DOM: 左上角线索区 + 交互网格 + 控制栏(重置/显示原图/下一幕按钮) + 完成状态层。
 *  4. 交互：左键(或触摸单击) 在 空(0)->填黑(1)->空 循环；右键 / 长按 标记 X(排除)；仅填黑参与判定。
 *  5. 每次操作快速检查：所有应填黑格均处于填黑 && 未多填 => 完成 -> 动画淡入原图与“进入下一幕”。
 */
export class Scene3Timeline extends BaseScene {
  async init(){ await super.init(); }
  async enter(){
    try { audioManager.playSceneBGM('3',{ loop:true, volume:0.55, fadeIn:700 }); } catch(e) { /* ignore */ }

    const CONFIG = {
      puzzleSrc: 'data/scene3_puzzles.json', // 改用手动编辑器产出的新路径
      gridSize: 9,
      showRuleHelp: true
    };

    const root = document.createElement('div');
    root.className = 'scene scene-nonogram';
    // 使用 BaseScene 公共方法统一禁用文字选择
    this.applyNoSelect(root);

  // 样式已抽取至全局 css/styles.css 中的 Scene 3 Nonogram 段落，不再动态注入。
    root.innerHTML = `
      <h1 class='title'>场景3：数织挑战 <span class='puzzle-progress' style="font-size:.6em; font-weight:500; margin-left:.6em; color:#c03; vertical-align:middle;">(0/0)</span></h1>
      <div class='nonogram-shell'>
        <div class='quad corner'></div>
        <div class='quad top-clues-area'><div class='top-inner'></div></div>
        <div class='quad left-clues-area'><div class='left-inner'></div></div>
        <div class='quad grid-scroller'><div class='grid-container'></div></div>
      </div>
      <div class='controls'>
        <button class='btn-reset' data-debounce>重置</button>
        <button class='btn-hint' data-debounce>提示</button>
        ${CONFIG.showRuleHelp ? `<button class='btn-rules' data-debounce>规则说明</button>`:''}
        <button class='btn-next hidden' data-debounce>进入下一幕</button>
      </div>
      <div class='status-msg'></div>
      <div class='rules-overlay hidden'>
        <div class='rules-box'>
          <h2>数织规则</h2>
          <div class='rules-content'>
            <p><strong>核心元素</strong></p>
            <p>网格由固定行列组成；每格最终状态：填色 或 留白(可打 X 标记)。</p>
            <p><strong>行 / 列提示数</strong>：每个数字表示一段连续填色块的长度；多个数字之间至少有 1 个留白格隔开。提示“0” 表示该行 / 列全部留白。</p>
            <p><strong>规则</strong></p>
            <ul>
              <li>提示顺序 = 填色块出现顺序。</li>
              <li>相邻数字代表的填色块之间 ≥ 1 个留白。</li>
              <li>不得多出或缺少填色格。</li>
            </ul>
            <p><strong>提示</strong>：随机点亮一个尚未点亮的正确格。</p>
            <p><strong>胜利条件</strong>：所有行与列的填色分布与各自提示数完全匹配。</p>
            <p><strong>操作</strong>：左键=填色/清除；右键=标记；拖拽连续填色或擦除。</p>
          </div>
          <div class='rules-actions'><button class='close-rules'>关闭</button></div>
        </div>
      </div>
      <p class='tips'>左键：填色/清除；右键：标记；拖拽批量操作。</p>
    `;
    this.ctx.rootEl.appendChild(root);

    const topCluesEl = root.querySelector('.top-clues-area .top-inner');
    const leftCluesEl = root.querySelector('.left-clues-area .left-inner');
    const gridContainer = root.querySelector('.grid-container');
    const gridScroller = gridContainer.parentElement; // .grid-scroller
    let btnReset = root.querySelector('.btn-reset');
    let btnHint = root.querySelector('.btn-hint');
    let btnRules = root.querySelector('.btn-rules');
    let btnNext = root.querySelector('.btn-next');
    const statusMsg = root.querySelector('.status-msg');
    const rulesOverlay = root.querySelector('.rules-overlay');

    // 优先尝试加载预生成 JSON；失败则回退到运行时图像生成
    let puzzles = [];
    let currentIndex = 0; // 0-based index into puzzles
    function initPuzzle(){
      if(CONFIG.puzzleSrc){
        fetch(CONFIG.puzzleSrc, { cache:'no-store' })
            .then(r=>{ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
            .then(json=>{
              if(Array.isArray(json.puzzles) && json.puzzles.length>0){
                // 排序确保按 meta.index 顺序
                puzzles = json.puzzles.slice().sort((a,b)=>{
                  const ia = a.meta && a.meta.index ? a.meta.index : 0;
                  const ib = b.meta && b.meta.index ? b.meta.index : 0;
                  return ia - ib;
                });
              } else if(json.matrix){
                puzzles = [{ meta: json.meta||{}, matrix: json.matrix, image: (json.meta&&json.meta.image)||json.image||null }];
              } else {
                throw new Error('缺少 puzzles 或 matrix');
              }
              currentIndex = 0;
              loadCurrentPuzzle();
            })
          .catch(err=>{
            console.warn('[Nonogram] 预生成 JSON 加载失败，回退到图片生成:', err);
            runtimeImageBuild();
          });
      } else {
        runtimeImageBuild();
      }
    }
    function loadCurrentPuzzle(){
      if(!puzzles.length) return;
      const p = puzzles[currentIndex];
      const matrix = p.matrix;
      if(!matrix) throw new Error('当前 puzzle 缺少 matrix');
      // 清除上一题可能遗留的完成状态样式 / 标记
      gridContainer.classList.remove('completed-locked','grid-fade-out','grid-jump','grid-heartbeat');
      delete gridContainer.dataset.animDone;
      gridContainer.style.opacity='';
      const h = matrix.length; const w = matrix[0].length;
      const rowClues = buildClues(matrix);
      const colClues = buildClues(transpose(matrix));
      // 准备揭示用图片（淡入用，不弹出 overlay）
      let revealImg = gridScroller.querySelector('.nonogram-reveal-img');
      if(!revealImg){
        revealImg = document.createElement('img');
        revealImg.className = 'nonogram-reveal-img';
        gridScroller.insertBefore(revealImg, gridScroller.firstChild); // 放在 gridContainer 前面以便位于下层
      }
      revealImg.src = p.image || '';
      revealImg.classList.remove('show');
      renderPuzzle(matrix, rowClues, colClues, w, h);
      // 更新按钮文案
      if(currentIndex < puzzles.length - 1){
        btnNext.textContent = '下一题';
      } else {
        btnNext.textContent = '进入下一幕';
      }
      // 更新进度文本
      const progEl = root.querySelector('.puzzle-progress');
      if(progEl){ progEl.textContent = `(${currentIndex+1}/${puzzles.length})`; }
      btnNext.classList.add('hidden'); // 新题开始时隐藏
      btnNext.disabled = true; // 初始保持禁用（直到完成时再启用）
      statusMsg.textContent = '';
      // 新题启用重置按钮
      btnReset.disabled = false;
      // 新题启用提示按钮
      if(btnHint) btnHint.disabled = false;
    }
    // 已移除运行时图片生成功能；编辑器现在仅使用预生成的 JSON
    function runtimeImageBuild(){
      gridContainer.textContent = '未配置预生成谜题（puzzleSrc）且运行时图片生成已被移除。';
    }
    initPuzzle();
    // 运行时根据图片构建数织功能已移除；仅保留通过 JSON 加载并渲染的路径。
    function renderPuzzle(matrix, rowClues, colClues, w, h){
      // 为避免多次 addEventListener 累积，克隆按钮以清除旧监听。
      function replaceButton(oldBtn){
        if(!oldBtn || !oldBtn.parentNode) return oldBtn;
        const newBtn = oldBtn.cloneNode(true);
        oldBtn.parentNode.replaceChild(newBtn, oldBtn);
        return newBtn;
      }
      btnReset = replaceButton(btnReset);
      if(btnHint) btnHint = replaceButton(btnHint);
      if(btnRules) btnRules = replaceButton(btnRules);
      btnNext = replaceButton(btnNext);
      // rowClues / colClues 已由上层传入，避免重复声明冲突
      const sizing = autoCellSize(w,h, 640, 480, 32, 14); // 计算合适 cell 大小
      gridContainer.style.setProperty('--cell-size', sizing.cell+'px');
      renderRowClues(leftCluesEl, rowClues, sizing.cell);
      renderColClues(topCluesEl, colClues, sizing.cell);
      const api = buildGrid(gridContainer, matrix, (changedX, changedY) => {
        updateRowHighlight(changedY);
        updateColHighlight(changedX);
        if (checkComplete(matrix, gridContainer)) {
          statusMsg.textContent = '完成！';
          enableNextButton();
          runCompletionAnimation();
        } else {
          statusMsg.textContent = '';
        }
      }, sizing.cell);
      // 提示：随机点亮一个尚未点亮的正确格
      function revealOneCorrect(){
        if(checkComplete(matrix, gridContainer)) return; // 已完成无需提示
        const candidates = [];
        for(let y=0;y<h;y++){
          for(let x=0;x<w;x++){
            if(matrix[y][x]===1){
              const cellEl = gridContainer.querySelector(`.cell[data-x='${x}'][data-y='${y}']`);
              if(cellEl && cellEl.dataset.state !== 'filled'){
                candidates.push({x,y,el:cellEl});
              }
            }
          }
        }
        if(!candidates.length) return; // 没有可提示的
        const pick = candidates[Math.floor(Math.random()*candidates.length)];
        // 填充该格
        pick.el.dataset.state='filled';
        pick.el.className='cell filled';
        // 更新线索状态
        updateRowHighlight(pick.y);
        updateColHighlight(pick.x);
        if (checkComplete(matrix, gridContainer)) {
          statusMsg.textContent = '完成！';
          enableNextButton();
          runCompletionAnimation();
        }
      }
      // 统一启用进入下一幕按钮的方法，防止被克隆或属性残留导致禁用
      function enableNextButton(){
        if(!btnNext) return;
        btnNext.classList.remove('hidden');
        btnNext.disabled = false;
        btnNext.removeAttribute('disabled'); // 双保险移除属性
      }
      function updateRowHighlight(y){
        const rowRuns = extractRuns(gridContainer, y, 'row');
        const el = leftCluesEl.children[y];
        if(!el) return;
        const status = evaluateRuns(rowRuns, rowClues[y]);
        el.classList.remove('clue-ok','clue-over','clue-done');
        if(status==='ok') el.classList.add('clue-ok');
        else if(status==='over') el.classList.add('clue-over');
      }
      function updateColHighlight(x){
        const colRuns = extractRuns(gridContainer, x, 'col');
        const el = topCluesEl.children[x];
        if(!el) return;
        const status = evaluateRuns(colRuns, colClues[x]);
        el.classList.remove('clue-ok','clue-over','clue-done');
        if(status==='ok') el.classList.add('clue-ok');
        else if(status==='over') el.classList.add('clue-over');
      }
      // 初始全部刷新
      for(let y=0;y<h;y++) updateRowHighlight(y);
      for(let x=0;x<w;x++) updateColHighlight(x);
      btnReset.addEventListener('click', () => {
        // 若当前题已完成（动画已触发），重置无效
        if(gridContainer.dataset.animDone) return;
        api.reset();
        statusMsg.textContent='';
        btnNext.classList.add('hidden');
        // 重置动画状态（包括新规范的心跳 / 淡出 / 图片）
  delete gridContainer.dataset.animDone;
  gridContainer.classList.remove('completed-locked','grid-fade-out','grid-jump','grid-heartbeat');
        gridContainer.style.opacity='';
        const revealImg2 = gridScroller.querySelector('.nonogram-reveal-img');
        if(revealImg2){
          revealImg2.classList.remove('show');
        }
        for(let y=0;y<h;y++) updateRowHighlight(y);
        for(let x=0;x<w;x++) updateColHighlight(x);
      });
      if(btnHint){
        btnHint.addEventListener('click', () => { if(!btnHint.disabled) revealOneCorrect(); });
      }
      // 原图查看按钮与遮罩已移除
      if(btnRules){
        btnRules.addEventListener('click', ()=> rulesOverlay.classList.remove('hidden'));
      }
      if(rulesOverlay){
        rulesOverlay.querySelector('.close-rules').addEventListener('click', ()=> rulesOverlay.classList.add('hidden'));
      }
      btnNext.addEventListener('click', ()=> {
        if(btnNext.textContent === '下一题'){
          currentIndex++;
            if(currentIndex >= puzzles.length) currentIndex = puzzles.length-1;
          loadCurrentPuzzle();
        } else {
          this.ctx.go('confession');
        }
      });
    }

    // 工具函数区域 --------------------------
    function buildClues(m){
      return m.map(row => {
        const clues=[]; let run=0;
        for(const v of row){
          if(v===1){ run++; }
          else if(run>0){ clues.push(run); run=0; }
        }
        if(run>0) clues.push(run);
        return clues.length? clues : [0];
      });
    }
    function transpose(m){
      const h = m.length, w = m[0].length;
      const out = Array.from({length:w},()=>Array(h).fill(0));
      for(let y=0;y<h;y++) for(let x=0;x<w;x++) out[x][y]=m[y][x];
      return out;
    }
    // ===== 新线索渲染 =====
    function renderRowClues(container, clues, cell){
      container.innerHTML='';
      clues.forEach(c=>{
        const div=document.createElement('div');
        div.className='row-clue';
        div.style.height=cell+'px';
        div.textContent=c.join(' ');
        container.appendChild(div);
      });
    }
    function renderColClues(container, clues, cell){
      container.innerHTML='';
      const maxLen = Math.max(...clues.map(c=>c.length));
      container.style.setProperty('--cols', clues.length);
      container.style.setProperty('--cell-size', cell+'px');
      for(let x=0;x<clues.length;x++){
        const col=document.createElement('div');
        col.className='col-clue';
        col.style.width=cell+'px';
        const arr = clues[x];
        for(let i=0;i<maxLen - arr.length;i++){
          const blank=document.createElement('span'); blank.className='blank'; col.appendChild(blank);
        }
        for(const num of arr){
          const sp=document.createElement('span'); sp.textContent= num===0 && arr.length===1 ? '0': String(num); col.appendChild(sp);
        }
        container.appendChild(col);
      }
    }
    // ===== 新网格构建 & 交互 =====
    function buildGrid(container, matrix, onChange, cell){
      container.innerHTML='';
      const h=matrix.length, w=matrix[0].length;
      container.style.setProperty('--rows', h);
      container.style.setProperty('--cols', w);
      container.style.gridTemplateColumns = `repeat(${w}, ${cell}px)`;
      container.style.gridTemplateRows = `repeat(${h}, ${cell}px)`;
      container.classList.add('nonogram-grid');
  // 二维 cells 数组，用于内部引用（不强制预填充）
  const cells = Array.from({ length: h }, () => new Array(w));
      let dragMode=null; // 'fill' | 'erase' | 'mark' | 'unmark'
      let mouseDown=false;
      container.addEventListener('contextmenu', e=> e.preventDefault());
      function applyAction(cDiv){
        if(!cDiv) return;
        const st=cDiv.dataset.state||'';
        if(dragMode===null){
          // 第一次决定模式
            if(st==='filled') dragMode='erase';
            else if(st==='marked') dragMode='unmark';
            else dragMode='fill';
        }
        if(dragMode==='fill') setFilled(cDiv,true);
        else if(dragMode==='erase') setFilled(cDiv,false);
        else if(dragMode==='mark') setMarked(cDiv,true);
        else if(dragMode==='unmark') setMarked(cDiv,false);
      }
      function setFilled(cellDiv,val){
        if(val){ cellDiv.dataset.state='filled'; cellDiv.className='cell filled'; }
        else { cellDiv.dataset.state=''; cellDiv.className='cell'; }
      }
      function setMarked(cellDiv,val){
        if(val){ cellDiv.dataset.state='marked'; cellDiv.className='cell marked'; }
        else { cellDiv.dataset.state=''; cellDiv.className='cell'; }
      }
      function handlePointer(e){
        if(!mouseDown) return;
        const target=e.target.closest('.cell');
        if(target){
          applyAction(target);
          onChange(+target.dataset.x,+target.dataset.y);
        }
      }
  window.addEventListener('mouseup', () => { mouseDown = false; dragMode = null; });
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const div=document.createElement('div');
          div.className='cell';
          div.style.width=div.style.height=cell+'px';
          div.dataset.x=x; div.dataset.y=y;
          div.addEventListener('mousedown', e => {
            mouseDown = true;
            if (e.button === 2) {
              dragMode = (div.dataset.state === 'marked') ? 'unmark' : 'mark';
              applyAction(div);
            } else if (e.button === 0) {
              dragMode = null; // 让 applyAction 决定
              applyAction(div);
            }
            onChange(x, y);
          });
          div.addEventListener('mouseenter', handlePointer);
          div.addEventListener('touchstart', e => { e.preventDefault(); dragMode = null; applyAction(div); onChange(x, y); });
          cells[y][x]=div;
          container.appendChild(div);
        }
      }
      return {
        reset(){
          for(let y=0;y<h;y++) for(let x=0;x<w;x++){ const c=cells[y][x]; c.dataset.state=''; c.className='cell'; }
        }
      };
    }
    function autoCellSize(w,h, maxW, maxH, maxCell, minCell){
      // 简单策略：取最大全局尺寸限制内的 cell 像素
      let cell = Math.floor(Math.min(maxCell, Math.max(minCell, Math.min(maxW / w, maxH / h))));
      return { cell };
    }
    function checkComplete(solution, container){
      for(const cell of container.querySelectorAll('.cell')){
        const x = +cell.dataset.x, y = +cell.dataset.y;
        const shouldFill = solution[y][x]===1;
        const isFilled = cell.dataset.state==='filled';
        if(shouldFill && !isFilled) return false; // 必须填的没填
        if(!shouldFill && isFilled) return false; // 多填
      }
      return true;
    }
    // 简化完成动画：锁定 -> 网格淡出(0.6s) -> 图片淡入(0.9s)
    function runCompletionAnimation(){
      if(gridContainer.dataset.animDone) return;
      gridContainer.dataset.animDone='1';
      const GRID_FADE_DURATION = 600; // ms
      gridContainer.classList.add('completed-locked','grid-fade-out');
      // 完成后禁用重置按钮
      btnReset.disabled = true;
      // 完成后禁用提示按钮
      if(btnHint) btnHint.disabled = true;
      const revealImg = gridScroller.querySelector('.nonogram-reveal-img');
      // 若存在图片且有 src 则淡入；若无图片，仍然保证按钮可点击
      setTimeout(()=>{ 
        if(revealImg && revealImg.getAttribute('src')) revealImg.classList.add('show');
        // 再次强化按钮启用（防止极端情况下其它逻辑改动状态）
        if(btnNext){ btnNext.disabled=false; btnNext.removeAttribute('disabled'); }
      }, GRID_FADE_DURATION);
    }
    // 旧的 updateClueHighlights 被拆分为局部的 updateRowHighlight / updateColHighlight
    function extractRuns(grid, index, mode){
      const cells = [];
      if(mode==='row'){
        cells.push(...grid.querySelectorAll(`.cell[data-y='${index}']`));
        cells.sort((a,b)=> (+a.dataset.x)-(+b.dataset.x));
      } else {
        cells.push(...grid.querySelectorAll(`.cell[data-x='${index}']`));
        cells.sort((a,b)=> (+a.dataset.y)-(+b.dataset.y));
      }
      const runs=[]; let run=0;
      for(const c of cells){
        if(c.dataset.state==='filled'){ run++; }
        else if(run>0){ runs.push(run); run=0; }
      }
      if(run>0) runs.push(run);
      return runs.length? runs : [0];
    }
    function arraysEqual(a,b){ if(a.length!==b.length) return false; for(let i=0;i<a.length;i++) if(a[i]!==b[i]) return false; return true; }
    // 评估当前填色 runs 相对 clue 的状态: ok | over | partial
    function evaluateRuns(runs, clues){
      // 特殊：空行表示 [0]
      if(runs.length===1 && runs[0]===0){
        if(clues.length===1 && clues[0]===0) return 'ok';
        return 'partial';
      }
      const sumRuns = runs.reduce((a,b)=>a+b,0);
      const sumClues = clues.reduce((a,b)=>a+b,0);
      // 基本超限：段过多 / 总和超
      if(runs.length > clues.length) return 'over';
      if(sumRuns > sumClues) return 'over';
      // 若已完全匹配（顺序长度都一致）直接 ok
      if(arraysEqual(runs, clues)) return 'ok';
      // 允许当前 runs 对应 clues 的一个保持顺序的子序列
      // 贪心：对每个 run 找到下一个 >= run 的 clue
      let ci = 0; // index in clues we are trying to match from
      for(const r of runs){
        let found = false;
        while(ci < clues.length){
          if(clues[ci] >= r){ found = true; ci++; break; }
          ci++; // 跳过更短的 clue（因为该 clue 不可能再满足 r）
        }
        if(!found) return 'over'; // 找不到可容纳该 run 的 clue => 超出
        if(r > Math.max(...clues)) return 'over'; // 防御：比所有 clue 都大
      }
      // 通过子序列匹配，尚未违规 => partial
      return 'partial';
    }

    // 图像生成相关函数已移除（现在使用人工/预生成的 JSON）

  }
  async exit(){ audioManager.stopBGM('3',{ fadeOut:500 }); }
}
