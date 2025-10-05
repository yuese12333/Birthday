/**
 * 场景2：高考四科小游戏（语/数/英/理综）
 * 设计理念：
 *  - 零挫败：答错也给满分（标记 _pamperedWrong），跳过也给分（_skipped），第三次提示直接送答案。
 *  - 情感陪伴：所有“失败路径”都会输出宠溺 / 鼓励话语，维持轻松甜蜜氛围。
 *  - 数据驱动：题库优先从 external JSON (questions.json) 替换加载；失败则使用内置 fallback。
 *  - 防并发/稳态：通过场景管理器 + 本地 DOM 清理，避免重复渲染；按钮加 _locked 防连击。
 *  - 可扩展：score 公式集中、题目对象字段统一，可后续添加科目、题型或成就统计。
 *
 * 主要机制概览：
 *  1. 得分：正确 = 2 * 难度权重；跳过 = 同上；错误 = 同上（满分宠溺）；提示不扣分。
 *  2. 提示：一题可按下至多 3 次（hintCount）。前两次显示提示文本，第 3 次直接自动判定正确 + 给答案 + 给分。
 *  3. 彩蛋：全跳过 / 全错误宠溺 / ≥50% 跳过（互斥优先级：全跳过 > 全错误宠溺 > 半数跳过）。
 *  4. 计时：改为“单科独立计时”——进入科目启动 5 分钟倒计时；该科完成即停止；30 秒内未开始下一科触发彩蛋提醒。
 *
 * 关键字段：
 *   question: {
 *     type: 'fill' | 'select', difficulty: 'easy' | 'medium' | 'hard',
 *     prompt, answer / answerIndex, options?, placeholder?, hint,
 *     solved (是否完成), hintCount (提示次数), _skipped, _pamperedWrong
 *   }
 *
 * 可扩展建议：
 *  - seriousMode: 切换关闭跳过加分 / 错误满分。
 *  - achievements: 根据 _skipped/_pamperedWrong/hintsUsed 派生成就称号。
 *  - 题目类型扩展：拖拽 / 配对，可在 renderSubject 内按 type 分支拆分组件化。
 */
import { BaseScene } from '../core/baseScene.js';

// 难度权重：影响统一得分（当前统一公式：2 * weight）
const DIFFICULTY_WEIGHT = { easy: 1, medium: 2, hard: 3 };

export class Scene2Exam extends BaseScene {
  /**
   * 初始化：
   *  - 设定默认内置题库（四科），结构与外部 JSON 兼容。
   *  - 尝试加载 external questions.json（替换模式：成功后完全覆盖默认）。
   *  - 初始化计分与统计字段。
   */
  async init(){
    await super.init();
    // 默认内置题库（仅在外部加载失败或为空时使用）
    const defaultSubjects = [
      { key:'chinese', title:'语文', questions:[
        { type:'fill', difficulty:'easy', prompt:'补全：山有木兮木有枝，', answer:'心悦君兮君不知', placeholder:'_____', hint:'“心悦”二字是重点', solved:false, correctMsg:'诗意满分！你比王昭君还会写情书~', wrongMsg:'先别急，想想那句超级甜的古风情话。' },
        { type:'fill', difficulty:'medium', prompt:'补全：愿得一心人，', answer:'白首不相离', placeholder:'_____', hint:'四字成语感觉', solved:false, correctMsg:'白首不相离——愿望收到，系统加密存档 ❤', wrongMsg:'这句很经典，我们常看的那句誓言~' }
      ], done:false },
      { key:'math', title:'数学', questions:[
        { type:'fill', difficulty:'easy', prompt:'1 + 2 × 3 = ?', answer:'7', placeholder:'答案', hint:'乘法优先', solved:false, correctMsg:'逻辑清晰小天才 ✓', wrongMsg:'别被乘法优先级绊倒啦~' },
        { type:'fill', difficulty:'medium', prompt:'(5 + 1) × 2 - 3 = ?', answer:'9', placeholder:'答案', hint:'括号先算', solved:false, correctMsg:'脑回路很顺畅！继续保持！', wrongMsg:'再过一遍：括号→乘除→加减。' }
      ], done:false },
      { key:'english', title:'英语', questions:[
        { type:'fill', difficulty:'easy', prompt:'forever 的中文是？', answer:'永远', placeholder:'中文', hint:'以 “永” 开头', solved:false, correctMsg:'Forever = 永远喜欢你，就是这么直接~', wrongMsg:'再想想我们常说的“永____”那两个字。' },
        { type:'fill', difficulty:'medium', prompt:'destiny 的中文是？', answer:'命运', placeholder:'中文', hint:'命___', solved:false, correctMsg:'命运都被你握住啦~', wrongMsg:'命开头的两个字，超常见组合。' }
      ], done:false },
      { key:'science', title:'理综', questions:[
        { type:'select', difficulty:'easy', prompt:'水锅盖内壁小水珠主要由于？', options:['蒸发与冷凝','升华','分解'], answerIndex:0, hint:'两个过程组合', solved:false, correctMsg:'物理 + 生活经验完美结合！', wrongMsg:'试着回忆：水蒸气遇冷会发生什么？' },
        { type:'select', difficulty:'hard', prompt:'下列哪种现象主要和光的折射有关？', options:['彩虹','回声','铁生锈'], answerIndex:0, hint:'雨后天空', solved:false, correctMsg:'彩虹都为你折一下色~', wrongMsg:'提示：声音那个是声学现象不是光学哦。' }
      ], done:false }
    ];

  // 先假定使用默认，若外部加载成功则完全替换（替换模式：不是追加）
    this.subjects = defaultSubjects;
    // 尝试加载外部题库 JSON；成功则“替换”默认题库
    try {
      const resp = await fetch('./data/questions.json');
      if(resp.ok){
        const data = await resp.json();
        const built = this.buildSubjectsFromExternal(data);
        if(built.length){
          this.subjects = built;
          console.info('题库使用外部 questions.json (替换模式)');
        } else {
          console.warn('外部 questions.json 没有可识别题目，使用默认题库');
        }
      }
    } catch(e){
      console.warn('外部题库加载失败，回退默认题库', e);
    }
    this.score = 0;
    this.hintsUsed = 0;
    this.skippedQuestions = 0; // 统计宠溺跳过次数
    this.totalQuestionsCount = () => this.subjects.reduce((a,s)=> a + s.questions.length,0);
  }
  /**
   * 将 external JSON 数据转换为内部统一结构。
   * @param {Object} data questions.json 解析结果
   * @returns {Array} subjects 数组
   */
  buildSubjectsFromExternal(data){
    const subjects = [];
    if(Array.isArray(data.chinesePoemFill) && data.chinesePoemFill.length){
      subjects.push({
        key:'chinese', title:'语文', done:false,
        questions: data.chinesePoemFill.map(item=>({
          type:'fill', difficulty:'easy',
          prompt: item.question.includes('_____') ? item.question.replace('_____','') : item.question,
          answer: item.answer, placeholder:'_____', hint:'诗句感受', solved:false,
          correctMsg: item.encourageCorrect, wrongMsg: item.encourageWrong
        }))
      });
    }
    if(Array.isArray(data.mathPuzzles) && data.mathPuzzles.length){
      subjects.push({
        key:'math', title:'数学', done:false,
        questions: data.mathPuzzles.map(item=>({
          type:'fill', difficulty:'medium', prompt:item.question, answer:(item.answer||'').split(' ')[0], placeholder:'答案', hint:'仔细读提示', solved:false,
          correctMsg: item.encourageCorrect, wrongMsg: item.encourageWrong
        }))
      });
    }
    if(Array.isArray(data.englishMatch) && data.englishMatch.length){
      subjects.push({
        key:'english', title:'英语', done:false,
        questions: data.englishMatch.map(item=>({
          type:'fill', difficulty:'easy', prompt:`${item.word} 的中文是？`, answer:item.match, placeholder:'中文', hint:'记忆里的那个词', solved:false,
          correctMsg: item.encourageCorrect, wrongMsg: item.encourageWrong
        }))
      });
    }
    if(Array.isArray(data.scienceQuiz) && data.scienceQuiz.length){
      subjects.push({
        key:'science', title:'理综', done:false,
        questions: data.scienceQuiz.map(item=>({
          type:'select', difficulty:'medium', prompt:item.question, options:item.options, answerIndex:item.answer, hint:'回想课堂', solved:false,
          correctMsg: item.encourageCorrect, wrongMsg: item.encourageWrong
        }))
      });
    }
    return subjects;
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
    el.innerHTML = `
      <h1>场景2：高考小考站</h1>
      <div class='exam-top'>
        <div class='tabs'></div>
        <div class='meta'>分数 <span class='score'>0</span> | 计时 <span class='timer'>05:00</span></div>
      </div>
      <div class='board'></div>
      <div class='status'></div>
      <div class='summary hidden'></div>
      <button class='finish' disabled>全部通过，进入下一阶段</button>
    `;
    const tabsBox = el.querySelector('.tabs');
    const board = el.querySelector('.board');
    const status = el.querySelector('.status');
    const finishBtn = el.querySelector('.finish');
    const scoreEl = el.querySelector('.score');
    const timerEl = el.querySelector('.timer');
    const summaryEl = el.querySelector('.summary');
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

  /**
   * 渲染顶部科目标签；点击切换当前主科目。
   */
  const renderTabs = ()=>{
      // 顺序锁：只有第一个未完成科目可以点击；已完成的仍可回顾但不再计时（此处阻止回顾刷时间）
      const firstUnfinished = this.subjects.find(s=>!s.done);
      tabsBox.innerHTML = this.subjects.map(s=>{
        const locked = firstUnfinished && s.key !== firstUnfinished.key && !s.done;
        return `<button class='tab ${locked?'locked':''}' data-sub='${s.key}' ${locked?'disabled':''}>${s.title}${s.done?'✔':''}</button>`;
      }).join('');
      tabsBox.querySelectorAll('.tab').forEach(tb=> tb.addEventListener('click',()=>{
        const s = this.subjects.find(x=>x.key===tb.dataset.sub);
        // 只允许点击当前待完成科目；已完成科目点击仅展示完成信息不重启计时
        const first = this.subjects.find(ss=>!ss.done);
        if(s.done){ // 查看完成状态（不重启计时）
          stopSubjectTimer();
          stopBetweenTimer();
          board.innerHTML = `<div class='paper'><p>${s.title} 已完成 ✔</p></div>`;
          status.textContent = `${s.title} 已完成，可以继续下一科~`;
          return;
        }
        if(first && s.key !== first.key) return; // 保护性判定
        stopBetweenTimer();
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
        renderTabs();
        status.textContent = subject.title + ' 已全部完成！';
        checkAll();
        board.innerHTML = `<div class='paper'><p>${subject.title} 全部题目完成 ✔</p></div>`;
        // 停止当前科目计时，启动科目间等待计时（若还有下一科）
        stopSubjectTimer();
        const idx = this.subjects.findIndex(s=> s.key===subject.key);
        const nextSubject = this.subjects[idx+1];
        if(nextSubject){
          startBetweenTimer(nextSubject);
        }
        return;
      }
      board.innerHTML = '';
  const wrapper = document.createElement('div'); // 单题容器（动态重建）
      wrapper.className='paper';
      const diffTag = `<span class='diff diff-${nextQ.difficulty}'>${nextQ.difficulty}</span>`;
      let inputHtml='';
      if(nextQ.type==='fill'){
        inputHtml = `<input class='q-input' placeholder='${nextQ.placeholder||''}' />`;
      } else if(nextQ.type==='select'){
        inputHtml = `<select class='q-select'><option value=''>选择</option>${nextQ.options.map((o,i)=>`<option value='${i}'>${o}</option>`).join('')}</select>`;
      }
      wrapper.innerHTML = `
        <p>${diffTag} ${nextQ.prompt}</p>
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
      if(startTimer){
        // 进入新科目：清理可能残留的懒散彩蛋提示
        const bh = status.querySelector('.between-hint');
        if(bh) bh.remove();
        startSubjectTimer();
      }

      const hintBtn = wrapper.querySelector('.hint-btn');
      const submitBtn = wrapper.querySelector('.submit-btn');
      const skipBtn = wrapper.querySelector('.skip-love-btn');
      const hintArea = wrapper.querySelector('.hint-area');

  // 提示按钮逻辑：累计 3 次，第三次直接完成题目
  hintBtn.addEventListener('click',()=>{
        // 多次提示：前两次显示提示文本，第三次直接给出答案并判定通过
        if(nextQ.solved) return; // 已完成无需提示
        nextQ.hintCount = (nextQ.hintCount||0) + 1;
        this.hintsUsed++;
        if(nextQ.hintCount < 3){
          const label = nextQ.hintCount === 1 ? '提示' : `再次提示(${nextQ.hintCount}/3)`;
          hintArea.textContent = label + '：' + (nextQ.hint || '暂无');
        } else {
          // 第三次：自动判定正确，显示答案并给分（不扣分）
          nextQ.solved = true;
          const base = 2;
          const weight = DIFFICULTY_WEIGHT[nextQ.difficulty] || 1;
          const gained = base * weight; 
          this.score += gained;
          const answerReveal = nextQ.type==='fill' ? nextQ.answer : (nextQ.options?.[nextQ.answerIndex] || '');
          hintArea.innerHTML = `<span class='auto-answer'>直接送你答案：<strong>${answerReveal}</strong></span>`;
          status.innerHTML = `<span class='ok'>第三次提示触发宠溺：答案我直接告诉你~</span> <em>+${gained} 分</em>`;
          updateHUD();
          wrapper._locked = true;
          hintBtn.disabled = true; submitBtn.disabled = true; skipBtn.disabled = true;
          setTimeout(()=> renderSubject(subject), 600);
        }
      });

  // 提交按钮：判断正误；正确=加分；错误=宠溺满分 + 答案展示
  submitBtn.addEventListener('click',()=>{
        if(wrapper._locked) return; // 操作锁
        let userAns='';
        if(nextQ.type==='fill') userAns = wrapper.querySelector('.q-input').value.trim();
        if(nextQ.type==='select') userAns = wrapper.querySelector('.q-select').value;
        // 空输入/未选择：不给分也不判错，给予轻提示
        const isEmpty = (nextQ.type==='fill' && userAns==='') || (nextQ.type==='select' && userAns==='');
        if(isEmpty){
          status.innerHTML = `<span class='err'>先填写/选择一个答案再提交哦~</span>`;
          wrapper.classList.add('shake-mini');
          setTimeout(()=> wrapper.classList.remove('shake-mini'),400);
          return;
        }
        const correct = nextQ.type==='fill' ? (userAns === nextQ.answer) : (parseInt(userAns,10) === nextQ.answerIndex);
        if(correct){
          nextQ.solved = true;
          const base = 2; // 基础分
          const weight = DIFFICULTY_WEIGHT[nextQ.difficulty] || 1;
          const gained = base*weight; // 不再因提示扣分
          this.score += gained;
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
            this.score += gained;
            const answerReveal = nextQ.type==='fill' ? nextQ.answer : (nextQ.options?.[nextQ.answerIndex] || '');
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
        this.score += gained;
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
    };

  /** 检查所有科目是否完成，用于激活 “进入下一阶段” 按钮 */
  const checkAll = ()=>{
      if(this.subjects.every(s=>s.done)){
        finishBtn.disabled = false;
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
      const partialHighSkip = !allSkipped && totalQuestions>0 && (this.skippedQuestions / totalQuestions >= 0.5);
      // 统计错误宠溺通过数量（既标记 _pamperedWrong 且未 _skipped）
      const pamperedWrongCount = this.subjects.reduce((acc,s)=> acc + s.questions.filter(q=> q._pamperedWrong).length,0);
      const allPamperedWrong = pamperedWrongCount === totalQuestions && totalQuestions>0; // 全部题都是错误宠溺
      // 彩蛋互斥优先级：全跳过 > 全错误宠溺 > 高跳过率
      let easterHTML = '';
      if(allSkipped){
        easterHTML = `<div class='easter-skip'>你怎么全跳过了呀？罚你亲我一口，小笨蛋 ❤</div>`;
      } else if(allPamperedWrong){
        easterHTML = `<div class='easter-pampered-wrong'>居然所有题都靠“答错被宠”过关？证明你超会撒娇——判处终身被我保护 ❤</div>`;
      } else if(partialHighSkip){
        easterHTML = `<div class='easter-skip-part'>你悄悄跳过了一半以上… 这是不是在示弱撒娇？那我全都宠着！</div>`;
      }
      summaryEl.innerHTML = `
        <div class='summary-card'>
          <h3>阶段成绩</h3>
          <p>总题数：${totalQuestions}</p>
          <p>总得分：${this.score}</p>
          <p>评价：${this.score >= totalQuestions*4 ? '学霸模式开启！' : this.score >= totalQuestions*3 ? '很棒的默契～' : '分数不是全部，心意最重要'}</p>
          ${easterHTML}
        </div>
      `;
    };

  renderTabs();
  // 自动进入第一科并启动计时
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
  }
}
