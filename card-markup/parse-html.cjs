const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// Icon mapping as provided in the PR description
const iconMap = {
  'icon_1': 'Crown',
  'icon_2': 'Leaf',
  'icon_3': 'Lightbulb',
  'icon_4': 'Castle',
  'icon_5': 'Factory',  // Not mentioned in PR but included for completeness
  'icon_6': 'Clock'     // Not mentioned in PR but included for completeness
};

function parseIcon(iconStr) {
  if (iconStr === 'x') return 'x';
  return iconMap[iconStr] || 'x';
}

function parseCards(htmlContent) {
  const dom = new JSDOM(htmlContent);
  const document = dom.window.document;
  
  const cardElements = document.querySelectorAll('.card');
  const cards = [];
  
  cardElements.forEach(cardEl => {
    const id = parseInt(cardEl.getAttribute('data-id') || '0');
    const age = parseInt(cardEl.getAttribute('data-age') || '0');
    const color = cardEl.getAttribute('data-color');
    const title = cardEl.getAttribute('data-title') || '';
    
    // Extract icon positions
    const iconElements = cardEl.querySelectorAll('.card-icons .position');
    const positions = {
      top: 'x',
      left: 'x',
      middle: 'x',
      right: 'x'
    };
    
    iconElements.forEach(iconEl => {
      const className = iconEl.className;
      const iconValue = iconEl.textContent?.trim() || '';
      
      if (className.includes('top')) {
        positions.top = parseIcon(iconValue);
      } else if (className.includes('left')) {
        positions.left = parseIcon(iconValue);
      } else if (className.includes('middle')) {
        positions.middle = parseIcon(iconValue);
      } else if (className.includes('right')) {
        positions.right = parseIcon(iconValue);
      }
    });
    
    // Extract hexagon image
    const hexagonImageEl = cardEl.querySelector('.hexagon-image');
    const hexagonImage = hexagonImageEl?.textContent?.trim() || '';
    
    // Extract dogma icon
    const dogmaIconEl = cardEl.querySelector('.dogma-icon');
    const dogmaIconStr = dogmaIconEl?.textContent?.trim() || '';
    const dogmaIcon = parseIcon(dogmaIconStr);
    
    // Extract dogma effects
    const effectElements = cardEl.querySelectorAll('.dogma-effects .effect');
    const dogmaEffects = [];
    
    effectElements.forEach(effectEl => {
      const effectText = effectEl.textContent?.trim() || '';
      dogmaEffects.push(effectText);
    });
    
    // Ensure we have exactly 3 effects (pad with empty strings)
    while (dogmaEffects.length < 3) {
      dogmaEffects.push('');
    }
    dogmaEffects.splice(3); // Limit to 3 effects
    
    const card = {
      id,
      age,
      color,
      title,
      positions,
      hexagonImage,
      dogmaIcon,
      dogmaEffects
    };
    
    cards.push(card);
  });
  
  return cards;
}

function generateTypeScriptFile(cards) {
  const cardDataEntries = cards.map(card => {
    return `  {
    id: ${card.id},
    age: ${card.age},
    color: '${card.color}',
    title: '${card.title}',
    positions: { top: '${card.positions.top}', left: '${card.positions.left}', middle: '${card.positions.middle}', right: '${card.positions.right}' },
    hexagonImage: '${card.hexagonImage.replace(/'/g, "\\'")}',
    dogmaIcon: '${card.dogmaIcon}',
    dogmaEffects: [
      '${card.dogmaEffects[0].replace(/'/g, "\\'")}',
      '${card.dogmaEffects[1].replace(/'/g, "\\'")}',
      '${card.dogmaEffects[2].replace(/'/g, "\\'")}'
    ]
  }`;
  }).join(',\n\n');

  return `import type { CardData, Age, CardDatabase } from '@/types/cards.js';

// Raw card data extracted from HTML markup (Age 3 - 4th Edition)
const CARD_DATA: CardData[] = [
  // Age 3 Cards (IDs 26-35) - 4th Edition
${cardDataEntries}
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
`;
}

// Main execution
function main() {
  try {
    const htmlFilePath = path.join(__dirname, 'age3.html');
    const htmlContent = fs.readFileSync(htmlFilePath, 'utf-8');
    
    const cards = parseCards(htmlContent);
    console.log(`Parsed ${cards.length} cards from HTML`);
    
    // Log the first card to verify parsing
    if (cards.length > 0) {
      console.log('First card:', JSON.stringify(cards[0], null, 2));
    }
    
    const tsContent = generateTypeScriptFile(cards);
    
    const outputPath = path.join(__dirname, 'age3-cards.ts');
    fs.writeFileSync(outputPath, tsContent, 'utf-8');
    
    console.log(`TypeScript file generated: ${outputPath}`);
    console.log('Card parsing completed successfully!');
    
  } catch (error) {
    console.error('Error parsing HTML:', error);
    process.exit(1);
  }
}

// Run main
main();