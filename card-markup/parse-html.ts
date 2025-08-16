#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import { JSDOM } from 'jsdom';

// Define types (copied from the existing codebase)
type CardId = number;
type Age = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
type Color = 'Yellow' | 'Red' | 'Purple' | 'Green' | 'Blue';
type Icon = 'Leaf' | 'Lightbulb' | 'Crown' | 'Castle' | 'Factory' | 'Clock';

interface CardPosition {
  top: Icon | 'x';
  left: Icon | 'x';  
  middle: Icon | 'x';
  right: Icon | 'x';
}

interface CardData {
  id: CardId;
  age: Age;
  color: Color;
  title: string;
  positions: CardPosition;
  hexagonImage: string;
  dogmaIcon: Icon;
  dogmaEffects: string[]; // Up to 3 effects, empty strings if none
}

// Icon mapping as provided in the PR description
const iconMap: Record<string, Icon> = {
  'icon_1': 'Crown',
  'icon_2': 'Leaf',
  'icon_3': 'Lightbulb',
  'icon_4': 'Castle',
  'icon_5': 'Factory',  // Not mentioned in PR but included for completeness
  'icon_6': 'Clock'     // Not mentioned in PR but included for completeness
};

function parseIcon(iconStr: string): Icon | 'x' {
  if (iconStr === 'x') return 'x';
  return iconMap[iconStr] || 'x';
}

function parseCards(htmlContent: string): CardData[] {
  const dom = new JSDOM(htmlContent);
  const document = dom.window.document;
  
  const cardElements = document.querySelectorAll('.card');
  const cards: CardData[] = [];
  
  cardElements.forEach(cardEl => {
    const id = parseInt(cardEl.getAttribute('data-id') || '0');
    const age = parseInt(cardEl.getAttribute('data-age') || '0') as Age;
    const color = cardEl.getAttribute('data-color') as Color;
    const title = cardEl.getAttribute('data-title') || '';
    
    // Extract icon positions
    const iconElements = cardEl.querySelectorAll('.card-icons .position');
    const positions: CardPosition = {
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
    const dogmaIcon = parseIcon(dogmaIconStr) as Icon;
    
    // Extract dogma effects
    const effectElements = cardEl.querySelectorAll('.dogma-effects .effect');
    const dogmaEffects: string[] = [];
    
    effectElements.forEach(effectEl => {
      const effectText = effectEl.textContent?.trim() || '';
      dogmaEffects.push(effectText);
    });
    
    // Ensure we have exactly 3 effects (pad with empty strings)
    while (dogmaEffects.length < 3) {
      dogmaEffects.push('');
    }
    dogmaEffects.splice(3); // Limit to 3 effects
    
    const card: CardData = {
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

function generateTypeScriptFile(cards: CardData[]): string {
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

// Only run main if this script is executed directly
if (require.main === module) {
  main();
}

export { parseCards, generateTypeScriptFile };