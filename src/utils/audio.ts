// Vintage 8-bit retro synth sound effects using Web Audio API

let audioCtx: AudioContext | null = null;
let bgmSource: OscillatorNode | null = null;
let bgmGain: GainNode | null = null;
let isBgmPlaying = false;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// 8-bit sound parameters
export function playJumpSound() {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = 'square'; // Classic square wave for NES sound
    
    // Jump slides UP in frequency quickly
    const startTime = ctx.currentTime;
    osc.frequency.setValueAtTime(150, startTime);
    osc.frequency.exponentialRampToValueAtTime(600, startTime + 0.15);

    // Fade out volume envelope
    gainNode.gain.setValueAtTime(0.15, startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.15);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + 0.15);
  } catch (error) {
    console.error('Audio play error:', error);
  }
}

export function playCrouchSound() {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = 'sawtooth'; // Sawtooth for crunch slide
    
    // Crouch slides DOWN
    const startTime = ctx.currentTime;
    osc.frequency.setValueAtTime(250, startTime);
    osc.frequency.exponentialRampToValueAtTime(100, startTime + 0.2);

    gainNode.gain.setValueAtTime(0.12, startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.2);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + 0.2);
  } catch (error) {
    console.error('Audio play error:', error);
  }
}

export function playCoinSound() {
  try {
    const ctx = getAudioContext();
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    // Retro coin is a 2-tone chime (e.g. B5 to E6)
    const startTime = ctx.currentTime;
    
    osc1.type = 'square';
    osc1.frequency.setValueAtTime(987.77, startTime); // B5
    osc1.frequency.setValueAtTime(1318.51, startTime + 0.08); // E6

    gainNode.gain.setValueAtTime(0.1, startTime);
    gainNode.gain.setValueAtTime(0.1, startTime + 0.08);
    gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.35);

    osc1.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc1.start(startTime);
    osc1.stop(startTime + 0.35);
  } catch (error) {
    console.error('Audio play error:', error);
  }
}

export function playCrashSound() {
  try {
    const ctx = getAudioContext();
    
    // Noise generation for explosion!
    const bufferSize = ctx.sampleRate * 0.4; // 0.4s buffer
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    // Fill buffer with random white noise
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noiseNode = ctx.createBufferSource();
    noiseNode.buffer = buffer;

    // Filter to make it sounding like explosion crash (low pass filter)
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.4);

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.25, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);

    noiseNode.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    noiseNode.start();
    noiseNode.stop(ctx.currentTime + 0.4);

    // Add a descending low frequency pitch drop for "game over slump"
    const slumpOsc = ctx.createOscillator();
    const slumpGain = ctx.createGain();
    slumpOsc.type = 'sawtooth';
    slumpOsc.frequency.setValueAtTime(120, ctx.currentTime);
    slumpOsc.frequency.linearRampToValueAtTime(40, ctx.currentTime + 0.5);
    
    slumpGain.gain.setValueAtTime(0.2, ctx.currentTime);
    slumpGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

    slumpOsc.connect(slumpGain);
    slumpGain.connect(ctx.destination);
    slumpOsc.start();
    slumpOsc.stop(ctx.currentTime + 0.5);
  } catch (error) {
    console.error('Audio play error:', error);
  }
}

export function playLevelUpSound() {
  try {
    const ctx = getAudioContext();
    const startTime = ctx.currentTime;
    
    // Arpeggio sound: low C, E, G, high C
    const freqs = [523.25, 659.25, 783.99, 1046.50];
    
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc.type = 'triangle'; // Smoother tone
      osc.frequency.setValueAtTime(freq, startTime + idx * 0.08);
      
      gainNode.gain.setValueAtTime(0.0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.12, startTime + idx * 0.08);
      gainNode.gain.setValueAtTime(0.12, startTime + idx * 0.08 + 0.08);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + idx * 0.08 + 0.25);
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      osc.start(startTime + idx * 0.08);
      osc.stop(startTime + idx * 0.08 + 0.25);
    });
  } catch (error) {
    console.error('Audio play error:', error);
  }
}

// Retro BGM Composer loops
export function startBgm() {
  if (isBgmPlaying) return;
  try {
    const ctx = getAudioContext();
    const startTime = ctx.currentTime;
    
    // We compose a simple repetitive 8-bit chip note bassline
    const bassline = [
      110, 110, 130, 110, 146, 146, 165, 130, // A2, C3, D3, E3...
      110, 110, 98, 98, 87, 87, 73, 98
    ];
    
    let noteIndex = 0;
    const tempo = 0.20; // Seconds per note (150 BPM approx)

    isBgmPlaying = true;
    
    // Since creating one long buffer is complex, we will schedule a periodic osc play or a simple timed sound.
    // For extreme efficiency and robust loop, we can write a simple background note schedule recursive function!
    const scheduleNextNote = () => {
      if (!isBgmPlaying || !audioCtx) return;
      
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      osc.type = 'triangle'; // triangle is nice and bassy, not too piercing
      const baseFreq = bassline[noteIndex % bassline.length];
      osc.frequency.setValueAtTime(baseFreq, audioCtx.currentTime);
      
      // Vintage bass pluck envelope
      gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + tempo * 0.9);
      
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      osc.start();
      osc.stop(audioCtx.currentTime + tempo * 0.9);
      
      noteIndex++;
      setTimeout(scheduleNextNote, tempo * 1000);
    };
    
    scheduleNextNote();
  } catch (error) {
    console.error('Audio BGM play error:', error);
  }
}

export function stopBgm() {
  isBgmPlaying = false;
}
