import type { PresenterMessage } from "./protocol";

/**
 * Transport between controllers and displays. Swappable so the same console
 * can drive a second window on this computer (BroadcastChannel, today) or a
 * screen on another device (WebSocket / cloud realtime, later).
 */
export interface PresenterTransport {
  send(msg: PresenterMessage): void;
  subscribe(fn: (msg: PresenterMessage) => void): () => void;
  close(): void;
}

export const CHANNEL = "church-presenter-v1";

export class BroadcastTransport implements PresenterTransport {
  private ch: BroadcastChannel;
  constructor(name = CHANNEL) {
    this.ch = new BroadcastChannel(name);
  }
  send(msg: PresenterMessage) {
    this.ch.postMessage(msg);
  }
  subscribe(fn: (msg: PresenterMessage) => void) {
    const h = (e: MessageEvent<PresenterMessage>) => fn(e.data);
    this.ch.addEventListener("message", h);
    return () => this.ch.removeEventListener("message", h);
  }
  close() {
    this.ch.close();
  }
}

export function createTransport(): PresenterTransport {
  return new BroadcastTransport();
}
