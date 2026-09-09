class Meter extends AudioWorkletProcessor {
  constructor() {
    super(); this.active = false;
    this.port.onmessage = ({ data }) => {
      if (data.type === 'start') { this.left = Math.round(data.seconds * sampleRate); this.block = new Float32Array(960); this.at = 0; this.active = true; }
      if (data.type === 'stop') this.active = false;
    };
  }
  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input || !this.active) return true;
    for (const x of input) {
      this.block[this.at++] = x; this.left--;
      if (this.at === this.block.length || this.left === 0) {
        const pcm = this.block.slice(0, this.at);
        this.port.postMessage({ pcm, done: this.left === 0 }, [pcm.buffer]); this.at = 0;
      }
      if (this.left === 0) { this.active = false; break; }
    }
    return true;
  }
}
registerProcessor('meter', Meter);
