// Name-based effect registry - maps card names to effect functions
// This is more maintainable than ID-based mapping

import type { CardEffectFunction } from '../types/dogma.js';
import {
  // Age 1 Cards
  agricultureEffect,
  archeryEffect,
  cityStatesEffect,
  clothingEffect,
  codeOfLawsEffect,
  domesticationEffect,
  masonryEffect,
  metalworkingEffect,
  mysticismEffect,
  oarsEffect,
  potteryEffect,
  sailingEffect,
  theWheelEffect,
  toolsEffect,
  writingEffect,
  
  // Age 2 Cards
  calendarEffect,
  canalBuildingEffect,
  constructionEffect,
  currencyEffect,
  fermentingEffect,
  mapmakingEffect,
  mathematicsEffect,
  monotheismEffect,
  philosophyEffect,
  roadBuildingEffect,
  
  // Age 3 Cards
  alchemyEffect,
  compassEffect,
  translationEffect,
  engineeringEffect,
  feudalismEffect,
  machineryEffect,
  medicineEffect,
  opticsEffect,
  educationEffect,
  
  // Age 4 Cards
  anatomyEffect,
  enterpriseEffect,
  gunpowderEffect,
  inventionEffect,
  navigationEffect,
  
  // Age 5 Cards
  physicsEffect,
  measurementEffect,
  astronomyEffect,
  chemistryEffect,
} from './effect-handlers.js';
  
import {
  // Age 6 Cards
  atomicTheoryEffect,
  machineToolsEffect,
  canningEffect,
  classificationEffect,
  encyclopediaEffect,
  industrializationEffect,
  metricSystemEffect,
  democracyEffect,
  emancipationEffect,
  vaccinationEffect,
} from './age6-effects.js';

import {
  // Age 4 Cards
  experimentationEffect,
  colonialismEffect,
  perspectiveEffect,
  printingPressEffect,
  reformationEffect,
} from './age4-effects.js';

import {
  // Age 5 Cards  
  coalEffect,
  steamEngineEffect,
  bankingEffect,
  piratecodeEffect,
  societiesEffect,
  statisticsEffect,
} from './age5-effects.js';

import {
  // Age 7 Cards
  bicycleEffect,
} from './age7-effects.js';

// Map card names to effect functions
export const EFFECT_BY_NAME: Record<string, CardEffectFunction> = {
  // Age 1 Cards
  'Agriculture': agricultureEffect,
  'Archery': archeryEffect,
  'City States': cityStatesEffect,
  'Clothing': clothingEffect,
  'Code of Laws': codeOfLawsEffect,
  'Domestication': domesticationEffect,
  'Masonry': masonryEffect,
  'Metalworking': metalworkingEffect,
  'Mysticism': mysticismEffect,
  'Oars': oarsEffect,
  'Pottery': potteryEffect,
  'Sailing': sailingEffect,
  'The Wheel': theWheelEffect,
  'Tools': toolsEffect,
  'Writing': writingEffect,
  
  // Age 2 Cards
  'Calendar': calendarEffect,
  'Canal Building': canalBuildingEffect,
  'Construction': constructionEffect,
  'Currency': currencyEffect,
  'Fermenting': fermentingEffect,
  'Mapmaking': mapmakingEffect,
  'Mathematics': mathematicsEffect,
  'Monotheism': monotheismEffect,
  'Philosophy': philosophyEffect,
  'Road Building': roadBuildingEffect,
  
  // Age 3 Cards
  'Alchemy': alchemyEffect,
  'Compass': compassEffect,
  'Translation': translationEffect,
  'Engineering': engineeringEffect,
  'Feudalism': feudalismEffect,
  'Machinery': machineryEffect,
  'Medicine': medicineEffect,
  'Optics': opticsEffect,
  'Education': educationEffect,
  
  // Age 4 Cards
  'Anatomy': anatomyEffect,
  'Colonialism': colonialismEffect,
  'Enterprise': enterpriseEffect,
  'Experimentation': experimentationEffect,
  'Gunpowder': gunpowderEffect,
  'Invention': inventionEffect,
  'Navigation': navigationEffect,
  'Perspective': perspectiveEffect,
  'Printing Press': printingPressEffect,
  'Reformation': reformationEffect,
  
  // Age 5 Cards
  'Coal': coalEffect,
  'Steam Engine': steamEngineEffect,
  'Banking': bankingEffect,
  'The Pirate Code': piratecodeEffect,
  'Societies': societiesEffect,
  'Statistics': statisticsEffect,
  'Physics': physicsEffect,
  'Measurement': measurementEffect,
  'Astronomy': astronomyEffect,
  'Chemistry': chemistryEffect,
  
  // Age 6 Cards
  'Atomic Theory': atomicTheoryEffect,
  'Machine Tools': machineToolsEffect,
  'Canning': canningEffect,
  'Classification': classificationEffect,
  'Encyclopedia': encyclopediaEffect,
  'Industrialization': industrializationEffect,
  'Metric System': metricSystemEffect,
  'Democracy': democracyEffect,
  'Emancipation': emancipationEffect,
  'Vaccination': vaccinationEffect,
  
  // Age 7 Cards
  'Bicycle': bicycleEffect,
} as const;

// Get effect function by card name
export function getCardEffectByName(cardName: string): CardEffectFunction | undefined {
  return EFFECT_BY_NAME[cardName];
}

// Get all available card names
export function getAvailableCardNames(): string[] {
  return Object.keys(EFFECT_BY_NAME);
}

// Check if a card has an effect handler
export function hasCardEffect(cardName: string): boolean {
  return cardName in EFFECT_BY_NAME;
} 