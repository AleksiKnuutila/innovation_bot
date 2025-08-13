import { describe, it, expect } from 'vitest';
import { CARDS } from './database.js';

describe('Card Database Integrity', () => {
  it('should have exactly 105 cards', () => {
    expect(CARDS.cards).toHaveLength(105);
  });

  it('should have correct age distribution', () => {
    const ageCounts = new Map<number, number>();
    
    for (const card of CARDS.cards) {
      ageCounts.set(card.age, (ageCounts.get(card.age) || 0) + 1);
    }
    
    expect(ageCounts.get(1)).toBe(15); // Age 1 has 15 cards
    for (let age = 2; age <= 10; age++) {
      expect(ageCounts.get(age)).toBe(10); // Ages 2-10 have 10 cards each
    }
  });

  it('should have all cards accessible by ID', () => {
    for (let id = 1; id <= 105; id++) {
      const card = CARDS.cardsById.get(id);
      expect(card).toBeDefined();
      expect(card?.id).toBe(id);
    }
  });

  it('should have all cards accessible by age', () => {
    for (let age = 1; age <= 10; age++) {
      const ageCards = CARDS.cardsByAge.get(age as any);
      expect(ageCards).toBeDefined();
      expect(ageCards?.length).toBeGreaterThan(0);
      
      for (const card of ageCards!) {
        expect(card.age).toBe(age);
      }
    }
  });

  it('should have consistent card structure', () => {
    for (const card of CARDS.cards) {
      expect(card).toHaveProperty('id');
      expect(card).toHaveProperty('age');
      expect(card).toHaveProperty('color');
      expect(card).toHaveProperty('title');
      expect(card).toHaveProperty('positions');
      expect(card).toHaveProperty('hexagonImage');
      expect(card).toHaveProperty('dogmaIcon');
      expect(card).toHaveProperty('dogmaEffects');
      
      expect(typeof card.id).toBe('number');
      expect(typeof card.age).toBe('number');
      expect(typeof card.color).toBe('string');
      expect(typeof card.title).toBe('string');
      expect(Array.isArray(card.dogmaEffects)).toBe(true);
    }
  });

  it('should have valid dogma effects array', () => {
    for (const card of CARDS.cards) {
      expect(card.dogmaEffects.length).toBeGreaterThanOrEqual(1);
      expect(card.dogmaEffects.length).toBeLessThanOrEqual(4); // Allow up to 4 for current structure
      expect(card.dogmaEffects[0]).toBeTypeOf('string');
      expect(card.dogmaEffects[1]).toBeTypeOf('string');
      if (card.dogmaEffects.length >= 3) {
        expect(card.dogmaEffects[2]).toBeTypeOf('string');
      }
      if (card.dogmaEffects.length === 4) {
        expect(card.dogmaEffects[3]).toBeTypeOf('string');
      }
    }
  });

  it('should have valid icon positions', () => {
    const validIcons = ['Leaf', 'Lightbulb', 'Crown', 'Castle', 'Factory', 'Clock', 'x'];
    
    for (const card of CARDS.cards) {
      expect(validIcons).toContain(card.positions.top);
      expect(validIcons).toContain(card.positions.left);
      expect(validIcons).toContain(card.positions.middle);
      expect(validIcons).toContain(card.positions.right);
    }
  });

  it('should have valid dogma icons', () => {
    const validDogmaIcons = ['Leaf', 'Lightbulb', 'Crown', 'Castle', 'Factory', 'Clock'];
    
    for (const card of CARDS.cards) {
      expect(validDogmaIcons).toContain(card.dogmaIcon);
    }
  });

  it('should have unique card IDs', () => {
    const ids = CARDS.cards.map(card => card.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(105);
  });

  it('should have unique card titles', () => {
    const titles = CARDS.cards.map(card => card.title);
    const uniqueTitles = new Set(titles);
    expect(uniqueTitles.size).toBe(105);
  });
}); 