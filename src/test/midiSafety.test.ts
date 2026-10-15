import test from 'node:test';
import assert from 'node:assert/strict';
import { WebMidiManager } from '../engine/midi/webMidi';
import { AudioRecorder } from '../engine/audio/recorder';
import { EffectsRack } from '../engine/audio/effects';
import { EngineFacade } from '../engine/engineFacade';
import { PRESET_WARM_ANALOG_DRONE } from '../engine/presets/defaultPresets';
import { HistoryManager } from '../engine/mutation/history';
import { runInNewContext } from 'node:vm';

function port(id:string) {
  const queue:{bytes:number[];timestamp?:number}[]=[];
  const log:{kind:string;bytes?:number[];timestamp?:number}[]=[];
  return {id,name:id,state:'connected',queue,log,
    send(bytes:number[],timestamp?:number){ log.push({kind:'send',bytes:[...bytes],timestamp}); if(timestamp !== undefined && timestamp>performance.now())queue.push({bytes:[...bytes],timestamp}); },
    clear(){log.push({kind:'clear'});queue.length=0;},
  };
}
test('Panic clears future MIDI queue before releases and touches only app-owned ports/channels', () => {
  const a=port('IAC'),b=port('Other synth');const midi=new WebMidiManager();
  midi.setMockMidiAccess({outputs:new Map([[a.id,a],[b.id,b]])} as unknown as MIDIAccess);
  midi.scheduleNote(3,64,88,performance.now()+10000,1000,'melody','IAC');
  midi.sendCC(3,74,90,performance.now()+11000,'IAC');
  assert.equal(a.queue.length,3); a.log.length=0; midi.panic();
  assert.equal(a.queue.length,0); assert.equal(a.log[0].kind,'clear');assert.equal(b.log.length,0);
  assert.ok(a.log.some(e=>e.bytes?.[0]===0xb2&&e.bytes[1]===120));
  assert.ok(!a.log.some(e=>e.bytes?.[0]===0xb0));
  assert.equal(midi.getActiveNoteCount(),0);
});
test('Changing output or explicitly disabling it cancels old notes; hotplug does not reenable Off', () => {
  const a=port('IAC'),b=port('B');const midi=new WebMidiManager();
  midi.setMockMidiAccess({outputs:new Map([[a.id,a],[b.id,b]])} as unknown as MIDIAccess);
  midi.scheduleNote(1,60,80,performance.now()+5000,1000,'a');
  midi.selectOutput('B');assert.equal(a.queue.length,0);
  midi.scheduleNote(2,62,70,performance.now()+6000,500,'b');midi.selectOff();
  assert.equal(b.queue.length,0); midi.updateOutputsList();assert.equal(midi.getSelectedOutputId(),null);
  assert.equal(midi.scheduleNote(1,60,80,performance.now(),100,'off'),null);
  assert.equal(midi.scheduleNote(1,60,80,performance.now(),100,'explicit-off',null),null);
  assert.equal(midi.scheduleNote(1,60,80,performance.now()+5000,100,'explicit','IAC') !== null,true);
  midi.panic();
});
test('Global output switch and Off retain explicit layer notes on the old shared port', () => {
  const a=port('IAC'),b=port('B');const midi=new WebMidiManager();midi.setMockMidiAccess({outputs:new Map([[a.id,a],[b.id,b]])} as unknown as MIDIAccess);
  const on=performance.now()+10000;
  midi.scheduleNote(1,60,80,on,1000,'global');midi.scheduleNote(2,72,90,on+100,5000,'explicit','IAC');
  midi.sendCC(1,29,40,on+50);midi.selectOutput('B',new Set(['explicit']));
  assert.deepEqual(a.queue.filter(e=>(e.bytes[0]&0xf0)===0x90).map(e=>e.bytes[1]),[72]);
  assert.ok(!a.queue.some(e=>e.bytes[0]===0xb0),'old global CC modulation was canceled');
  midi.scheduleNote(3,48,80,on+200,1000,'global');midi.selectOff(new Set(['explicit']));
  assert.equal(b.queue.length,0);assert.deepEqual(a.queue.filter(e=>(e.bytes[0]&0xf0)===0x90).map(e=>e.bytes[1]),[72]);
  assert.equal(midi.getActiveNoteCount(),1);midi.panic();
});
test('Saved unavailable global routes do not silently fall back to another connected device', () => {
  const a=port('IAC');const midi=new WebMidiManager();
  midi.selectOutput('Saved-DeepMind');midi.setMockMidiAccess({outputs:new Map([[a.id,a]])} as unknown as MIDIAccess);
  assert.equal(midi.getSelectedOutputId(),'Saved-DeepMind');assert.equal(midi.getTimingMode(),'off');
  assert.equal(midi.scheduleNote(1,60,80,performance.now(),100,'global'),null);assert.equal(a.log.length,0);
  const restored=port('Saved-DeepMind');midi.setMockMidiAccess({outputs:new Map([[a.id,a],[restored.id,restored]])} as unknown as MIDIAccess);
  assert.equal(midi.getSelectedOutputId(),'Saved-DeepMind');assert.equal(midi.getTimingMode(),'timestamped');
  midi.scheduleNote(1,60,80,performance.now()+1000,100,'global');assert.equal(restored.queue.length,2);midi.panic();
});
test('Disconnecting an initially discovered output does not redirect a running global route', () => {
  const a=port('IAC'),b=port('Other');const outputs=new Map([[a.id,a],[b.id,b]]);const midi=new WebMidiManager();midi.setMockMidiAccess({outputs} as unknown as MIDIAccess);
  assert.equal(midi.getSelectedOutputId(),'IAC');midi.scheduleNote(1,60,80,performance.now()+1000,100,'global');
  outputs.delete('IAC');midi.updateOutputsList();
  assert.equal(midi.getSelectedOutputId(),'IAC');assert.equal(midi.getTimingMode(),'off');assert.equal(a.queue.length,0);
  assert.equal(midi.scheduleNote(1,60,80,performance.now(),100,'global'),null);assert.equal(b.log.length,0);
});
test('Overlapping same-pitch retrigger replaces the old note-off instead of prematurely killing the new note', () => {
  const a=port('IAC');const midi=new WebMidiManager();midi.setMockMidiAccess({outputs:new Map([[a.id,a]])} as unknown as MIDIAccess);
  const on=performance.now()+10000;
  midi.scheduleNote(1,60,80,on,5000,'one');midi.scheduleNote(1,60,90,on+1000,6000,'two');
  const offs=a.queue.filter(e=>e.bytes[0]===0x80).map(e=>e.timestamp);
  assert.deepEqual(offs,[on+1000,on+7000]);assert.ok(!offs.includes(on+5000));
  midi.panic();
});
test('Layer cancellation clears only that layer while retaining sibling notes and pending CC on shared ports', () => {
  const a=port('IAC'),b=port('Other');const midi=new WebMidiManager();midi.setMockMidiAccess({outputs:new Map([[a.id,a],[b.id,b]])} as unknown as MIDIAccess);
  const on=performance.now()+10000;
  midi.scheduleNote(1,60,80,on,1000,'chords','IAC');
  midi.scheduleNote(2,72,88,on+250,2000,'melody','IAC');
  midi.sendCC(2,74,90,on+500,'IAC');
  midi.scheduleNote(3,48,80,on,3000,'bass','Other');
  const otherBefore=JSON.stringify(b.log);midi.releaseNotesForLayer('chords');
  assert.equal(a.queue.filter(e=>(e.bytes[0]&0xf0)===0x90).length,1);
  assert.equal(a.queue.find(e=>(e.bytes[0]&0xf0)===0x90)?.bytes[1],72);
  assert.equal(a.queue.find(e=>e.bytes[0]===0x81)?.timestamp,on+2250);
  assert.equal(a.queue.find(e=>e.bytes[0]===0xb1)?.timestamp,on+500);
  assert.equal(JSON.stringify(b.log),otherBefore);assert.equal(midi.getActiveNoteCount(),2);
  midi.panic();
});
test('Outputs without MIDIOutput.clear use cancellable timers and never leave a future hardware queue', async () => {
  const a=port('Chromium'); Reflect.deleteProperty(a,'clear');
  const midi=new WebMidiManager();midi.setMockMidiAccess({outputs:new Map([[a.id,a]])} as unknown as MIDIAccess);
  const on=performance.now()+40;midi.scheduleNote(1,60,80,on,100,'a');
  assert.equal(midi.getTimingMode(),'timer');assert.equal(a.queue.length,0);
  assert.match(midi.getErrorMessage()!,/timer/);midi.panic();
  await new Promise(resolve=>setTimeout(resolve,70));
  assert.ok(!a.log.some(e=>(e.bytes?.[0]??0)===0x90),'canceled timer cannot send a later note-on');
});
test('Concurrent MIDI enable requests use one browser permission request', async () => {
  const original=Object.getOwnPropertyDescriptor(globalThis,'navigator');let calls=0;
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{requestMIDIAccess:async()=>{calls++;return {outputs:new Map(),onstatechange:null};}}});
  try { const midi=new WebMidiManager(); assert.deepEqual(await Promise.all([midi.init(),midi.init(),midi.init()]),[true,true,true]);assert.equal(calls,1); }
  finally { if(original)Object.defineProperty(globalThis,'navigator',original);else Reflect.deleteProperty(globalThis,'navigator'); }
});

function audioParam() { return {value:0,setValueAtTime(value:number){this.value=value;},setTargetAtTime(value:number){this.value=value;},cancelScheduledValues(){}}; }
function audioNode(kind='gain') {
  return {kind,numberOfOutputs:1,gain:audioParam(),delayTime:audioParam(),frequency:audioParam(),Q:audioParam(),type:'lowpass',connections:[] as object[],disconnected:false,
    connect(node:object){this.connections.push(node);return node;},
    disconnect(node?:object){if(node)this.connections=this.connections.filter(n=>n!==node);else{this.connections=[];this.disconnected=true;}}
  };
}
test('PCM recorder taps a real output, captures real samples and disconnects only its own graph', async () => {
  const tap=audioNode('analyser'),destination=audioNode('destination');
  const stream={numberOfOutputs:0,connect(){throw new Error('MediaStream destination has zero outputs');}};
  const processor={...audioNode('processor'),onaudioprocess:null as ((event:AudioProcessingEvent)=>void)|null};
  const ctx={state:'running',currentTime:0,sampleRate:48000,destination,createGain:()=>audioNode(),createScriptProcessor:()=>processor};
  const recorder=new AudioRecorder(()=>stream as unknown as MediaStreamAudioDestinationNode,()=>ctx as unknown as AudioContext,()=>tap as unknown as AudioNode);
  const directDestination=audioNode();tap.connect(directDestination);
  assert.equal(recorder.start(),true);assert.equal(tap.connections[1],processor);
  assert.equal(recorder.start(),false,'duplicate recording cannot allocate a second graph');
  processor.onaudioprocess!({inputBuffer:{numberOfChannels:2,getChannelData:(channel:number)=>Float32Array.from(channel?[0,-0.5,0.2,0.4]:[0,0.5,-0.2,-0.4])}} as unknown as AudioProcessingEvent);
  const result=await recorder.stop();assert.ok(result.wavBytes);assert.equal(result.wavBytes.length,44+4*4);
  const view=new DataView(result.wavBytes.buffer);assert.equal(view.getUint32(24,true),48000);assert.ok(view.getInt16(48,true)>0);
  assert.deepEqual(tap.connections,[directDestination]);assert.equal(processor.onaudioprocess,null);
  assert.equal(recorder.isCurrentlyRecording(),false);
});
test('Primary AudioWorklet DSP captures stereo samples and flushes its partial block before WAV encoding', async () => {
  class BridgePort {
    peer: BridgePort | null = null;
    onmessage: ((event: MessageEvent) => void) | null = null;
    postMessage(data: unknown): void { queueMicrotask(() => this.peer?.onmessage?.({data} as MessageEvent)); }
    close(): void { this.onmessage = null; }
  }
  class BaseProcessor { port = new BridgePort(); }
  type DSP = {port: BridgePort; process: (inputs: Float32Array[][], outputs: Float32Array[][]) => boolean};
  let Constructor: (new () => DSP) | null = null;
  class MockWorkletNode {
    port = new BridgePort(); numberOfOutputs = 1; dsp: DSP;
    connections: object[] = [];
    constructor() { this.dsp = new Constructor!(); this.port.peer = this.dsp.port; this.dsp.port.peer = this.port; }
    connect(node: object): void { this.connections.push(node); }
    disconnect(): void { this.connections = []; }
  }
  const original=Object.getOwnPropertyDescriptor(globalThis,'AudioWorkletNode');
  Object.defineProperty(globalThis,'AudioWorkletNode',{configurable:true,value:MockWorkletNode});
  let loaded: Promise<void> = Promise.resolve();
  const tap=audioNode('analyser');
  const ctx={state:'running',currentTime:0,sampleRate:44100,destination:audioNode(),createGain:()=>audioNode(),audioWorklet:{addModule:(url:string)=>{
    loaded = (async()=> { const code=await (await fetch(url)).text();runInNewContext(code,{Float32Array,AudioWorkletProcessor:BaseProcessor,registerProcessor:(_name:string,constructor:new()=>DSP)=>{Constructor=constructor;}}); })();
    return loaded;
  }}};
  const recorder=new AudioRecorder(()=>null,()=>ctx as unknown as AudioContext,()=>tap as unknown as AudioNode);
  try {
    assert.equal(recorder.start(),true);await loaded;await new Promise(resolve=>setImmediate(resolve));
    const node=tap.connections[0] as MockWorkletNode;assert.ok(node instanceof MockWorkletNode);
    const left=Float32Array.from({length:512},(_,i)=>Math.sin(i/15)*0.4),right=Float32Array.from(left,value=>-value);
    const output=new Float32Array(512).fill(1);node.dsp.process([[left,right]],[[output]]);
    assert.ok(output.every(value=>value===0),'tap output stays silent, so recording does not double playback');
    const result=await recorder.stop();assert.ok(result.wavBytes);assert.equal(result.wavBytes.length,44+512*4);
    const view=new DataView(result.wavBytes.buffer);assert.equal(view.getUint32(24,true),44100);
    assert.ok(view.getInt16(48,true)>0);assert.ok(view.getInt16(50,true)<0);
    assert.equal(tap.connections.length,0);
  } finally {
    if(recorder.isCurrentlyRecording())await recorder.stop();
    if(original)Object.defineProperty(globalThis,'AudioWorkletNode',original);else Reflect.deleteProperty(globalThis,'AudioWorkletNode');
  }
});
test('Invalid zero-output PCM source produces an explicit error instead of a fake WAV success', () => {
  const source={numberOfOutputs:0};const ctx={state:'running',sampleRate:48000};
  const recorder=new AudioRecorder(()=>null,()=>ctx as AudioContext,()=>source as AudioNode);
  assert.equal(recorder.start(),false);assert.match(recorder.getState().lastError!,/PCM audio tap/);
});
test('Effects contain allpass feedback loops; Panic replaces buffered wet nodes while retaining synth input', () => {
  const nodes:ReturnType<typeof audioNode>[]=[];
  const ctx={currentTime:0,createGain:()=>{const n=audioNode();nodes.push(n);return n;},createDelay:(max:number)=>{const n=audioNode(`delay-${max}`);nodes.push(n);return n;},createBiquadFilter:()=>{const n=audioNode('filter');nodes.push(n);return n;}};
  const drives:number[]=[];
  const rack=new EffectsRack(ctx as unknown as AudioContext,audioNode() as unknown as AudioNode,value=>drives.push(value));
  rack.updateParams({...PRESET_WARM_ANALOG_DRONE.effectsParams,masterDrive:0.2});
  assert.deepEqual(drives,[0.2],'offline drive callback handles drive without altering the live master');
  const diffusers=nodes.filter(n=>n.kind==='delay-0.1');assert.equal(diffusers.length,2);
  for(const delay of diffusers){
    const feedback=delay.connections.find(n=>(n as ReturnType<typeof audioNode>).gain.value===0.7) as ReturnType<typeof audioNode>;
    assert.ok(feedback);const sum=feedback.connections[0] as ReturnType<typeof audioNode>;
    assert.ok(sum.connections.includes(delay),'delay feeds back to its input sum');
    assert.ok(sum.connections.some(n=>(n as ReturnType<typeof audioNode>).gain.value===-0.7),'feedforward uses that same sum');
  }
  const input=rack.inputNode,oldDelay=rack.delayLeft;rack.killTail();
  assert.equal(rack.inputNode,input);assert.notEqual(rack.delayLeft,oldDelay);assert.equal((oldDelay as unknown as ReturnType<typeof audioNode>).disconnected,true);
  assert.deepEqual(drives,[0.2,0.2],'Panic preserves configured drive callback and effects settings');
});
test('Legacy facade redo restores the mutation result and presets/evolution update actual generators', () => {
  const engine=EngineFacade.getInstance();
  engine.loadPreset(structuredClone(PRESET_WARM_ANALOG_DRONE));
  const initial=JSON.stringify(engine.state);engine.mutate(0.7);const after=JSON.stringify(engine.state);
  assert.notEqual(after,initial);assert.equal(engine.undo(),true);assert.equal(JSON.stringify(engine.state),initial);
  assert.equal(engine.redo(),true);assert.equal(JSON.stringify(engine.state),after);
  const preset=structuredClone(PRESET_WARM_ANALOG_DRONE);const kick=preset.layers.find(l=>l.id==='kick')??preset.layers.find(l=>l.type==='drum')!;
  kick.settings.pulses=1;engine.loadPreset(preset);
  const internals=engine as unknown as {generators:Map<string,{getSettings:()=>Record<string,unknown>}>};
  assert.equal(internals.generators.get(kick.id)?.getSettings().pulses,1);
  engine.evolve();for(const layer of engine.state.layers)assert.deepEqual(internals.generators.get(layer.id)?.getSettings(),layer.settings);
});
test('History caps all retained branch nodes at64 and branch jumps restore valid undo ancestry', () => {
  const state=structuredClone(PRESET_WARM_ANALOG_DRONE),history=new HistoryManager(state);
  for(let i=0;i<100;i++){state.bpm=60+i;history.pushState(`edit${i}`,state);}
  assert.equal(history.getAllNodes().length,64);assert.equal(history.canUndo(),true);
  const old=history.getAllNodes()[10];assert.deepEqual(history.jumpToNode(old.id),old.state);
  state.bpm=240;history.pushState('branch',state);assert.equal(history.canRedo(),false);assert.ok(history.getAllNodes().length<=64);
});
