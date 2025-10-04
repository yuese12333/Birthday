export class EventBus {
  constructor(){ this.events = {}; }
  on(event, handler){ (this.events[event] ||= []).push(handler); }
  off(event, handler){ if(!this.events[event]) return; this.events[event] = this.events[event].filter(h=>h!==handler); }
  emit(event, payload){ (this.events[event]||[]).forEach(h=>{ try{ h(payload); }catch(e){ console.error('Event handler error', e); } }); }
}
