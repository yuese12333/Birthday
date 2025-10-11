export class BaseScene {
  constructor(context) {
    this.ctx = context; // {rootEl, bus, resources, go}
    this.initialized = false;
  }
  async init() {
    this.initialized = true;
  }
  async enter() {
    /* fade in etc */
  }
  update(dt) {
    /* per frame if needed */
  }
  async exit() {
    /* cleanup before leave */
  }
  destroy() {
    /* remove listeners */
  }

  /** 确保只注入一次全局禁止文字选择的样式（带可选作用域类名） */
  ensureGlobalNoSelectStyle() {
    const ID = 'global-noselect-style';
    if (document.getElementById(ID)) return;
    const st = document.createElement('style');
    st.id = ID;
    st.textContent = `
      .noselect, .noselect * {\n        -webkit-user-select:none;\n        -moz-user-select:none;\n        -ms-user-select:none;\n        user-select:none;\n      }`;
    document.head.appendChild(st);
  }
  /** 为传入根节点添加 noselect 类，使其内部文字不可选 */
  applyNoSelect(root) {
    if (!root) return;
    this.ensureGlobalNoSelectStyle();
    root.classList.add('noselect');
  }
}
