<script context="module" lang="ts">
  // Helper function to get icon symbols
  function getIconSymbol(icon: string): string {
    const iconMap = {
      'leaf': '🍃',
      'bulb': '💡',
      'crown': '👑',
      'castle': '🏰',
      'factory': '🏭',
      'clock': '⏰'
    };
    return iconMap[icon] || '?';
  }
</script>

<script lang="ts">
  import type { GameData, CardId } from '../../types/index.js';
  import { CARDS } from '../../cards/database.js';
  
  export let cardId: CardId;
  export let gameState: GameData;
  export let isTopCard: boolean = false;
  export let isHandCard: boolean = false;
  export let isScoreCard: boolean = false;
  export let splayDirection: string | undefined = undefined;
  
  // Get card data from database
  $: card = CARDS.cardsById.get(cardId);
  
  // Get color-specific styling
  $: cardColor = getCardColor(card?.color || 'Gray');
  $: splayClass = splayDirection ? `splay-${splayDirection}` : '';
  
  function getCardColor(color: string) {
    const colors = {
      'Red': { bg: '#dc2626', text: 'white' },
      'Blue': { bg: '#2563eb', text: 'white' },
      'Green': { bg: '#16a34a', text: 'white' },
      'Yellow': { bg: '#ca8a04', text: 'black' },
      'Purple': { bg: '#9333ea', text: 'white' },
      'Gray': { bg: '#6b7280', text: 'white' }
    };
    return colors[color] || { bg: '#6b7280', text: 'white' };
  }
  
  // Handle card click
  function handleCardClick() {
    if (isHandCard) {
      console.log(`Selected hand card: ${cardId}`);
      // TODO: Implement card selection for actions
    }
  }
  
  // Handle keyboard events
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleCardClick();
    }
  }
  
  // Get icons from card positions
  function getCardIcons() {
    if (!card) return [];
    
    const icons = [];
    if (card.positions.left !== 'x') icons.push(card.positions.left.toLowerCase());
    if (card.positions.middle !== 'x') icons.push(card.positions.middle.toLowerCase());
    if (card.positions.right !== 'x') icons.push(card.positions.right.toLowerCase());
    
    return icons;
  }
</script>

<div 
  class="card {splayClass} {isTopCard ? 'top-card' : ''} {isHandCard ? 'hand-card' : ''} {isScoreCard ? 'score-card' : ''}"
  style="background-color: {cardColor.bg}; color: {cardColor.text};"
  on:click={handleCardClick}
  on:keydown={handleKeydown}
  role="button"
  tabindex="0"
>
  <div class="card-header">
    <div class="card-age">{card?.age || '?'}</div>
    <div class="card-color">{card?.color || 'Unknown'}</div>
  </div>
  
  <div class="card-name">{card?.title || `Card ${cardId}`}</div>
  
  <div class="card-icons">
    {#each getCardIcons() as icon}
      <span class="icon">{getIconSymbol(icon)}</span>
    {/each}
  </div>
  
  <!-- Splay indicators -->
  {#if splayDirection && isTopCard}
    <div class="splay-indicator {splayDirection}">
      {#if splayDirection === 'left'}
        ←
      {:else if splayDirection === 'right'}
        →
      {:else if splayDirection === 'up'}
        ↑
      {/if}
    </div>
  {/if}
</div>

<style>
  .card {
    width: 80px;
    height: 120px;
    border-radius: 8px;
    padding: 0.5rem;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    transition: all 0.2s ease;
    cursor: pointer;
    border: 2px solid transparent;
    position: relative;
    font-size: 0.75rem;
    font-weight: bold;
  }
  
  .card:hover {
    transform: translateY(-4px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  }
  
  .card:focus {
    outline: 2px solid #4ecdc4;
    outline-offset: 2px;
  }
  
  .hand-card {
    cursor: pointer;
    border-color: #4ecdc4;
  }
  
  .hand-card:hover {
    border-color: #45b7aa;
    transform: translateY(-6px) scale(1.05);
  }
  
  .top-card {
    border-color: #ffd93d;
    box-shadow: 0 0 10px rgba(255, 217, 61, 0.3);
  }
  
  .score-card {
    opacity: 0.8;
    transform: rotate(90deg);
    width: 120px;
    height: 80px;
  }
  
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .card-age {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 50%;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
    font-weight: bold;
  }
  
  .card-color {
    font-size: 0.6rem;
    text-transform: uppercase;
    opacity: 0.8;
  }
  
  .card-name {
    text-align: center;
    font-size: 0.7rem;
    line-height: 1.2;
    flex-grow: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    word-break: break-word;
  }
  
  .card-icons {
    display: flex;
    justify-content: center;
    gap: 0.25rem;
    flex-wrap: wrap;
  }
  
  .icon {
    font-size: 1rem;
    opacity: 0.9;
  }
  
  /* Splay indicators */
  .splay-indicator {
    position: absolute;
    font-size: 1.5rem;
    font-weight: bold;
    opacity: 0.8;
  }
  
  .splay-indicator.left {
    left: -15px;
    top: 50%;
    transform: translateY(-50%);
  }
  
  .splay-indicator.right {
    right: -15px;
    top: 50%;
    transform: translateY(-50%);
  }
  
  .splay-indicator.up {
    top: -15px;
    left: 50%;
    transform: translateX(-50%);
  }
  
  /* Splay classes for visual effects */
  .splay-left {
    border-left: 3px solid #ffd93d;
  }
  
  .splay-right {
    border-right: 3px solid #ffd93d;
  }
  
  .splay-up {
    border-top: 3px solid #ffd93d;
  }
  
  @media (max-width: 768px) {
    .card {
      width: 70px;
      height: 105px;
      font-size: 0.65rem;
    }
    
    .score-card {
      width: 105px;
      height: 70px;
    }
  }
</style> 