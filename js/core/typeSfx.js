// 合成机械键盘音效工具
// 用法: import { typeSfx } from './core/typeSfx.js'; typeSfx.play();
// 特点: 无需外部音频文件, 轻量, 自动随机微调频率避免机械感。

class TypeSfx {
  constructor(){
    this._ctx = null;
    this._enabled = true;
    this._lastPlay = 0;
    this.minInterval = 25; // ms 节流, 防止字符极快时音爆
  }
  
  _ensureCtx(){
    if(!this._ctx){
      const AC = window.AudioContext || window.webkitAudioContext;
      if(!AC) return null;
      this._ctx = new AC();
    }
    if(this._ctx.state === 'suspended'){
      this._ctx.resume().catch(()=>{});
    }
    return this._ctx;
  }
  
  setEnabled(v){ this._enabled = !!v; }
  isEnabled(){ return this._enabled; }
  
  warm(){ this.play(0,true); }
  
  play(baseFreq=0, silentIfBlocked=false){
    if(!this._enabled) return;
    const nowMs = performance.now();
    if(nowMs - this._lastPlay < this.minInterval) return;
    const ctx = this._ensureCtx();
    if(!ctx){ 
      if(!silentIfBlocked) console.warn('[typeSfx] Web Audio 不可用'); 
      return; 
    }
    
    // 创建主振荡器 - 负责低频主体
    const oscMain = ctx.createOscillator();
    const gainMain = ctx.createGain();
    
    // 创建高频泛音振荡器
    const oscHigh = ctx.createOscillator();
    const gainHigh = ctx.createGain();
    
    // 创建噪声源 - 模拟敲击的高频细节
    const noise = ctx.createBufferSource();
    const noiseGain = ctx.createGain();
    
    // 生成噪声缓冲区
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.02, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    noise.buffer = noiseBuffer;
    
    // 基础频率: 未指定则 180-260 随机
    const f = baseFreq || (180 + Math.random()*80);
    
    // 主振荡器设置 - 低频冲击
    oscMain.frequency.value = f * (1 + (Math.random()*0.08 - 0.04));
    oscMain.type = 'sawtooth'; // 锯齿波更适合机械感
    
    // 高频泛音 - 模拟金属振动
    oscHigh.frequency.value = f * (2.5 + Math.random() * 0.5);
    oscHigh.type = 'square';
    
    // 时间点
    const t = ctx.currentTime;
    
    // 主音量包络 - 快速上升然后迅速衰减
    gainMain.gain.setValueAtTime(0.0001, t);
    gainMain.gain.exponentialRampToValueAtTime(0.18, t + 0.005);
    gainMain.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    
    // 高频泛音音量 - 比主音小，持续时间更短
    gainHigh.gain.setValueAtTime(0.0001, t);
    gainHigh.gain.exponentialRampToValueAtTime(0.08, t + 0.003);
    gainHigh.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    
    // 噪声音量 - 非常短的峰值
    noiseGain.gain.setValueAtTime(0.0001, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.05, t + 0.002);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.015);
    
    // 连接节点
    oscMain.connect(gainMain);
    oscHigh.connect(gainHigh);
    noise.connect(noiseGain);
    
    // 合并输出
    const mainOut = ctx.createGain();
    gainMain.connect(mainOut);
    gainHigh.connect(mainOut);
    noiseGain.connect(mainOut);
    mainOut.connect(ctx.destination);
    
    // 播放
    oscMain.start(t);
    oscHigh.start(t);
    noise.start(t);
    
    // 停止
    oscMain.stop(t + 0.07);
    oscHigh.stop(t + 0.04);
    noise.stop(t + 0.02);
    
    this._lastPlay = nowMs;
  }
}

export const typeSfx = new TypeSfx();