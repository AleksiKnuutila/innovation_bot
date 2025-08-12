// Deterministic RNG implementation using xoshiro128** algorithm
// Provides seedable, reproducible randomness for game engine

import type { RngState } from '@/types/game-data.js';

// xoshiro128** implementation - fast, high quality PRNG
export class DeterministicRng {
  private state: [number, number, number, number];
  private counter: number;
  private readonly initialSeed: number;

  constructor(seed: number) {
    this.initialSeed = seed;
    this.counter = 0;
    
    // Initialize state from seed using splitmix32
    this.state = this.initializeState(seed);
  }

  // Initialize the four 32-bit state values from a single seed
  private initializeState(seed: number): [number, number, number, number] {
    // Use splitmix32 to generate initial state from seed
    let s = seed >>> 0; // Ensure 32-bit unsigned
    
    const next = (): number => {
      s = (s + 0x9E3779B9) >>> 0;
      let z = s;
      z = (z ^ (z >>> 16)) >>> 0;
      z = Math.imul(z, 0x21F494C7) >>> 0;
      z = (z ^ (z >>> 15)) >>> 0;
      z = Math.imul(z, 0x735A2D97) >>> 0;
      return (z ^ (z >>> 15)) >>> 0;
    };

    return [next(), next(), next(), next()];
  }

  // Generate next 32-bit unsigned integer
  next(): number {
    this.counter++;
    
    const [s0, s1, s2, s3] = this.state;
    const result = Math.imul((s1 << 5) | (s1 >>> 27), 7) >>> 0;
    const t = (s1 << 9) >>> 0;

    this.state[2] = (s2 ^ s0) >>> 0;
    this.state[3] = (s3 ^ s1) >>> 0;
    this.state[1] = (s1 ^ s2) >>> 0;
    this.state[0] = (s0 ^ s3) >>> 0;
    
    this.state[2] = (this.state[2] ^ t) >>> 0;
    this.state[3] = ((this.state[3] << 11) | (this.state[3] >>> 21)) >>> 0;

    return result;
  }

  // Generate random integer in range [0, max)
  nextInt(max: number): number {
    if (max <= 0) throw new Error('max must be positive');
    if (max === 1) return 0;
    
    // Use rejection sampling to avoid modulo bias
    const threshold = (0x100000000 % max) >>> 0;
    let value: number;
    
    do {
      value = this.next();
    } while (value < threshold);
    
    return value % max;
  }

  // Generate random integer in range [min, max]
  nextIntRange(min: number, max: number): number {
    if (min > max) throw new Error('min cannot be greater than max');
    if (min === max) return min;
    return min + this.nextInt(max - min + 1);
  }

  // Generate random float in range [0, 1)
  nextFloat(): number {
    return (this.next() >>> 0) / 0x100000000;
  }

  // Shuffle array in-place using Fisher-Yates algorithm
  shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = this.nextInt(i + 1);
      [array[i], array[j]] = [array[j]!, array[i]!];
    }
    return array;
  }

  // Choose random element from array
  choice<T>(array: T[]): T {
    if (array.length === 0) throw new Error('Cannot choose from empty array');
    return array[this.nextInt(array.length)]!;
  }

  // Get current RNG state for serialization
  getState(): RngState {
    return {
      seed: this.initialSeed,
      counter: this.counter,
      state: [...this.state],
    };
  }

  // Restore RNG from serialized state
  static fromState(rngState: RngState): DeterministicRng {
    const rng = new DeterministicRng(rngState.seed);
    rng.counter = rngState.counter;
    rng.state = [...rngState.state] as [number, number, number, number];
    return rng;
  }

  // Reset to initial state (for testing)
  reset(): void {
    this.counter = 0;
    this.state = this.initializeState(this.initialSeed);
  }

  // Get deterministic hash of current state (for validation)
  getStateHash(): number {
    let hash = this.counter;
    for (const s of this.state) {
      hash = ((hash << 5) - hash + s) >>> 0;
    }
    return hash;
  }
}

// Helper functions for common RNG operations
export function createRng(seed: number): DeterministicRng {
  return new DeterministicRng(seed);
}

export function shuffleCards(rng: DeterministicRng, cards: import('@/types/core.js').CardId[]): import('@/types/core.js').CardId[] {
  return rng.shuffle([...cards]); // Don't mutate input array
}

export function drawRandomCard(rng: DeterministicRng, cards: import('@/types/core.js').CardId[]): { card: import('@/types/core.js').CardId; remaining: import('@/types/core.js').CardId[] } {
  if (cards.length === 0) throw new Error('Cannot draw from empty pile');
  
  const index = rng.nextInt(cards.length);
  const card = cards[index]!;
  const remaining = cards.filter((_, i) => i !== index);
  
  return { card, remaining };
}