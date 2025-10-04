import { BaseScene } from '../core/baseScene.js';

export class Scene5Date extends BaseScene {
  async init(){
    await super.init();
    this.menu = [
      { id:1, name:'前菜 · 小暖汤', score:1 },
      { id:2, name:'主菜 · 柔软意面', score:2 },
      { id:3, name:'主菜 · 辣味创意', score:0 },
      { id:4, name:'甜点 · 心形慕斯', score:3 },
      { id:5, name:'饮品 · 橙子气泡', score:1 },
      { id:6, name:'饮品 · 温牛奶', score:2 }
    ];
    this.selection = new Set();
  }
  async enter(){
    const el = document.createElement('div');
    el.className = 'scene scene-date';
    el.innerHTML = `
      <h1>场景5：第一次正式约会</h1>
      <div class='stage'>
        <div class='theatre'>
          <div class='lights'>
            <span class='beam'></span><span class='beam'></span><span class='beam'></span>
          </div>
          <div class='play'>话剧灯光亮起（占位）</div>
        </div>
        <p>选择 3~4 样你觉得“最配今天气氛”的餐点</p>
        <ul class='menu'></ul>
        <button class='calc' disabled>计算默契值</button>
        <div class='result'></div>
        <button class='toNext hidden'>继续前往下一段记忆 →</button>
      </div>`;

    const menuEl = el.querySelector('.menu');
    this.menu.forEach(item=>{
      const li = document.createElement('li');
      li.textContent = item.name;
      li.dataset.id = item.id;
      li.addEventListener('click', ()=>{
        if(this.selection.has(item.id)) this.selection.delete(item.id); else this.selection.add(item.id);
        li.classList.toggle('chosen');
        const size = this.selection.size;
        el.querySelector('.calc').disabled = size < 3 || size > 4;
      });
      menuEl.appendChild(li);
    });

    el.querySelector('.calc').addEventListener('click', ()=>{
      let score = 0;
      this.selection.forEach(id=>{
        const it = this.menu.find(x=>x.id===id);
        score += it.score;
      });
      const res = el.querySelector('.result');
      let text = '';
      if(score >=7) text = '默契值：MAX！就像今天的灯光一样完美。';
      else if(score >=5) text = '默契值：很高～我们品味很接近。';
      else if(score >=3) text = '默契值：中等，但独特的组合也很特别。';
      else text = '默契值：低？可能你在故意搞怪吧。';
      res.textContent = text;
      el.querySelector('.toNext').classList.remove('hidden');
    });

    el.querySelector('.toNext').addEventListener('click', ()=> this.ctx.go('scarf'));

    this.ctx.rootEl.appendChild(el);
  }
}
