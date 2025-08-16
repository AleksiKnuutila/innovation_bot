import type { CardData } from '../src/types/cards.js';

// Age 3 (4th Edition) Innovation cards
const AGE3_CARDS: CardData[] = [
  {
    id: 25,
    age: 3,
    color: 'Blue',
    title: 'ALCHEMY',
    positions: { top: 'x', left: 'Leaf', middle: 'Castle', right: 'Castle' },
    hexagonImage: 'Hexagon icon 25',
    dogmaIcon: 'Castle',
    dogmaEffects: [
      'Draw and reveal a 4 for every color on your board with [Castle]. If any of the drawn cards are red, return all cards from your hand.',
      'Meld a card from your hand, then score a card from your hand.',
      ''
    ]
  },
  {
    id: 26,
    age: 3,
    color: 'Blue',
    title: 'TRANSLATION',
    positions: { top: 'x', left: 'Crown', middle: 'Crown', right: 'Crown' },
    hexagonImage: 'Hexagon icon 26',
    dogmaIcon: 'Crown',
    dogmaEffects: [
      'You may meld all the cards in your score pile.',
      'If each top card on your board has [Crown], claim the World achievement.',
      ''
    ]
  },
  {
    id: 27,
    age: 3,
    color: 'Red',
    title: 'ENGINEERING',
    positions: { top: 'Castle', left: 'x', middle: 'Lightbulb', right: 'Castle' },
    hexagonImage: 'Hexagon icon 27',
    dogmaIcon: 'Castle',
    dogmaEffects: [
      'I DEMAND you transfer a top card with [Castle] of each color from your board to my score pile!',
      'You may splay your red cards left.',
      ''
    ]
  },
  {
    id: 28,
    age: 3,
    color: 'Red',
    title: 'OPTICS',
    positions: { top: 'Crown', left: 'Crown', middle: 'Crown', right: 'x' },
    hexagonImage: 'Hexagon icon 28',
    dogmaIcon: 'Crown',
    dogmaEffects: [
      'Draw and meld a 3. If it has [Crown], draw and score a 4. Otherwise, transfer a card from your score pile to the score pile of an opponent with fewer points than you.',
      '',
      ''
    ]
  },
  {
    id: 29,
    age: 3,
    color: 'Green',
    title: 'COMPASS',
    positions: { top: 'x', left: 'Crown', middle: 'Crown', right: 'Leaf' },
    hexagonImage: 'Hexagon icon 29',
    dogmaIcon: 'Crown',
    dogmaEffects: [
      'I DEMAND you transfer a top non-green card with [Leaf] from your board to my board, and then meld a top card without [Leaf] from my board!',
      '',
      ''
    ]
  },
  {
    id: 30,
    age: 3,
    color: 'Green',
    title: 'PAPER',
    positions: { top: 'x', left: 'Lightbulb', middle: 'Lightbulb', right: 'Crown' },
    hexagonImage: 'Hexagon icon 30',
    dogmaIcon: 'Lightbulb',
    dogmaEffects: [
      'You may splay your green or blue cards left.',
      'Score a top card with [Leaf] from your board. If you do, draw a 4 for every color you have splayed left.',
      ''
    ]
  },
  {
    id: 31,
    age: 3,
    color: 'Yellow',
    title: 'MACHINERY',
    positions: { top: 'Leaf', left: 'Leaf', middle: 'x', right: 'Castle' },
    hexagonImage: 'Hexagon icon 31',
    dogmaIcon: 'Leaf',
    dogmaEffects: [
      'I DEMAND you exchange all the cards in your hand with all the highest cards in my hand!',
      'Score a card from your hand with [Castle].',
      'You may splay your red cards left.'
    ]
  },
  {
    id: 32,
    age: 3,
    color: 'Yellow',
    title: 'MEDICINE',
    positions: { top: 'Crown', left: 'Leaf', middle: 'Leaf', right: 'x' },
    hexagonImage: 'Hexagon icon 32',
    dogmaIcon: 'Leaf',
    dogmaEffects: [
      'I DEMAND you exchange the highest card in your score pile with the lowest card in my score pile!',
      'Junk an available achievement of value 3 or 4.',
      ''
    ]
  },
  {
    id: 33,
    age: 3,
    color: 'Purple',
    title: 'EDUCATION',
    positions: { top: 'Lightbulb', left: 'Lightbulb', middle: 'Lightbulb', right: 'x' },
    hexagonImage: 'Hexagon icon 33',
    dogmaIcon: 'Lightbulb',
    dogmaEffects: [
      'You may return the highest card from your score pile. If you do, draw a card of value two higher than the highest card remaining in your score pile.',
      '',
      ''
    ]
  },
  {
    id: 34,
    age: 3,
    color: 'Purple',
    title: 'FEUDALISM',
    positions: { top: 'x', left: 'Castle', middle: 'Leaf', right: 'Castle' },
    hexagonImage: 'Hexagon icon 34',
    dogmaIcon: 'Castle',
    dogmaEffects: [
      'I DEMAND you transfer a card with [Castle] from your hand to my hand! If you do, junk all available special achievements!',
      'You may splay your yellow or purple cards left. If you do, draw a 3.',
      ''
    ]
  },
];

export { AGE3_CARDS };
