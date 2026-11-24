import React, { useEffect, useMemo, useRef, useState } from 'react';
import { usePlatform } from '../../context/PlatformContext';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  viaVoice?: boolean;
}

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome-ta',
  role: 'model',
  text: 'வணக்கம்! நான் Unavagam தமிழ் குரல் & AI உதவியாளர். மைக் பொத்தானை அழுத்தி தமிழில் பேசலாம் அல்லது தட்டச்சு செய்யலாம் — கிடைக்கும் உபரி உணவுகள், பாதுகாப்பு வெப்பநிலை (>60°C / <5°C), மற்றும் அருகிலுள்ள NGO-கள் குறித்து உடனே பதிலளிப்பேன்.',
  timestamp: new Date().toISOString(),
};

const QUICK_PROMPTS_TA: Array<{ label: string; prompt: string }> = [
  {
    label: 'கிடைக்கும் உணவுகள்',
    prompt: 'இப்போது NGO-கள் கோருவதற்கு கிடைக்கும் உபரி உணவுகள் எவை? விவரமாகச் சொல்லுங்கள்.',
  },
  {
    label: 'பாதுகாப்பு விதிகள்',
    prompt: 'Unavagam தளத்தில் உணவுப் பாதுகாப்பு வெப்பநிலை மற்றும் கால அளவு விதிகள் என்ன?',
  },
  {
    label: 'சரிபார்க்கப்பட்ட NGO-கள்',
    prompt: 'தற்போது சரிபார்க்கப்பட்ட NGO-கள் யார்? அவர்களின் திறன் எவ்வளவு?',
  },
  {
    label: 'AI முன்னறிவிப்பு',
    prompt: 'AI தேவை முன்னறிவிப்பு மற்றும் 6-படி உணவு மீட்பு செயல்முறை எப்படி வேலை செய்கிறது?',
  },
];

function pickSupportedAudioMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      if (!base64) {
        reject(new Error('Failed to encode recorded audio'));
      } else {
        resolve(base64);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read recorded audio'));
    reader.readAsDataURL(blob);
  });
}

export const TamilAiChatbot: React.FC = () => {
  const { currentUser, donations, users } = usePlatform();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [inputText, setInputText] = useState('');
  const [statusPhase, setStatusPhase] = useState<
    'idle' | 'recording' | 'transcribing' | 'thinking'
  >('idle');
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [autoSpeakReplies, setAutoSpeakReplies] = useState(true);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [synthesizingMessageId, setSynthesizingMessageId] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioCacheRef = useRef<Map<string, string>>(new Map());

  const isBusy = statusPhase === 'transcribing' || statusPhase === 'thinking';
  const isRecording = statusPhase === 'recording';

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, statusPhase]);

  // Cleanup active streams, timers, and audio playback on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        window.clearInterval(recordingTimerRef.current);
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
        activeAudioRef.current = null;
      }
    };
  }, []);

  const stopPlayback = () => {
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current.currentTime = 0;
      activeAudioRef.current = null;
    }
    setSpeakingMessageId(null);
  };

  const playVoiceReply = async (messageId: string, text: string) => {
    // Toggle off if clicking the currently speaking message
    if (speakingMessageId === messageId) {
      stopPlayback();
      return;
    }

    stopPlayback();
    setErrorText(null);

    try {
      let base64Wav = audioCacheRef.current.get(messageId);

      if (!base64Wav) {
        setSynthesizingMessageId(messageId);
        const res = await fetch('/api/voice/speak', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, voiceName: 'Kore' }),
        });
        const data = (await res.json()) as {
          audioBase64?: string;
          mimeType?: string;
          error?: string;
        };

        if (!res.ok || !data.audioBase64) {
          throw new Error(data.error || 'குரல் ஒலியை உருவாக்க முடியவில்லை.');
        }

        base64Wav = data.audioBase64;
        audioCacheRef.current.set(messageId, base64Wav);
      }

      const audio = new Audio(`data:audio/wav;base64,${base64Wav}`);
      activeAudioRef.current = audio;
      setSpeakingMessageId(messageId);

      audio.onended = () => {
        if (activeAudioRef.current === audio) {
          activeAudioRef.current = null;
        }
        setSpeakingMessageId(null);
      };

      audio.onerror = () => {
        if (activeAudioRef.current === audio) {
          activeAudioRef.current = null;
        }
        setSpeakingMessageId(null);
      };

      await audio.play();
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'குரல் இயக்கத்தில் பிழை ஏற்பட்டது.';
      setErrorText(msg);
      setSpeakingMessageId(null);
    } finally {
      setSynthesizingMessageId(null);
    }
  };

  const platformContext = useMemo(() => {
    const publishedListings = donations
      .filter((d) => d.status === 'published')
      .map((d) => ({
        foodTitle: d.foodTitle,
        quantityKg: d.confirmedQuantityKg,
        donorOrg: d.donorOrg,
        storageCondition: d.storageCondition,
        temperatureC: d.temperatureC,
        neighborhood: d.pickupLocation.neighborhood,
      }));

    const verifiedNgos = users
      .filter((u) => u.role === 'ngo' && u.verificationStatus === 'verified')
      .map((n) => ({
        organization: n.organization,
        neighborhood: n.location.neighborhood,
        capacityKg: n.capacityKg,
      }));

    const validDonations = donations.filter((d) => d.status !== 'cancelled');
    const totalSavedKg =
      Math.round(validDonations.reduce((acc, d) => acc + d.confirmedQuantityKg, 0) * 10) / 10;
    const totalMeals = validDonations.reduce((acc, d) => acc + d.estimatedServings, 0);

    return {
      userName: currentUser?.name,
      userRole: currentUser?.role,
      organization: currentUser?.organization,
      totalDonations: validDonations.length,
      publishedListings,
      verifiedNgos,
      totalSavedKg,
      totalMeals,
    };
  }, [currentUser, donations, users]);

  const sendMessage = async (
    textToSend: string,
    options?: { isRetry?: boolean; viaVoice?: boolean }
  ) => {
    const trimmed = textToSend.trim();
    if (!trimmed || isBusy) return;

    const isRetry = options?.isRetry ?? false;
    const viaVoice = options?.viaVoice ?? false;

    setErrorText(null);
    setLastFailedPrompt(null);
    stopPlayback();

    const historyForApi = messages
      .filter((m) => m.id !== WELCOME_MESSAGE.id)
      .map((m) => ({ role: m.role, text: m.text }));

    if (!isRetry) {
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        text: trimmed,
        timestamp: new Date().toISOString(),
        viaVoice,
      };
      setMessages((prev) => [...prev, userMsg]);
      setInputText('');
    }

    setStatusPhase('thinking');
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          history: isRetry ? historyForApi.slice(0, -1) : historyForApi,
          context: platformContext,
        }),
      });

      const data = (await response.json()) as { reply?: string; error?: string };

      if (!response.ok || !data.reply) {
        throw new Error(
          data.error || 'பதில் பெற முடியவில்லை. சிறிது நேரம் கழித்து மீண்டும் முயற்சிக்கவும்.'
        );
      }

      const botMsgId = `bot-${Date.now()}`;
      const botMsg: ChatMessage = {
        id: botMsgId,
        role: 'model',
        text: data.reply,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, botMsg]);
      setStatusPhase('idle');

      // Speak reply automatically if submitted via voice or if Auto-Speak is enabled cleanly
      if (viaVoice || autoSpeakReplies) {
        void playVoiceReply(botMsgId, data.reply);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'இணைய இணைப்பில் பிழை ஏற்பட்டது. மீண்டும் முயற்சிக்கவும்.';
      setErrorText(msg);
      setLastFailedPrompt(trimmed);
      setStatusPhase('idle');
    }
  };

  const handleVoiceAudioCaptured = async (blob: Blob, mimeType: string) => {
    setStatusPhase('transcribing');
    setErrorText(null);
    try {
      const audioBase64 = await blobToBase64(blob);
      const res = await fetch('/api/voice/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioBase64, mimeType }),
      });
      const data = (await res.json()) as { transcript?: string; error?: string };

      if (!res.ok || !data.transcript) {
        throw new Error(
          data.error || 'உங்கள் பேச்சைப் புரிந்துகொள்ள முடியவில்லை. மீண்டும் பேசவும்.'
        );
      }

      await sendMessage(data.transcript, { viaVoice: true });
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'குரல் பதிவைச் செயலாக்குவதில் பிழை ஏற்பட்டது.';
      setErrorText(msg);
      setStatusPhase('idle');
    }
  };

  const startRecording = async () => {
    if (isBusy || isRecording) return;
    setErrorText(null);
    stopPlayback();

    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorText('உங்கள் உலாவியில் மைக்ரோஃபோன் பதிவு வசதி ஆதரிக்கப்படவில்லை.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const mimeType = pickSupportedAudioMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      recordedChunksRef.current = [];
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          recordedChunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = () => {
        if (recordingTimerRef.current) {
          window.clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        stream.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;

        const actualMime = recorder.mimeType || mimeType || 'audio/webm';
        const audioBlob = new Blob(recordedChunksRef.current, { type: actualMime });
        recordedChunksRef.current = [];

        if (audioBlob.size < 300) {
          setErrorText('குரல் பதிவு மிகவும் குறுகியதாக உள்ளது. மீண்டும் பேசவும்.');
          setStatusPhase('idle');
          return;
        }

        void handleVoiceAudioCaptured(audioBlob, actualMime);
      };

      recorder.start();
      setRecordingSeconds(0);
      setStatusPhase('recording');

      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch {
      setErrorText('மைக்ரோஃபோன் அனுமதி மறுக்கப்பட்டது. உலாவி அமைப்புகளில் அனுமதிக்கவும்.');
      setStatusPhase('idle');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const cancelRecording = () => {
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    recordedChunksRef.current = [];
    setStatusPhase('idle');
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendMessage(inputText);
  };

  const handleResetChat = () => {
    stopPlayback();
    if (isRecording) cancelRecording();
    setMessages([WELCOME_MESSAGE]);
    setErrorText(null);
    setLastFailedPrompt(null);
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <>
      {/* Voice & Chat Assistant Drawer */}
      {isOpen && (
        <section
          aria-label="Unavagam குரல் மற்றும் தமிழ் AI உதவியாளர்"
          className="fixed bottom-36 lg:bottom-22 right-4 lg:right-6 z-50 w-[calc(100vw-2rem)] sm:w-[410px] h-[550px] max-h-[78vh] bg-surface-container-lowest rounded-2xl shadow-[0_12px_40px_rgba(11,28,48,0.22)] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="bg-primary text-on-primary px-4 py-3.5 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[20px]">
                  {isRecording || speakingMessageId ? 'graphic_eq' : 'mic'}
                </span>
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-display font-bold truncate">
                  Unavagam குரல் &amp; தமிழ் AI
                </h2>
                <p className="text-[11px] text-on-primary/80 truncate">
                  பேசி அல்லது தட்டச்சு செய்து உதவி பெறுங்கள்
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (autoSpeakReplies) stopPlayback();
                  setAutoSpeakReplies((prev) => !prev);
                }}
                aria-label={autoSpeakReplies ? 'தானியங்கி குரல் பதிலை நிறுத்து' : 'தானியங்கி குரல் பதிலை இயக்கு'}
                title={autoSpeakReplies ? 'குரல் பதில்: இயக்கத்தில்' : 'குரல் பதில்: நிறுத்தப்பட்டது'}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  autoSpeakReplies ? 'bg-white/20 text-on-primary' : 'text-on-primary/70 hover:bg-white/10'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {autoSpeakReplies ? 'volume_up' : 'volume_off'}
                </span>
              </button>
              <button
                type="button"
                onClick={handleResetChat}
                aria-label="உரையாடலைப் புதுப்பி"
                title="புதிய உரையாடல்"
                className="w-8 h-8 rounded-full flex items-center justify-center text-on-primary/85 hover:bg-white/15 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">refresh</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  stopPlayback();
                  if (isRecording) cancelRecording();
                  setIsOpen(false);
                }}
                aria-label="மூடு"
                className="w-8 h-8 rounded-full flex items-center justify-center text-on-primary/85 hover:bg-white/15 transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
          </div>

          {/* Quick Suggestion Prompts */}
          <div className="px-3.5 py-2.5 bg-surface-container-low flex items-center gap-1.5 overflow-x-auto shrink-0">
            {QUICK_PROMPTS_TA.map((item) => (
              <button
                key={item.label}
                type="button"
                disabled={isBusy || isRecording}
                onClick={() => void sendMessage(item.prompt)}
                className="px-2.5 py-1.5 rounded-lg bg-surface-container-lowest hover:bg-secondary-container/60 text-primary text-[11px] font-bold shadow-sm transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Messages List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-surface">
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              const isPlayingThis = speakingMessageId === msg.id;
              const isSynthesizingThis = synthesizingMessageId === msg.id;

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} gap-1`}
                >
                  <div
                    className={`max-w-[86%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                      isUser
                        ? 'bg-primary text-on-primary rounded-br-sm shadow-sm'
                        : 'bg-surface-container-lowest text-on-surface rounded-bl-sm shadow-[0_1px_4px_rgba(0,0,0,0.05)]'
                    }`}
                  >
                    {msg.viaVoice && isUser && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-on-primary/80 font-semibold mb-1 block">
                        <span className="material-symbols-outlined text-[12px]">mic</span>
                        <span>குரல் வழியாக</span>
                      </span>
                    )}
                    {msg.text}
                  </div>

                  {!isUser && (
                    <button
                      type="button"
                      disabled={isSynthesizingThis}
                      onClick={() => void playVoiceReply(msg.id, msg.text)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-primary hover:bg-surface-container-low transition-colors disabled:opacity-60"
                    >
                      <span className="material-symbols-outlined text-[14px]">
                        {isSynthesizingThis
                          ? 'progress_activity'
                          : isPlayingThis
                            ? 'stop_circle'
                            : 'volume_up'}
                      </span>
                      <span>
                        {isSynthesizingThis
                          ? 'ஒலி தயாராகிறது...'
                          : isPlayingThis
                            ? 'ஒலியை நிறுத்து'
                            : 'குரலில் கேளுங்கள்'}
                      </span>
                    </button>
                  )}
                </div>
              );
            })}

            {statusPhase === 'transcribing' && (
              <div className="flex justify-end">
                <div className="bg-secondary-container text-on-secondary-container rounded-2xl rounded-br-sm px-3.5 py-2.5 text-xs inline-flex items-center gap-2 font-medium">
                  <span className="material-symbols-outlined text-[16px] animate-spin">
                    progress_activity
                  </span>
                  <span>உங்கள் குரல் எழுத்தாக மாற்றப்படுகிறது...</span>
                </div>
              </div>
            )}

            {statusPhase === 'thinking' && (
              <div className="flex justify-start">
                <div className="bg-surface-container-lowest text-on-surface-variant rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-xs shadow-[0_1px_4px_rgba(0,0,0,0.05)] inline-flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] text-primary animate-spin">
                    progress_activity
                  </span>
                  <span>தமிழில் பதில் தயாராகிறது...</span>
                </div>
              </div>
            )}

            {errorText && (
              <div className="p-3 rounded-xl bg-error-container text-on-error-container text-xs space-y-2">
                <p className="font-medium leading-relaxed">{errorText}</p>
                {lastFailedPrompt && (
                  <button
                    type="button"
                    onClick={() => void sendMessage(lastFailedPrompt, { isRetry: true })}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-on-error text-error font-bold text-[11px]"
                  >
                    <span className="material-symbols-outlined text-[14px]">refresh</span>
                    <span>மீண்டும் முயற்சி</span>
                  </button>
                )}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Active Voice Recording Bar OR Standard Input + Mic */}
          {isRecording ? (
            <div className="p-3 bg-secondary-container/45 border-t border-surface-container flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-3 h-3 rounded-full bg-error animate-pulse shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-on-surface truncate">
                    கேட்டுக்கொண்டிருக்கிறது...{' '}
                    <span className="font-mono text-primary">{formatTimer(recordingSeconds)}</span>
                  </p>
                  <p className="text-[11px] text-on-surface-variant truncate">
                    தமிழில் தெளிவாகப் பேசுங்கள்
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={cancelRecording}
                  className="px-2.5 py-2 rounded-xl bg-surface-container-lowest text-on-surface-variant hover:text-error text-xs font-bold"
                >
                  ரத்து
                </button>
                <button
                  type="button"
                  onClick={stopRecording}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-primary hover:bg-primary-container text-on-primary text-xs font-bold shadow-sm whitespace-nowrap"
                >
                  <span className="material-symbols-outlined text-[16px]">stop</span>
                  <span>அனுப்பு</span>
                </button>
              </div>
            </div>
          ) : (
            <form
              onSubmit={handleFormSubmit}
              className="p-3 bg-surface-container-lowest border-t border-surface-container flex items-center gap-2 shrink-0"
            >
              <button
                type="button"
                disabled={isBusy}
                onClick={() => void startRecording()}
                aria-label="குரல் மூலம் பேசுங்கள்"
                title="மைக் மூலம் தமிழில் பேசுங்கள்"
                className="w-10 h-10 rounded-xl bg-secondary-container hover:bg-secondary-container/80 text-primary flex items-center justify-center shadow-sm transition-colors disabled:opacity-45 shrink-0"
              >
                <span className="material-symbols-outlined text-[20px]">mic</span>
              </button>

              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="பேச மைக்கை அழுத்தவும் அல்லது எழுதவும்..."
                disabled={isBusy}
                className="flex-1 min-w-0 px-3.5 py-2.5 text-xs bg-surface-container-low rounded-xl border border-outline-variant/40 text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
              />

              <button
                type="submit"
                disabled={!inputText.trim() || isBusy}
                aria-label="அனுப்பு"
                className="w-10 h-10 rounded-xl bg-primary hover:bg-primary-container text-on-primary flex items-center justify-center shadow-sm transition-colors disabled:opacity-45 disabled:cursor-not-allowed shrink-0"
              >
                <span className="material-symbols-outlined text-[18px]">send</span>
              </button>
            </form>
          )}
        </section>
      )}

      {/* Floating Voice & AI Assistant Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="தமிழ் குரல் மற்றும் AI உதவியாளரைத் திறக்கவும்"
        className="fixed bottom-22 lg:bottom-6 right-4 lg:right-6 z-40 inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-primary hover:bg-primary-container text-on-primary shadow-[0_6px_20px_rgba(0,107,44,0.28)] transition-all active:scale-[0.98] whitespace-nowrap shrink-0"
      >
        <span className="material-symbols-outlined text-[20px]">
          {isOpen ? 'close' : 'mic'}
        </span>
        <span className="text-xs font-bold">
          {isOpen ? 'மூடு' : 'குரல் & தமிழ் AI'}
        </span>
      </button>
    </>
  );
};
