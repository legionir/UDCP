export class MetricsCollector {
  constructor() {
    this.packets = 0;
  }

  collectPacket(msg, transport) {
    this.packets++;
  }
}
