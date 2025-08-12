<script lang="ts">
  import type { GameData, PlayerId, Action } from '../../types/index.js';
  import { getLegalActions } from '../../engine/index.js';
  
  export let gameState: GameData;
  export let currentPlayer: PlayerId;
  export let onActionSelect: (action: Action) => void;
  
  // Get legal actions for current player
  $: legalActions = getLegalActions(gameState, currentPlayer);
  
  // Handle action button click
  function handleActionClick(action: Action) {
    onActionSelect(action);
  }
  
  // Get action button styling
  function getActionStyle(actionType: string) {
    const styles = {
      'draw': { bg: '#3b82f6', hover: '#2563eb' },
      'meld': { bg: '#10b981', hover: '#059669' },
      'dogma': { bg: '#f59e0b', hover: '#d97706' },
      'achieve': { bg: '#8b5cf6', hover: '#7c3aed' }
    };
    return styles[actionType] || { bg: '#6b7280', hover: '#4b5563' };
  }
  
  // Get action description
  function getActionDescription(actionType: string): string {
    const descriptions = {
      'draw': 'Draw cards from supply piles',
      'meld': 'Play cards to your tableau',
      'dogma': 'Activate card effects',
      'achieve': 'Claim achievements'
    };
    return descriptions[actionType] || 'Perform game action';
  }
</script>

<div class="action-bar">
  <div class="action-bar-header">
    <h3>Available Actions</h3>
    <div class="action-count">
      {legalActions.length} action{legalActions.length !== 1 ? 's' : ''} available
    </div>
  </div>
  
  <div class="actions-grid">
    {#each legalActions as action}
      {@const style = getActionStyle(action.type)}
      <button
        class="action-button {action.type}"
        style="background-color: {style.bg}"
        on:click={() => handleActionClick(action)}
        on:keydown={(e) => e.key === 'Enter' && handleActionClick(action)}
        tabindex="0"
      >
        <div class="action-icon">
          {#if action.type === 'draw'}
            📚
          {:else if action.type === 'meld'}
            🎯
          {:else if action.type === 'dogma'}
            ⚡
          {:else if action.type === 'achieve'}
            🏆
          {/if}
        </div>
        <div class="action-content">
          <div class="action-name">{action.type.toUpperCase()}</div>
          <div class="action-description">{getActionDescription(action.type)}</div>
        </div>
      </button>
    {/each}
  </div>
  
  {#if legalActions.length === 0}
    <div class="no-actions">
      <p>No actions available at this time.</p>
      <p class="hint">Wait for your turn or resolve pending choices.</p>
    </div>
  {/if}
</div>

<style>
  .action-bar {
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    border-radius: 12px;
    padding: 1.5rem;
    color: white;
    margin-bottom: 2rem;
  }
  
  .action-bar-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }
  
  .action-bar-header h3 {
    font-size: 1.3rem;
    color: #4ecdc4;
    margin: 0;
  }
  
  .action-count {
    background: rgba(255, 255, 255, 0.1);
    padding: 0.5rem 1rem;
    border-radius: 20px;
    font-size: 0.9rem;
    color: #b8c5d6;
  }
  
  .actions-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1rem;
  }
  
  .action-button {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    border: none;
    border-radius: 10px;
    color: white;
    cursor: pointer;
    transition: all 0.3s ease;
    text-align: left;
    font-family: inherit;
  }
  
  .action-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  }
  
  .action-button:focus {
    outline: 2px solid #4ecdc4;
    outline-offset: 2px;
  }
  
  .action-button:active {
    transform: translateY(0);
  }
  
  .action-icon {
    font-size: 2rem;
    flex-shrink: 0;
  }
  
  .action-content {
    flex-grow: 1;
  }
  
  .action-name {
    font-size: 1.1rem;
    font-weight: bold;
    margin-bottom: 0.25rem;
  }
  
  .action-description {
    font-size: 0.9rem;
    opacity: 0.9;
    line-height: 1.3;
  }
  
  /* Action-specific hover effects */
  .action-button.draw:hover {
    background-color: #2563eb !important;
  }
  
  .action-button.meld:hover {
    background-color: #059669 !important;
  }
  
  .action-button.dogma:hover {
    background-color: #d97706 !important;
  }
  
  .action-button.achieve:hover {
    background-color: #7c3aed !important;
  }
  
  .no-actions {
    text-align: center;
    padding: 2rem;
    color: #b8c5d6;
  }
  
  .no-actions p {
    margin: 0.5rem 0;
  }
  
  .hint {
    font-size: 0.9rem;
    opacity: 0.7;
    font-style: italic;
  }
  
  @media (max-width: 768px) {
    .action-bar {
      padding: 1rem;
    }
    
    .action-bar-header {
      flex-direction: column;
      gap: 1rem;
      text-align: center;
    }
    
    .actions-grid {
      grid-template-columns: 1fr;
    }
    
    .action-button {
      padding: 0.75rem;
    }
    
    .action-icon {
      font-size: 1.5rem;
    }
  }
</style> 