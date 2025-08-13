# Primitive Function Analysis

## Overview
Analysis of common card effect patterns to identify candidate primitive functions for implementation.

## Pattern Frequency Analysis

### 1. Draw + Action Patterns

#### Draw and Score (Very High Frequency: 25+ cards)
**Cards**: Agriculture, Pottery, Optics, Banking, Machine Tools, Optics, etc.
**Pattern**: Draw card(s) from age X, then score them
**Primitive Candidate**: `drawAndScore(player, age, count)`

#### Draw and Meld (High Frequency: 20+ cards)
**Cards**: Sailing, Mathematics, Alchemy, Democracy, Encyclopedia, etc.
**Pattern**: Draw card(s) from age X, then meld them
**Primitive Candidate**: `drawAndMeld(player, age, count)`

#### Draw and Tuck (Medium Frequency: 15+ cards)
**Cards**: Code of Laws, Monotheism, Colonialism, Coal, etc.
**Pattern**: Draw card(s) from age X, then tuck them
**Primitive Candidate**: `drawAndTuck(player, age, count)`

#### Draw and Splay (Medium Frequency: 12+ cards)
**Cards**: Philosophy, Paper, Invention, Banking, Chemistry, etc.
**Pattern**: Draw card(s) from age X, then splay color(s)
**Primitive Candidate**: `drawAndSplay(player, age, count, color, direction)`

### 2. Demand Patterns (High Frequency: 20+ cards)

#### I Demand Transfer (High Frequency: 15+ cards)
**Cards**: Archery, City States, Oars, Engineering, Feudalism, etc.
**Pattern**: I demand you transfer card(s) from zone to zone
**Primitive Candidate**: `demandTransfer(player, target, cardType, fromZone, toZone)`

#### I Demand Return (Medium Frequency: 8+ cards)
**Cards**: Anatomy, Fission, Databases, etc.
**Pattern**: I demand you return card(s) from zone
**Primitive Candidate**: `demandReturn(player, target, zone, cardType)`

#### I Demand Exchange (Medium Frequency: 6+ cards)
**Cards**: Machinery, Medicine, Combustion, Sanitation, etc.
**Pattern**: I demand you exchange card(s) between zones
**Primitive Candidate**: `demandExchange(player, target, fromZone, toZone)`

### 3. Splay Patterns (High Frequency: 15+ cards)

#### Basic Splay (High Frequency: 15+ cards)
**Cards**: Philosophy, Code of Laws, Paper, Invention, Banking, etc.
**Pattern**: Splay color(s) in direction
**Primitive Candidate**: `splayColor(player, color, direction)` (already exists)

#### Conditional Splay (Medium Frequency: 8+ cards)
**Cards**: Invention, Banking, Chemistry, etc.
**Pattern**: If condition, splay color(s) in direction
**Primitive Candidate**: `conditionalSplay(player, color, direction, condition)`

### 4. Conditional Patterns (Medium Frequency: 10+ cards)

#### Icon-Based Conditions (Medium Frequency: 8+ cards)
**Cards**: Clothing, Paper, Invention, etc.
**Pattern**: If you have X icons, do effect
**Primitive Candidate**: `conditionalEffect(condition, effectFunction)`

#### Repeat Effects (Low Frequency: 5+ cards)
**Cards**: Metalworking, Colonialism, etc.
**Pattern**: If condition, repeat effect
**Primitive Candidate**: `repeatEffect(condition, effectFunction, maxIterations)`

### 5. Exchange Patterns (Medium Frequency: 8+ cards)

#### Hand/Score Exchange (Medium Frequency: 6+ cards)
**Cards**: Canal Building, Bicycle, etc.
**Pattern**: Exchange cards between hand and score pile
**Primitive Candidate**: `exchangeHandScore(player, handCards, scoreCards)`

#### Opponent Exchange (Low Frequency: 4+ cards)
**Cards**: Machinery, Medicine, Sanitation, etc.
**Pattern**: Exchange cards with opponent
**Primitive Candidate**: `exchangeWithOpponent(player, opponent, fromZone, toZone)`

## Primitive Function Priority

### High Priority (Implement First)
1. **`drawAndScore(player, age, count)`** - Used in 25+ cards
2. **`drawAndMeld(player, age, count)`** - Used in 20+ cards
3. **`drawAndTuck(player, age, count)`** - Used in 15+ cards
4. **`demandTransfer(player, target, cardType, fromZone, toZone)`** - Used in 15+ cards

### Medium Priority (Implement Second)
5. **`drawAndSplay(player, age, count, color, direction)`** - Used in 12+ cards
6. **`demandReturn(player, target, zone, cardType)`** - Used in 8+ cards
7. **`demandExchange(player, target, fromZone, toZone)`** - Used in 6+ cards
8. **`exchangeHandScore(player, handCards, scoreCards)`** - Used in 6+ cards

### Low Priority (Implement Last)
9. **`conditionalEffect(condition, effectFunction)`** - Used in 8+ cards
10. **`repeatEffect(condition, effectFunction, maxIterations)`** - Used in 5+ cards
11. **`exchangeWithOpponent(player, opponent, fromZone, toZone)`** - Used in 4+ cards

## Implementation Strategy

### Phase 1: Core Draw Primitives
Start with the most frequently used patterns:
1. `drawAndScore()` - Handles 25+ cards
2. `drawAndMeld()` - Handles 20+ cards
3. `drawAndTuck()` - Handles 15+ cards

**Impact**: These 3 primitives will handle ~60+ cards (over half the deck)

### Phase 2: Demand Primitives
Add demand pattern primitives:
1. `demandTransfer()` - Handles 15+ cards
2. `demandReturn()` - Handles 8+ cards
3. `demandExchange()` - Handles 6+ cards

**Impact**: These 3 primitives will handle ~30+ cards

### Phase 3: Advanced Primitives
Add remaining primitives:
1. `drawAndSplay()` - Handles 12+ cards
2. `exchangeHandScore()` - Handles 6+ cards
3. `conditionalEffect()` - Handles 8+ cards

**Impact**: These 3 primitives will handle ~25+ cards

## Expected Coverage

### After Phase 1 (Core Draw)
- **Cards Covered**: ~60+ cards
- **Coverage**: ~60% of deck
- **Implementation Speed**: 2-3x faster for covered cards

### After Phase 2 (Demand)
- **Cards Covered**: ~90+ cards
- **Coverage**: ~85% of deck
- **Implementation Speed**: 3-4x faster for covered cards

### After Phase 3 (Advanced)
- **Cards Covered**: ~115+ cards
- **Coverage**: ~100% of deck (some cards use multiple primitives)
- **Implementation Speed**: 4-5x faster for covered cards

## Risk Assessment

### High Risk Areas
1. **Demand primitives**: Complex logic for finding affected players
2. **Conditional primitives**: Generic function execution patterns
3. **Exchange primitives**: Complex zone validation logic

### Mitigation Strategies
1. **Extensive testing**: Test each primitive with multiple card scenarios
2. **Clear interfaces**: Well-defined parameter types and return values
3. **Error handling**: Comprehensive error handling for edge cases
4. **Performance monitoring**: Ensure primitives don't add overhead

## Success Metrics

### Phase 7c Complete When
- [ ] High priority primitives implemented and tested
- [ ] Medium priority primitives implemented and tested
- [ ] Low priority primitives implemented and tested
- [ ] All primitives have comprehensive test coverage
- [ ] Primitives show measurable speed improvement
- [ ] No regression in existing functionality 