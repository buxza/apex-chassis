let audioCtx = null, osc1 = null, osc2 = null, turboOsc = null, gearOsc = null;
let engineGain = null, turboGain = null, gearGain = null, filter = null;

function toggleAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    osc1 = audioCtx.createOscillator();
    osc2 = audioCtx.createOscillator();
    turboOsc = audioCtx.createOscillator();
    gearOsc = audioCtx.createOscillator();
    filter = audioCtx.createBiquadFilter();
    engineGain = audioCtx.createGain();
    turboGain = audioCtx.createGain();
    gearGain = audioCtx.createGain();

    osc1.type = 'sawtooth';
    osc2.type = 'triangle';
    turboOsc.type = 'sine';
    gearOsc.type = 'triangle';
    filter.type = 'lowpass';
    filter.frequency.value = 300;

    engineGain.gain.value = 0;
    turboGain.gain.value = 0;
    gearGain.gain.value = 0;

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(engineGain);
    engineGain.connect(audioCtx.destination);

    turboOsc.connect(turboGain);
    turboGain.connect(audioCtx.destination);

    gearOsc.connect(gearGain);
    gearGain.connect(audioCtx.destination);

    osc1.start(); osc2.start(); turboOsc.start(); gearOsc.start();
  }
  state.audioOn = !state.audioOn;
  const btn = document.getElementById('audio-btn');
  btn.innerText = state.audioOn ? 'AUDIO: ON' : 'AUDIO: OFF';
  btn.classList.toggle('on', state.audioOn);
  if (!state.audioOn && engineGain) {
    engineGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.05);
    turboGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.05);
    gearGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.05);
  }
}

function triggerBlowOffValve() {
  if (!state.audioOn || !audioCtx) return;
  const bufSize = audioCtx.sampleRate * 0.22;
  const buffer = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.35));

  const noise = audioCtx.createBufferSource();
  noise.buffer = buffer;
  const bp = audioCtx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 3200;
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0.12, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.22);

  noise.connect(bp); bp.connect(g); g.connect(audioCtx.destination);
  noise.start();
}

function triggerExhaustPop() {
  if (!state.audioOn || !audioCtx) return;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(115 + Math.random() * 55, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(35, audioCtx.currentTime + 0.09);
  g.gain.setValueAtTime(0.15, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.09);
  osc.connect(g); g.connect(audioCtx.destination);
  osc.start(); osc.stop(audioCtx.currentTime + 0.09);
}

function triggerTorqueClick(success) {
  if (!state.audioOn || !audioCtx) return;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(success ? 880 : 220, audioCtx.currentTime);
  g.gain.setValueAtTime(0.12, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
  osc.connect(g); g.connect(audioCtx.destination);
  osc.start(); osc.stop(audioCtx.currentTime + 0.12);
}

function updateEngineAudio(rpm, throttle, boost, speed, nosActive) {
  if (!state.audioOn || !audioCtx) return;
  const eng = getSelectedPart('engine');
  const trs = getSelectedPart('drivetrain');
  const exh = getSelectedPart('exhaust');
  const firingFreq = (rpm / 60) * (eng.cyl * 0.5);
  osc1.frequency.setTargetAtTime(firingFreq, audioCtx.currentTime, 0.02);
  osc2.frequency.setTargetAtTime(firingFreq * 0.5, audioCtx.currentTime, 0.02);

  const exhaustOpen = exh.pops ? 250 : 0;
  filter.frequency.setTargetAtTime(170 + exhaustOpen + (rpm / 8800) * 1800 + throttle * 850 + (nosActive ? 700 : 0), audioCtx.currentTime, 0.025);
  engineGain.gain.setTargetAtTime(0.032 + throttle * 0.072, audioCtx.currentTime, 0.025);

  const spool = Math.max(0, (rpm - 2400) / 5800) * Math.min(1, boost / 2.2);
  turboOsc.frequency.setTargetAtTime(2000 + spool * 2700 + (nosActive ? 900 : 0), audioCtx.currentTime, 0.03);
  turboGain.gain.setTargetAtTime(spool * throttle * 0.024, audioCtx.currentTime, 0.03);

  if (trs.straightCut && speed > 10) {
    gearOsc.frequency.setTargetAtTime(450 + speed * 8.5, audioCtx.currentTime, 0.03);
    gearGain.gain.setTargetAtTime(Math.min(0.025, speed * 0.00015), audioCtx.currentTime, 0.03);
  } else {
    gearGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.05);
  }
}
