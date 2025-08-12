# Innovation Digital Board Game Project

## Project Overview
Creating a browser-based TypeScript implementation of Carl Chudyk's Innovation board game (4th edition) with AI opponent support and future portability to Rust/WASM.

## Key Resources

### 1. **Innovation_rules.md**
Complete rules documentation for Innovation board game including:
- Game setup and card anatomy
- Icons system (Leaf, Bulbs, Crown, Castle, Factory, Clock)
- Turn structure and actions (Draw, Meld, Dogma, Dominate)
- Detailed card effects and mechanics

### 2. **Specification.md** 
Project requirements and scope defining:
- **MVP Goal**: Pure TypeScript game engine + simple AI bot + browser UI
- Architecture goals: deterministic rules, UI/AI separation, future Rust portability
- Version 1 scope with core game engine, AI bot, test suite
- Future expansion plans (stronger AI, multiplayer, etc.)

### 3. **Plan.md**
Implementation roadmap with phases:
- **Phase 0**: Repo setup (monorepo, TypeScript, testing)
- **Phase 1**: Shared contracts (Actions, Choices, Events, IDs)
- **Phase 2**: Engine skeleton (deterministic stepper, RNG, serialization)  
- **Phase 3**: Effect execution system (primitives, effect stack/queue)
- Subsequent phases: card implementations, AI bot, UI, testing

### 4. **Architecture.md**
System design decisions:
- **Simplified single-package structure**: `/src/{engine,ui,bot,types,cards}`
- **State Machine API**: Direct action processing with `processAction()` / `processChoice()`
- **Data contracts**: Actions vs Choices separation, Events for replay/debug
- Simple state machine architecture instead of complex effect queues

### 5. **Coding_standards.md**
Technical constraints and patterns:
- **Deterministic core**: No time-based RNG, pure functions, explicit RNG seeding
- **Simple data**: Arrays/integers over objects, typed arrays for performance
- **Immutable API**: Pure state transitions, centralized mutations
- **Two-layer model**: Actions (player intents) vs Choices (rule-forced decisions)
- Compact IDs, versioned schema, cross-platform determinism

### 6. **Innovation_faq_and_cards.md**
Official FAQ and complete card database containing:
- **FAQ Section**: Edge cases, timing rules, keyword clarifications
- **Complete Card List**: All cards ages 1-10 with exact text, icons, and dogma effects
- **Card Clarifications**: Detailed explanations of how each card's effects work
- **Special Achievement Rules**: Complete conditions and timing
- **Team Play Rules**: 2v2 variant rules

### 7. **vb-implementation/** 
Legacy Visual Basic implementation containing:
- **Innovation.txt**: Complete card database with metadata and effects
- **Functions.vb**: Card effect implementations and game logic
- **AIFunctions.vb**: AI decision-making algorithms  
- **main.vb**: UI and game flow
- Images and assets for card artwork

## Key Technical Decisions
- **Simple State Machine** architecture chosen for clarity and maintainability
- **TypeScript first** with future Rust/WASM migration path  
- **Single package structure** with clear module separation
- **Deterministic RNG** (xoshiro128**) with seed storage
- **Actions/Choices** separation for clean AI integration
- **Direct calculations** instead of caching for simpler architecture

## Implementation Status
**Phase 2 COMPLETED** - Engine core implemented with:
- ✅ Deterministic RNG system (xoshiro128**)
- ✅ State machine API (`processAction`, `processChoice`)
- ✅ Event system for replay capability
- ✅ Serialization system
- ✅ All Phase 2 DoD tests passing (basic functionality, deterministic replay, golden test)

**Ready for Phase 3** - Card effects and architecture validation

## Commands to Remember
- Run tests: `npm test -- --run`
- Run tests in watch mode: `npm test`
- Build: `npm run build`
- Lint/typecheck: `npm run lint` and `npm run typecheck`