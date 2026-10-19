import { useCallback, useEffect, useRef, useState } from "react";
import { PitchDetector } from "pitchy";
import { frequencyToNote, type NoteReading } from "./notes";

const MIN_CLARITY = 0.9;  // how confident pitchy must be (0–1)
const MIN_FREQ = 60;      // ignore anything below a very low bass voice
const MAX_FREQ = 1200;    // ignore anything above a very high soprano

export function usePitch() {
  const [reading, setReading] = useState<NoteReading | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close();
    rafRef.current = null;
    streamRef.current = null;
    audioCtxRef.current = null;
    setIsListening(false);
    setReading(null);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);

      const detector = PitchDetector.forFloat32Array(analyser.fftSize);
      const buffer = new Float32Array(detector.inputLength);

      const tick = () => {
        analyser.getFloatTimeDomainData(buffer);
        const [pitch, clarity] = detector.findPitch(buffer, audioCtx.sampleRate);

        if (clarity >= MIN_CLARITY && pitch >= MIN_FREQ && pitch <= MAX_FREQ) {
          setReading(frequencyToNote(pitch));
        } else {
          setReading(null); // silence, noise, or unclear sound
        }
        rafRef.current = requestAnimationFrame(tick);
      };

      streamRef.current = stream;
      audioCtxRef.current = audioCtx;
      setIsListening(true);
      tick();
    } catch {
      setError("Couldn't access your microphone. Check your browser's permission settings.");
    }
  }, []);

  useEffect(() => stop, [stop]); // clean up if the component unmounts

  return { reading, isListening, error, start, stop };
}