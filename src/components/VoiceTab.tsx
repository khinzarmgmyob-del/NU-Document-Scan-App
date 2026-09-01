import React, { useState, useEffect, useRef } from 'react';
import { Mic, Square, Play, Pause, Share2, Music, Trash2, Volume2 } from 'lucide-react';
import { VoiceService } from '../services/voiceService';
import { LocalFileItem } from '../types';

interface VoiceTabProps {
  voiceService: VoiceService;
  savedVoiceNotes: LocalFileItem[];
  onSaveVoiceNote: (file: LocalFileItem) => void;
  onDeleteVoiceNote: (id: string) => void;
}

export const VoiceTab: React.FC<VoiceTabProps> = ({
  voiceService,
  savedVoiceNotes,
  onSaveVoiceNote,
  onDeleteVoiceNote,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [activePlayingId, setActivePlayingId] = useState<string | null>(null);

  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      voiceService.stopAudio();
    };
  }, []);

  const handleToggleRecord = async () => {
    if (!isRecording) {
      const success = await voiceService.startRecording(level => {
        setVolumeLevel(level);
      });

      if (success) {
        setIsRecording(true);
        setRecordingSeconds(0);
        timerRef.current = window.setInterval(() => {
          setRecordingSeconds(prev => prev + 1);
        }, 1000);
      } else {
        alert('Microphone access was denied or is not supported in this browser.');
      }
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setIsRecording(false);
      setVolumeLevel(0);

      const result = await voiceService.stopRecording();
      if (result) {
        const now = new Date();
        const timeStamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);
        const fileName = `Voice_Note_${timeStamp}.webm`;

        const newNote: LocalFileItem = {
          id: `voice-${Date.now()}`,
          path: `/storage/${fileName}`,
          name: fileName,
          extension: 'webm',
          sizeBytes: result.blob.size || 128000,
          modifiedAt: now.toISOString(),
          isPdf: false,
          isExcel: false,
          isCsv: false,
          isAudio: true,
          dataUrl: result.url,
          driveSynced: false,
        };

        onSaveVoiceNote(newNote);
      }
    }
  };

  const handleTogglePlay = (note: LocalFileItem) => {
    if (!note.dataUrl) return;

    if (activePlayingId === note.id && voiceService.isPlaying) {
      voiceService.pauseAudio();
      setActivePlayingId(null);
    } else {
      setActivePlayingId(note.id);
      voiceService.playAudio(
        note.dataUrl,
        () => {
          setActivePlayingId(null);
        },
        () => {}
      );
    }
  };

  const handleShare = async (note: LocalFileItem) => {
    if (navigator.share && note.dataUrl) {
      try {
        await navigator.share({
          title: note.name,
          text: `Voice note audio memo: ${note.name}`,
          url: window.location.href,
        });
      } catch (err) {
        console.warn('Share cancelled or not supported:', err);
      }
    } else if (note.dataUrl) {
      const a = document.createElement('a');
      a.href = note.dataUrl;
      a.download = note.name;
      a.click();
    }
  };

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const remaining = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${remaining.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto pb-8">
      {/* Central Voice Recorder Card */}
      <div className="bg-white/95 dark:bg-dark-card/95 backdrop-blur-xs rounded-2xl border border-emerald-100 dark:border-dark-border shadow-xs p-8 text-center flex flex-col items-center justify-center transition-colors">
        {/* Pulsing Record Button */}
        <div className="relative mb-6">
          {isRecording && (
            <div
              className="absolute inset-0 rounded-full bg-rose-500/30 animate-ping pointer-events-none"
              style={{
                transform: `scale(${1 + volumeLevel * 0.4})`,
                transition: 'transform 0.1s ease',
              }}
            />
          )}

          <button
            onClick={handleToggleRecord}
            className={`relative w-24 h-24 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95 ${
              isRecording
                ? 'bg-rose-600 text-white shadow-rose-600/30 ring-8 ring-rose-100 dark:ring-rose-950/40'
                : 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-emerald-600/30 ring-8 ring-emerald-100/80 dark:ring-emerald-950/50 hover:from-emerald-600 hover:to-teal-700'
            }`}
          >
            {isRecording ? (
              <Square className="w-9 h-9 fill-current" />
            ) : (
              <Mic className="w-11 h-11" />
            )}
          </button>
        </div>

        {/* Live Timer or Tap to Record label */}
        <div className="space-y-1">
          <div
            className={`text-lg font-bold ${
              isRecording ? 'text-rose-600 dark:text-rose-400 animate-pulse font-mono' : 'text-slate-900 dark:text-emerald-100'
            }`}
          >
            {isRecording ? `Recording: ${formatSeconds(recordingSeconds)}` : 'Tap to Record Voice Note'}
          </div>
          <p className="text-xs text-emerald-800/80 dark:text-emerald-400/80 max-w-md mx-auto">
            {isRecording
              ? 'Speaking into microphone... Tap stop when finished.'
              : 'Attach audio explanations or meeting notes to your scanned documents'}
          </p>
        </div>

        {/* Dynamic Waveform Visualizer simulation while recording */}
        {isRecording && (
          <div className="mt-4 flex items-center justify-center gap-1 h-8">
            {[40, 75, 100, 60, 30, 90, 50, 80, 45, 95, 60, 70, 30].map((h, i) => (
              <div
                key={i}
                className="w-1 bg-rose-500 rounded-full transition-all duration-100"
                style={{
                  height: `${Math.max(6, h * (0.3 + volumeLevel * 0.8))}px`,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Voice Notes Archive List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="font-bold text-slate-900 dark:text-emerald-100 text-sm">
            Saved Voice Notes ({savedVoiceNotes.length})
          </h3>
          <span className="text-xs text-emerald-700 dark:text-emerald-400/70 font-medium">Audio Memo Archives</span>
        </div>

        {savedVoiceNotes.length === 0 ? (
          <div className="bg-white/90 dark:bg-dark-card/90 rounded-xl border border-emerald-100 dark:border-dark-border p-8 text-center transition-colors">
            <Volume2 className="w-8 h-8 text-emerald-300 dark:text-emerald-800 mx-auto mb-2" />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              No voice recordings yet. Tap the microphone button above to record your first note.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {savedVoiceNotes.map(note => {
              const isPlayingThis = activePlayingId === note.id;
              return (
                <div
                  key={note.id}
                  className="bg-white/95 dark:bg-dark-card/95 backdrop-blur-xs rounded-xl border border-emerald-100 dark:border-dark-border p-3.5 shadow-2xs flex items-center justify-between gap-3 hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors"
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                      <Music className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-emerald-100 truncate">
                        {note.name}
                      </div>
                      <div className="text-[11px] text-emerald-700/80 dark:text-emerald-400/70 flex items-center gap-2">
                        <span>Audio Note • {note.extension.toUpperCase()}</span>
                        <span>•</span>
                        <span>{new Date(note.modifiedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  </div>

                  {/* Playback Controls & Sharing */}
                  <div className="flex items-center space-x-1 shrink-0">
                    <button
                      onClick={() => handleTogglePlay(note)}
                      className={`p-2 rounded-full border transition-all ${
                        isPlayingThis
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-white dark:bg-dark-surface text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-dark-border hover:bg-emerald-50 dark:hover:bg-dark-elevated'
                      }`}
                      title={isPlayingThis ? 'Pause' : 'Play'}
                    >
                      {isPlayingThis ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      )}
                    </button>

                    <button
                      onClick={() => handleShare(note)}
                      className="p-2 text-slate-500 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-300 rounded-lg hover:bg-emerald-50 dark:hover:bg-dark-elevated transition-colors"
                      title="Share Audio Note"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => onDeleteVoiceNote(note.id)}
                      className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                      title="Delete Voice Note"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

