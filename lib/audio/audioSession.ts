// Safari's Audio Session API: tells iOS what kind of audio the page is making.
// Without it, once a page has used the mic, iOS can stay in "phone call" mode
// (quiet, earpiece) even while we're only playing a note. Other browsers don't
// have it, so this quietly does nothing there.
type AudioSessionType = "auto" | "playback" | "play-and-record";

export function setAudioSession(type: AudioSessionType): void {
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
  if (session) session.type = type;
}
