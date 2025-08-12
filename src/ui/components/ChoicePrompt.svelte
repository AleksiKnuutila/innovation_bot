<script lang="ts">
  import type { Choice, ChoiceAnswer, GameData } from '../../types/index.js';
  import { expandChoice } from '../../types/choices.js';
  
  export let choice: Choice;
  export let gameState: GameData;
  export let onChoiceSubmit: (answer: ChoiceAnswer) => void;
  
  // Get valid choice options
  $: choiceOptions = expandChoice(choice, gameState);
  
  // Handle choice selection
  function handleChoiceSelect(option: ChoiceAnswer) {
    onChoiceSubmit(option);
  }
  
  // Get choice type description
  function getChoiceDescription(): string {
    switch (choice.type) {
      case 'yes_no':
        return 'Choose Yes or No';
      case 'select_cards':
        return `Select ${choice.minCards} to ${choice.maxCards} card${choice.maxCards !== 1 ? 's' : ''}`;
      case 'select_pile':
        return 'Choose a color pile';
      case 'order_cards':
        return `Order ${choice.cards.length} card${choice.cards.length !== 1 ? 's' : ''}`;
      case 'select_player':
        return 'Choose a player';
      default:
        return 'Make a choice';
    }
  }
  
  // Get choice icon
  function getChoiceIcon(): string {
    switch (choice.type) {
      case 'yes_no':
        return '❓';
      case 'select_cards':
        return '🃏';
      case 'select_pile':
        return '🎨';
      case 'order_cards':
        return '📋';
      case 'select_player':
        return '👤';
      default:
        return '❓';
    }
  }
</script>

<div class="choice-prompt-overlay">
  <div class="choice-prompt">
    <div class="choice-header">
      <div class="choice-icon">{getChoiceIcon()}</div>
      <h3>Choice Required</h3>
      <p class="choice-description">{getChoiceDescription()}</p>
    </div>
    
    <div class="choice-content">
      <div class="choice-message">
        {choice.message}
      </div>
      
      <div class="choice-options">
        {#if choice.type === 'yes_no'}
          <div class="yes-no-options">
            <button 
              class="choice-button yes"
              on:click={() => handleChoiceSelect({ choiceId: choice.id, playerId: choice.playerId, answer: true })}
            >
              ✅ Yes
            </button>
            <button 
              class="choice-button no"
              on:click={() => handleChoiceSelect({ choiceId: choice.id, playerId: choice.playerId, answer: false })}
            >
              ❌ No
            </button>
          </div>
        {:else if choice.type === 'select_cards'}
          <div class="card-selection">
            <p class="selection-hint">
              Select {choice.minCards} to {choice.maxCards} card{choice.maxCards !== 1 ? 's' : ''} from your {choice.from}
            </p>
            <div class="available-cards">
              {#each choice.cards as cardId}
                <div class="selectable-card" data-card-id={cardId}>
                  Card {cardId}
                </div>
              {/each}
            </div>
            <button 
              class="submit-button"
              disabled={true}
              on:click={() => {/* TODO: Implement card selection submission */}}
            >
              Submit Selection
            </button>
          </div>
        {:else if choice.type === 'select_pile'}
          <div class="pile-selection">
            <p class="selection-hint">Choose a color pile:</p>
            <div class="pile-options">
              {#each ['Red', 'Blue', 'Green', 'Yellow', 'Purple'] as color}
                <button 
                  class="pile-button {color.toLowerCase()}"
                  on:click={() => handleChoiceSelect({ 
                    choiceId: choice.id, 
                    playerId: choice.playerId, 
                    selectedColor: color.toLowerCase() 
                  })}
                >
                  {color}
                </button>
              {/each}
            </div>
          </div>
        {:else if choice.type === 'order_cards'}
          <div class="card-ordering">
            <p class="selection-hint">Drag to reorder cards:</p>
            <div class="orderable-cards">
              {#each choice.cards as cardId, index}
                <div class="orderable-card" data-card-id={cardId} data-index={index}>
                  {index + 1}. Card {cardId}
                </div>
              {/each}
            </div>
            <button 
              class="submit-button"
              on:click={() => {/* TODO: Implement card ordering submission */}}
            >
              Submit Order
            </button>
          </div>
        {:else if choice.type === 'select_player'}
          <div class="player-selection">
            <p class="selection-hint">Choose a player:</p>
            <div class="player-options">
              {#each choice.players as playerId}
                <button 
                  class="player-button"
                  on:click={() => handleChoiceSelect({ 
                    choiceId: choice.id, 
                    playerId: choice.playerId, 
                    selectedPlayer: playerId 
                  })}
                >
                  Player {playerId}
                </button>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .choice-prompt-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }
  
  .choice-prompt {
    background: rgba(255, 255, 255, 0.95);
    border-radius: 16px;
    padding: 2rem;
    max-width: 500px;
    width: 100%;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
    color: #333;
  }
  
  .choice-header {
    text-align: center;
    margin-bottom: 2rem;
  }
  
  .choice-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
  }
  
  .choice-header h3 {
    font-size: 1.5rem;
    margin-bottom: 0.5rem;
    color: #1e3c72;
  }
  
  .choice-description {
    color: #666;
    font-size: 1rem;
  }
  
  .choice-content {
    margin-bottom: 1rem;
  }
  
  .choice-message {
    background: #f8f9fa;
    padding: 1rem;
    border-radius: 8px;
    margin-bottom: 1.5rem;
    font-size: 1.1rem;
    text-align: center;
    border-left: 4px solid #4ecdc4;
  }
  
  .choice-options {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .yes-no-options {
    display: flex;
    gap: 1rem;
    justify-content: center;
  }
  
  .choice-button {
    padding: 1rem 2rem;
    border: none;
    border-radius: 8px;
    font-size: 1.1rem;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.2s ease;
    min-width: 120px;
  }
  
  .choice-button.yes {
    background: #10b981;
    color: white;
  }
  
  .choice-button.yes:hover {
    background: #059669;
    transform: translateY(-2px);
  }
  
  .choice-button.no {
    background: #ef4444;
    color: white;
  }
  
  .choice-button.no:hover {
    background: #dc2626;
    transform: translateY(-2px);
  }
  
  .selection-hint {
    text-align: center;
    color: #666;
    margin-bottom: 1rem;
    font-style: italic;
  }
  
  .available-cards, .orderable-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
    gap: 0.5rem;
    margin-bottom: 1rem;
  }
  
  .selectable-card, .orderable-card {
    background: #e5e7eb;
    padding: 0.75rem;
    border-radius: 6px;
    text-align: center;
    cursor: pointer;
    transition: all 0.2s ease;
    border: 2px solid transparent;
  }
  
  .selectable-card:hover, .orderable-card:hover {
    background: #d1d5db;
    border-color: #4ecdc4;
  }
  
  .pile-options, .player-options {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
    gap: 0.5rem;
  }
  
  .pile-button, .player-button {
    padding: 0.75rem;
    border: none;
    border-radius: 6px;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .pile-button.red { background: #dc2626; color: white; }
  .pile-button.blue { background: #2563eb; color: white; }
  .pile-button.green { background: #16a34a; color: white; }
  .pile-button.yellow { background: #ca8a04; color: #333; }
  .pile-button.purple { background: #9333ea; color: white; }
  
  .pile-button:hover, .player-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }
  
  .player-button {
    background: #6b7280;
    color: white;
  }
  
  .submit-button {
    background: #4ecdc4;
    color: white;
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 6px;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.2s ease;
    width: 100%;
  }
  
  .submit-button:hover:not(:disabled) {
    background: #45b7aa;
    transform: translateY(-2px);
  }
  
  .submit-button:disabled {
    background: #9ca3af;
    cursor: not-allowed;
  }
  
  @media (max-width: 768px) {
    .choice-prompt {
      padding: 1.5rem;
      margin: 1rem;
    }
    
    .yes-no-options {
      flex-direction: column;
    }
    
    .choice-button {
      min-width: auto;
    }
  }
</style> 