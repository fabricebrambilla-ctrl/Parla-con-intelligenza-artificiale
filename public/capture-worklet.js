// Sends the microphone signal to the page in 20 ms frames.
class CaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.size = Math.round(sampleRate * 0.02);
    this.buf = new Float32Array(this.size);
    this.pos = 0;
  }

  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    for (let i = 0; i < ch.length; i++) {
      this.buf[this.pos++] = ch[i];
      if (this.pos === this.size) {
        this.port.postMessage(this.buf);
        this.buf = new Float32Array(this.size);
        this.pos = 0;
      }
    }
    return true;
  }
}

registerProcessor("capture", CaptureProcessor);
