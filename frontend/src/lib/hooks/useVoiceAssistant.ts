'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export type VoiceState = 'IDLE' | 'LISTENING' | 'THINKING' | 'SPEAKING' | 'ERROR';

interface UseVoiceAssistantOptions {
  languagePreference?: 'auto' | 'hi' | 'en';
  onFinalTranscript: (transcript: string) => void;
  onSilenceTimeout?: () => void;
}

const SILENCE_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes auto-off

interface WebSpeechRecognitionEvent {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: {
        transcript: string;
      };
    };
  };
}

interface WebSpeechRecognitionErrorEvent {
  error: string;
}

export function useVoiceAssistant({
  languagePreference = 'auto',
  onFinalTranscript,
  onSilenceTimeout,
}: UseVoiceAssistantOptions) {
  const [voiceState, setVoiceState] = useState<VoiceState>('IDLE');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isContinuous, setIsContinuous] = useState(false);
  const [mutePatientNames, setMutePatientNames] = useState(true);

  // Lazy check for browser support without set-state-in-effect
  const [isSupported] = useState(() => {
    if (typeof window === 'undefined') return true;
    const w = window as unknown as {
      SpeechRecognition?: unknown;
      webkitSpeechRecognition?: unknown;
    };
    return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
  });

  // References to external Web APIs
  const recognitionRef = useRef<unknown>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isContinuousRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const startListeningRef = useRef<() => void>(() => {});

  // Initialize SpeechSynthesis reference
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis;
    }
  }, []);

  // Sync ref with state
  useEffect(() => {
    isContinuousRef.current = isContinuous;
  }, [isContinuous]);

  // Reset silence timer on activity
  const resetSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }
    if (isContinuousRef.current) {
      silenceTimerRef.current = setTimeout(() => {
        if (isContinuousRef.current) {
          setIsContinuous(false);
          isContinuousRef.current = false;
          onSilenceTimeout?.();
        }
      }, SILENCE_TIMEOUT_MS);
    }
  }, [onSilenceTimeout]);

  // Stop listening
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        (recognitionRef.current as { abort: () => void }).abort();
      } catch {}
      recognitionRef.current = null;
    }
    setInterimTranscript('');
    setVoiceState((prev) => (prev === 'LISTENING' ? 'IDLE' : prev));
  }, []);

  // Stop TTS speech
  const stopSpeaking = useCallback(() => {
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    isSpeakingRef.current = false;
  }, []);

  // Initialize and start browser SpeechRecognition
  const startListening = useCallback(() => {
    if (typeof window === 'undefined') return;

    // Barge-in: if speaking, cancel speech immediately
    if (isSpeakingRef.current) {
      stopSpeaking();
    }

    const windowWithSpeech = window as unknown as {
      SpeechRecognition?: new () => unknown;
      webkitSpeechRecognition?: new () => unknown;
    };

    const SpeechRecognitionClass =
      windowWithSpeech.SpeechRecognition ||
      windowWithSpeech.webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      setErrorMessage('Speech recognition is not supported in this browser.');
      setVoiceState('ERROR');
      return;
    }

    try {
      if (recognitionRef.current) {
        try {
          (recognitionRef.current as { abort: () => void }).abort();
        } catch {}
      }

      const recognition = new SpeechRecognitionClass() as {
        continuous: boolean;
        interimResults: boolean;
        maxAlternatives: number;
        lang: string;
        onstart: () => void;
        onresult: (event: WebSpeechRecognitionEvent) => void;
        onerror: (event: WebSpeechRecognitionErrorEvent) => void;
        onend: () => void;
        start: () => void;
        abort: () => void;
      };

      recognitionRef.current = recognition;
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.lang = languagePreference === 'en' ? 'en-IN' : 'hi-IN';

      recognition.onstart = () => {
        setVoiceState('LISTENING');
        setErrorMessage(null);
        resetSilenceTimer();
      };

      recognition.onresult = (event: WebSpeechRecognitionEvent) => {
        resetSilenceTimer();
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            final += transcript;
          } else {
            interim += transcript;
          }
        }

        setInterimTranscript(interim || final);

        if (final && final.trim().length > 2) {
          const cleaned = final.trim();
          setInterimTranscript('');

          // Check voice commands to stop continuous session
          const lower = cleaned.toLowerCase();
          if (
            lower === 'stop' ||
            lower === 'band karo' ||
            lower === 'voice off' ||
            lower === 'exit'
          ) {
            setIsContinuous(false);
            isContinuousRef.current = false;
            stopListening();
            return;
          }

          setVoiceState('THINKING');
          onFinalTranscript(cleaned);
        }
      };

      recognition.onerror = (event: WebSpeechRecognitionErrorEvent) => {
        if (event.error === 'no-speech' || event.error === 'aborted') {
          if (isContinuousRef.current && !isSpeakingRef.current) {
            setTimeout(() => {
              if (isContinuousRef.current && !isSpeakingRef.current) {
                startListeningRef.current();
              }
            }, 300);
          } else if (!isContinuousRef.current) {
            setVoiceState('IDLE');
          }
          return;
        }

        if (event.error === 'not-allowed') {
          setErrorMessage('Microphone access denied. Please allow microphone permission.');
          setVoiceState('ERROR');
          setIsContinuous(false);
          isContinuousRef.current = false;
        } else {
          setErrorMessage(`Microphone error: ${event.error}`);
          setVoiceState('ERROR');
        }
      };

      recognition.onend = () => {
        if (isContinuousRef.current && !isSpeakingRef.current) {
          setTimeout(() => {
            if (isContinuousRef.current && !isSpeakingRef.current) {
              startListeningRef.current();
            }
          }, 200);
        } else if (!isSpeakingRef.current) {
          setVoiceState('IDLE');
        }
      };

      recognition.start();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Microphone error';
      setErrorMessage(msg);
      setVoiceState('ERROR');
    }
  }, [languagePreference, onFinalTranscript, resetSilenceTimer, stopListening, stopSpeaking]);

  // Keep startListeningRef updated
  useEffect(() => {
    startListeningRef.current = startListening;
  }, [startListening]);

  // Speak short text using browser SpeechSynthesis
  const speak = useCallback(
    (text: string, lang: 'en' | 'hi' = 'hi') => {
      if (!synthRef.current || !text) return;

      synthRef.current.cancel();

      // Temporarily pause microphone so AI doesn't hear itself
      if (recognitionRef.current) {
        try {
          (recognitionRef.current as { abort: () => void }).abort();
        } catch {}
      }

      setVoiceState('SPEAKING');
      isSpeakingRef.current = true;

      const utterance = new SpeechSynthesisUtterance(text);
      const voices = synthRef.current.getVoices();
      const targetLang = lang === 'hi' ? 'hi-IN' : 'en-IN';

      let voice = voices.find((v) => v.lang === targetLang);
      if (!voice && lang === 'hi') {
        voice = voices.find((v) => v.lang.startsWith('hi') || v.lang === 'en-IN');
      }
      if (!voice) {
        voice = voices.find((v) => v.lang.startsWith('en'));
      }

      if (voice) {
        utterance.voice = voice;
      }
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      utterance.onend = () => {
        isSpeakingRef.current = false;
        if (isContinuousRef.current) {
          setTimeout(() => {
            if (isContinuousRef.current && !isSpeakingRef.current) {
              startListeningRef.current();
            }
          }, 300);
        } else {
          setVoiceState('IDLE');
        }
      };

      utterance.onerror = () => {
        isSpeakingRef.current = false;
        if (isContinuousRef.current) {
          startListeningRef.current();
        } else {
          setVoiceState('IDLE');
        }
      };

      synthRef.current.speak(utterance);
    },
    [],
  );

  // Start continuous voice session mode (Section 11)
  const startContinuousVoice = useCallback(() => {
    setIsContinuous(true);
    isContinuousRef.current = true;
    resetSilenceTimer();
    startListening();
  }, [resetSilenceTimer, startListening]);

  // Stop continuous voice session
  const stopContinuousVoice = useCallback(() => {
    setIsContinuous(false);
    isContinuousRef.current = false;
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }
    stopSpeaking();
    stopListening();
    setVoiceState('IDLE');
  }, [stopSpeaking, stopListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isContinuousRef.current = false;
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      if (recognitionRef.current) {
        try {
          (recognitionRef.current as { abort: () => void }).abort();
        } catch {}
      }
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, []);

  return {
    voiceState,
    interimTranscript,
    isSupported,
    errorMessage,
    isContinuous,
    mutePatientNames,
    setMutePatientNames,
    startListening,
    stopListening,
    startContinuousVoice,
    stopContinuousVoice,
    speak,
    stopSpeaking,
  };
}
