Here's a cleaned-up plan that uses a **simplified state machine** architecture instead of complex effect queues.

**Note**: Throughout implementation, use the vb-implementation directory as a behavioral reference for card effects and rule implementations. The VB code has working implementations of all card effects and edge cases - adapt these to the new architecture but maintain the same game behavior.

# ✅ Phase 0 — Repo & Workspace (COMPLETED)

* ✅ Create single TypeScript package with clear module structure
  `/src/engine`, `/src/ui`, `/src/bot`, `/src/types`, `/src/cards`
* ✅ Enable TypeScript strict, ESLint, Prettier
* ✅ Add Vitest for testing + coverage
* ✅ Simple build setup with Vite

# ✅ Phase 0.5 — Card Database Preparation (COMPLETED)

* ✅ **Extract card database from VB implementation**:
  * ✅ Convert VB card metadata to TypeScript/JSON format (35 cards Ages 1-3)
  * ✅ Include basic info: name, age, color, icons, dogma text
  * ✅ Focus on Ages 1-3 for MVP scope
* ✅ **Select representative test cards**:
  * ✅ Choose 3 Age 1 cards with different complexity levels
  * ✅ Simple: Writing (basic draw)
  * ✅ Medium: Code of Laws (conditional + choice)
  * ✅ Complex: Oars (demand with fallback)
* ✅ **Reference implementation patterns**:
  * ✅ Created card types with helper functions
  * ✅ Structured for easy VB reference lookup

**DoD Phase 0.5** ✅
* ✅ Card database ready for Ages 1-3 (35 cards)
* ✅ Test cards selected for architecture validation

# ✅ Phase 1 — Core Types & State Machine (COMPLETED)

* ✅ Define IDs: `PlayerID`, `CardID`, `Color`, `Icon` with strict typing
* ✅ Define **Actions**: `Draw`, `Meld`, `Dogma`, `Achieve` with parameters
* ✅ Define **GameState** enum: `AwaitingAction`, `ResolvingDogma`, `AwaitingChoice`, `CheckingWinConditions`, `GameOver`
* ✅ Define **Choices** & **ChoiceAnswer**: `SelectCards`, `SelectPile`, `OrderCards`, `YesNo`, `SelectPlayer`
* ✅ Define **Events**: Complete event system with 14 event types for replay
* ✅ Define core **GameData** structure with RNG state, caching, and validation

# 🚧 Phase 2 — Engine Core (state machine) (IN PROGRESS)

* 🚧 Implement seeded RNG (xoshiro/PCG) stored in `GameData`
* ⏳ Model `GameData` with simple arrays; cache per-player icon counts  
* ⏳ Turn/legality: 2 actions/turn, action validity, achievement thresholds
* ⏳ **State Machine API:**

  * `processAction(state, action) → GameResult`
  * `processChoice(state, answer) → GameResult` 
  * `getLegalActions(state, player)`, `expandChoice(choice)`
  * `GameResult` has `newState`, `events`, `nextPhase`, `pendingChoice?`
* ⏳ Simple serializer: `JSON.stringify/parse` initially
* ⏳ Every mutation emits Events for UI/debugging

**DoD Phase 2**

* Deterministic replay: `seed + [Action/ChoiceAnswer...]` reproduces identical Events
* Golden test: scripted game reaches same final state hash reliably

# Phase 3 — Card Effects & Architecture Validation

* Implement **direct state manipulation** approach:
  Simple functions like `drawCard()`, `meldCard()`, `splayColor()`, `scoreCard()`
* Build **dogma resolution framework**:
  
  * Card handlers that directly modify state
  * Return `DogmaResult` with state changes, events, pending choices
  * Handle sharing/demand logic in resolvers
* Centralize symbol comparisons (most/least/at-least, tie rules)  
* **Implement 2-3 representative Age 1 cards** for architecture validation:
  * Start with simple card (e.g., basic draw/meld effect)
  * Add medium complexity card (e.g., conditional splay)
  * Add complex card (e.g., demand with choices)
  * Validate that state machine handles all card types correctly
* **Reference implementation guidance**:
  * Use vb-implementation card handlers as behavioral reference
  * Check Functions.vb for card effect implementations and edge cases
  * Adapt logic patterns to new state machine architecture (better structure!)
* Ensure Events include `source` (card/rule) for explainability

**DoD Phase 3**

* Representative cards working end-to-end (action → choice → resolution)
* Architecture validated with different complexity levels
* Cards produce standardized Choices (UI renders without special-casing)
* Logs human-readable via message keys + params

# Phase 4 — Comprehensive Testing & Validation

* **Unit Tests**:
  * Test each card handler in isolation
  * Test state machine transitions
  * Test error handling and validation functions
* **Integration Tests**:
  * End-to-end game flows with representative cards
  * Multi-turn scenarios with state persistence
  * Choice/answer cycles working correctly
* **Property Tests** (automated invariant checking):
  * Card conservation (deck+hands+board+score constant)
  * Icon cache consistency (cached == recomputed icons)
  * Unique achievements (no duplicates claimed)
  * Turn counter correctness
  * RNG determinism (same seed → same results)
* **Golden Tests** (regression protection):
  * Record complete game scenarios as expected outputs
  * Scripted games with known card interactions
  * Serialize/deserialize round-trip testing
* **Fuzz Testing** (stability):
  * Random valid action sequences
  * Invalid input handling
  * Long game sessions (memory leaks, performance)
  * Edge case discovery
* **Performance Testing**:
  * Action processing speed benchmarks
  * Memory usage in long games
  * Serialization/deserialization performance

**DoD Phase 4**

* 90%+ test coverage on core engine
* Property tests passing consistently
* Fuzz tests running 1000+ games without crashes
* Performance baselines established

# Phase 5 — UI (Svelte or vanilla)

* Render:

  * Tableaus with splay indicators, hands, scores, icon tallies
  * Action bar from `legalActions(state, you)`
  * **Choice prompt** driven by stepper:

    * Call `startAction(...)` → if `NeedChoice`, show prompt
    * On click, call `resumeWithAnswer(...)` until `Done`
  * Event log (scrolling list)
* Keep state local or a tiny Svelte store; no extra libs

# Phase 6 — Bot (in a Web Worker)

* `/bot/worker.ts`:

  * Receives `{ state, player }`
  * Calls `legalActions(state, p)` to pick an Action
  * Drives the stepper loop: if `NeedChoice`, enumerate answers (via `choices/expand`) and respond until `Done`
* UI spawns worker with `new Worker(new URL('../bot/worker.ts', import.meta.url))`
* Start with simple heuristics; upgrade later

# Phase 7 — Replay, Dev UX, and Sim

* `replay(seed, inputs)` that feeds the **stepper** to reproduce games
* Time-travel in UI (`eventIndex` slider using stored Events)
* `/sim`: headless runner to batch playouts for perf/testing

# Phase 8 — Content & Editions

* Card registry with stable `cardKey`, edition availability (3E/4E), metadata
* Edition flags in rules; centralize differences (e.g., Age 11, aslant splay)
* Incrementally add core deck (Age 1→10) with targeted tests

**DoD Phase 8**

* Edition toggle works; shared tests pass under both where applicable

# Phase 9 — Performance Pass (optional after MVP)

* Profile hotspots in runner, choice expansion, legality checks
* Add `stepMany(inputs[])` for batched bot sims
* Consider internal in-place mutation with immutable public returns
* Memoize `legalActions`/choice expansions until state changes
