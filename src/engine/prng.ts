// Deterministic Mulberry32 Pseudo-Random Number Generator

export class PRNG {
  private state: number;

  constructor(seed: number = Date.now()) {
    this.state = seed >>> 0;
  }

  public setSeed(seed: number): void {
    this.state = seed >>> 0;
  }

  public getSeed(): number {
    return this.state;
  }

  // Returns pseudo-random float between 0 (inclusive) and 1 (exclusive)
  public next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Float in range [min, max)
  public range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  // Integer in range [min, max] inclusive
  public rangeInt(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  // Boolean with specified probability [0, 1]
  public chance(probability: number): boolean {
    return this.next() < probability;
  }

  // Gaussian (normally distributed) random number
  public gaussian(mean: number = 0, stdDev: number = 1): number {
    let u1 = 0;
    let u2 = 0;
    while (u1 === 0) u1 = this.next();
    while (u2 === 0) u2 = this.next();
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return mean + z0 * stdDev;
  }

  // Pick random element from array
  public pick<T>(arr: T[]): T {
    const idx = Math.floor(this.next() * arr.length);
    return arr[idx];
  }
}
