import type { CardData, Age, CardDatabase } from '@/types/cards.js';

// Raw card data extracted from VB implementation (Ages 1-3)
const CARD_DATA: CardData[] = [
  // Age 1 Cards (IDs 1-15)
  {
    id: 1,
    age: 1,
    color: 'Yellow',
    title: 'Agriculture',
    positions: { top: 'x', left: 'Leaf', middle: 'Leaf', right: 'Leaf' },
    hexagonImage: 'Sheaf of grain',
    dogmaIcon: 'Leaf',
    dogmaEffects: [
      'You may return a card from your hand. If you do, draw and score a card of value one higher than the card you returned.',
      '',
      ''
    ]
  },
  {
    id: 2,
    age: 1,
    color: 'Red',
    title: 'Archery',
    positions: { top: 'Castle', left: 'Lightbulb', middle: 'x', right: 'Castle' },
    hexagonImage: 'bow and arrow',
    dogmaIcon: 'Castle',
    dogmaEffects: [
      'I demand you draw a 1, then transfer the highest card in your hand to my hand!',
      '',
      ''
    ]
  },
  {
    id: 3,
    age: 1,
    color: 'Purple',
    title: 'City States',
    positions: { top: 'x', left: 'Crown', middle: 'Crown', right: 'Castle' },
    hexagonImage: 'Courthouse or temple',
    dogmaIcon: 'Crown',
    dogmaEffects: [
      'I demand you transfer a top card with a [Castle] from your board to my board if you have at least four [Castle] icons on your board! If you do, draw a 1!',
      '',
      ''
    ]
  },
  {
    id: 4,
    age: 1,
    color: 'Green',
    title: 'Clothing',
    positions: { top: 'x', left: 'Crown', middle: 'Leaf', right: 'Leaf' },
    hexagonImage: 'Toga',
    dogmaIcon: 'Leaf',
    dogmaEffects: [
      'Meld a card from your hand of different color from any card on your board.',
      'Draw and score a 1 for each color present on your board not present on any other player's board.',
      ''
    ]
  },
  {
    id: 5,
    age: 1,
    color: 'Purple',
    title: 'Code of Laws',
    positions: { top: 'x', left: 'Crown', middle: 'Crown', right: 'Leaf' },
    hexagonImage: 'Two tablets',
    dogmaIcon: 'Crown',
    dogmaEffects: [
      'You may tuck a card from your hand of the same color as any card on your board. If you do, you may splay that color of your cards left.',
      '',
      ''
    ]
  },
  {
    id: 6,
    age: 1,
    color: 'Yellow',
    title: 'Domestication',
    positions: { top: 'Castle', left: 'Crown', middle: 'x', right: 'Castle' },
    hexagonImage: 'Bull',
    dogmaIcon: 'Castle',
    dogmaEffects: [
      'Meld the lowest card in your hand. Draw a 1.',
      '',
      ''
    ]
  },
  {
    id: 7,
    age: 1,
    color: 'Yellow',
    title: 'Masonry',
    positions: { top: 'Castle', left: 'x', middle: 'Castle', right: 'Castle' },
    hexagonImage: 'Bricks',
    dogmaIcon: 'Castle',
    dogmaEffects: [
      'You may meld any number of cards from your hand, each with a [Castle]. If you melded four or more cards, claim the Monument achievement.',
      '',
      ''
    ]
  },
  {
    id: 8,
    age: 1,
    color: 'Red',
    title: 'Metalworking',
    positions: { top: 'Castle', left: 'Castle', middle: 'x', right: 'Castle' },
    hexagonImage: 'Spear and shield',
    dogmaIcon: 'Castle',
    dogmaEffects: [
      'Draw and reveal a 1. If it has a [Castle], score it and repeat this dogma effect. Otherwise, keep it.',
      '',
      ''
    ]
  },
  {
    id: 9,
    age: 1,
    color: 'Purple',
    title: 'Mysticism',
    positions: { top: 'x', left: 'Castle', middle: 'Castle', right: 'Castle' },
    hexagonImage: 'Crescent moon',
    dogmaIcon: 'Castle',
    dogmaEffects: [
      'Draw a 1. If it is the same color as any card on your board, meld it and draw a 1.',
      '',
      ''
    ]
  },
  {
    id: 10,
    age: 1,
    color: 'Red',
    title: 'Oars',
    positions: { top: 'Castle', left: 'Crown', middle: 'x', right: 'Castle' },
    hexagonImage: 'Oars',
    dogmaIcon: 'Castle',
    dogmaEffects: [
      'I demand you transfer a card with a [Crown] from your hand to my score pile! If you do, draw a 1.',
      'If no cards were transferred due to this demand, draw a 1.',
      ''
    ]
  },
  {
    id: 11,
    age: 1,
    color: 'Blue',
    title: 'Pottery',
    positions: { top: 'x', left: 'Leaf', middle: 'Leaf', right: 'Leaf' },
    hexagonImage: 'Pot',
    dogmaIcon: 'Leaf',
    dogmaEffects: [
      'You may return up to three cards from your hand. If you returned any cards, draw and score a card of value equal to the number of cards you returned.',
      'Draw a 1.',
      ''
    ]
  },
  {
    id: 12,
    age: 1,
    color: 'Green',
    title: 'Sailing',
    positions: { top: 'Crown', left: 'Crown', middle: 'x', right: 'Leaf' },
    hexagonImage: 'Boat',
    dogmaIcon: 'Crown',
    dogmaEffects: [
      'Draw and meld a 1.',
      '',
      ''
    ]
  },
  {
    id: 13,
    age: 1,
    color: 'Green',
    title: 'The Wheel',
    positions: { top: 'x', left: 'Castle', middle: 'Castle', right: 'Castle' },
    hexagonImage: 'Wheel',
    dogmaIcon: 'Castle',
    dogmaEffects: [
      'Draw two 1.',
      '',
      ''
    ]
  },
  {
    id: 14,
    age: 1,
    color: 'Blue',
    title: 'Tools',
    positions: { top: 'x', left: 'Lightbulb', middle: 'Lightbulb', right: 'Castle' },
    hexagonImage: 'Sickle and Hammer',
    dogmaIcon: 'Lightbulb',
    dogmaEffects: [
      'You may return three cards from your hand. If you do, draw and meld a 3.',
      'You may return a 3 from your hand. If you do, draw three 1.',
      ''
    ]
  },
  {
    id: 15,
    age: 1,
    color: 'Blue',
    title: 'Writing',
    positions: { top: 'x', left: 'Lightbulb', middle: 'Lightbulb', right: 'Crown' },
    hexagonImage: 'Quill',
    dogmaIcon: 'Lightbulb',
    dogmaEffects: [
      'Draw a 2.',
      '',
      ''
    ]
  },

  // Age 2 Cards (IDs 16-25)
  {
    id: 16,
    age: 2,
    color: 'Blue',
    title: 'Calendar',
    positions: { top: 'x', left: 'Leaf', middle: 'Leaf', right: 'Lightbulb' },
    hexagonImage: 'Sundial',
    dogmaIcon: 'Leaf',
    dogmaEffects: [
      'If you have more cards in your score pile than in your hand, draw two 3.',
      '',
      ''
    ]
  },
  {
    id: 17,
    age: 2,
    color: 'Yellow',
    title: 'Canal Building',
    positions: { top: 'x', left: 'Crown', middle: 'Leaf', right: 'Crown' },
    hexagonImage: 'Gondola',
    dogmaIcon: 'Crown',
    dogmaEffects: [
      'You may exchange all the highest cards in your hand with all the highest cards in your score pile.',
      '',
      ''
    ]
  },
  {
    id: 18,
    age: 2,
    color: 'Red',
    title: 'Construction',
    positions: { top: 'Castle', left: 'x', middle: 'Castle', right: 'Castle' },
    hexagonImage: 'Catapult',
    dogmaIcon: 'Castle',
    dogmaEffects: [
      'I demand you transfer two cards from your hand to my hand, then draw a 2!',
      'If you are the only player with five top cards, claim the Empire achievement.',
      ''
    ]
  },
  {
    id: 19,
    age: 2,
    color: 'Green',
    title: 'Currency',
    positions: { top: 'Leaf', left: 'Crown', middle: 'x', right: 'Crown' },
    hexagonImage: 'Two ancient coins',
    dogmaIcon: 'Crown',
    dogmaEffects: [
      'You may return any number of cards from your hand. If you do, draw and score a 2 for every different value of card you returned.',
      '',
      ''
    ]
  },
  {
    id: 20,
    age: 2,
    color: 'Yellow',
    title: 'Fermenting',
    positions: { top: 'Leaf', left: 'Leaf', middle: 'x', right: 'Castle' },
    hexagonImage: 'Barrel',
    dogmaIcon: 'Leaf',
    dogmaEffects: [
      'Draw a 2 for every two [Leaf] icons on your board.',
      '',
      ''
    ]
  },
  {
    id: 21,
    age: 2,
    color: 'Green',
    title: 'Mapmaking',
    positions: { top: 'x', left: 'Crown', middle: 'Crown', right: 'Castle' },
    hexagonImage: 'Treasure map',
    dogmaIcon: 'Crown',
    dogmaEffects: [
      'I demand you transfer a 1 from your score pile to my score pile.',
      'If any card was transferred due to the demand, draw and score a 1.',
      ''
    ]
  },
  {
    id: 22,
    age: 2,
    color: 'Blue',
    title: 'Mathematics',
    positions: { top: 'x', left: 'Lightbulb', middle: 'Crown', right: 'Lightbulb' },
    hexagonImage: 'Pi',
    dogmaIcon: 'Lightbulb',
    dogmaEffects: [
      'You may return a card from your hand. If you do, draw and meld a card of value one higher than the card you returned.',
      '',
      ''
    ]
  },
  {
    id: 23,
    age: 2,
    color: 'Purple',
    title: 'Monotheism',
    positions: { top: 'x', left: 'Castle', middle: 'Castle', right: 'Castle' },
    hexagonImage: 'Cross',
    dogmaIcon: 'Castle',
    dogmaEffects: [
      'I demand you transfer a top card on your board of a different color from any card on my board to my score pile! If you do, draw and tuck a 1!',
      'Draw and tuck a 1.',
      ''
    ]
  },
  {
    id: 24,
    age: 2,
    color: 'Purple',
    title: 'Philosophy',
    positions: { top: 'x', left: 'Lightbulb', middle: 'Lightbulb', right: 'Lightbulb' },
    hexagonImage: 'Glass with poisoned milk',
    dogmaIcon: 'Lightbulb',
    dogmaEffects: [
      'You may splay left any one color of your cards.',
      'You may score a card from your hand.',
      ''
    ]
  },
  {
    id: 25,
    age: 2,
    color: 'Red',
    title: 'Road Building',
    positions: { top: 'Castle', left: 'Castle', middle: 'x', right: 'Castle' },
    hexagonImage: 'Winding road',
    dogmaIcon: 'Castle',
    dogmaEffects: [
      'Meld one or two cards from your hand. If you melded two, you may transfer your top red card to another player\'s board. In exchange, transfer that player\'s top green card to your board.',
      '',
      ''
    ]
  },

  // Age 3 Cards (IDs 26-35)
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