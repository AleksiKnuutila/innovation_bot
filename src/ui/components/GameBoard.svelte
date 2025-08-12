<script lang="ts">
  import type { GameData, PlayerId } from '../../types/index.js';
  import PlayerTableau from './PlayerTableau.svelte';
  
  export let gameState: GameData;
  export let currentPlayer: PlayerId;
  
  // Get all player IDs
  $: playerIds = Object.keys(gameState.players).map(Number) as PlayerId[];
</script>

<div class="game-board">
  <div class="tableaus-container">
    {#each playerIds as playerId}
      <div class="player-tableau-wrapper {playerId === currentPlayer ? 'current-player' : ''}">
        <PlayerTableau 
          {gameState} 
          {playerId} 
          isCurrentPlayer={playerId === currentPlayer}
        />
      </div>
    {/each}
  </div>
  
  <div class="game-controls">
    <div class="game-info-panel">
      <h3>Game Status</h3>
      <div class="info-grid">
        <div class="info-item">
          <span class="label">Phase:</span>
          <span class="value">{gameState.phase.state}</span>
        </div>
        <div class="info-item">
          <span class="label">Turn:</span>
          <span class="value">{gameState.phase.turnNumber}</span>
        </div>
        <div class="info-item">
          <span class="label">Actions Left:</span>
          <span class="value">{gameState.phase.actionsRemaining}</span>
        </div>
        <div class="info-item">
          <span class="label">Current Player:</span>
          <span class="value">Player {currentPlayer}</span>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .game-board {
    display: flex;
    flex-direction: column;
    gap: 2rem;
    max-width: 1400px;
    margin: 0 auto;
    padding: 1rem;
  }
  
  .tableaus-container {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
    gap: 2rem;
  }
  
  .player-tableau-wrapper {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 12px;
    padding: 1rem;
    border: 2px solid transparent;
    transition: all 0.3s ease;
  }
  
  .player-tableau-wrapper.current-player {
    border-color: #4ecdc4;
    background: rgba(78, 205, 196, 0.1);
    box-shadow: 0 0 20px rgba(78, 205, 196, 0.3);
  }
  
  .game-controls {
    display: flex;
    justify-content: center;
  }
  
  .game-info-panel {
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    border-radius: 12px;
    padding: 1.5rem;
    color: white;
    min-width: 300px;
  }
  
  .game-info-panel h3 {
    text-align: center;
    margin-bottom: 1rem;
    font-size: 1.3rem;
    color: #4ecdc4;
  }
  
  .info-grid {
    display: grid;
    gap: 0.75rem;
  }
  
  .info-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 6px;
  }
  
  .label {
    font-weight: 500;
    color: #b8c5d6;
  }
  
  .value {
    font-weight: bold;
    color: white;
  }
  
  @media (max-width: 768px) {
    .tableaus-container {
      grid-template-columns: 1fr;
    }
    
    .game-board {
      padding: 0.5rem;
    }
  }
</style> 