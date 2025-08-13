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
      'Draw and score a 1 for each color present on your board not present on any other player\'s board.',
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
  },

  // Age 4 Cards (IDs 36-45)
  {
    id: 36,
    age: 4,
    color: 'Yellow',
    title: 'Anatomy',
    positions: { top: 'Leaf', left: 'Leaf', middle: 'Leaf', right: 'x' },
    hexagonImage: 'Skull',
    dogmaIcon: 'Leaf',
    dogmaEffects: [
      'I demand you return a card from your score pile! If you do, return a top card of equal value from your board!',
      '',
      ''
    ]
  },
  {
    id: 37,
    age: 4,
    color: 'Red',
    title: 'Colonialism',
    positions: { top: 'x', left: 'Factory', middle: 'Lightbulb', right: 'Factory' },
    hexagonImage: 'Union jack',
    dogmaIcon: 'Factory',
    dogmaEffects: [
      'Draw and tuck a 3. If it has a [Crown], repeat this dogma effect.',
      '',
      ''
    ]
  },
  {
    id: 38,
    age: 4,
    color: 'Purple',
    title: 'Enterprise',
    positions: { top: 'x', left: 'Crown', middle: 'Crown', right: 'Crown' },
    hexagonImage: 'Signed contract',
    dogmaIcon: 'Crown',
    dogmaEffects: [
      'I demand you transfer a top non-purple card with a [Crown] from your board to my board! If you do, draw and meld a 4!',
      'You may splay your green cards right.',
      ''
    ]
  },
  {
    id: 39,
    age: 4,
    color: 'Blue',
    title: 'Experimentation',
    positions: { top: 'x', left: 'Lightbulb', middle: 'Lightbulb', right: 'Lightbulb' },
    hexagonImage: 'Tower of Pisa',
    dogmaIcon: 'Lightbulb',
    dogmaEffects: [
      'Draw and meld a 5.',
      '',
      ''
    ]
  },
  {
    id: 40,
    age: 4,
    color: 'Red',
    title: 'Gunpowder',
    positions: { top: 'x', left: 'Factory', middle: 'Crown', right: 'Factory' },
    hexagonImage: 'Muskets',
    dogmaIcon: 'Factory',
    dogmaEffects: [
      'I demand you transfer a top card with a [Castle] from your board to my score pile!',
      'If any card was transferred due to the demand, draw and score a 2.',
      ''
    ]
  },
  {
    id: 41,
    age: 4,
    color: 'Green',
    title: 'Invention',
    positions: { top: 'x', left: 'Lightbulb', middle: 'Lightbulb', right: 'Factory' },
    hexagonImage: 'Vitruvian Man',
    dogmaIcon: 'Lightbulb',
    dogmaEffects: [
      'You may splay right any one color of your cards currently splayed left. If you do, draw and score a 4.',
      'If you have five colors splayed, each in any direction, claim the Wonder achievement.',
      ''
    ]
  },
  {
    id: 42,
    age: 4,
    color: 'Green',
    title: 'Navigation',
    positions: { top: 'x', left: 'Crown', middle: 'Crown', right: 'Crown' },
    hexagonImage: 'Sextant',
    dogmaIcon: 'Crown',
    dogmaEffects: [
      'I demand you transfer a 2 or 3 from your score pile to my score pile!',
      '',
      ''
    ]
  },
  {
    id: 43,
    age: 4,
    color: 'Yellow',
    title: 'Perspective',
    positions: { top: 'x', left: 'Lightbulb', middle: 'Lightbulb', right: 'Leaf' },
    hexagonImage: 'Man inspecting ship on horizon',
    dogmaIcon: 'Lightbulb',
    dogmaEffects: [
      'You may return a card from your hand. If you do, score a card from your hand for every two [Lightbulb] icons on your board.',
      '',
      ''
    ]
  },
  {
    id: 44,
    age: 4,
    color: 'Blue',
    title: 'Printing Press',
    positions: { top: 'x', left: 'Lightbulb', middle: 'Lightbulb', right: 'Crown' },
    hexagonImage: 'Press',
    dogmaIcon: 'Lightbulb',
    dogmaEffects: [
      'You may return a card from your score pile. If you do, draw a card of value two higher than the top purple card on your board.',
      'You may splay your blue cards right.',
      ''
    ]
  },
  {
    id: 45,
    age: 4,
    color: 'Purple',
    title: 'Reformation',
    positions: { top: 'x', left: 'Leaf', middle: 'Leaf', right: 'x' },
    hexagonImage: 'Cathedral',
    dogmaIcon: 'Leaf',
    dogmaEffects: [
      'You may tuck a card from your hand for every two [Leaf] icons on your board.',
      'You may splay your yellow or purple cards right.',
      ''
    ]
  },

  // Age 5 Cards (IDs 46-55)
  {
    id: 46,
    age: 5,
    color: 'Purple',
    title: 'Astronomy',
    positions: { top: 'x', left: 'Lightbulb', middle: 'Lightbulb', right: 'Crown' },
    hexagonImage: 'Observatory',
    dogmaIcon: 'Lightbulb',
    dogmaEffects: [
      'Draw and reveal a 6. If the card is green or blue, meld it and repeat this dogma effect.',
      'If all non-purple top cards on your board are value 6 or higher, claim the Universe achievement.',
      ''
    ]
  },
  {
    id: 47,
    age: 5,
    color: 'Green',
    title: 'Banking',
    positions: { top: 'x', left: 'Factory', middle: 'Crown', right: 'Crown' },
    hexagonImage: 'Two piles of notes and a coin',
    dogmaIcon: 'Crown',
    dogmaEffects: [
      'I demand you transfer a top non-green card with a [Factory] from your board to my board! If you do, draw and score a 5.',
      'You may splay your green cards right.',
      ''
    ]
  },
  {
    id: 48,
    age: 5,
    color: 'Blue',
    title: 'Chemistry',
    positions: { top: 'x', left: 'Lightbulb', middle: 'Factory', right: 'Factory' },
    hexagonImage: 'Erlenmeyer flask full of liquid',
    dogmaIcon: 'Factory',
    dogmaEffects: [
      'You may splay your blue cards right.',
      'Draw and score a card of value one higher than the highest top card on your board and then return a card from your score pile.',
      ''
    ]
  },
  {
    id: 49,
    age: 5,
    color: 'Red',
    title: 'Coal',
    positions: { top: 'x', left: 'Factory', middle: 'Factory', right: 'Factory' },
    hexagonImage: 'Lumps of coal or a fossil',
    dogmaIcon: 'Factory',
    dogmaEffects: [
      'Draw and tuck a 5.',
      'You may splay your red cards right.',
      'You may score any one of your top cards. If you do, also score the card beneath it.'
    ]
  },
  {
    id: 50,
    age: 5,
    color: 'Green',
    title: 'Measurement',
    positions: { top: 'x', left: 'Leaf', middle: 'Lightbulb', right: 'Lightbulb' },
    hexagonImage: 'Ruler',
    dogmaIcon: 'Lightbulb',
    dogmaEffects: [
      'You may return a card from your hand. If you do, splay any one color of your cards right, and draw a card of value equal to the number of cards of that color on your board.',
      '',
      ''
    ]
  },
  {
    id: 51,
    age: 5,
    color: 'Blue',
    title: 'Physics',
    positions: { top: 'x', left: 'Factory', middle: 'Lightbulb', right: 'Lightbulb' },
    hexagonImage: 'Spectrum of light',
    dogmaIcon: 'Lightbulb',
    dogmaEffects: [
      'Draw three 6 and reveal them. If two or more of the drawn cards are of the same color, return the drawn cards and all the cards in your hand. Otherwise, keep them.',
      '',
      ''
    ]
  },
  {
    id: 52,
    age: 5,
    color: 'Red',
    title: 'The Pirate Code',
    positions: { top: 'x', left: 'Factory', middle: 'Crown', right: 'Crown' },
    hexagonImage: 'Skull and cross bones',
    dogmaIcon: 'Crown',
    dogmaEffects: [
      'I demand you transfer two cards of value 4 or less from your score pile to my score pile!',
      'If any card was transferred due to the demand, score the lowest top card with a [Crown] from your board.',
      ''
    ]
  },
  {
    id: 53,
    age: 5,
    color: 'Purple',
    title: 'Societies',
    positions: { top: 'x', left: 'Crown', middle: 'x', right: 'Lightbulb' },
    hexagonImage: 'Crowd of people',
    dogmaIcon: 'Crown',
    dogmaEffects: [
      'I demand you transfer a top non-purple card with a [Lightbulb] from your board to my board! If you do, draw a 5!',
      '',
      ''
    ]
  },
  {
    id: 54,
    age: 5,
    color: 'Yellow',
    title: 'Statistics',
    positions: { top: 'x', left: 'Leaf', middle: 'Lightbulb', right: 'Leaf' },
    hexagonImage: 'Two birds in flight',
    dogmaIcon: 'Leaf',
    dogmaEffects: [
      'I demand you draw the highest card in your score pile! If you do, and have only one card in your hand afterwards, repeat this demand!',
      'You may splay your yellow cards right.',
      ''
    ]
  },
  {
    id: 55,
    age: 5,
    color: 'Yellow',
    title: 'Steam Engine',
    positions: { top: 'x', left: 'Factory', middle: 'Crown', right: 'Factory' },
    hexagonImage: 'Gauge connected to a pipe',
    dogmaIcon: 'Factory',
    dogmaEffects: [
      'Draw and tuck two 4, then score your bottom yellow card.',
      '',
      ''
    ]
  },

  // Age 6 Cards (IDs 56-65)
  {
    id: 56,
    age: 6,
    color: 'Blue',
    title: 'Atomic Theory',
    positions: { top: 'x', left: 'Lightbulb', middle: 'Lightbulb', right: 'Lightbulb' },
    hexagonImage: 'Cartoon of an atom',
    dogmaIcon: 'Lightbulb',
    dogmaEffects: [
      'You may splay your blue cards right.',
      'Draw and meld a 7.',
      ''
    ]
  },
  {
    id: 57,
    age: 6,
    color: 'Yellow',
    title: 'Canning',
    positions: { top: 'x', left: 'Factory', middle: 'Leaf', right: 'Factory' },
    hexagonImage: 'Pyramid made of cans',
    dogmaIcon: 'Factory',
    dogmaEffects: [
      'You may draw and tuck a 6. If you do, score all your top cards without a [Factory].',
      'You may splay your yellow cards right.',
      ''
    ]
  },
  {
    id: 58,
    age: 6,
    color: 'Green',
    title: 'Classification',
    positions: { top: 'x', left: 'Lightbulb', middle: 'Lightbulb', right: 'Lightbulb' },
    hexagonImage: 'Turtle',
    dogmaIcon: 'Lightbulb',
    dogmaEffects: [
      'Reveal the color of a card from your hand. Take into your hand all cards of that color from all other player\'s hands. Then, meld all cards of that color from your hand.',
      '',
      ''
    ]
  },
  {
    id: 59,
    age: 6,
    color: 'Purple',
    title: 'Democracy',
    positions: { top: 'x', left: 'Lightbulb', middle: 'Lightbulb', right: 'Crown' },
    hexagonImage: 'two multiple choice squares, with the bottom one checked off',
    dogmaIcon: 'Lightbulb',
    dogmaEffects: [
      'You may return any number of cards from your hand. If you have returned more cards than any other player due to Democracy this phase, draw and score an 8.',
      '',
      ''
    ]
  },
  {
    id: 60,
    age: 6,
    color: 'Purple',
    title: 'Emancipation',
    positions: { top: 'x', left: 'Factory', middle: 'Lightbulb', right: 'Factory' },
    hexagonImage: 'Shackle snapping in half',
    dogmaIcon: 'Factory',
    dogmaEffects: [
      'I demand you transfer a card from your hand to my score pile! If you do, draw a 6!',
      'You may splay your red or purple cards right.',
      ''
    ]
  },
  {
    id: 61,
    age: 6,
    color: 'Blue',
    title: 'Encyclopedia',
    positions: { top: 'x', left: 'Crown', middle: 'Crown', right: 'Crown' },
    hexagonImage: 'Large pile of book, with an open book at the top',
    dogmaIcon: 'Crown',
    dogmaEffects: [
      'You may meld all the highest cards in your score pile. If you meld one of the highest, you must meld all of the highest.',
      '',
      ''
    ]
  },
  {
    id: 62,
    age: 6,
    color: 'Red',
    title: 'Industrialization',
    positions: { top: 'x', left: 'Factory', middle: 'Factory', right: 'Crown' },
    hexagonImage: 'Three smokestacks with billowing smoke',
    dogmaIcon: 'Factory',
    dogmaEffects: [
      'Draw and tuck a 6 for every two [Factory] icons on your board.',
      'You may splay your red or purple cards right.',
      ''
    ]
  },
  {
    id: 63,
    age: 6,
    color: 'Red',
    title: 'Machine Tools',
    positions: { top: 'x', left: 'Factory', middle: 'Factory', right: 'x' },
    hexagonImage: 'Cog',
    dogmaIcon: 'Factory',
    dogmaEffects: [
      'Draw and score a card of value equal to the highest card in your score pile.',
      '',
      ''
    ]
  },
  {
    id: 64,
    age: 6,
    color: 'Green',
    title: 'Metric System',
    positions: { top: 'x', left: 'Factory', middle: 'Crown', right: 'Crown' },
    hexagonImage: 'Wrench',
    dogmaIcon: 'Crown',
    dogmaEffects: [
      'If your green cards are splayed right, you may splay any color of your cards right.',
      'You may splay your green cards right.',
      ''
    ]
  },
  {
    id: 65,
    age: 6,
    color: 'Yellow',
    title: 'Vaccination',
    positions: { top: 'x', left: 'Leaf', middle: 'Factory', right: 'Leaf' },
    hexagonImage: 'Syringe',
    dogmaIcon: 'Leaf',
    dogmaEffects: [
      'I demand you return all the lowest cards in your score pile! If you returned any, draw and meld a 6!',
      'If any card was returned as a result of the demand, draw and meld a 7.',
      ''
    ]
  },

  // Age 7 Cards (IDs 66-75)
  {
    id: 66,
    age: 7,
    color: 'Green',
    title: 'Bicycle',
    positions: { top: 'x', left: 'Crown', middle: 'Crown', right: 'Clock' },
    hexagonImage: 'Bicycle',
    dogmaIcon: 'Crown',
    dogmaEffects: [
      'You may exchange all the cards in your hand with all the cards in your score pile. If you exchange one, you must exchange them all.',
      '',
      ''
    ]
  },
  {
    id: 67,
    age: 7,
    color: 'Red',
    title: 'Combustion',
    positions: { top: 'x', left: 'Crown', middle: 'Crown', right: 'Factory' },
    hexagonImage: 'Automobile',
    dogmaIcon: 'Crown',
    dogmaEffects: [
      'I demand you transfer two cards from your score pile to my score pile!',
      '',
      ''
    ]
  },
  {
    id: 68,
    age: 7,
    color: 'Green',
    title: 'Electricity',
    positions: { top: 'x', left: 'Lightbulb', middle: 'Factory', right: 'x' },
    hexagonImage: 'Lightning bolt',
    dogmaIcon: 'Factory',
    dogmaEffects: [
      'Return all your top cards without a [Factory], then draw an 8 for each card you returned.',
      '',
      ''
    ]
  },
  {
    id: 69,
    age: 7,
    color: 'Blue',
    title: 'Evolution',
    positions: { top: 'x', left: 'Lightbulb', middle: 'Lightbulb', right: 'Lightbulb' },
    hexagonImage: 'Puddle with two organisms, or an amoeba',
    dogmaIcon: 'Lightbulb',
    dogmaEffects: [
      'You may choose to either draw and score an 8 and then return a card from your score pile, or draw a card of value one higher than the highest card in your score pile.',
      '',
      ''
    ]
  },
  {
    id: 70,
    age: 7,
    color: 'Red',
    title: 'Explosives',
    positions: { top: 'x', left: 'Factory', middle: 'Factory', right: 'Factory' },
    hexagonImage: 'Grenade',
    dogmaIcon: 'Factory',
    dogmaEffects: [
      'I demand you transfer your three highest cards from your hand to my hand! If you do, and then have no cards in hand, draw a 7!',
      '',
      ''
    ]
  },
  {
    id: 71,
    age: 7,
    color: 'Purple',
    title: 'Lighting',
    positions: { top: 'x', left: 'Leaf', middle: 'Clock', right: 'Leaf' },
    hexagonImage: 'Glowing street lamp',
    dogmaIcon: 'Leaf',
    dogmaEffects: [
      'You may tuck up to three cards from your hand. If you do, draw and score a 7 for every different value of card you tucked.',
      '',
      ''
    ]
  },
  {
    id: 72,
    age: 7,
    color: 'Blue',
    title: 'Publications',
    positions: { top: 'x', left: 'Lightbulb', middle: 'Clock', right: 'Lightbulb' },
    hexagonImage: 'Signed book',
    dogmaIcon: 'Lightbulb',
    dogmaEffects: [
      'You may rearrange the order of one color of cards on your board.',
      'You may splay your yellow or blue cards up.',
      ''
    ]
  },
  {
    id: 73,
    age: 7,
    color: 'Purple',
    title: 'Railroad',
    positions: { top: 'x', left: 'Clock', middle: 'Factory', right: 'Clock' },
    hexagonImage: 'Railroad tracks',
    dogmaIcon: 'Clock',
    dogmaEffects: [
      'Return all cards from your hand, then draw three 6.',
      'You may splay up any one color of your cards currently splayed right.',
      ''
    ]
  },
  {
    id: 74,
    age: 7,
    color: 'Yellow',
    title: 'Refrigeration',
    positions: { top: 'x', left: 'Leaf', middle: 'Leaf', right: 'Crown' },
    hexagonImage: 'Refrigerator',
    dogmaIcon: 'Leaf',
    dogmaEffects: [
      'I demand you return half (rounded down) of the cards in your hand!',
      'You may score a card from your hand.',
      ''
    ]
  },
  {
    id: 75,
    age: 7,
    color: 'Yellow',
    title: 'Sanitation',
    positions: { top: 'x', left: 'Leaf', middle: 'Leaf', right: 'x' },
    hexagonImage: 'Trash can',
    dogmaIcon: 'Leaf',
    dogmaEffects: [
      'I demand you exchange the two highest cards in your hand with the lowest card in my hand!',
      '',
      ''
    ]
  },

  // Age 8 Cards (IDs 76-85)
  {
    id: 76,
    age: 8,
    color: 'Yellow',
    title: 'Antibiotics',
    positions: { top: 'x', left: 'Leaf', middle: 'Leaf', right: 'Leaf' },
    hexagonImage: 'Pill',
    dogmaIcon: 'Leaf',
    dogmaEffects: [
      'You may return up to three cards from your hand. For every different value of card that you returned, draw two 8.',
      '',
      ''
    ]
  },
  {
    id: 77,
    age: 8,
    color: 'Green',
    title: 'Corporations',
    positions: { top: 'x', left: 'Factory', middle: 'Factory', right: 'Crown' },
    hexagonImage: 'Histogram',
    dogmaIcon: 'Factory',
    dogmaEffects: [
      'I demand you transfer a top non-green card with a [Factory] from your board to my score pile! If you do, draw and meld an 8.',
      'Draw and meld an 8.',
      ''
    ]
  },
  {
    id: 78,
    age: 8,
    color: 'Purple',
    title: 'Empiricism',
    positions: { top: 'x', left: 'Lightbulb', middle: 'Lightbulb', right: 'Lightbulb' },
    hexagonImage: 'Microscope',
    dogmaIcon: 'Lightbulb',
    dogmaEffects: [
      'Choose two colors, then draw and reveal a 9. If it is either of the colors you chose, meld it and you may splay your cards of that color up.',
      'If you have twenty or more [Lightbulb] icons on your board, you win.',
      ''
    ]
  },
  {
    id: 79,
    age: 8,
    color: 'Red',
    title: 'Flight',
    positions: { top: 'x', left: 'Crown', middle: 'x', right: 'Clock' },
    hexagonImage: 'Airplane',
    dogmaIcon: 'Crown',
    dogmaEffects: [
      'If your red cards are splayed up, you may splay any one color of your cards up.',
      'You may splay your red cards up.',
      ''
    ]
  },
  {
    id: 80,
    age: 8,
    color: 'Green',
    title: 'Mass Media',
    positions: { top: 'x', left: 'Lightbulb', middle: 'x', right: 'Clock' },
    hexagonImage: 'Microphone',
    dogmaIcon: 'Lightbulb',
    dogmaEffects: [
      'You may return a card from your hand. If you do, choose a value, and return all cards of that value from all score piles.',
      'You may splay your purple cards up.',
      ''
    ]
  },
  {
    id: 81,
    age: 8,
    color: 'Red',
    title: 'Mobility',
    positions: { top: 'x', left: 'Factory', middle: 'Clock', right: 'Factory' },
    hexagonImage: 'Tank',
    dogmaIcon: 'Factory',
    dogmaEffects: [
      'I demand you transfer your two highest non-red cards without a [Factory] from your board to my score pile! If you transferred any cards, draw an 8!',
      '',
      ''
    ]
  },
  {
    id: 82,
    age: 8,
    color: 'Blue',
    title: 'Quantum Theory',
    positions: { top: 'x', left: 'Clock', middle: 'Clock', right: 'Clock' },
    hexagonImage: 'Wireframe',
    dogmaIcon: 'Clock',
    dogmaEffects: [
      'You may return up to two cards from your hand. If you return two, draw a 10 and then draw and score a 10.',
      '',
      ''
    ]
  },
  {
    id: 83,
    age: 8,
    color: 'Blue',
    title: 'Rocketry',
    positions: { top: 'x', left: 'Clock', middle: 'Clock', right: 'Clock' },
    hexagonImage: 'Rocket',
    dogmaIcon: 'Clock',
    dogmaEffects: [
      'Return a card in any other player\'s score pile for every two [Clock] icons on your board.',
      '',
      ''
    ]
  },
  {
    id: 84,
    age: 8,
    color: 'Yellow',
    title: 'Skyscrapers',
    positions: { top: 'x', left: 'Factory', middle: 'Crown', right: 'Crown' },
    hexagonImage: 'Skyscraper',
    dogmaIcon: 'Crown',
    dogmaEffects: [
      'I demand you transfer a top non-yellow card with a [Clock] from your board to my board! If you do, score the card beneath it, and return all other cards from that pile!',
      '',
      ''
    ]
  },
  {
    id: 85,
    age: 8,
    color: 'Purple',
    title: 'Socialism',
    positions: { top: 'x', left: 'Leaf', middle: 'x', right: 'Leaf' },
    hexagonImage: 'Communist party logo',
    dogmaIcon: 'Leaf',
    dogmaEffects: [
      'You may tuck all cards from your hand. If you tuck one, you must tuck them all. If you tucked at least one purple card, take all the lowest cards in each other player\'s hand into your hand.',
      '',
      ''
    ]
  },

  // Age 9 Cards (IDs 86-95)
  {
    id: 86,
    age: 9,
    color: 'Green',
    title: 'Collaboration',
    positions: { top: 'x', left: 'Crown', middle: 'Clock', right: 'Crown' },
    hexagonImage: 'Two shaking hands',
    dogmaIcon: 'Crown',
    dogmaEffects: [
      'I demand you draw two 9 and reveal them. Transfer the card of my choice to my board, and meld the other.',
      'If you have ten or more green cards on your board, you win.',
      ''
    ]
  },
  {
    id: 87,
    age: 9,
    color: 'Red',
    title: 'Composites',
    positions: { top: 'x', left: 'Factory', middle: 'Factory', right: 'x' },
    hexagonImage: 'Tank',
    dogmaIcon: 'Factory',
    dogmaEffects: [
      'I demand you transfer all but one card from your hand to my hand! Also, transfer the highest card from your score pile to my score pile!',
      '',
      ''
    ]
  },
  {
    id: 88,
    age: 9,
    color: 'Blue',
    title: 'Computers',
    positions: { top: 'x', left: 'Clock', middle: 'x', right: 'Factory' },
    hexagonImage: 'Computer',
    dogmaIcon: 'Clock',
    dogmaEffects: [
      'You may splay your red cards or your green cards up.',
      'Draw and meld a 10, then execute its non-demand dogma effects for yourself only.',
      ''
    ]
  },
  {
    id: 89,
    age: 9,
    color: 'Yellow',
    title: 'Ecology',
    positions: { top: 'x', left: 'Leaf', middle: 'Lightbulb', right: 'Lightbulb' },
    hexagonImage: 'Recycling icon',
    dogmaIcon: 'Lightbulb',
    dogmaEffects: [
      'You may return a card from your hand. If you do, score a card from your hand and draw two 10.',
      '',
      ''
    ]
  },
  {
    id: 90,
    age: 9,
    color: 'Red',
    title: 'Fission',
    positions: { top: 'x', left: 'Clock', middle: 'Clock', right: 'Clock' },
    hexagonImage: 'Nuclear mushroom cloud',
    dogmaIcon: 'Clock',
    dogmaEffects: [
      'I demand you draw a 10! If it is red, remove all hands, boards, and score piles from the game! If this occurs, the dogma action is complete.',
      'Return a top card other than Fission from any player\'s board.',
      ''
    ]
  },
  {
    id: 91,
    age: 9,
    color: 'Blue',
    title: 'Genetics',
    positions: { top: 'x', left: 'Lightbulb', middle: 'Lightbulb', right: 'Lightbulb' },
    hexagonImage: 'DNA helix',
    dogmaIcon: 'Lightbulb',
    dogmaEffects: [
      'Draw and meld a 10. Score all cards beneath it.',
      '',
      ''
    ]
  },
  {
    id: 92,
    age: 9,
    color: 'Green',
    title: 'Satellites',
    positions: { top: 'x', left: 'Clock', middle: 'Clock', right: 'Clock' },
    hexagonImage: 'Satellite',
    dogmaIcon: 'Clock',
    dogmaEffects: [
      'Return all cards from your hand, and draw three 8.',
      'You may splay your purple cards up.',
      'Meld a card from your hand and then execute each of its non-demand dogma effects for yourself only.',
      ''
    ]
  },
  {
    id: 93,
    age: 9,
    color: 'Purple',
    title: 'Services',
    positions: { top: 'x', left: 'Leaf', middle: 'Leaf', right: 'Leaf' },
    hexagonImage: 'Gas pump',
    dogmaIcon: 'Leaf',
    dogmaEffects: [
      'I demand you transfer all the highest cards from your score pile to my hand! If you transferred any cards, then transfer a top card from my board without a [Leaf] to your hand!',
      '',
      ''
    ]
  },
  {
    id: 94,
    age: 9,
    color: 'Purple',
    title: 'Specialization',
    positions: { top: 'x', left: 'Factory', middle: 'Leaf', right: 'Factory' },
    hexagonImage: 'Scalpel',
    dogmaIcon: 'Factory',
    dogmaEffects: [
      'Reveal a card from your hand. Take into your hand the top card of that color from all other players\' boards.',
      'You may splay your yellow or blue cards up.',
      ''
    ]
  },
  {
    id: 95,
    age: 9,
    color: 'Yellow',
    title: 'Suburbia',
    positions: { top: 'x', left: 'Crown', middle: 'Leaf', right: 'Leaf' },
    hexagonImage: 'three large houses, 2.6 kids and a dog in each',
    dogmaIcon: 'Leaf',
    dogmaEffects: [
      'You may tuck any number of cards from your hand. Draw and score a 1 for each card you tucked.',
      '',
      ''
    ]
  },

  // Age 10 Cards (IDs 96-105)
  {
    id: 96,
    age: 10,
    color: 'Purple',
    title: 'A.I.',
    positions: { top: 'x', left: 'Lightbulb', middle: 'Lightbulb', right: 'Clock' },
    hexagonImage: 'Robot overlords',
    dogmaIcon: 'Lightbulb',
    dogmaEffects: [
      'Draw and score a 10.',
      'If Robotics and Software are top cards on any board, the single player with the lowest score wins.',
      ''
    ]
  },
  {
    id: 97,
    age: 10,
    color: 'Blue',
    title: 'Bioengineering',
    positions: { top: 'x', left: 'Lightbulb', middle: 'Clock', right: 'Clock' },
    hexagonImage: 'Biohazard icon',
    dogmaIcon: 'Clock',
    dogmaEffects: [
      'Transfer a top card with a [Leaf] from any other player\'s board to your score pile.',
      'If any player has fewer than three [Leaf] icons on their board, the single player with the most [Leaf] icons on their board wins.',
      ''
    ]
  },
  {
    id: 98,
    age: 10,
    color: 'Green',
    title: 'Databases',
    positions: { top: 'x', left: 'Clock', middle: 'Clock', right: 'Clock' },
    hexagonImage: 'Spreadsheet',
    dogmaIcon: 'Clock',
    dogmaEffects: [
      'I demand you return half (rounded up) of the cards in your score pile!',
      '',
      ''
    ]
  },
  {
    id: 99,
    age: 10,
    color: 'Yellow',
    title: 'Globalization',
    positions: { top: 'x', left: 'Factory', middle: 'Factory', right: 'Factory' },
    hexagonImage: 'Globe',
    dogmaIcon: 'Factory',
    dogmaEffects: [
      'I demand you return a top card with a [Leaf] on your board!',
      'Draw and score a 6. If no player has more [Leaf] icons than [Factory] icons on their board, the single player with the most points wins.',
      ''
    ]
  },
  {
    id: 100,
    age: 10,
    color: 'Red',
    title: 'Miniaturization',
    positions: { top: 'x', left: 'Lightbulb', middle: 'Clock', right: 'Lightbulb' },
    hexagonImage: 'Silicon chip',
    dogmaIcon: 'Lightbulb',
    dogmaEffects: [
      'You may return a card from your hand. If you returned a 10, draw a 10 for every different value of card in your score pile.',
      '',
      ''
    ]
  },
  {
    id: 101,
    age: 10,
    color: 'Red',
    title: 'Robotics',
    positions: { top: 'x', left: 'Factory', middle: 'Clock', right: 'Factory' },
    hexagonImage: 'Robot',
    dogmaIcon: 'Factory',
    dogmaEffects: [
      'Score your top green card. Draw and meld a 10, then execute its non-demand dogma effects for yourself only.',
      '',
      ''
    ]
  },
  {
    id: 102,
    age: 10,
    color: 'Green',
    title: 'Self Service',
    positions: { top: 'x', left: 'Crown', middle: 'Crown', right: 'Crown' },
    hexagonImage: 'Vending machine',
    dogmaIcon: 'Crown',
    dogmaEffects: [
      'Execute the non-demand dogma effects of any other top card on your board for yourself only.',
      'If you have more achievements than each other player, you win.',
      ''
    ]
  },
  {
    id: 103,
    age: 10,
    color: 'Blue',
    title: 'Software',
    positions: { top: 'x', left: 'Clock', middle: 'Clock', right: 'Clock' },
    hexagonImage: 'Floppy disk',
    dogmaIcon: 'Clock',
    dogmaEffects: [
      'Draw and score a 10.',
      'Draw and meld two 10, then execute the second card\'s non-demand dogma effects for yourself only.',
      ''
    ]
  },
  {
    id: 104,
    age: 10,
    color: 'Yellow',
    title: 'Stem Cells',
    positions: { top: 'x', left: 'Leaf', middle: 'Leaf', right: 'Leaf' },
    hexagonImage: 'Cell with a large nucleus',
    dogmaIcon: 'Leaf',
    dogmaEffects: [
      'You may score all cards from your hand. If you score one, you must score them all.',
      '',
      ''
    ]
  },
  {
    id: 105,
    age: 10,
    color: 'Purple',
    title: 'The Internet',
    positions: { top: 'x', left: 'Clock', middle: 'Clock', right: 'Lightbulb' },
    hexagonImage: 'Ethernet port',
    dogmaIcon: 'Clock',
    dogmaEffects: [
      'You may splay your green cards up.',
      'Draw and score a 10.',
      'Draw and meld a 10 for every two [Clock] icons on your board.'
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