/**
 * SceneManager
 * 负责：
 *  - 注册场景（name -> factory）
 *  - 顺序异步切换（go）并管理生命周期：exit -> destroy -> init -> enter
 *  - 防并发：_transitioning 标志避免用户/代码重复快速触发 go 导致双重渲染
 *  - 视觉过渡：简单遮罩淡入/淡出，提供“正在切换…”提示并阻挡点击
 * 设计取舍：
 *  - 不使用复杂队列：若多次点击在切换中，仅忽略后续请求，保证简单与确定性
 *  - destroy 与 exit 包装 try-catch：即便单个场景报错也不阻塞后续切换
 *  可扩展点：
 *    - 支持一个切换完成回调 bus.emit('sceneChanged', name)
 *    - 支持并发队列（可维护 pendingName）
 *    - 支持转场动画 hook（beforeEnter / afterEnter）
 */
export class SceneManager {
  constructor(rootEl, bus){
    this.rootEl = rootEl;
    this.bus = bus;
    this.current = null;
    this.registry = new Map();
    this._transitioning = false;
    // 过渡遮罩：阻挡点击，提供柔和的白色径向模糊背景
    this._overlay = document.createElement('div');
    this._overlay.style.cssText = 'position:fixed;inset:0;pointer-events:none;opacity:0;transition:.25s;background:radial-gradient(circle at 50% 50%,rgba(255,255,255,.65),rgba(255,255,255,.85));backdrop-filter:blur(3px);z-index:9999;font-size:.9rem;display:flex;align-items:center;justify-content:center;font-weight:600;color:#a73d56;font-family:system-ui,sans-serif;';
    this._overlay.textContent = '正在切换...';
    document.body.appendChild(this._overlay);
  }
  /** 注册场景工厂 */
  register(name, sceneFactory){ this.registry.set(name, sceneFactory); }
  /**
   * 切换到指定场景：
   *  1. 防抖：若正在切换直接 return
   *  2. 显示遮罩
   *  3. 若有当前场景：调用 exit -> 清 DOM -> destroy
   *  4. 实例化新场景：若首次 init，再 enter
   *  5. 延迟 250ms 隐藏遮罩，结束切换
   */
  async go(name, data){
    if(!this.registry.has(name)) throw new Error('Scene not found: '+name);
    if(this._transitioning){ return; } // 忽略重复切换请求
    this._transitioning = true;
    // 显示过渡遮罩
    requestAnimationFrame(()=>{ this._overlay.style.pointerEvents='auto'; this._overlay.style.opacity='1'; });
    if(this.current){
      try { await this.current.exit(); } catch(e){ console.warn('scene exit error', e); }
      this.rootEl.innerHTML='';
      try { this.current.destroy(); } catch(e){ console.warn('scene destroy error', e); }
    }
    const scene = this.registry.get(name)();
    this.current = scene;
    if(!scene.initialized) await scene.init();
    await scene.enter(data);
    // 小延迟再移除遮罩，避免闪烁
    setTimeout(()=>{
      this._overlay.style.opacity='0';
      this._overlay.style.pointerEvents='none';
    }, 250);
    this._transitioning = false;
  }
}
