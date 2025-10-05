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
// (后续场景将在实现后追加 import)

const bus = new EventBus();
const rootEl = document.getElementById('app');
const sceneManager = new SceneManager(rootEl, bus);

// 配置：若设为 true，无论 localStorage 是否已有 hasRegistered 都先进入注册页
const FORCE_REGISTER_ALWAYS = true; // 修改为 true 即可默认进入注册页面

function context(){
  return { rootEl, bus, go:(name,data)=>sceneManager.go(name,data) };
}

sceneManager.register('register', ()=> new Scene0Register(context()));
sceneManager.register('intro', ()=> new Scene1Intro(context()));
sceneManager.register('exam', ()=> new Scene2Exam(context()));
sceneManager.register('timeline', ()=> new Scene3Timeline(context()));
sceneManager.register('confession', ()=> new Scene4Confession(context()));
sceneManager.register('date', ()=> new Scene5Date(context()));
sceneManager.register('scarf', ()=> new Scene6Scarf(context()));
sceneManager.register('future', ()=> new Scene7Future(context()));
// 新增：转场中介场景（用于动画 & BGM 交叉淡出缓冲）
sceneManager.register('transition', ()=> new TransitionScene(context()));

window.addEventListener('DOMContentLoaded', ()=>{
  // 若已注册过直接进入 intro，否则进入 register 仪式页
  const has = localStorage.getItem('hasRegistered') === '1';
  const params = new URLSearchParams(location.search);
  const force = params.get('forceRegister') === '1';
  if(force){ localStorage.removeItem('hasRegistered'); }
  const goRegister = FORCE_REGISTER_ALWAYS ? true : (force || !has);
  sceneManager.go(goRegister ? 'register' : 'intro');

  // 已注册情况下提供悬浮“重新验证”按钮（除非已经强制在注册页）
  if(!goRegister){
    const btn = document.createElement('button');
    btn.textContent = '重新验证';
    btn.style.cssText = 'position:fixed;bottom:14px;right:14px;z-index:9998;font-size:.7rem;padding:.45rem .8rem;background:#ffb3c6;color:#702438;box-shadow:0 4px 10px -2px rgba(0,0,0,.25);';
    btn.addEventListener('click',()=>{
      localStorage.removeItem('hasRegistered');
      sceneManager.go('register');
    });
    document.body.appendChild(btn);
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
window.addEventListener('click',(e)=>{
  const target = e.target.closest('[data-debounce]');
  if(!target) return;
  const dur = parseInt(target.getAttribute('data-debounce'),10) || 400;
  // 若仍在冷却中，阻止后续监听器执行（含按钮默认行为）
  if(target._debouncing){
    e.stopImmediatePropagation();
    e.preventDefault();
    return;
  }
  target._debouncing = true;
  target.classList.add('debouncing');
  setTimeout(()=>{
    target._debouncing = false;
    target.classList.remove('debouncing');
  }, dur);
}, true); // 捕获阶段，尽早拦截

// 全局快捷键：Ctrl + Alt + R 清除注册标记并回注册场景（调试/重看仪式）
window.addEventListener('keydown',(e)=>{
  if(e.ctrlKey && e.altKey && (e.key==='r' || e.key==='R')){
    localStorage.removeItem('hasRegistered');
    sceneManager.go('register');
  }
});
