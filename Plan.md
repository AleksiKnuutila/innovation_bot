Here’s a cleaned-up plan that matches the **Option A (effect stack + synchronous stepper)** architecture.

# Phase 0 — Repo & Workspace

* Create monorepo (pnpm or yarn workspaces)
  `/packages/shared`, `/packages/engine`, `/packages/ui`, `/packages/bot`, `/packages/sim`
* Enable TypeScript strict, ESLint, Prettier
* Add Vitest/Jest + coverage; CI (GitHub Actions)

# Phase 1 — Shared Contracts (the “language”)

* Define IDs: `PlayerID`, `CardID`, `Color`, `Icon` (numeric where possible)
* Define **Actions**: `Draw`, `Meld`, `Dogma`, `Dominate`
* Define **Choices** & **ChoiceAnswer**: `SelectCards`, `SelectPile`, `OrderCards`, `YesNo`, `SelectPlayer`
* Define **Events**: `Drew`, `Melded`, `Splayed`, `Dogma`, `DemandStart`, `Returned`, `Scored`, `Domination`, `GameEnd`
* Define **Observation** (imperfect-info) and **State header** metadata
* Publish `shared` package; others depend on it

# Phase 2 — Engine Skeleton (deterministic stepper core)

* Implement seeded RNG (xoshiro/PCG) stored in `State`
* Model `State` with dense arrays/typed arrays; cache per-player icon counts
* Turn/legality: 2 actions/turn, action validity, domination thresholds
* **Stepper API (no async inside engine):**

  * `startAction(state, action) → NeedChoice | Done`
  * `resumeWithAnswer(state, answer) → NeedChoice | Done`
  * `legalActions(state, player)`, `observe(state, player)`
  * `StepResult` is either `{ kind: "NeedChoice", choice }` or `{ kind: "Done", events }`
* Serializer: `encode(state) → { header, Uint32Array }`, `decode(...)`
* Minimal logging: every mutation emits Events

**DoD Phase 2**

* Deterministic replay: `seed + [Action/ChoiceAnswer...]` reproduces identical Events
* Golden test: scripted game reaches same final state hash reliably

# Phase 3 — Effect Execution & Primitives (effect stack)

* Implement **effect primitives** (data-only):
  `SelectCards`, `MoveFromSelection`, `DrawHighest`, `Splay`, `MoveCard`, `ConditionalSplay`
  *(Optionally add tiny control ops later: `While(pred, body)`, `ForEach(list, body)`)*
* Build the **effect runner/queue (drain loop)**:

  * Pops effects, performs mutations, emits Events
  * On `Select*` → returns `NeedChoice` and saves `{ stack, selections, waiting }` in `state.pending`
  * On resume → stores answer, continues until `Done`
* Centralize symbol comparisons (most/least/at-least, tie rules)
* Implement the functionality of all the cards from age 1. Note that you can read the existing visual basic implementation for a reference, though the architecture is quite different.
* Ensure Events include `source` (card/rule) for explainability

**DoD Phase 3**

* Cards produce standardized Choices (UI renders without special-casing)
* Logs human-readable via message keys + params

# Phase 4 — Testing & Stability

* Golden tests for sample cards (inputs → Events snapshot)
* Property tests:

  * Card conservation (deck+hands+board+score constant)
  * Icon cache == recomputed icons
  * Unique dominations
* Fuzz: random playouts (N games, no throws, termination guaranteed)
* Add `LOG_MIN` vs `LOG_DEBUG` modes

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
