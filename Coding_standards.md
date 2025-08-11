
# Coding standard

- **Deterministic core:** no time-based randomness, no I/O in rules. One pure function: `next_state(state, action, rng_seed)`.
    
- **Simple data shapes:** prefer arrays/integers over nested objects and Maps. E.g., `cardId: number`, `zone: Uint16Array`, `players: fixed-length arrays`.
    
- **Explicit types:** `type State`, `type Action`, `type Observation` with no `any`/duck-typing. Rust maps cleanly from these.
    
- **No hidden side effects:** centralize rules; don’t mutate global singletons.
    
- **RNG parity:** lock a specific algorithm (e.g., **PCG32**/xoshiro). Log the seed and advancement count. Never use JS `Math.random()` in rules.
    
- **Floats:** avoid them in rules. Use integers for scoring/costs to ensure cross-platform determinism.
    
- **Single source of truth**: everything derives from `State` (UI, bot, logs). No UI-only state that can drift.
    
- **Immutable-by-default API**: expose pure `reduce(state, intent) -> { state', events, choices? }`. Internally you can mutate for speed.
    
- **Choice objects** should be first-class, serializable, and machine-readable, so both UI and bot consume the same thing
    
- Flat, numeric data structures — no JS object key order reliance.
    

# Actions vs. choices

- **Two-layer model**
    
    1. **Intents**: what the player tries to do (Draw / Meld / Dogma / Dominate).
        
    2. **Choices**: what the rules force you to specify _inside_ an intent or as reactions (select a card, pick a pile, order X cards, yes/no).
        
- **Choice lifecycle**: engine returns pending `choices[]` with stable `id`s; UI/bot submits `choiceAnswers` which resume resolution. This allows complex dogmas that branch.
    
- **Composite/Dependent choices**: support sequencing (`after: "choiceId"`), and constraints like “pick 2 cards from different colors”.
    

# State modeling

- **Compact IDs everywhere**: `CardID` (u16), `PlayerID` (u8). Avoid string keys for hot paths.
    
- **Zones as typed arrays**: hands, piles, score, decks as `Uint16Array` or small vectors; index = top/bottom semantics defined.
    
- **Cached counts**: keep per-player icon counts (Leaf/Bulb/Crown/Castle/Factory/Clock) cached & invalidated on splay/meld for fast dogma checks.
    
- **Versioned schema**: include `state.schemaVersion` so you can migrate saves later.
    

# RNG & determinism

- **Seeded RNG**: pick a specific algorithm (e.g., xoshiro128**). Keep RNG state in `State`.
    
- **No floating point in rules**: integers for influence/thresholds; helps cross-platform parity.
    
- **Golden tests**: store tricky scenarios with expected logs to catch regressions.
    

# Logging & explainability

- **Event-sourced log**: every state change emits an `Event`. Keep it compact but explicit; let the UI decorate for humans.
    
- **Diffs**: for debugging, optionally store per-event diffs for zones (before/after counts or IDs).
    
- **Causality**: include `source` fields (cardID, dogmaID, ruleRef) to trace _why_ something happened.
    

# 10. Testing

- **Golden tests**: seeds + inputs → expected events/state hash.
    
- **Property tests**: invariants like card conservation, unique dominations.
    
- **Fuzz**: random playthroughs — no crashes, always terminates.
    

# 11. UI Integration Requirements

- Renders from State and Events only.
    
- Uses Choices to drive highlights and prompts.
    
- Localizes UI via `promptKey` in Choices and message keys in Events.
    
- Includes log viewer and time travel debug (`stateAt(eventIndex)`).
    

# 12. Validation & Errors

- All public validators return **error codes** (enums) plus fields for explanation. UI localizes.
    
- Illegal Action/Choice does not mutate state; return `{ errors: [...] }`.
