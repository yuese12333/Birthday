/**
 * Scene2 — 四科小游戏 (语 / 数 / 英 / 理综)
 *
 * 目标与设计要点
 * - 零挫败体验：无论答错或跳过都尽量给分（错误标记为 _pamperedWrong，跳过标记为 _skipped），鼓励探索与陪伴感。
 * - 数据驱动：题库由外部文件 `data/scene2_questions.json` 提供并完全替换内置数据；外部文件缺失或为空时会抛错（项目要求必须提供题库）。
 * - 稳定性：通过场景管理器与 DOM 清理避免重复渲染；按钮使用 _locked 属性防止连击。
 * - 可扩展：题型、计分、成就等在集中位置可扩展。
 *
 * 主要规则
 * - 得分：每题基础分 2 × 难度权重（easy=1, medium=2, hard=3）。正确 / 跳过 / 宠溺错误均按此给分。
 * - 提示：每题最多 3 次提示（hintCount）。前两次展示提示文本，第 3 次自动判定为通过并展示答案。
 * - 彩蛋判定（互斥优先级）：全跳过 > 全自动提示（第三次）> 全错误宠溺；另有半数跳过的计算但不优先触发。
 * - 计时：按科目独立计时，进入科目启动 5 分钟倒计时；完成后停止；科目间若 30 秒未开始下一科会触发过渡提示。
 *
 * 数据契约（question 对象）
 * {
 *   type: 'fill' | 'single_select' | 'multi_select',
 *   difficulty: 'easy' | 'medium' | 'hard',
 *   prompt, answer / answerIndex, options?, placeholder?, hints?: [],
 *   solved?: bool, hintCount?: number, _skipped?: bool, _pamperedWrong?: bool
 * }
 *
 * 可扩展方向示例：seriousMode（关闭宠溺规则）、成就系统、更多题型（拖拽/配对/听力）等。
 */
import { BaseScene } from '../core/baseScene.js';
import { audioManager } from '../core/audioManager.js';

// 难度权重：影响统一得分（当前统一公式：2 * weight）
// 可扩展：在外部 JSON 的题目里声明 difficulty（若缺省按科目默认 / easy）
const DIFFICULTY_WEIGHT = { easy: 1, medium: 2, hard: 3 };

// 题型渲染/输入注册表：未来添加新题型时只需 push 一个 handler
// handler 接口：({q, wrapper}) => { 返回需要的 input/select DOM 字符串或直接操作 wrapper }
const QUESTION_TYPE_REGISTRY = {
  fill: (q)=> `<input class='q-input' data-qtype='fill' placeholder='${q.placeholder||''}' />`,
  // 单选：显示所有选项，左侧为可点击的勾选框（单选时只允许选中一个）
  single_select: (q)=> `
    <div class='q-opts' data-qtype='single_select'>
      ${(q.options||[]).map((o,i)=>`
        <label class='q-opt' data-index='${i}'>
          <input type='checkbox' class='q-opt-input' name='qopt' value='${i}' />
          <span class='q-opt-label'>${o}</span>
        </label>
      `).join('')}
    </div>
  `,
  // 多选：显示所有选项，左侧为复选框，可多选
  multi_select: (q)=> `
    <div class='q-opts' data-qtype='multi_select'>
      ${(q.options||[]).map((o,i)=>`
        <label class='q-opt' data-index='${i}'>
          <input type='checkbox' class='q-opt-input' name='qopt' value='${i}' />
          <span class='q-opt-label'>${o}</span>
        </label>
      `).join('')}
    </div>
  `,
  // 不再支持旧别名 'select'，只保留 single_select 与 multi_select
  // 预留：dragMatch / order / audio 等
};

/**
 * 统一抽取用户答案：新增题型时在此 switch 添加分支
 */
function extractUserAnswer(wrapper, q){
  switch(q.type){
    case 'fill': return wrapper.querySelector('.q-input')?.value.trim();
    case 'single_select': {
      const el = wrapper.querySelector('.q-opts');
      if(!el) return '';
      const checked = el.querySelector('.q-opt-input:checked');
      return checked ? checked.value : '';
    }
    case 'multi_select': {
      const el = wrapper.querySelector('.q-opts');
      if(!el) return [];
      return [...el.querySelectorAll('.q-opt-input:checked')].map(n=>parseInt(n.value,10));
    }
    default: return '';
  }
}

/**
 * 判定正确性：可在未来扩展不同题型的比较策略
 */
function isAnswerCorrect(q, userAns){
  if(q.type==='fill') return userAns === q.answer;
  if(q.type==='single_select'){
    const correctIndex = (typeof q.answerIndex !== 'undefined') ? q.answerIndex : q.answer;
    return parseInt(userAns,10) === parseInt(correctIndex,10);
  }
  if(q.type==='multi_select'){
    // q.answerIndex expected to be an array of indices
    const correctArr = Array.isArray(q.answerIndex) ? q.answerIndex : (Array.isArray(q.answer) ? q.answer : null);
    if(!Array.isArray(correctArr)) return false;
    if(!Array.isArray(userAns)) return false;
    // compare as sets (order-insensitive)
    const a = [...new Set(userAns)].sort();
    const b = [...new Set(correctArr)].sort();
    if(a.length !== b.length) return false;
    for(let i=0;i<a.length;i++) if(a[i] !== b[i]) return false;
    return true;
  }
  return false; // 未知题型默认 false（或可改为 true 宽松模式）
}

function getAnswerReveal(q){
  if(q.type === 'fill') return q.answer;
  if(q.type === 'single_select'){
    const idx = (typeof q.answerIndex !== 'undefined') ? q.answerIndex : q.answer;
    return q.options?.[idx] || '';
  }
  if(q.type === 'multi_select'){
    const arr = Array.isArray(q.answerIndex) ? q.answerIndex : (Array.isArray(q.answer) ? q.answer : []);
    return arr.map(i=> q.options?.[i]).filter(Boolean).join(', ');
  }
  return '';
}

export class Scene2Exam extends BaseScene {
  /**
   * 初始化：
   *  - 设定默认内置题库（四科），结构与外部 JSON 兼容。
   *  - 尝试加载 external scene2_questions.json（替换模式：成功后完全覆盖默认）。
   *  - 初始化计分与统计字段。
   */
  async init(){
    await super.init();
    // 不再内置默认题库：直接加载 external questions.json（若失败或为空将导致后续逻辑异常，符合“必须提供外部题库”要求）
    const resp = await fetch('./data/scene2_questions.json');
    if(!resp.ok) throw new Error('题库加载失败 (HTTP)');
    const data = await resp.json();
    const built = this.buildSubjectsFromExternal(data);
    if(!built.length) throw new Error('外部题库为空或无法解析');
    this.subjects = built;
    console.info('题库加载成功：使用 external scene2_questions.json');
    this.score = 0;
    // 每科得分统计
    this.subjectScores = {}; // key -> score
    this.hintsUsed = 0;
    this.skippedQuestions = 0; // 统计宠溺跳过次数
    this.totalQuestionsCount = () => this.subjects.reduce((a,s)=> a + s.questions.length,0);
  }
  /**
   * 将 external JSON 数据转换为内部统一结构。
   * @param {Object} data scene2_questions.json 解析结果
   * @returns {Array} subjects 数组
   */
  buildSubjectsFromExternal(data){
    // 先按科目 key 分别生成（可能为 undefined），最后按固定顺序组装返回
    const byKey = {};
    // 语文（填空）
    if(Array.isArray(data.chinesePoemFill) && data.chinesePoemFill.length){
      byKey.chinese = {
        key:'chinese', title:'语文', done:false,
        questions: data.chinesePoemFill.map(item=>({
          type: item.questionType || item.type || 'fill',
          difficulty: item.difficulty || 'easy',
          prompt: item.question.includes('_____') ? item.question.replace('_____','') : item.question,
          answer: item.answer,
          options: item.options || [],
          placeholder:'_____', hints: item.hints || [], solved:false,
          correctMsg: item.encourageCorrect, wrongMsg: item.encourageWrong
        }))
      };
    }
    // 数学（填空）
    if(Array.isArray(data.mathPuzzles) && data.mathPuzzles.length){
      byKey.math = {
        key:'math', title:'数学', done:false,
        questions: data.mathPuzzles.map(item=>{
          const base = {
            type: item.questionType || item.type || 'fill',
            difficulty: item.difficulty || 'medium',
            prompt: item.question,
            hints: item.hints || [], solved:false,
            correctMsg: item.encourageCorrect, wrongMsg: item.encourageWrong
          };
          // if options present, keep them and preserve answer as-is (for select types)
          if(Array.isArray(item.options) && item.options.length){
            return Object.assign({}, base, { options: item.options, answer: item.answer, placeholder:'答案' });
          }
          // otherwise treat as fill and coerce answer to string safely
          let ans = '';
          if(typeof item.answer === 'string'){
            ans = item.answer.split(' ')[0];
          }else if(Array.isArray(item.answer) && item.answer.length){
            ans = String(item.answer[0]);
          }else if(item.answer != null){
            ans = String(item.answer);
          }
          return Object.assign({}, base, { answer: ans, placeholder:'答案' });
        })
      };
    }
    // 英语（匹配 → 填空）
    if(Array.isArray(data.englishMatch) && data.englishMatch.length){
      byKey.english = {
        key:'english', title:'英语', done:false,
        questions: data.englishMatch.map(item=>({
          type: item.questionType || item.type || 'fill',
          difficulty: item.difficulty || item.difficulty || 'easy',
          prompt: item.question || `${item.word} 的中文是？`,
          answer: item.match || item.answer,
          options: item.options || [],
          placeholder:'中文', hints: item.hints || [], solved:false,
          correctMsg: item.encourageCorrect, wrongMsg: item.encourageWrong
        }))
      };
    }
    // 理综（选择）
    if(Array.isArray(data.scienceQuiz) && data.scienceQuiz.length){
      byKey.science = {
        key:'science', title:'理综', done:false,
        questions: data.scienceQuiz.map(item=>({
          type: item.questionType || item.type || 'single_select',
          difficulty: item.difficulty || 'medium', prompt:item.question, options:item.options, answerIndex:item.answer, hints: item.hints || [], solved:false,
          correctMsg: item.encourageCorrect, wrongMsg: item.encourageWrong
        }))
      };
    }
    const order = ['chinese','math','science','english'];
    return order.map(k => byKey[k]).filter(Boolean);
  }
  /**
   * 场景进入：
   *  - 清理潜在残留 DOM（防极端并发 go 导致的多副本）。
   *  - 构建主 UI：标签栏 / 分数 / 计时器 / 题目面板 / 状态 / 总结卡片。
   *  - 启动 5 分钟循环倒计时；到 0 重置并输出宠溺信息。
   *  - 渲染第一个科目。
   */
  async enter(){
    // 保险：若极端情况下多次并发 go 造成重复残留，这里主动清理已有 exam 场景节点
    const existing = this.ctx.rootEl.querySelectorAll('.scene-exam');
    if(existing.length){ existing.forEach(node=> node.remove()); }
    const el = document.createElement('div');
    el.className='scene scene-exam';
    // 统一通过 BaseScene 公共方法禁用文字选择
    this.applyNoSelect(el);
    // Styles for Scene 2 have been moved to the central stylesheet: css/styles.css
    // Please ensure <link rel="stylesheet" href="./css/styles.css"> is included in the host HTML.
    el.innerHTML = `
      <h1>场景2：高考小考站</h1>
      <div class='exam-top'>
        <div class='tabs'></div>
        <div class='meta'>分数 <span class='score'>0</span> | 计时 <span class='timer'>05:00</span> | <button class='bgm-btn' data-debounce title='好听的音乐'>♪</button></div>
      </div>
      <div class='board'></div>
      <div class='status'></div>
      <div class='summary hidden'></div>
      <button class='finish' hidden>全部通过，进入下一阶段</button>
    `;
    const tabsBox = el.querySelector('.tabs');
    const board = el.querySelector('.board');
    const status = el.querySelector('.status');
    const finishBtn = el.querySelector('.finish');
    const scoreEl = el.querySelector('.score');
    const breakdownEl = document.createElement('div');
    breakdownEl.className = 'score-breakdown';
    // 将分数分解展示放在 meta 下
    el.querySelector('.meta').appendChild(breakdownEl);
    const timerEl = el.querySelector('.timer');
    const summaryEl = el.querySelector('.summary');
    const bgmBtn = el.querySelector('.bgm-btn');
    // 默认进入即尝试播放（可能被浏览器策略阻止；若阻止则第一次点击会重新尝试）
    const bgmAudio = audioManager.playSceneBGM('2',{ loop:true, volume:0.6, fadeIn:800 });
    bgmBtn.addEventListener('click',()=>{
      // 若因自动播放策略被拦截，click 时再尝试播放
      if(bgmAudio && bgmAudio.paused){
        const p = bgmAudio.play();
        if(p) p.catch(()=>{/* 仍失败则静默 */});
        audioManager.globalMuted = false;
        bgmAudio.muted = false;
        bgmBtn.classList.remove('muted');
        return;
      }
      const muted = audioManager.toggleMute();
      bgmBtn.classList.toggle('muted', muted);
    });
    // 计时器：5分钟循环倒计时
    // 新：单科计时控制变量
    this._subjectTimer = null;          // 当前科目倒计时 interval
    this._subjectRemain = 0;            // 剩余秒数（该科）
    this._betweenTimer = null;          // 科目间30秒等待彩蛋计时器
    const formatTime = (s)=>{ const m=Math.floor(s/60).toString().padStart(2,'0'); const sec=(s%60).toString().padStart(2,'0'); return `${m}:${sec}`; };
    const startSubjectTimer = ()=>{
      stopSubjectTimer();
      this._subjectRemain = 300; // 5分钟
      timerEl.textContent = formatTime(this._subjectRemain);
      this._subjectTimer = setInterval(()=>{
        this._subjectRemain--;
        if(this._subjectRemain <= 0){
          stopSubjectTimer();
          status.innerHTML = `<span class='ok'>这一科时间到啦~ 不着急，我陪你慢慢来 (可继续做完剩余题目)</span>`;
        }
        if(timerEl) timerEl.textContent = formatTime(Math.max(0,this._subjectRemain));
      },1000);
    };
    const stopSubjectTimer = ()=>{ if(this._subjectTimer){ clearInterval(this._subjectTimer); this._subjectTimer=null; } };
    const startBetweenTimer = (nextSubject)=>{
      stopBetweenTimer();
      let wait = 30; // 30 秒未进入下一科彩蛋
      this._betweenTimer = setInterval(()=>{
        wait--;
        if(wait<=0){
          stopBetweenTimer();
          // 只有在下一科还没开始且未全部完成时提示
          if(!nextSubject.done){
            const lines=[
              `要不要我们一起开始 ${nextSubject.title} ？我已经把桌子擦好啦~`,
              `下一科 ${nextSubject.title} 在等你，我先偷偷给你加好运。`,
              `休息够了吗？${nextSubject.title} 说：点我点我！`,
              `拖延症不用怕，我陪你，一起打开 ${nextSubject.title} ~`
            ];
            status.innerHTML = `<span class='ok between-hint'>${lines[Math.floor(Math.random()*lines.length)]}</span>`;
          }
        }
      },1000);
    };
    const stopBetweenTimer = ()=>{ if(this._betweenTimer){ clearInterval(this._betweenTimer); this._betweenTimer=null; } };

    /* 渲染顶部科目标签；点击切换当前主科目。*/
    const renderTabs = ()=>{
      // 固定科目顺序：语文、数学、理综、英语（若外部 JSON 顺序不同，按此顺序显示）
      const orderKeys = ['chinese','math','science','english'];
      const ordered = orderKeys.map(k => this.subjects.find(s => s.key === k)).filter(Boolean);
      const firstUnfinished = ordered.find(s=>!s.done);
      // 仅渲染已解锁或已完成的科目按钮，未解锁的保持隐藏
      tabsBox.innerHTML = ordered
      .filter(s => {
        const locked = !!(firstUnfinished && s.key !== firstUnfinished.key && !s.done);
        return !locked || s.done || s.key === this._activeSubjectKey || s.key === this._displayedSubjectKey;
      })
      .map(s=>{
        const activeCls = (s.key === this._activeSubjectKey) ? ' active' : '';
        const dispCls = (s.key === this._displayedSubjectKey) ? ' displayed' : '';
        return `<button class='tab${activeCls}${dispCls}' data-sub='${s.key}'>${s.title}${s.done?'✔':''}</button>`;
      }).join('');
      tabsBox.querySelectorAll('.tab').forEach(tb=> tb.addEventListener('click',()=>{
        const key = tb.dataset.sub;
        // 若点击当前正在显示的科目，忽略操作
        if(key === this._displayedSubjectKey) return;
        const s = this.subjects.find(x=>x.key===key);
        if(!s) return;
        // 点击已完成科目：仅作为查看（不重启计时），但会切换显示
        if(s.done){
          stopSubjectTimer();
          stopBetweenTimer();
          this._displayedSubjectKey = s.key;
          renderTabs();
          board.innerHTML = `<div class='paper'><p>${s.title} 已完成 ✔</p></div>`;
          return;
        }
        // 只允许点击第一个未完成科目以开始它；未解锁则不允许
        const first = ordered.find(ss=>!ss.done);
        if(first && s.key !== first.key) return;
        stopBetweenTimer();
        // 标记为当前活动科目并启动计时
        this._activeSubjectKey = s.key;
        this._displayedSubjectKey = s.key;
        renderTabs();
        // 切换到未完成科目时也清空 status，以免看到之前的“已完成”提示
        status.textContent = '';
        renderSubject(s, true);
      }));
    };

    /**
     * 渲染某科目的下一题；若该科全部完成则显示完成提示。
     * @param {Object} subject 当前学科对象
     */
    const renderSubject = (subject, startTimer=false)=>{
      // 找到第一道未完成的题
      const nextQ = subject.questions.find(q=>!q.solved);
      if(!nextQ){
        subject.done = true;
        // 若当前显示的科目就是刚完成的科目，则把显示切换到该科（保持一致）
        this._displayedSubjectKey = subject.key;
        renderTabs();
        status.textContent = subject.title + ' 已完成！';
        checkAll();
        board.innerHTML = `<div class='paper'><p>${subject.title} 全部题目完成 ✔</p></div>`;
        // 若还有下一科且未完成，显示进入下一科目的按钮
        const idx = this.subjects.findIndex(s=> s.key===subject.key);
        const nextSubject = this.subjects[idx+1];
        if(nextSubject && !nextSubject.done){
          const btn = document.createElement('button');
          btn.className = 'next-subject-btn';
          btn.textContent = `进入下一科：${nextSubject.title}`;
          btn.addEventListener('click',()=>{
            // 用户选择立即进入下一科：清理任何等待计时器，避免在切换后仍触发懒散提示
            stopBetweenTimer();
            // 切换到下一科并开始计时
            this._activeSubjectKey = nextSubject.key;
            this._displayedSubjectKey = nextSubject.key;
            renderTabs();
            // 清理完成提示，进入下一科时不应保留之前的完成文案
            status.textContent = '';
            renderSubject(nextSubject, true);
          });
          board.appendChild(btn);
          // 停止当前科目计时，启动科目间等待计时（若还有下一科）
          stopSubjectTimer();
          // 仅在按钮已展示后才启动 between 计时器；若用户点击按钮我们在处理器中会清理计时器
          if(nextSubject){
            startBetweenTimer(nextSubject);
          }
        } else {
          // 无下一科：依旧停止科目计时
          stopSubjectTimer();
        }
        return;
      }
      board.innerHTML = '';
      const wrapper = document.createElement('div'); // 单题容器（动态重建）
      wrapper.className='paper';
      const diffTag = `<span class='diff diff-${nextQ.difficulty}'>${nextQ.difficulty}</span>`;
      let inputHtml='';
      if(QUESTION_TYPE_REGISTRY[nextQ.type]){
        inputHtml = QUESTION_TYPE_REGISTRY[nextQ.type](nextQ);
      } else {
        // 未知题型：提示并降级为填空
        inputHtml = QUESTION_TYPE_REGISTRY.fill({placeholder:'(未知题型降级为填空)'});
      }
      // 如果是 single_select，需要把默认生成的 checkbox inputs 改为 radio 并赋予一个题目唯一 name
      if(nextQ.type === 'single_select'){
        const uniqueName = `q_${subject.key}_${Math.floor(Math.random()*1000000)}`;
        // 将所有 input[type=checkbox] 替换为 input[type=radio] 并注入 name
        inputHtml = inputHtml.replace(/type='checkbox'/g, `type='radio' name='${uniqueName}'`);
        inputHtml = inputHtml.replace(/type=\"checkbox\"/g, `type=\"radio\" name=\"${uniqueName}\"`);
      }
      const typeLabel = (nextQ.type === 'fill') ? '填空题' : (nextQ.type === 'single_select' ? '单选题' : (nextQ.type === 'multi_select' ? '多选题' : nextQ.type));
      wrapper.innerHTML = `
        <p>${diffTag} <span class='q-type-label'>${typeLabel}</span> ${nextQ.prompt}</p>
        <div class='q-box'>${inputHtml}</div>
        <div class='actions'>
          <button class='hint-btn'>提示</button>
          <button class='submit-btn'>提交</button>
          <button class='skip-love-btn'>不会但我超可爱</button>
        </div>
        <div class='hint-area'></div>
        <div class='progress-mini'>本科进度：${subject.questions.filter(q=>q.solved).length}/${subject.questions.length}</div>
      `;
      board.appendChild(wrapper);
      const optsContainer = wrapper.querySelector('.q-opts');
      if((nextQ.type === 'single_select' || nextQ.type === 'multi_select') && !optsContainer){
        console.warn('select type but .q-opts missing for question:', nextQ);
      }
      if(startTimer){
        // 进入新科目：清理可能残留的懒散彩蛋提示
        const bh = status.querySelector('.between-hint');
        if(bh) bh.remove();
        // 进入下一科目时清空 status 文本，避免保留「已完成」等提示
        status.textContent = '';
        startSubjectTimer();
      }
      // 切换到某科目进行答题时，更新当前显示科目 key
      this._displayedSubjectKey = subject.key;

      const hintBtn = wrapper.querySelector('.hint-btn');
      const submitBtn = wrapper.querySelector('.submit-btn');
      const skipBtn = wrapper.querySelector('.skip-love-btn');
      const hintArea = wrapper.querySelector('.hint-area');

      // 提示按钮逻辑：前两次依次显示 JSON 中的 hints[0], hints[1]；第三次自动给答案
      hintBtn.addEventListener('click',()=>{
        if(nextQ.solved) return; // 已完成无需提示
        nextQ.hintCount = (nextQ.hintCount||0) + 1;
        this.hintsUsed++;
        const hintsArr = Array.isArray(nextQ.hints) ? nextQ.hints : [];
        if(nextQ.hintCount <= 2){
          const idx = nextQ.hintCount - 1; // 0 或 1
          const text = hintsArr[idx] || (idx===0 ? '暂无提示' : (hintsArr[0] ? hintsArr[0] : '没有更多提示了'));
          const label = nextQ.hintCount === 1 ? '提示①' : '提示②';
          // 累积显示，不覆盖之前提示
          const line = document.createElement('div');
          line.className = 'hint-line';
          line.textContent = `${label}：${text}`;
          hintArea.appendChild(line);
          // 按需求：按钮文字保持恒定为“提示”不做变化
          hintBtn.textContent = '提示';
        } else {
          // 第三次：直接送答案并判定通过
          nextQ.solved = true;
          nextQ._autoHint = true;
          const base = 2;
          const weight = DIFFICULTY_WEIGHT[nextQ.difficulty] || 1;
          const gained = base * weight;
          addScoreToSubject(subject.key, gained);
          const answerReveal = getAnswerReveal(nextQ);
          // 覆盖之前的提示行
          hintArea.innerHTML = `<span class='auto-answer'>直接送你答案：<strong>${answerReveal}</strong></span>`;
          status.innerHTML = `<span class='ok'>第三次提示：我直接把答案告诉你啦~</span> <em>+${gained} 分</em>`;
          updateHUD();
          wrapper._locked = true;
          hintBtn.textContent = '提示';
          hintBtn.disabled = true; submitBtn.disabled = true; skipBtn.disabled = true;
          setTimeout(()=> renderSubject(subject), 600);
        }
      });

      // 提交按钮：判断正误；正确=加分；错误=宠溺满分 + 答案展示
      submitBtn.addEventListener('click',()=>{
        if(wrapper._locked) return; // 操作锁
        let userAns='';
        userAns = extractUserAnswer(wrapper, nextQ);
        // 空输入/未选择：不给分也不判错，给予轻提示
        const isEmpty = (nextQ.type==='fill' && userAns==='') 
          || ((nextQ.type==='select' || nextQ.type==='single_select') && (userAns === '' || userAns == null))
          || (nextQ.type==='multi_select' && Array.isArray(userAns) && userAns.length === 0);
        if(isEmpty){
          status.innerHTML = `<span class='err'>先填写/选择一个答案再提交哦~</span>`;
          wrapper.classList.add('shake-mini');
          setTimeout(()=> wrapper.classList.remove('shake-mini'),400);
          return;
        }
        const correct = isAnswerCorrect(nextQ, userAns);
        if(correct){
          nextQ.solved = true;
          const base = 2; // 基础分
          const weight = DIFFICULTY_WEIGHT[nextQ.difficulty] || 1;
          const gained = base*weight; // 不再因提示扣分
          addScoreToSubject(subject.key, gained);
          status.innerHTML = `<span class='ok'>${nextQ.correctMsg || '太棒啦！'}</span> <em>+${gained} 分</em>`;
          updateHUD();
          wrapper._locked = true;
          submitBtn.disabled = true; skipBtn.disabled = true; hintBtn.disabled = true;
          setTimeout(()=> renderSubject(subject), 400);
        } else {
          // 宠溺错误模式：也判定通过，并给予“完整得分”且展示正确答案
          nextQ.solved = true;
          nextQ._pamperedWrong = true;
          const base = 2;
            const weight = DIFFICULTY_WEIGHT[nextQ.difficulty] || 1;
            // 按正确答题同一公式给予完整分数（不因提示减少，体现“被宠”）
            const gained = base * weight;
            addScoreToSubject(subject.key, gained);
            const answerReveal = getAnswerReveal(nextQ);
            const pamperWrongLines = [
              '答错也没关系，我在乎的是你陪我玩。',
              '错了？那我补一个正确答案给你，再顺便奖励你。',
              '出题人（就是我）决定：可爱值抵消错误。',
              '这题放过你，抱一下就当会了。'
            ];
            const line = pamperWrongLines[Math.floor(Math.random()*pamperWrongLines.length)];
            status.innerHTML = `<span class='ok'>${line} 正确答案：<strong>${answerReveal}</strong></span> <em>+${gained} 分 (宠溺错误满分)</em>`;
            updateHUD();
            wrapper.classList.add('shake-mini');
            wrapper._locked = true;
            submitBtn.disabled = true; skipBtn.disabled = true; hintBtn.disabled = true;
            setTimeout(()=> wrapper.classList.remove('shake-mini'),400);
            setTimeout(()=> renderSubject(subject), 600);
        }
      });

      // 宠溺跳过，给分，显示暖心话
      // 跳过按钮：视为“宠溺跳过”满分通过
      skipBtn.addEventListener('click',()=>{
        if(wrapper._locked) return; // 操作锁
        if(nextQ.solved) return;
        nextQ.solved = true;
        nextQ._skipped = true; // 标记此题由跳过获得
        // 跳过算正确答题
        const base = 2;
        const weight = DIFFICULTY_WEIGHT[nextQ.difficulty] || 1;
        const gained = base * weight; 
        addScoreToSubject(subject.key, gained);
        this.skippedQuestions++;
        const pamperLines = [
          '不会也没关系，我负责所有你不会的部分。',
          '跳过授权通过，因为你可爱度溢出。',
          '这题我替你写，分数记在我们头上。',
          '略过！比起答案，更想先摸摸你的头。'
        ];
        const line = pamperLines[Math.floor(Math.random()*pamperLines.length)];
        status.innerHTML = `<span class='ok'>${line}</span> <em>+${gained} 分 (宠溺跳过)</em>`;
        updateHUD();
        wrapper._locked = true;
        submitBtn.disabled = true; skipBtn.disabled = true; hintBtn.disabled = true;
        setTimeout(()=> renderSubject(subject), 500);
      });
      };

    /** 更新 HUD（目前只有分数，可扩展显示提示次数等） */
    const updateHUD = ()=>{
      scoreEl.textContent = this.score;
      // 更新分科统计显示
      const parts = (this.subjects||[]).map(s=>{
        const sc = this.subjectScores[s.key] || 0;
        return `<span class='sb-item' data-sub='${s.key}'>${s.title}: ${sc}</span>`;
      }).join(' ');
      breakdownEl.innerHTML = parts;
    };

    // helper: 给某科目和总分添加分数
    const addScoreToSubject = (subjectKey, amount)=>{
      this.score = (this.score||0) + amount;
      this.subjectScores[subjectKey] = (this.subjectScores[subjectKey]||0) + amount;
      updateHUD();
    };

    /** 检查所有科目是否完成，用于激活 “进入下一阶段” 按钮 */
    const checkAll = ()=>{
        if(this.subjects.every(s=>s.done)){
          finishBtn.hidden = false;
          renderSummary();
        }
      };

    /**
     * 渲染总结：
     *  - 统计总题数 / 得分 / 动态评价。
     *  - 计算彩蛋（互斥优先级）。
     */
    const renderSummary = ()=>{
      const totalQuestions = this.subjects.reduce((a,s)=> a + s.questions.length,0);
      summaryEl.classList.remove('hidden');
      const allSkipped = this.skippedQuestions === totalQuestions;
      // 取消 partialHighSkip 展示：仍计算但不再使用（保留变量以便未来需要恢复时方便）
      const partialHighSkip = !allSkipped && totalQuestions>0 && (this.skippedQuestions / totalQuestions >= 0.5);
      // 统计错误宠溺通过数量（既标记 _pamperedWrong 且未 _skipped）
      const pamperedWrongCount = this.subjects.reduce((acc,s)=> acc + s.questions.filter(q=> q._pamperedWrong).length,0);
      const allPamperedWrong = pamperedWrongCount === totalQuestions && totalQuestions>0; // 全部题都是错误宠溺
      // 统计自动提示完成
      const autoHintCount = this.subjects.reduce((acc,s)=> acc + s.questions.filter(q=> q._autoHint).length,0);
      const allAutoHint = autoHintCount === totalQuestions && totalQuestions>0;
      // 新版彩蛋展示：使用 GIF 图片，不再使用 ::after emoji；互斥顺序：全跳过 > 全自动提示 > 全错误宠溺；忽略 partialHighSkip
      let easterHTML = '';
      if(allSkipped){
        easterHTML = `
          <div class='easter-skip easter-block'>
            <img src="./assets/images/allSkipped.gif" alt="全跳过彩蛋" />
            <div class='text'>你怎么全部跳过啦？罚你补一个超级长的抱抱，然后亲我一口 ❤</div>
          </div>`;
      } else if(allAutoHint){
        easterHTML = `
          <div class='easter-pampered-wrong easter-block'>
            <img src="./assets/images/allAutoHint.gif" alt="全自动提示彩蛋" />
            <div class='text'>全部靠第三次提示解锁？表示你超会软软求助，判定为『终身被我包办难题特权』 ❤</div>
          </div>`;
      } else if(allPamperedWrong){
        easterHTML = `
          <div class='easter-pampered-wrong easter-block'>
            <img src="./assets/images/allPamperedWrong.gif" alt="全错误宠溺彩蛋" />
            <div class='text'>所有题都通过“答错被宠”方式过关？！说明你已经掌握『用可爱征服一切』技能 ❤</div>
          </div>`;
      }
      summaryEl.innerHTML = `
        <div class='summary-card'>
          <h3>阶段成绩</h3>
          <p>总题数：${totalQuestions}</p>
          <p>总得分：${this.score}</p>
          <div class='subject-breakdown'>
            ${(this.subjects||[]).map(s=>`<div class='sb-line'>${s.title}: ${this.subjectScores[s.key]||0}</div>`).join('')}
          </div>
          <p>评价：${this.score >= totalQuestions*4 ? '学霸模式开启！' : this.score >= totalQuestions*3 ? '很棒的默契～' : '分数不是全部，心意最重要'}</p>
          ${easterHTML}
        </div>
      `;
    };

    renderTabs();
    // 自动进入第一科并启动计时
    // 初始化 active subject（默认按顺序：语文、数学、理综、英语）
    this._activeSubjectKey = this.subjects[0] && this.subjects[0].key;
    renderSubject(this.subjects[0], true);

      finishBtn.addEventListener('click',()=> this.ctx.go('timeline'));
      this.ctx.rootEl.appendChild(el);
  }
  /**
   * 场景退出：清理倒计时 interval，防止脱离场景仍继续执行。
   */
  async exit(){
    // 清理循环计时器，避免场景切换后仍然运行
    // 清理所有计时器
    if(this._subjectTimer){ clearInterval(this._subjectTimer); this._subjectTimer=null; }
    if(this._betweenTimer){ clearInterval(this._betweenTimer); this._betweenTimer=null; }
    // 淡出停止本场景 BGM
    audioManager.stopBGM('2',{ fadeOut:700 });
  }
}
