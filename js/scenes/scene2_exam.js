import { BaseScene } from '../core/baseScene.js';

// 帮助：难度定义影响得分/提示次数
const DIFFICULTY_WEIGHT = { easy: 1, medium: 2, hard: 3 };

export class Scene2Exam extends BaseScene {
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

    // 先假定使用默认，若外部加载成功则完全替换
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
        <div class='meta'>分数 <span class='score'>0</span></div>
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
    const summaryEl = el.querySelector('.summary');

    const renderTabs = ()=>{
      tabsBox.innerHTML = this.subjects.map(s=>`<button class='tab' data-sub='${s.key}'>${s.title}${s.done?'✔':''}</button>`).join('');
      tabsBox.querySelectorAll('.tab').forEach(tb=> tb.addEventListener('click',()=>{
        const s = this.subjects.find(x=>x.key===tb.dataset.sub);
        renderSubject(s);
      }));
    };

    const renderSubject = (subject)=>{
      // 找到第一道未完成的题
      const nextQ = subject.questions.find(q=>!q.solved);
      if(!nextQ){
        subject.done = true;
        renderTabs();
        status.textContent = subject.title + ' 已全部完成！';
        checkAll();
        board.innerHTML = `<div class='paper'><p>${subject.title} 全部题目完成 ✔</p></div>`;
        return;
      }
      board.innerHTML = '';
      const wrapper = document.createElement('div');
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

      const hintBtn = wrapper.querySelector('.hint-btn');
      const submitBtn = wrapper.querySelector('.submit-btn');
      const skipBtn = wrapper.querySelector('.skip-love-btn');
      const hintArea = wrapper.querySelector('.hint-area');

      hintBtn.addEventListener('click',()=>{
        if(nextQ.hinted) return; // 一题一次
        hintArea.textContent = '提示：' + (nextQ.hint || '暂无');
        nextQ.hinted = true; this.hintsUsed++;
        this.score = Math.max(0, this.score - 1); // 使用提示扣 1 分
        updateHUD();
      });

      submitBtn.addEventListener('click',()=>{
        let userAns='';
        if(nextQ.type==='fill') userAns = wrapper.querySelector('.q-input').value.trim();
        if(nextQ.type==='select') userAns = wrapper.querySelector('.q-select').value;
        const correct = nextQ.type==='fill' ? (userAns === nextQ.answer) : (parseInt(userAns,10) === nextQ.answerIndex);
        if(correct){
          nextQ.solved = true;
          const base = 2; // 基础分
          const weight = DIFFICULTY_WEIGHT[nextQ.difficulty] || 1;
          const gained = base*weight - (nextQ.hinted?1:0);
          const finalGain = Math.max(1,gained);
          this.score += finalGain;
          status.innerHTML = `<span class='ok'>${nextQ.correctMsg || '太棒啦！'}</span> <em>+${finalGain} 分</em>`;
          updateHUD();
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
            setTimeout(()=> wrapper.classList.remove('shake-mini'),400);
            setTimeout(()=> renderSubject(subject), 600);
        }
      });

      // 宠溺跳过：不给连击加成，重置连击，给基础分*权重（不受提示惩罚），显示暖心话
      skipBtn.addEventListener('click',()=>{
        if(nextQ.solved) return;
        nextQ.solved = true;
        nextQ._skipped = true; // 标记此题由跳过获得
  // 跳过不算正确答题
        const base = 2;
        const weight = DIFFICULTY_WEIGHT[nextQ.difficulty] || 1;
        const gained = base * weight; // 不减提示，不加连击
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
        setTimeout(()=> renderSubject(subject), 500);
      });
    };

    const updateHUD = ()=>{
      scoreEl.textContent = this.score;
    };

    const checkAll = ()=>{
      if(this.subjects.every(s=>s.done)){
        finishBtn.disabled = false;
        renderSummary();
      }
    };

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
    // 默认打开第一科
    renderSubject(this.subjects[0]);

    finishBtn.addEventListener('click',()=> this.ctx.go('timeline'));
    this.ctx.rootEl.appendChild(el);
  }
}
