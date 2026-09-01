export class VoiceService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private stream: MediaStream | null = null;
  private audioElement: HTMLAudioElement | null = null;

  public isRecording = false;
  public isPlaying = false;
  public currentRecordingUrl: string | null = null;
  public currentAudioBlob: Blob | null = null;

  /**
   * Request microphone permissions
   */
  static async checkPermission(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Start microphone recording
   */
  async startRecording(onVolumeLevel?: (level: number) => void): Promise<boolean> {
    try {
      this.audioChunks = [];
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      });

      // Setup audio analyser for waveform visualizer
      try {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.audioContext = new AudioContextClass();
        const source = this.audioContext.createMediaStreamSource(this.stream);
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256;
        source.connect(this.analyser);

        if (onVolumeLevel) {
          const bufferLength = this.analyser.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);
          const updateVolume = () => {
            if (!this.isRecording || !this.analyser) return;
            this.analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < bufferLength; i++) {
              sum += dataArray[i];
            }
            const average = sum / bufferLength;
            onVolumeLevel(Math.min(average / 128, 1));
            requestAnimationFrame(updateVolume);
          };
          updateVolume();
        }
      } catch (e) {
        console.warn('AudioContext visualization setup skipped:', e);
      }

      // Initialize MediaRecorder
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      }

      this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });
      this.mediaRecorder.ondataavailable = event => {
        if (event.data && event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.start(100);
      this.isRecording = true;
      return true;
    } catch (err) {
      console.error('Failed to start recording:', err);
      this.isRecording = false;
      return false;
    }
  }

  /**
   * Stop recording and return audio blob & URL
   */
  async stopRecording(): Promise<{ blob: Blob; url: string } | null> {
    return new Promise(resolve => {
      if (!this.mediaRecorder || !this.isRecording) {
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = () => {
        const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
        const blob = new Blob(this.audioChunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        this.currentAudioBlob = blob;
        this.currentRecordingUrl = url;
        this.isRecording = false;

        // Cleanup stream tracks
        if (this.stream) {
          this.stream.getTracks().forEach(track => track.stop());
          this.stream = null;
        }
        if (this.audioContext) {
          this.audioContext.close();
          this.audioContext = null;
        }

        resolve({ blob, url });
      };

      this.mediaRecorder.stop();
    });
  }

  /**
   * Play audio URL
   */
  playAudio(
    audioUrl: string,
    onEnded?: () => void,
    onTimeUpdate?: (currentTime: number, duration: number) => void
  ): void {
    this.stopAudio();

    this.audioElement = new Audio(audioUrl);
    this.audioElement.onended = () => {
      this.isPlaying = false;
      if (onEnded) onEnded();
    };

    if (onTimeUpdate) {
      this.audioElement.ontimeupdate = () => {
        if (this.audioElement) {
          onTimeUpdate(this.audioElement.currentTime, this.audioElement.duration || 0);
        }
      };
    }

    this.audioElement.play();
    this.isPlaying = true;
  }

  /**
   * Pause audio playback
   */
  pauseAudio(): void {
    if (this.audioElement) {
      this.audioElement.pause();
      this.isPlaying = false;
    }
  }

  /**
   * Stop audio playback
   */
  stopAudio(): void {
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.currentTime = 0;
      this.audioElement = null;
      this.isPlaying = false;
    }
  }
}
