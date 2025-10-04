import { EventBus } from './core/eventBus.js';
import { SceneManager } from './core/sceneManager.js';
import { Scene1Intro } from './scenes/scene1_intro.js';
import { Scene2Exam } from './scenes/scene2_exam.js';
import { Scene3Timeline } from './scenes/scene3_timeline.js';
import { Scene4Confession } from './scenes/scene4_confession.js';
import { Scene5Date } from './scenes/scene5_date.js';
import { Scene6Scarf } from './scenes/scene6_scarf.js';
import { Scene7Future } from './scenes/scene7_future.js';
// (后续场景将在实现后追加 import)

const bus = new EventBus();
const rootEl = document.getElementById('app');
const sceneManager = new SceneManager(rootEl, bus);

function context(){
  return { rootEl, bus, go:(name,data)=>sceneManager.go(name,data) };
}

sceneManager.register('intro', ()=> new Scene1Intro(context()));
sceneManager.register('exam', ()=> new Scene2Exam(context()));
sceneManager.register('timeline', ()=> new Scene3Timeline(context()));
sceneManager.register('confession', ()=> new Scene4Confession(context()));
sceneManager.register('date', ()=> new Scene5Date(context()));
sceneManager.register('scarf', ()=> new Scene6Scarf(context()));
sceneManager.register('future', ()=> new Scene7Future(context()));
// 待续: confession, date, scarf, future

window.addEventListener('DOMContentLoaded', ()=>{
  sceneManager.go('intro');
});
