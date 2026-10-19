import { Soundfont } from "smplr";
import { midiToFrequency } from "./notes";

let audioCtx: AudioContext | null = null;
let voicePromise: Promise<Soundfont> | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

function getVoice(): Promise<Soundfont> {
  if (!voicePromise) {
    const voice = new Soundfont(getAudioContext(), { instrument: "voice_oohs" });
    voicePromise = voice.ready
      .then(() => voice)
      .catch((err) => {
        voicePromise = null; // let the next attempt try again
        throw err;
      });
  }
  return voicePromise;
}

// Start downloading the samples early so the first note isn't delayed
export function preloadTone(): void {
  getVoice().catch(() => {});
}

export async function playTone(midi: number, durationSec = 1.5): Promise<void> {
  const ctx = getAudioContext();
  if (ctx.state === "suspended") await ctx.resume();

  try {
    const voice = await getVoice();
    voice.start({ note: midi, velocity: 90, duration: durationSec });
    await new Promise((resolve) => setTimeout(resolve, durationSec * 1000));
  } catch {
    await playSynthTone(ctx, midi, durationSec);
  }
}

// Fallback: the synthesised "ooh" from before
function playSynthTone(ctx: AudioContext, midi: number, durationSec: number): Promise<void> {
  const freq = midiToFrequency(midi);
  const now = ctx.currentTime;
  const end = now + durationSec;

  const oscA = ctx.createOscillator();
  const oscB = ctx.createOscillator();
  oscA.type = "sawtooth";
  oscB.type = "sawtooth";
  oscA.frequency.value = freq;
  oscB.frequency.value = freq;
  oscA.detune.value = -4;
  oscB.detune.value = 4;

  const vibrato = ctx.createOscillator();
  const vibratoDepth = ctx.createGain();
  vibrato.frequency.value = 5;
  vibratoDepth.gain.setValueAtTime(0, now);
  vibratoDepth.gain.linearRampToValueAtTime(10, now + 0.4);
  vibrato.connect(vibratoDepth);
  vibratoDepth.connect(oscA.detune);
  vibratoDepth.connect(oscB.detune);

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = Math.min(freq * 4, 1500);
  filter.Q.value = 1;

  const gain = ctx.createGain();
  const volume = 0.2;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(volume, now + 0.15);
  gain.gain.setValueAtTime(volume, end - 0.25);
  gain.gain.linearRampToValueAtTime(0, end);

  oscA.connect(filter);
  oscB.connect(filter);
  filter.connect(gain).connect(ctx.destination);

  for (const osc of [oscA, oscB, vibrato]) {
    osc.start(now);
    osc.stop(end);
  }

  return new Promise((resolve) => {
    oscA.onended = () => resolve();
  });
}