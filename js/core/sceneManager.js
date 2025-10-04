export class SceneManager {
  constructor(rootEl, bus){
    this.rootEl = rootEl;
    this.bus = bus;
    this.current = null;
    this.registry = new Map();
  }
  register(name, sceneFactory){ this.registry.set(name, sceneFactory); }
  async go(name, data){
    if(!this.registry.has(name)) throw new Error('Scene not found: '+name);
    if(this.current){ await this.current.exit(); this.rootEl.innerHTML=''; this.current.destroy(); }
    const scene = this.registry.get(name)();
    this.current = scene;
    if(!scene.initialized) await scene.init();
    await scene.enter(data);
  }
}
