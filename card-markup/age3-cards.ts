import type { CardData, Age, CardDatabase } from '@/types/cards.js';

// Raw card data extracted from HTML markup (Age 3 - 4th Edition)
const CARD_DATA: CardData[] = [
  // Age 3 Cards (IDs 26-35) - 4th Edition
  {
    id: 26,
    age: 3,
    color: 'Blue',
    title: 'Alchemy',
    positions: { top: 'x', left: 'Leaf', middle: 'Castle', right: 'Castle' },
    hexagonImage: 'Mortar and pestle',
    dogmaIcon: 'Castle',
    dogmaEffects: [
      'Draw and reveal a 4 for every three [Castle] icons on your board. If any of the drawn cards are red, return the cards drawn and all cards in your hand. Otherwise, keep them.',
      'Meld a card from your hand, then score a card from your hand.',
      ''
    ]
  },

  {
    id: 27,
    age: 3,
    color: 'Green',
    title: 'Compass',
    positions: { top: 'x', left: 'Crown', middle: 'Crown', right: 'Leaf' },
    hexagonImage: 'Compass',
    dogmaIcon: 'Crown',
    dogmaEffects: [
      'I demand you transfer a top non-green card with a [Leaf] from your board to my board, and then transfer a top card without a [Leaf] from my board to your board.',
      '',
      ''
    ]
  },

  {
    id: 28,
    age: 3,
    color: 'Purple',
    title: 'Education',
    positions: { top: 'Lightbulb', left: 'Lightbulb', middle: 'Lightbulb', right: 'x' },
    hexagonImage: 'Apple',
    dogmaIcon: 'Lightbulb',
    dogmaEffects: [
      'You may return the highest card from your score pile. If you do, draw a card of value two higher than the highest card remaining in your score pile.',
      '',
      ''
    ]
  },

  {
    id: 29,
    age: 3,
    color: 'Red',
    title: 'Engineering',
    positions: { top: 'Castle', left: 'x', middle: 'Lightbulb', right: 'Castle' },
    hexagonImage: 'Fortified castle',
    dogmaIcon: 'Castle',
    dogmaEffects: [
      'I demand you transfer all top cards with a [Castle] from your board to my score pile!',
      'You may splay your red cards left.',
      ''
    ]
  },

  {
    id: 30,
    age: 3,
    color: 'Purple',
    title: 'Feudalism',
    positions: { top: 'x', left: 'Castle', middle: 'Leaf', right: 'Castle' },
    hexagonImage: 'Shield(w/ cross) and sword',
    dogmaIcon: 'Castle',
    dogmaEffects: [
      'I demand you transfer a card with a [Castle] from your hand to my hand!',
      'You may splay your yellow or purple cards left.',
      ''
    ]
  },

  {
    id: 31,
    age: 3,
    color: 'Yellow',
    title: 'Machinery',
    positions: { top: 'Leaf', left: 'Leaf', middle: 'x', right: 'Castle' },
    hexagonImage: 'Windmill',
    dogmaIcon: 'Leaf',
    dogmaEffects: [
      'I demand you exchange all cards in your hand with all the highest cards in my hand!',
      'Score a card from your hand with a [Castle]. You may splay your red cards left.',
      ''
    ]
  },

  {
    id: 32,
    age: 3,
    color: 'Yellow',
    title: 'Medicine',
    positions: { top: 'Crown', left: 'Leaf', middle: 'Leaf', right: 'x' },
    hexagonImage: 'Caduceus',
    dogmaIcon: 'Leaf',
    dogmaEffects: [
      'I demand you exchange the highest card in your score pile with the lowest card in my score pile!',
      '',
      ''
    ]
  },

  {
    id: 33,
    age: 3,
    color: 'Red',
    title: 'Optics',
    positions: { top: 'Crown', left: 'Crown', middle: 'Crown', right: 'x' },
    hexagonImage: 'Telescope',
    dogmaIcon: 'Crown',
    dogmaEffects: [
      'Draw and meld a 3. If it has a [Crown], draw and score a 4. Otherwise, transfer a card from your score pile to the score pile of an opponent with fewer points than you.',
      '',
      ''
    ]
  },

  {
    id: 34,
    age: 3,
    color: 'Green',
    title: 'Paper',
    positions: { top: 'x', left: 'Lightbulb', middle: 'Lightbulb', right: 'Crown' },
    hexagonImage: 'Book',
    dogmaIcon: 'Lightbulb',
    dogmaEffects: [
      'You may splay your green or blue cards left.',
      'Draw a 4 for every color you have splayed left.',
      ''
    ]
  },

  {
    id: 35,
    age: 3,
    color: 'Blue',
    title: 'Translation',
    positions: { top: 'x', left: 'Crown', middle: 'Crown', right: 'Crown' },
    hexagonImage: 'Hieroglyph and two letters in the demotic script',
    dogmaIcon: 'Crown',
    dogmaEffects: [
      'You may meld all the cards in your score pile. If you meld one, you must meld them all.',
      'If each top card on your board has a [Crown], claim the World achievement.',
      ''
    ]
  }
];

// Create indexed database for efficient lookups
function createCardDatabase(): CardDatabase {
  const cardsByAge = new Map<Age, CardData[]>();
  const cardsById = new Map<number, CardData>();

  for (const card of CARD_DATA) {
    cardsById.set(card.id, card);
    
    if (!cardsByAge.has(card.age)) {
      cardsByAge.set(card.age, []);
    }
    cardsByAge.get(card.age)!.push(card);
  }

  return {
    cards: [...CARD_DATA],
    cardsByAge,
    cardsById
  };
}

export const CARDS = createCardDatabase();
export { CARD_DATA };
