/** Presentation clock. Independent of simulation; never feeds back into results. */
export const SPEEDS = [1, 2, 4, 8] as const;
export type Speed = (typeof SPEEDS)[number];

export class Playback {
  t = 0;
  speed: Speed = 1;
  paused = false;

  constructor(public duration: number) {}

  advance(dtMs: number): void {
    if (this.paused) return;
    this.t = Math.min(this.duration, this.t + dtMs * this.speed);
    if (this.t >= this.duration) this.paused = true;
  }

  seek(tMs: number): void {
    this.t = Math.max(0, Math.min(this.duration, tMs));
  }

  restart(): void {
    this.t = 0;
    this.paused = false;
  }

  toggle(): void {
    if (this.t >= this.duration) this.restart();
    else this.paused = !this.paused;
  }
}
