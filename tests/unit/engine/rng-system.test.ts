// RNG system tests - testing deterministic behavior, shuffle quality, and state management
import { describe, it, expect } from 'vitest';
import { DeterministicRng, shuffleCards } from '@/engine/rng.js';

describe('RNG System', () => {
  describe('DeterministicRng', () => {
    it('should produce identical sequences with same seed', () => {
      const rng1 = new DeterministicRng(12345);
      const rng2 = new DeterministicRng(12345);
      
      const sequence1 = Array.from({ length: 10 }, () => rng1.next());
      const sequence2 = Array.from({ length: 10 }, () => rng2.next());
      
      expect(sequence1).toEqual(sequence2);
    });

    it('should produce different sequences with different seeds', () => {
      const rng1 = new DeterministicRng(1);
      const rng2 = new DeterministicRng(2);
      
      const sequence1 = Array.from({ length: 10 }, () => rng1.next());
      const sequence2 = Array.from({ length: 10 }, () => rng2.next());
      
      expect(sequence1).not.toEqual(sequence2);
    });

    it('should maintain state consistency', () => {
      const rng = new DeterministicRng(99999);
      const initialState = rng.getState();
      
      // Generate some numbers
      rng.next();
      rng.next();
      rng.next();
      
      const advancedState = rng.getState();
      expect(advancedState.counter).toBeGreaterThan(initialState.counter);
      
      // Create new RNG from advanced state
      const rng2 = DeterministicRng.fromState(advancedState);
      
      // Should continue from same point
      expect(rng.next()).toBe(rng2.next());
    });

    it('should generate uniform distribution in range', () => {
      const rng = new DeterministicRng(777);
      const samples = Array.from({ length: 1000 }, () => rng.nextInt(10));
      
      // Check that all values 0-9 appear
      const unique = new Set(samples);
      expect(unique.size).toBe(10);
      
      // Check rough uniformity (each value should appear ~100 times)
      for (let i = 0; i < 10; i++) {
        const count = samples.filter(x => x === i).length;
        expect(count).toBeGreaterThan(50); // At least 5% of samples
        expect(count).toBeLessThan(200);   // At most 20% of samples
      }
    });
  });

  describe('Shuffle functionality', () => {
    it('should shuffle array contents', () => {
      const rng = new DeterministicRng(555);
      const original = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const shuffled = rng.shuffle([...original]);
      
      // Same elements, different order (with high probability)
      expect([...shuffled].sort((a, b) => a - b)).toEqual(original);
      expect(shuffled).not.toEqual(original);
    });

    it('should produce different shuffles with different seeds', () => {
      const array = [1, 2, 3, 4, 5];
      
      const shuffled1 = shuffleCards(new DeterministicRng(1), array);
      const shuffled2 = shuffleCards(new DeterministicRng(2), array);
      
      expect(shuffled1).not.toEqual(shuffled2);
    });

    it('should not mutate input array', () => {
      const rng = new DeterministicRng(333);
      const original = [1, 2, 3, 4, 5];
      const originalCopy = [...original];
      
      const shuffled = shuffleCards(rng, original);
      
      expect(original).toEqual(originalCopy); // Input unchanged
      expect(shuffled).not.toBe(original);    // Different array reference
    });
  });
});