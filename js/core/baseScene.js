export class BaseScene {
  constructor(context){
    this.ctx = context; // {rootEl, bus, resources, go}
    this.initialized = false;
  }
  async init(){ this.initialized = true; }
  async enter(){ /* fade in etc */ }
  update(dt){ /* per frame if needed */ }
  async exit(){ /* cleanup before leave */ }
  destroy(){ /* remove listeners */ }
}
