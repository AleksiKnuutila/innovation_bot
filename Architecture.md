# Architecture Overview

## Goals

- Single deterministic game rules engine shared by UI and AI bot.
- Clear split between **Actions** (top-level turn decisions) and **Choices** (in-turn prompts).
- Standardized **Events** log for replay/debug/UI.

## Core Components

- **Engine** – headless deterministic rules + RNG + card effects; no DOM/timers.
- **UI** – renders state, events, and prompts; sends Actions/ChoiceAnswers to engine.
- **AI Bot** – decision-maker using same API as UI; runs in main thread or worker.
- **Shared** – types, constants, encoders; no dependencies on engine/UI.
- Services - serialisation and saving of state

# monorepo layout (pnpm/yarn workspaces)

`/packages   
  /shared           # types, constants, encoders (no deps on engine/ui)   
  /engine           # core game + effect runner; exports pure APIs
  /bot              # MCTS/heuristics; depends on shared + engine types only 
  /sim              # headless simulator for training/fuzz/property tests   
  /ui               # /Svelte app; consumes shared + engine`

# Data Contracts

The following

- Identifiers (Players, Cards, Colours, Icons)
- Actions (Draw, Meld, Dogma, Achieve with parameters)
- **Choices (Mid-Resolution Prompts, eg. SelectCards, SelectPile, Yes/No, OrderPile..)**
- Choice Answers
- Zones (hand, board, score, deck, achievements, ...)
- Filter (byAge, byColor, ...)
- Events (StartTurn, Draw, Score, ...)

# Engine API

**Synchronous stepper that either completes or pauses for a single Choice.**
- `startAction(state, action) -> StepResult`
- `resumeWithAnswer(state, answer) -> StepResult`
- `StepResult` is:
    - `{ kind: "NeedChoice", choice: Choice }` — engine paused; host must collect an answer
    - `{ kind: "Done", events: Event[] }` — action fully resolved; control passes to turn flow

_(Optional convenience)_: a `runUntilPause(state, action)` helper can call `startAction` once and return either `NeedChoice` or `Done` for ease of integration; tests/replay drive the stepper explicitly.

## Why this arrangement (Effect Queue + Stepper)?

- **Innovation dogmas pause mid-resolution** (e.g., “opponent chooses a card”, then later the active player chooses something). A pure “run-to-completion” function can’t block inside the engine—especially not in WASM.
    
- A tiny **effect queue + stepper** solves this cleanly: the engine runs synchronously until a decision point, **returns** a `Choice` to the host (UI/bot), and later **resumes** from exactly where it left off with the provided `ChoiceAnswer`. No async/await inside the engine, no UI leaks into rules, and it ports 1:1 to Rust→WASM.
    
- This keeps your engine **deterministic**, **testable**, and **portable**: same seed + same inputs → same events/outcome; Rust can mirror the exact loop with an enum and a `Vec`.

## Indicative list of modules inside `/engine`

/engine
/api                 → Public. Stepper-facing API: startAction, resumeWithAnswer, legalActions, observe.
                         (Calls the effect runner; never touches UI.)
  /types          → Public. Shared contracts (Action, Choice, ChoiceAnswer, Event, IDs, enums).
  /constants      → Public. Fixed values: editions, icon/color enums, thresholds.
  /serializer     → Public. State encode/decode/hash for saves, replay, and interop.
  /cards          → Public (metadata) + Internal (handlers).
    /handlers     → Internal. Per-card dogma/effect code; registered by id.
  /selectors      → Public. Pure read-only queries (no mutation); safe for UI/bot.
  /state          → Internal. Core State shape, caches, initialization.
  /rng            → Internal. Seeded RNG implementation/wrappers (deterministic).
  /rules          → Mixed. Turn flow, validation, endgame, edition toggles.
                    (Expose only validation helpers if you want UI tooltips.)
  /mutations      → Internal. Primitive state changes (moveCard, draw, meld, score, splay).
/effects             → Internal. **Queue/Stepper lives here.**
    /primitives        → Tiny effect types & helpers (selectCards, moveFromSelection, drawHighest, conditionalSplay, …).
    /control           → Optional minimal control effects (while/forEach/if) that expand by pushing to the stack.
    /runner            → **Effect runner (drain loop / stepper):**
                         - pops Effects, performs mutations,
                         - returns NeedChoice(choice) and saves /state/pending,
                         - on resume, consumes stored selection and continues to Done.
  /choices        → Mixed. Create/validate/expand choices.
                    (Expose only “expand” to list legal answers for UI/bot.)
  /events         → Internal. Canonical event emission (+ optional debug diffs).
  /replay         → Public. Transcript format and deterministic replayer.
  /testing        → Internal (dev-only). Golden fixtures, fuzz/property test helpers.

## Engine modules

## 1) Card properties & selectors → `cards/` + `selectors/`

- `cards/cards.json` (metadata): `{id, age, color, title, icons[], dogmaIcon, text, editionFlags…}`
    
- `cards/index.ts`: typed accessors and the **registry** `CARD: Record<CardID, CardDef>`
    
- `selectors/`: pure **queries** (no mutation)
    
    - `getCard(id)`, `getAge(id)`, `getColor(id)`
        
    - `hasIcon(cardId, icon)`, `highestTopCard(player)`
        
    - `iconTotals(state, player)` (or use cached values)
        

> Pattern: keep “what is true?” (selectors) separate from “do a thing” (mutations).

## 2) Game state management → `state/` + `cache/` + **no UI here**

- `state/State.ts`: dense, numeric structures (typed arrays), RNG state.
    
- `cache/`: recompute helpers + **incremental updaters**:
    
    - `recountIcons(state, player)`, `recountScores(state, player)`
        
    - Or **invalidate-on-change** in mutations (faster).
        
- **No** `update_display()` in engine. UI renders from `State` + `Events`.
    
- `persistence/`: `saveGame(state)`, `loadGame(blob)`.
    

## 3) Action validation → `rules/validation.ts`

- `canAchieve(state, player, age) -> Result<void, Code>`
    
- `canSplay(state, player, color, dir) -> Result<void, Code>`
    
- `winnerFound(state) -> PlayerID | null`
    
- Return error **codes** (machine-readable); UI localizes messages.
    

## 4) Core mechanics (primitives) → `mutations/` + `effects/`

- `mutations/`: **single generic transfer** + typed wrappers (no explosion of variants):

moveCard(state, {from: ZoneRef, to: ZoneRef, position: "top"|"bottom"})
draw(state, player, {ageRel: "highest"|number, n: 1})
meld(state, player, cardId)
score(state, player, cardId)
tuck(state, player, cardId, color)
splay(state, player, color, dir)

- Each updates caches + emits **Events**.
    
- `effects/` (the “embedded DSL” helpers, still imperative TS):
    
    - `selectCards`, `ifSymbols`, `demand(target, subEffects)`, etc.
        
    - Standardize **Choices** & **Events** so UI and bot don’t special-case per card.


### Effect queue + standardized Choices

- Dogma resolves through the **effect queue**; each effect may mutate state, **pause with a Choice**, or **enqueue** more effects.
- Choices always come from a small set (`SelectCards`, `SelectPile`, `OrderCards`, `YesNo`, `SelectPlayer`) with predictable filters—UI and bot can enumerate/legalize identically.

### How the Effect Queue Works (precise mechanics)

**Data it keeps**

- `stack: Effect[]` — LIFO list of remaining work for the current Action.
    
- `selections: Record<choiceId, { cards: CardID[], from: ZoneRef }>` — answers collected so far.
    
- `waiting?: choiceId` — which choice (if any) we paused on.
    
- _(Optionally)_ tiny locals for control effects (e.g., loop indices), but prefer **pre-expansion** in card builders.
    

**Drain loop (stepper)**

1. Pop the next `Effect`.
    
2. If it’s a **mutation primitive** (`draw`, `moveCard`, `splay`…), apply it; emit `Event`s; continue.
    
3. If it’s a **Select*** effect, construct a `Choice`, set `waiting = choiceId`, **return** `NeedChoice(choice)`.
    
4. If it’s a **post-selection** effect (e.g., `moveFromSelection`), read the stored selection and apply it.
    
5. For any **control op** you include (e.g., `while`, `forEach`), the runner **pushes** more effects onto `stack` (e.g., re-push the `while` and one body step).
    
6. When `stack` empties, clear `pending` and **return** `Done(events)`.
    

**Pause & resume**

- `startAction(...)` initializes `pending.stack` from the card’s built effects and calls the drain loop.
    
- On `NeedChoice`, the host (UI/bot) shows the prompt and later calls `resumeWithAnswer(state, answer)`.
    
- `resumeWithAnswer` stores the answer into `selections[choiceId]`, clears `waiting`, and calls the drain loop again.
    

**Building effects (no DSL required)**

- **Prefer pre-expansion in card builders** using normal TS control flow:
    - _For each opponent …_ → loop and push a `Select` + `MoveFromSelection` pair per target (snapshot targets at start for determinism).
    - _If condition …_ → compute condition now and push (or push a `conditionalSplay` that checks at execution time).
    - _While hand < 3 …_ → either push `DrawHighest` repeatedly now, or use one tiny generic `while(pred, body)`that pushes itself + body.
- Keep effects **data-only** (no closures). This keeps everything serializable and Rust-portable.
- Only add a **card-specific effect** when the behavior is truly unique; keep it tiny and data-only.
- Always **snapshot lists** for multi-target steps (e.g., opponents with fewer 🏰) at the start, and pass the concrete array to your builder or a `ForEach` control. That makes ordering/resume deterministic.
- No functions in effects; evaluate predicates in the runner. That’s what makes the Rust port trivial (enums + `Vec` + `match`).


### 5) Game flow control → `rules/turn.ts` + `api.ts`

- `rules/turn.ts`: turn counters, two actions/turn, action legality, dominance thresholds, auto-claim windows.
    
- `api.ts` (single entry point):
    
    - `reset(seed)`
        
    - `legalActions(state, player)`
        
    - **Stepper**: `startAction(state, Action)` → `NeedChoice | Done`
        
    - **Stepper**: `resumeWithAnswer(state, ChoiceAnswer)` → `NeedChoice | Done`
        
    - The **effect queue** (pending continuation) lives here: resume dogma, multi-step prompts.
        

## 6) Card effects → `cards/handlers/`

- **Registry**: `CARD[id].dogma(ctx): Effect[] | void`
    
- No giant `if/else`. Each card has its own tiny file or entry.
    
- Use primitives for 80% cases; fall back to custom imperative code for weird cards.
    
- Attach `source: {card:id}` so logs/explanations are consistent.
    

## 7) End game detection → `rules/endgame.ts`

- `checkDominations(state)`, `checkSpecialWins(state)`, `winnerFound(state)`
    
- Called after each **resolution** (end of Action/Choice chain) or on specific Events.
    

## Cross-cutting

- `choices/`: creators/validators; stable `choiceId`, filters.
    
- `events/`: canonical shapes; optionally include **diff summaries** in debug.
    
- `serializer/`: `{header, payload}` (typed arrays) for replay/interop.
    
- `replay/`: apply inputs deterministically for debugging/tests.


## Good practice patterns for engine

### A. Commands vs. Queries

- **Queries/selectors** never mutate; they read derived facts.
    
- **Mutations/commands** change state and **must**:
    
    1. update caches,
        
    2. maintain invariants,
        
    3. emit Events.
        
- Validation lives in `rules/validation.ts`; `mutations/` assume input is legal (the API checks first).

### One transfer to rule them all

Instead of dozens of `transfer_*` variants, implement **one** `moveCard()` with `ZoneRef`:

type ZoneRef =
  | { zone:"hand"; player:PID }
  | { zone:"board"; player:PID; color?:Color }
  | { zone:"score"; player:PID }
  | { zone:"deck"; age:number }
  | { zone:"achievements"|"domains" };

All card movement composes from this. Add thin wrappers (`meld`, `tuck`, `score`) for readability.

## C. Event sourcing for explainability

- Every mutation emits an `Event` with `source` (card or rule ref).
    
- UI builds the human log from Events; bots can ignore or consume as needed.
    
- Optional debug: attach **diff** (e.g., “hand: +2, score: +1(5 influence)”).
    

## D. Determinism & RNG

- Single seeded RNG in `State`; resolved by the API only.
    
- No floats; integers only for influence/thresholds.
    
- Replays: `{seed, inputs[]}` must reproduce the same Events & outcome.
    

## E. Card handlers without a 1000-line file

- Dispatch by `CARD[id].dogma`.
    
- Keep handlers tiny: assemble primitives + small `if/else`.
    
- Promote repeating patterns to helpers (draw→compare→splay; demand→return→score).
    
- Keep an **escape hatch**: a handler can call custom code if truly unique.
    

## F. Auto-claim windows (achievements, special wins)

- Central rule step after each resolution:
    
    1. `checkSpecialAchievements()` (auto-claim)
        
    2. `checkDominations()`
        
    3. `winnerFound()`
        
- Emit Events (`Domination`, `GameEnd`) from there—**not** from card files.
    

## G. Validation results (for UI)

- All `can*` functions return `Ok` or `Err(code, fields)`—UI gets structured reasons to disable buttons or show messages.
    

## H. Testing hooks & fast sims

- Public API is the **stepper**; tests drive `startAction`/`resumeWithAnswer`.
    
- Internal `applyUnchecked` for bots/rollouts after a legal move is chosen.
    
- Provide `cloneInto(dst, src)` to avoid GC churn in sims.
    
- Golden tests (scripted turns) + property tests (conservation, icon caches, uniqueness).    

---

## Action → Choices → ChoiceAnswer loop

1. UI/bot sends Action → engine starts resolution.
2. Engine returns Choices if more input is needed.
3. UI/bot answers with ChoiceAnswer → engine continues.
4. Repeat until no Choices remain.

# UI (frontend)

- **state mgmt:** pull from engine outputs; no hidden rule state. a tiny adapter maps `choices` → highlights/tooltips.
- **renderer:** board/tableau, splay viz, symbol tallies, card inspector.
- **controller:** translates clicks to `Intent` or `ChoiceAnswer`.
- **log viewer:** renders `Event[]` with message keys (i18n-ready).
- **replay/undo:** step through event indices (time travel).

# Bot (AI)

- **action generator:** consumes `legalIntents(state,p)` and `expandChoice(choice)`.
- **search:** start with heuristic or IS-MCTS; later add NN-guided priors/values.
- **rollouts:** uses engine’s fast clone/apply helpers (or `stepMany` batching).
- **policy hooks:** `evaluate(observation)` pluggable; swaps between heuristic and other forms of making choices (later AI)

# State Design (Rust-Friendly)

- **Numeric IDs** for cards/players (u16/u32 size).
- Zones stored in `Uint16Array` or dense arrays (top/bottom explicit).
- Cache icon counts per player.
- Store RNG state in `State`.
- Include `schemaVersion` for migrations.
- Provide encode/decode to `{ header: JSON, payload: Uint32Array }`.

# Card Effect Primitives

Card effects are defined, as far as possible, with "primitives". These include the following:

**Card Movement Primitives**

**Draw Operations:**

- draw(player) - Draw a card from appropriate age pile
- draw_num(player, num) - Draw from specific age
- draw_and_score(player, num) - Draw then immediately score
- draw_and_meld(player, num) - Draw then immediately meld
- draw_and_tuck(player, num) - Draw then immediately tuck

**Meld Operations:**

- meld(player, id) - Place card on top of color stack on board
- meld_from_hand(player, index) - Meld specific card from hand

**Score Operations:**

- score(player, id) - Add card to score pile
- score_from_hand(player, index) - Score specific card from hand
- score_top_card(player, index) - Score top card from board stack

**Tuck Operations:**

- tuck(player, id) - Place card at bottom of color stack
- tuck_from_hand(player, index) - Tuck specific card from hand

**Transfer Operations**

- transfer_card_in_hand(from_player, to_player, index) - Move card between hands
- transfer_card_from_score(from_player, to_player, index) - Move from score pile
- transfer_card_on_board(from_player, to_player, index) - Move cards between boards
- transfer_board_to_score(from_player, to_player, index) - Board card to score
- transfer_board_to_hand(from_player, to_player, index) - Board card to hand
- transfer_score_to_hand(player, index) - Score pile to hand

**Board Manipulation**

- splay(player, color_index, direction) - Splay color stack ("Left", "Right", "Up")
- return_from_hand(player, index) - Return card to appropriate age pile
- return_from_board(player, index) - Return top board card to pile
- return_from_score_pile(player, index) - Return score card to pile

**Achievement Operations**

- achieve(player, num) - Claim numbered achievement (1-10)
- achieve_special(player, index, name) - Claim special achievement
- can_achieve(player, num) - Check if achievement requirements met

**Helper Functions**

- get_highest_card_in_hand(player) - Find highest age card
- get_lowest_card_in_hand(player) - Find lowest age card
- find_card(player, id) - Locate specific card in hand
- icon_total(player, symbol) - Count symbols on board
- card_has_symbol(card_id, symbol) - Check if card has symbol

# Actions (Top-Level)

Chosen by active player at start of turn.

- **Definition**: The _top-level action_ a player declares on their turn.
- **Examples in Innovation**:
    - `"Draw"` (draw from deck)
    - `"Meld"` a specific card
    - `"Dogma"` a specific card
    - `"Dominate"` a specific age or special achievement
- **Characteristics**:
    - Always comes from the “main menu” of your turn.
    - Fully legal by itself — you can validate it immediately against the rules.
    - Triggers _resolution logic_ inside the engine (e.g., executing a Dogma effect).

# Choices (Mid-Resolution Prompts)

- **Definition**: _Follow-up decisions_ needed while resolving an intent or another game effect.
- **Examples**:
    - “Select 1 card from your hand to return” (demand)
    - “Select a pile to splay right” (dogma effect)
    - “Order these 3 cards” (echo effect)
    - “Choose Yes/No” (optional effect)
- **Characteristics**:
    - Created _by the engine_ during effect resolution, often in a sequence.
    - Each choice is a **structured object**:
        - unique `choiceId`
        - prompt type (`SelectCards`, `SelectPile`, etc.)
        - constraints (min/max, filter by color, age, symbol count)
        - target zones/players
    - The UI highlights valid options; the bot enumerates them.
    - When the player/bot answers, you feed the answer back into the engine.
    - The engine either:
        - Applies the effect immediately and returns new state/events
        - Or returns _more_ choices if the effect chains

# Choice Answers
### **Choice Answers**

Submitted by UI/bot to resume resolution. Example of what it could look like (not definitive):

`type ChoiceAnswer =   | { choiceId: string; kind: "SelectCards"; cards: CardID[] }   | { choiceId: string; kind: "SelectPile"; color: Color }   | { choiceId: string; kind: "OrderCards"; order: CardID[] }   | { choiceId: string; kind: "YesNo"; yes: boolean }   | { choiceId: string; kind: "SelectPlayer"; player: PlayerID };`

### **Zones & Filters**

Example of what it could look like (not definitive):

`type ZoneRef =   | { zone: "hand"; player: PlayerID }   | { zone: "board"; player: PlayerID; color?: Color }   | { zone: "score"; player: PlayerID }   | { zone: "deck"; age: number }   | { zone: "achievements" | "domains" };  interface Filter {   byAge?: { min?: number; max?: number };   byColor?: Color[];   byIconAtLeast?: { icon: Icon; count: number }; }`

### **Events**

Example of what it could look like (not definitive):

`type Event =   | { t: "StartTurn"; p: PlayerID }   | { t: "Drew"; p: PlayerID; card: CardID; age: number; from: ZoneRef; to: ZoneRef }   | { t: "Melded"; p: PlayerID; card: CardID; color: Color }   | { t: "Splayed"; p: PlayerID; color: Color; dir: SplayDir }   | { t: "Dogma"; p: PlayerID; card: CardID }   | { t: "DemandStart"; from: PlayerID; to: PlayerID; card: CardID }   | { t: "Returned"; p: PlayerID; card: CardID; from: ZoneRef; to: ZoneRef }   | { t: "Scored"; p: PlayerID; cards: CardID[]; influenceDelta: number }   | { t: "Domination"; p: PlayerID; age: number }   | { t: "GameEnd"; reason: "dominations" | "effect" | "deckExhausted" };`

## Action → Choice → Answer Game Loop (with Stepper)

1. UI/bot submits an **Action** → engine runs the effect queue.
2. Engine returns **`NeedChoice`** with a single `Choice` when input is required.
3. UI/bot submits a **`ChoiceAnswer`** (matching `choiceId`) → engine resumes from the saved queue.
4. Repeat until the engine returns **`Done`**; then proceed with turn flow (e.g., second action, end-of-turn checks).
5. All state deltas emit **Events**.

> Constraint: Choices must be **re-computable** from state (idempotent), but we include `choiceId` for precise continuity and logs.
# Logging & Replay

- Every state change during resolution emits an `Event`.
- Provide `replay(seed, inputs[])` that reproduces the exact game.
- Offer `LOG_MIN | LOG_DEBUG` levels; DEBUG may attach diffs (counts before/after by zone).
