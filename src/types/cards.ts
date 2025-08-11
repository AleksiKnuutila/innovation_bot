// Card types and interfaces for Innovation

export type CardId = number;
export type Age = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type Color = 'Yellow' | 'Red' | 'Purple' | 'Green' | 'Blue';
export type Icon = 'Leaf' | 'Lightbulb' | 'Crown' | 'Castle' | 'Factory' | 'Clock';

export interface CardPosition {
  top: Icon | 'x';
  left: Icon | 'x';  
  middle: Icon | 'x';
  right: Icon | 'x';
}

export interface CardData {
  id: CardId;
  age: Age;
  color: Color;
  title: string;
  positions: CardPosition;
  hexagonImage: string; // Descriptive text only
  dogmaIcon: Icon;
  dogmaEffects: string[]; // Up to 3 effects, empty strings if none
}

export interface CardDatabase {
  cards: CardData[];
  cardsByAge: Map<Age, CardData[]>;
  cardsById: Map<CardId, CardData>;
}

// Helper function to get all icons on a card (excluding 'x' positions)
export function getCardIcons(card: CardData): Icon[] {
  const icons: Icon[] = [];
  const { positions } = card;
  
  if (positions.top !== 'x') icons.push(positions.top);
  if (positions.left !== 'x') icons.push(positions.left);
  if (positions.middle !== 'x') icons.push(positions.middle);
  if (positions.right !== 'x') icons.push(positions.right);
  
  return icons;
}

// Count specific icon types on a card
export function countIcon(card: CardData, icon: Icon): number {
  return getCardIcons(card).filter(i => i === icon).length;
}