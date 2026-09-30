class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.samples = new Int16Array(4096);
    this.offset = 0;
  }

  process(inputs) {
    const channel = inputs[0]?.[0];
    if (!channel) return true;

    for (let i = 0; i < channel.length; i++) {
      const sample = Math.max(-1, Math.min(1, channel[i]));
      this.samples[this.offset++] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;

      if (this.offset === this.samples.length) {
        this.port.postMessage(this.samples.buffer, [this.samples.buffer]);
        this.samples = new Int16Array(4096);
        this.offset = 0;
      }
    }

    return true;
  }
}

registerProcessor('pcm-capture-processor', PcmCaptureProcessor);
