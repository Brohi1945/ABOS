// ============================================================
//  useVoiceInput — shared voice-to-text hook (Web Speech API)
//  Used by both the customer store assistant (Store.tsx) and the
//  admin AI assistant (AssistantView.tsx) so mic behavior stays
//  identical in one place.
//
//  Browser support: Chrome/Edge (desktop + Android) — good.
//  Safari/iOS — limited/inconsistent, hook degrades gracefully
//  (isSupported=false, mic button hides itself).
//
//  BUG FIX (this version): recognition is only ever created ONCE
//  (the effect below intentionally doesn't re-run per render), but
//  the caller's onResult/onError callbacks are NEW functions every
//  render (they usually close over component state like `send`).
//  Previously the recognition object's onresult handler captured
//  whatever onResult was passed in on the FIRST render and called
//  that forever — so mic input kept triggering a permanently stale
//  version of the caller's logic (e.g. always seeing voiceEnabled
//  as false, no matter what it actually is now). Fixed by stashing
//  the latest onResult/onError in refs that update every render,
//  and having the recognition handlers call through the ref.
// ============================================================
import { useEffect, useRef, useState, useCallback } from "react";

interface UseVoiceInputOptions {
  // Called once with the final recognized transcript when the user stops speaking.
  onResult: (transcript: string) => void;
  // Called on any recognition error (permission denied, no speech, network, etc.)
  onError?: (message: string) => void;
  // BCP-47 language tag. Roman Urdu speech is typically best matched by
  // Urdu (ur-PK) or Hindi (hi-IN) acoustic models depending on device support;
  // "ur-PK" is tried first, caller can override.
  lang?: string;
  // When true, recognition is temporarily stopped without losing "keep
  // listening" intent — meant to be set to the caller's isSpeaking flag
  // so the mic doesn't pick up the AI's own TTS reply and misfire on it.
  // Automatically resumes hands-free listening once this goes back to false.
  pause?: boolean;
}

interface UseVoiceInputReturn {
  isSupported: boolean;
  isListening: boolean;
  interimTranscript: string;
  startListening: () => void;
  stopListening: () => void;
  toggleListening: () => void;
}

export function useVoiceInput({
  onResult,
  onError,
  lang = "ur-PK",
  pause = false,
}: UseVoiceInputOptions): UseVoiceInputReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const recognitionRef = useRef<any>(null);

  // ---- stale-closure fix: always call the LATEST callback, never the
  // one that happened to be in scope when the recognition object was built.
  const onResultRef = useRef(onResult);
  const onErrorRef = useRef(onError);
  useEffect(() => { onResultRef.current = onResult; }, [onResult]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  // BUG FIX: "voice minimize hone ke baad band ho jata hai, khula rehna
  // chahiye taake baat karte karte commands milte rahein" — recognition.
  // continuous=false means the browser auto-stops listening the instant
  // it detects the user finished one sentence (onend fires). Previously
  // that was the end of it — the mic icon flipped back off and the admin
  // had to tap it again for every single command, which is especially
  // awkward once minimized (no full UI to reach for). This ref tracks
  // *intent*: true from the moment the mic is tapped on until the admin
  // (or an error) explicitly tapps it off again. Whenever recognition
  // ends on its own (not because of an explicit stopListening() call),
  // and intent is still "on", we silently restart it — so one tap keeps
  // listening across as many back-to-back commands as needed.
  const keepListeningRef = useRef(false);
  const restartTimerRef = useRef<number | null>(null);
  // True while temporarily paused (e.g. AI is speaking) — blocks the
  // onend auto-restart without clearing "keep listening" intent, so
  // listening resumes hands-free once unpaused instead of needing a tap.
  const pausedRef = useRef(false);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }
    setIsSupported(true);

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = lang;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setInterimTranscript("");
    };

    recognition.onresult = (event: any) => {
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else interimText += result[0].transcript;
      }
      if (interimText) setInterimTranscript(interimText);
      if (finalText.trim()) {
        setInterimTranscript("");
        // always the current callback, never a stale one
        onResultRef.current(finalText.trim());
      }
    };

    recognition.onerror = (event: any) => {
      setIsListening(false);
      setInterimTranscript("");
      // "no-speech" (silence timeout) shouldn't break hands-free mode —
      // it just means restart and keep waiting. Genuine problems
      // (permission denied, no mic, network) should actually stop.
      if (event.error === "no-speech" && keepListeningRef.current) {
        return; // onend will fire right after this and handle the restart
      }
      keepListeningRef.current = false;
      const messages: Record<string, string> = {
        "not-allowed": "Microphone permission denied hai — browser settings mein allow karein.",
        "no-speech": "Kuch sunai nahi diya — dobara koshish karein.",
        network: "Network issue — voice recognition ke liye internet chahiye.",
      };
      onErrorRef.current?.(messages[event.error] || "Voice input mein masla hua — dobara try karein.");
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript("");
      if (keepListeningRef.current && !pausedRef.current) {
        // Small delay before restarting — calling start() immediately
        // inside onend throws on some Android Chrome builds.
        if (restartTimerRef.current) window.clearTimeout(restartTimerRef.current);
        restartTimerRef.current = window.setTimeout(() => {
          if (!keepListeningRef.current || pausedRef.current) return;
          try {
            recognition.start();
          } catch {
            /* already running — ignore */
          }
        }, 300);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      keepListeningRef.current = false;
      if (restartTimerRef.current) { window.clearTimeout(restartTimerRef.current); restartTimerRef.current = null; }
      try {
        recognition.stop();
      } catch {
        /* already stopped */
      }
    };
    // Intentionally only depends on `lang` — recognition is expensive to
    // recreate and the callback staleness is now handled via refs above,
    // not by rebuilding the recognition object every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  // Mute the mic while the AI is speaking (caller passes its isSpeaking
  // flag in as `pause`) so it doesn't hear its own TTS reply through the
  // device speaker and misfire on it as a new command. Resumes hands-free
  // listening automatically once speaking stops, if it was on before.
  useEffect(() => {
    pausedRef.current = pause;
    if (!recognitionRef.current) return;
    if (pause) {
      if (restartTimerRef.current) { window.clearTimeout(restartTimerRef.current); restartTimerRef.current = null; }
      try {
        recognitionRef.current.stop();
      } catch {
        /* already stopped */
      }
    } else if (keepListeningRef.current) {
      try {
        recognitionRef.current.start();
      } catch {
        /* already running — ignore */
      }
    }
  }, [pause]);

  const startListening = useCallback(() => {
    keepListeningRef.current = true;
    if (!recognitionRef.current || isListening) return;
    try {
      recognitionRef.current.start();
    } catch {
      /* recognition already started — ignore duplicate start calls */
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    keepListeningRef.current = false;
    if (restartTimerRef.current) { window.clearTimeout(restartTimerRef.current); restartTimerRef.current = null; }
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
    } catch {
      /* already stopped */
    }
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) stopListening();
    else startListening();
  }, [isListening, startListening, stopListening]);

  return { isSupported, isListening, interimTranscript, startListening, stopListening, toggleListening };
}
