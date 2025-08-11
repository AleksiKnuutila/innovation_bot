Here's a cleaned-up plan that uses a **simplified state machine** architecture instead of complex effect queues.

# Phase 0 — Repo & Workspace

* Create single TypeScript package with clear module structure
  `/src/engine`, `/src/ui`, `/src/bot`, `/src/types`, `/src/cards`
* Enable TypeScript strict, ESLint, Prettier
* Add Vitest for testing + coverage
* Simple build setup with Vite

# Phase 0.5 — Card Database Preparation

* **Extract card database from VB implementation**:
  * Convert VB card metadata to TypeScript/JSON format
  * Include basic info: name, age, color, icons, dogma text
  * Focus on Ages 1-3 for MVP scope
* **Select representative test cards**:
  * Choose 2-3 Age 1 cards with different complexity levels
  * Simple: Basic draw/meld effects
  * Medium: Conditional effects or splaying
  * Complex: Multi-step effects or demands
* **Reference implementation patterns** (as needed):
  * Look at VB card handlers when implementing specific cards
  * Use FAQ file to resolve specific questions that arise

**DoD Phase 0.5**
* Card database ready for Ages 1-3
* Test cards selected for architecture validation

# Phase 1 — Core Types & State Machine

* Define IDs: `PlayerID`, `CardID`, `Color`, `Icon` (numeric where possible)  
* Define **Actions**: `Draw`, `Meld`, `Dogma`, `Achieve`
* Define **GameState** enum: `AwaitingAction`, `ResolvingDogma`, `AwaitingChoice`, `GameOver`
* Define **Choices** & **ChoiceAnswer**: `SelectCards`, `SelectPile`, `OrderCards`, `YesNo`
* Define **Events**: `Drew`, `Melded`, `Splayed`, `Dogma`, `Scored`, `GameEnd`
* Define core **GameData** structure with all game state

# Phase 2 — Engine Core (state machine)

* Implement seeded RNG (xoshiro/PCG) stored in `GameData`
* Model `GameData` with simple arrays; cache per-player icon counts  
* Turn/legality: 2 actions/turn, action validity, achievement thresholds
* **State Machine API:**

  * `processAction(state, action) → GameResult`
  * `processChoice(state, answer) → GameResult` 
  * `getLegalActions(state, player)`, `expandChoice(choice)`
  * `GameResult` has `newState`, `events`, `nextPhase`, `pendingChoice?`
* Simple serializer: `JSON.stringify/parse` initially
* Every mutation emits Events for UI/debugging

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
