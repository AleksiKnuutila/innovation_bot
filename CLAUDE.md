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
- **Monorepo structure**: `/packages/{shared,engine,ui,bot,sim}`
- **Engine API**: Synchronous stepper pattern with `startAction()` / `resumeWithAnswer()`
- **Data contracts**: Actions vs Choices separation, Events for replay/debug
- Effect queue + stepper architecture for complex card interactions

### 5. **Coding_standards.md**
Technical constraints and patterns:
- **Deterministic core**: No time-based RNG, pure functions, explicit RNG seeding
- **Simple data**: Arrays/integers over objects, typed arrays for performance
- **Immutable API**: Pure state transitions, centralized mutations
- **Two-layer model**: Actions (player intents) vs Choices (rule-forced decisions)
- Compact IDs, versioned schema, cross-platform determinism

### 6. **vb-implementation/** 
Legacy Visual Basic implementation containing:
- **Innovation.txt**: Complete card database with metadata and effects
- **Functions.vb**: Card effect implementations and game logic
- **AIFunctions.vb**: AI decision-making algorithms  
- **main.vb**: UI and game flow
- Images and assets for card artwork

## Key Technical Decisions
- **Effect Stack + Synchronous Stepper** architecture chosen over alternatives
- **TypeScript first** with future Rust/WASM migration path
- **Monorepo** with clear package separation
- **Deterministic RNG** (PCG32/xoshiro) with seed storage
- **Actions/Choices** separation for clean AI integration

## Implementation Status
Currently in planning phase with detailed architecture and specifications complete. Ready to begin Phase 0 (repository setup) and Phase 1 (shared contracts).

## Commands to Remember
- Run tests: `npm test` or `pnpm test` (to be determined during setup)
- Build: `npm run build` or `pnpm build` (to be determined during setup)
- Lint/typecheck: `npm run lint` and `npm run typecheck` (to be determined during setup)