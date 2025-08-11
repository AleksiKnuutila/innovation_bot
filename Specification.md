# **Innovation Web App – Project Specification**

## **Overall Goal**

Create a fully playable digital version of Carl Chudyk’s _Innovation_ (4th edition) as a browser-based application, with:

- A **pure TypeScript game engine** designed for:
    
    - Deterministic rules execution
        
    - Easy integration with both UI and AI bots
        
    - Future **portability to Rust + WASM** for performance and advanced AI
        
- An **initial simple AI bot** that can play against a human
    
- A minimal but functional **UI** for human play in the browser
    
- A **test suite** ensuring rules correctness and deterministic replays
    
- Architecture that can later support:
    
    - Stronger AI via reinforcement learning
        
    - AI models running in-browser via WASM
        
    - Multiple editions/rule variations
        
    - Possibly multiplayer (future)
        

---

## **Version 1 Scope (MVP)**

### **1. Core Game Engine (TypeScript)**

- **Pure logic, no DOM** — runs in Node or browser
    
- Deterministic RNG with seed stored in state
    
- Data contracts for:
    
    - **Actions** (Draw, Meld, Dogma, Dominate)
        
    - **Choices** (mid-resolution prompts like selecting cards, piles, etc.)
        
    - **ChoiceAnswers**
        
    - **Events** (append-only log of game actions)
        
- Turn loop:
    
    1. Player picks Action
        
    2. Engine resolves, possibly returning one or more Choices
        
    3. Player (human or AI) answers Choice
        
    4. Repeat until resolution is complete
        
- Edition toggle (start with 4E rules, but design for future 3E)
    
- Support for ONLY CARDS FROM AGE 1
    
- Event logging for UI + debugging
    
- State serialization/deserialization for replay
    

---

### **2. UI Layer (Browser)**

- Minimal, responsive UI built with **Svelte** (or vanilla TypeScript + HTML if simpler)
    
- Components:
    
    - Player tableau display with splay directions
        
    - Hand view
        
    - Action bar for legal Actions
        
    - Choice prompts (select cards, piles, yes/no, etc.)
        
    - Event log
        
- Reads state and Events from engine
    
- Sends Actions and ChoiceAnswers back to engine
    
- Local 2-player game mode (human vs bot)
    

---

### **3. AI Bot (Simple MVP)**

- Runs in same thread initially
    
- Uses **same API as UI**:
    
    - `legalActions(state, player)`
        
    - `expandChoice(state, choice)`
        
- Simple heuristic: e.g., prefer higher-age melds, draw when no good meld
    
- No hidden info cheating (use `observe` to filter)
    

---

### **4. Testing**

- Golden tests:
    
    - Seed + sequence of inputs → exact final state hash
        
- Property tests:
    
    - Card conservation
        
    - Icon counts match recomputation
        
    - Game ends under valid conditions
        
- Random fuzz tests for stability (no crashes, always terminates)
    

---

## **Design Constraints for Rust Portability**

- **Data primitives**: numeric IDs for players/cards, flat arrays for zones
    
- **Determinism**: all randomness via stored RNG state
    
- **No floating point** in rules
    
- **Pure functions** for all public APIs (return `{ state, events, choices }` without side effects)
    
- Clear separation between:
    
    - **Rules engine** (deterministic logic)
        
    - **Bot logic** (pluggable strategy/evaluation)
        
    - **UI rendering**
        
- Serialization: state encodable into `{ header: JSON, payload: Uint32Array }` for fast Rust interop
    

---

## **Future Phases (Post-MVP)**

1. **Full card set** for chosen edition: Third edition of Innovation
    
2. **Bot improvements**:
    - Pluggable evaluation function (heuristics or NN)
        
3. **Rust + WASM port**:
    
    - Engine logic rewritten in Rust, compiled to WASM for in-browser performance
        
    - Python bindings for offline training
        
4. **Reinforcement Learning**:
    
    - Self-play simulations using Rust engine
        
    - Model export to ONNX and load in browser
        
5. **UI polish**:
    
    - Better animations
        
    - Mobile-friendly layout
        
    - Prebuilt design system (e.g., Skeleton UI or Flowbite-Svelte)
        

---

## **What’s _not_ in MVP**

- Full card set
    
- Multiplayer
    
- Advanced animations
    
- Strong AI
    
- Persistent accounts or cloud saves
    
- Mobile optimization beyond basic responsiveness
    

---
