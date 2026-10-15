// Deterministic Mulberry32 Pseudo-Random Number Generator with Independent Streams & State Preservation

export class PRNG {
  private state: number;

  constructor(seed?: number) {
    // Explicitly support seed 0 without falling back to Date.now()
    const initialSeed = seed !== undefined ? seed : Date.now();
    this.state = initialSeed >>> 0;
  }

  public setSeed(seed: number): void {
    this.state = seed >>> 0;
  }

  public getSeed(): number {
    return this.state;
  }

  public getState(): number {
    return this.state;
  }

  public setState(savedState: number): void {
    this.state = savedState >>> 0;
  }

  // Fork an independent deterministic sub-stream for a specific layer or algorithm
  public fork(streamIndex: number): PRNG {
    // SplitMix32 style hash of current state + stream index
    let z = (this.state + Math.imul(streamIndex + 1, 0x9e3779b9)) >>> 0;
    z = Math.imul(z ^ (z >>> 16), 0x21f0aaad);
    z = Math.imul(z ^ (z >>> 15), 0x735a2d97);
    z = (z ^ (z >>> 15)) >>> 0;
    return new PRNG(z);
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
    if (probability <= 0) return false;
    if (probability >= 1) return true;
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
    if (arr.length === 0) return undefined as any;
    const idx = Math.floor(this.next() * arr.length);
    return arr[idx];
  }
}
