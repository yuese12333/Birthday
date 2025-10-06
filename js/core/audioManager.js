// 轻量 AudioManager：统一管理单条或多条 BGM，支持淡入/淡出与重复播放。
// 使用方式：
// import { audioManager } from './core/audioManager.js';
// audioManager.playBGM('scene2', './assets/audio/scene_2.mp3', { loop:true, fadeIn:800, volume:0.6 });
// audioManager.stopBGM('scene2', { fadeOut:600 });

class AudioManager {
  constructor(){
    this.bgms = new Map(); // key -> { audio, targetVolume }
    this.globalMuted = false;
    this.currentSceneBGM = null;
  }
  /** 通用场景 BGM 播放辅助：sceneId -> assets/audio/scene_x.mp3，自动停止前一个 */
  playSceneBGM(sceneId, { loop=true, volume=0.7, fadeIn=700 }={}){
    // 停止前一个场景 BGM
    if(this.currentSceneBGM && this.currentSceneBGM!==sceneId){
      this.stopBGM(this.currentSceneBGM, { fadeOut:600 });
    }
    this.currentSceneBGM = sceneId;
    return this.playBGM(sceneId, `./assets/audio/scene_${sceneId}.mp3`, { loop, volume, fadeIn });
  }
  playBGM(key, src, { loop=true, volume=0.7, fadeIn=0 }={}){
    // 若已存在同 key，直接调整目标音量
    let entry = this.bgms.get(key);
    if(!entry){
      const audio = new Audio(src);
      audio.loop = loop;
      audio.volume = 0;
      audio.preload = 'auto';
      entry = { audio, targetVolume: volume };
      this.bgms.set(key, entry);
      const playPromise = audio.play();
      if(playPromise){ playPromise.catch(()=>{/* 静默失败，等待下一次用户交互重试 */}); }
    } else {
      entry.targetVolume = volume;
    }
    if(fadeIn>0){
      const steps = 20; const stepVol = entry.targetVolume/steps; let i=0;
      const timer = setInterval(()=>{
        i++; entry.audio.volume = Math.min(entry.targetVolume, entry.audio.volume + stepVol);
        if(i>=steps) clearInterval(timer);
      }, fadeIn/steps);
    } else {
      entry.audio.volume = volume;
    }
    return entry.audio;
  }
  stopBGM(key, { fadeOut=0 }={}){
    const entry = this.bgms.get(key); if(!entry) return;
    const { audio } = entry;
    if(fadeOut>0){
      const steps = 18; const stepVol = audio.volume/steps; let i=0;
      const timer = setInterval(()=>{
        i++; audio.volume = Math.max(0, audio.volume - stepVol);
        if(i>=steps){ clearInterval(timer); audio.pause(); this.bgms.delete(key); }
      }, fadeOut/steps);
    } else {
      audio.pause(); this.bgms.delete(key);
    }
    if(this.currentSceneBGM===key){ this.currentSceneBGM=null; }
  }
  toggleMute(){
    this.globalMuted = !this.globalMuted;
    this.bgms.forEach(e=> e.audio.muted = this.globalMuted);
    return this.globalMuted;
  }
  stopAll({ fadeOut=0 }={}){
    [...this.bgms.keys()].forEach(k=> this.stopBGM(k,{ fadeOut }));
  }
}

export const audioManager = new AudioManager();
