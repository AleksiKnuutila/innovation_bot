<script lang="ts">
  import { onMount } from 'svelte';
  import { initializeGame, processAction, processChoice } from '../engine/index.js';
  import type { GameData, PlayerId, Action, Choice, ChoiceAnswer } from '../types/index.js';
  import GameBoard from './components/GameBoard.svelte';
  import ActionBar from './components/ActionBar.svelte';
  import ChoicePrompt from './components/ChoicePrompt.svelte';
  import EventLog from './components/EventLog.svelte';
  
  // Game state
  let gameState: GameData;
  let currentPlayer: PlayerId = 1; // Start with player 1
  let isLoading = true;
  let error: string | null = null;
  
  // Choice handling
  let pendingChoice: Choice | null = null;
  
  // Initialize the game
  onMount(() => {
    try {
      gameState = initializeGame({
        gameId: 'ui-game',
        playerNames: ['Player 0', 'Player 1'],
        rngSeed: Date.now(),
      });
      
      currentPlayer = gameState.phase.currentPlayer;
      isLoading = false;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to initialize game';
      isLoading = false;
    }
  });
  
  // Handle action selection
  function handleActionSelect(action: Action) {
    if (!gameState) return;
    
    try {
      console.log(`Player ${currentPlayer} chose action: ${action.type}`);
      
      // Process the action
      const result = processAction(gameState, action);
      gameState = result.newState;
      
      // Update current player if turn changed
      if (result.newState.phase.currentPlayer !== currentPlayer) {
        currentPlayer = result.newState.phase.currentPlayer;
      }
      
      console.log('Action processed successfully:', result);
      
      // Handle pending choices if they exist
      if (result.pendingChoice) {
        console.log('Pending choice:', result.pendingChoice);
        pendingChoice = result.pendingChoice;
      }
      
    } catch (err) {
      console.error('Error processing action:', err);
      error = err instanceof Error ? err.message : 'Failed to process action';
    }
  }
  
  // Handle choice submission
  function handleChoiceSubmit(choiceAnswer: ChoiceAnswer) {
    if (!gameState || !pendingChoice) return;
    
    try {
      console.log('Processing choice:', choiceAnswer);
      
      // Process the choice
      const result = processChoice(gameState, choiceAnswer);
      gameState = result.newState;
      
      // Update current player if turn changed
      if (result.newState.phase.currentPlayer !== currentPlayer) {
        currentPlayer = result.newState.phase.currentPlayer;
      }
      
      console.log('Choice processed successfully:', result);
      
      // Clear the pending choice
      pendingChoice = null;
      
      // Handle any new pending choices
      if (result.pendingChoice) {
        console.log('New pending choice:', result.pendingChoice);
        pendingChoice = result.pendingChoice;
      }
      
    } catch (err) {
      console.error('Error processing choice:', err);
      error = err instanceof Error ? err.message : 'Failed to process choice';
    }
  }
  
  // Handle time travel
  function handleTimeTravel(eventIndex: number) {
    console.log(`Time traveling to event ${eventIndex}`);
    // TODO: Implement time travel functionality
    // This would involve replaying the game up to the specified event
  }
</script>

<main>
  {#if isLoading}
    <div class="loading">
      <h1>🎮 Innovation</h1>
      <p>Initializing game...</p>
    </div>
  {:else if error}
    <div class="error">
      <h1>❌ Error</h1>
      <p>{error}</p>
      <button on:click={() => window.location.reload()}>Retry</button>
    </div>
  {:else}
    <div class="game-container">
      <header class="game-header">
        <h1>🎮 Innovation</h1>
        <div class="game-info">
          <span>Turn: {gameState.phase.turnNumber}</span>
          <span>Player: {currentPlayer}</span>
          <span>Actions: {gameState.phase.actionsRemaining}</span>
        </div>
      </header>
      
      <!-- Action Bar -->
      <ActionBar 
        {gameState} 
        {currentPlayer} 
        onActionSelect={handleActionSelect}
      />
      
      <!-- Game Board -->
      <GameBoard 
        {gameState} 
        {currentPlayer}
      />
      
      <!-- Event Log -->
      <EventLog 
        {gameState} 
        onTimeTravel={handleTimeTravel}
      />
    </div>
    
    <!-- Choice Prompt (Modal) -->
    {#if pendingChoice}
      <ChoicePrompt 
        choice={pendingChoice}
        {gameState}
        onChoiceSubmit={handleChoiceSubmit}
      />
    {/if}
  {/if}
</main>

<style>
  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    color: white;
    text-align: center;
  }
  
  .loading h1 {
    font-size: 3rem;
    margin-bottom: 1rem;
  }
  
  .error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    color: white;
    text-align: center;
  }
  
  .error h1 {
    font-size: 2rem;
    margin-bottom: 1rem;
    color: #ff6b6b;
  }
  
  .error button {
    margin-top: 1rem;
    padding: 0.5rem 1rem;
    background: #4ecdc4;
    border: none;
    border-radius: 4px;
    color: white;
    cursor: pointer;
    font-size: 1rem;
  }
  
  .error button:hover {
    background: #45b7aa;
  }
  
  .game-container {
    min-height: 100vh;
    padding: 1rem;
  }
  
  .game-header {
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    border-radius: 12px;
    padding: 1rem;
    margin-bottom: 2rem;
    color: white;
    text-align: center;
  }
  
  .game-header h1 {
    font-size: 2.5rem;
    margin-bottom: 0.5rem;
  }
  
  .game-info {
    display: flex;
    justify-content: center;
    gap: 2rem;
    font-size: 1.1rem;
  }
</style> 