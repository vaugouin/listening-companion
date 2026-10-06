class PcmCapture extends AudioWorkletProcessor {
  constructor() { super(); this.buffer = new Int16Array(2400); this.offset = 0; this.phase = 0; this.sum = 0; this.count = 0; this.energy = 0; }
  process(inputs) {
    const channels = inputs[0];
    if (!channels?.length) return true;
    for (let i = 0; i < channels[0].length; i++) {
      let sample = 0;
      for (const channel of channels) sample += channel[i] / channels.length;
      this.sum += sample; this.count++; this.phase += 24000;
      if (this.phase >= sampleRate) {
        this.phase -= sampleRate;
        const value = Math.max(-1,Math.min(1,this.sum/this.count));
        this.sum = 0; this.count = 0;
        this.energy += value*value;
        this.buffer[this.offset++] = value < 0 ? value*32768 : value*32767;
        if (this.offset === 2400) {
          this.port.postMessage({ pcm: this.buffer.buffer, rms: Math.sqrt(this.energy/2400) }, [this.buffer.buffer]);
          this.buffer = new Int16Array(2400); this.offset = 0; this.energy = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor('pcm-capture',PcmCapture);
