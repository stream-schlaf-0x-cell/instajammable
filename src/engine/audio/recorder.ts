// Web Audio Stream Recorder (Captures live generative output to file)

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private isRecording: boolean = false;
  private startTime: number = 0;
  private onStateChangeCallback?: (isRecording: boolean, durationSec: number) => void;
  private timerInterval: any = null;

  constructor(private streamNode: MediaStreamAudioDestinationNode) {}

  public isCurrentlyRecording(): boolean {
    return this.isRecording;
  }

  public setCallback(cb: (isRecording: boolean, durationSec: number) => void): void {
    this.onStateChangeCallback = cb;
  }

  public start(): boolean {
    if (this.isRecording) return false;

    try {
      this.recordedChunks = [];
      const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
      let selectedMime = '';
      for (const mime of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mime)) {
          selectedMime = mime;
          break;
        }
      }

      const options = selectedMime ? { mimeType: selectedMime } : undefined;
      this.mediaRecorder = new MediaRecorder(this.streamNode.stream, options);

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.start(200); // chunk every 200ms
      this.isRecording = true;
      this.startTime = Date.now();

      this.timerInterval = setInterval(() => {
        if (this.onStateChangeCallback && this.isRecording) {
          const duration = Math.floor((Date.now() - this.startTime) / 1000);
          this.onStateChangeCallback(true, duration);
        }
      }, 500);

      return true;
    } catch (err) {
      console.error('Failed to start MediaRecorder:', err);
      return false;
    }
  }

  public stop(): Promise<Blob | null> {
    return new Promise((resolve) => {
      if (!this.isRecording || !this.mediaRecorder) {
        resolve(null);
        return;
      }

      if (this.timerInterval) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
      }

      this.mediaRecorder.onstop = () => {
        const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
        const blob = new Blob(this.recordedChunks, { type: mimeType });
        this.isRecording = false;
        if (this.onStateChangeCallback) {
          this.onStateChangeCallback(false, 0);
        }
        resolve(blob);
      };

      this.mediaRecorder.stop();
    });
  }

  public downloadRecording(blob: Blob, filename = 'echo-garden-session.webm'): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }
}
