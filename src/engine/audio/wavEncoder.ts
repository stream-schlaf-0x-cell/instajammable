// Pure TypeScript Linear PCM 16-bit Stereo WAV Encoder

export class WavEncoder {
  // Encodes AudioBuffer into standard 16-bit linear PCM RIFF WAV format
  public static encodeAudioBuffer(audioBuffer: AudioBuffer): Uint8Array {
    const numChannels = Math.min(2, audioBuffer.numberOfChannels);
    const sampleRate = audioBuffer.sampleRate;
    const length = audioBuffer.length;
    const bytesPerSample = 2; // 16-bit
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = length * blockAlign;
    const headerSize = 44;
    const totalSize = headerSize + dataSize;

    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);

    // RIFF Chunk Descriptor
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, totalSize - 8, true); // chunk size
    this.writeString(view, 8, 'WAVE');

    // "fmt " Sub-chunk
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);             // Subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true);              // AudioFormat (1 = Linear PCM)
    view.setUint16(22, numChannels, true);    // NumChannels
    view.setUint32(24, sampleRate, true);     // SampleRate
    view.setUint32(28, byteRate, true);       // ByteRate
    view.setUint16(32, blockAlign, true);     // BlockAlign
    view.setUint16(34, 16, true);             // BitsPerSample

    // "data" Sub-chunk
    this.writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    // Write interleaved 16-bit PCM samples
    const leftChannel = audioBuffer.getChannelData(0);
    const rightChannel = numChannels > 1 ? audioBuffer.getChannelData(1) : leftChannel;

    let offset = 44;
    for (let i = 0; i < length; i++) {
      // Left channel
      const sampleL = Math.max(-1, Math.min(1, leftChannel[i]));
      view.setInt16(offset, sampleL < 0 ? sampleL * 0x8000 : sampleL * 0x7fff, true);
      offset += 2;

      // Right channel
      if (numChannels > 1) {
        const sampleR = Math.max(-1, Math.min(1, rightChannel[i]));
        view.setInt16(offset, sampleR < 0 ? sampleR * 0x8000 : sampleR * 0x7fff, true);
        offset += 2;
      }
    }

    return new Uint8Array(buffer);
  }

  // Encodes Float32Array channel data directly into 16-bit PCM WAV
  public static encodeFloat32Channels(
    left: Float32Array,
    right: Float32Array,
    sampleRate: number
  ): Uint8Array {
    const length = Math.min(left.length, right.length);
    const numChannels = 2;
    const blockAlign = 4;
    const byteRate = sampleRate * blockAlign;
    const dataSize = length * blockAlign;
    const totalSize = 44 + dataSize;

    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);

    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, totalSize - 8, true);
    this.writeString(view, 8, 'WAVE');

    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true);

    this.writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    let offset = 44;
    for (let i = 0; i < length; i++) {
      const sampleL = Math.max(-1, Math.min(1, left[i]));
      view.setInt16(offset, sampleL < 0 ? sampleL * 0x8000 : sampleL * 0x7fff, true);
      offset += 2;

      const sampleR = Math.max(-1, Math.min(1, right[i]));
      view.setInt16(offset, sampleR < 0 ? sampleR * 0x8000 : sampleR * 0x7fff, true);
      offset += 2;
    }

    return new Uint8Array(buffer);
  }

  private static writeString(view: DataView, offset: number, string: string): void {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  public static downloadWav(wavBytes: Uint8Array, filename = 'echo-garden-recording.wav'): void {
    const blob = new Blob([wavBytes.buffer as ArrayBuffer], { type: 'audio/wav' });
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
