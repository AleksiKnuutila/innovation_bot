<script lang="ts">
  import type { GameData, PlayerId } from '../../types/index.js';
  import Card from './Card.svelte';
  
  export let gameState: GameData;
  export let playerId: PlayerId;
  export let isCurrentPlayer: boolean;
  
  // Get player data
  $: player = gameState.players[playerId];
  $: handCards = player?.hands || [];
  $: colorStacks = player?.colors || [];
  $: scoreCards = player?.scores || [];
  $: achievements = [...(player?.normalAchievements || []), ...(player?.specialAchievements || [])];
  
  // Calculate icon counts
  $: iconCounts = calculateIconCounts(colorStacks);
  
  function calculateIconCounts(colorStacks: any[]) {
    const counts = {
      leaf: 0,
      bulb: 0,
      crown: 0,
      castle: 0,
      factory: 0,
      clock: 0
    };
    
    // TODO: Implement proper icon counting based on splay direction
    // For now, just return placeholder counts
    return counts;
  }
</script>

<div class="player-tableau">
  <div class="player-header">
    <h2 class="player-name {isCurrentPlayer ? 'current' : ''}">
      Player {playerId} {isCurrentPlayer ? '(Current)' : ''}
    </h2>
    <div class="player-stats">
      <span class="stat">Cards: {handCards.length}</span>
      <span class="stat">Score: {scoreCards.length}</span>
      <span class="stat">Achievements: {achievements.length}</span>
    </div>
  </div>
  
  <div class="tableau-content">
    <!-- Color Stacks (Tableau) -->
    <div class="color-stacks">
      <h3>Tableau</h3>
      <div class="stacks-grid">
        {#each colorStacks as stack, index}
          <div class="color-stack">
            <div class="stack-header">
              <span class="color-name">{stack.color}</span>
              <span class="card-count">{stack.cards.length}</span>
            </div>
            {#if stack.cards.length > 0}
              <div class="stack-cards">
                {#each stack.cards.slice(-3) as cardId, cardIndex}
                  <Card 
                    {cardId} 
                    {gameState}
                    isTopCard={cardIndex === stack.cards.length - 1}
                    splayDirection={stack.splayDirection || undefined}
                  />
                {/each}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </div>
    
    <!-- Hand -->
    <div class="hand-section">
      <h3>Hand ({handCards.length})</h3>
      <div class="hand-cards">
        {#each handCards as cardId}
          <Card {cardId} {gameState} isHandCard={true} />
        {/each}
      </div>
    </div>
    
    <!-- Score Pile -->
    <div class="score-section">
      <h3>Score ({scoreCards.length})</h3>
      <div class="score-cards">
        {#each scoreCards as cardId}
          <Card {cardId} {gameState} isScoreCard={true} />
        {/each}
      </div>
    </div>
    
    <!-- Achievements -->
    <div class="achievements-section">
      <h3>Achievements ({achievements.length})</h3>
      <div class="achievements-list">
        {#each achievements as achievementId}
          <div class="achievement">
            Achievement {achievementId}
          </div>
        {/each}
      </div>
    </div>
    
    <!-- Icon Summary -->
    <div class="icon-summary">
      <h3>Icons</h3>
      <div class="icon-grid">
        <div class="icon-item">
          <span class="icon">🍃</span>
          <span class="count">{iconCounts.leaf}</span>
        </div>
        <div class="icon-item">
          <span class="icon">💡</span>
          <span class="count">{iconCounts.bulb}</span>
        </div>
        <div class="icon-item">
          <span class="icon">👑</span>
          <span class="count">{iconCounts.crown}</span>
        </div>
        <div class="icon-item">
          <span class="icon">🏰</span>
          <span class="count">{iconCounts.castle}</span>
        </div>
        <div class="icon-item">
          <span class="icon">🏭</span>
          <span class="count">{iconCounts.factory}</span>
        </div>
        <div class="icon-item">
          <span class="icon">⏰</span>
          <span class="count">{iconCounts.clock}</span>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .player-tableau {
    background: rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 1.5rem;
    color: white;
  }
  
  .player-header {
    margin-bottom: 1.5rem;
    text-align: center;
  }
  
  .player-name {
    font-size: 1.5rem;
    margin-bottom: 0.5rem;
    color: #4ecdc4;
  }
  
  .player-name.current {
    color: #ffd93d;
    text-shadow: 0 0 10px rgba(255, 217, 61, 0.5);
  }
  
  .player-stats {
    display: flex;
    justify-content: center;
    gap: 1rem;
    font-size: 0.9rem;
  }
  
  .stat {
    background: rgba(255, 255, 255, 0.1);
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
  }
  
  .tableau-content {
    display: grid;
    gap: 1.5rem;
  }
  
  .tableau-content h3 {
    font-size: 1.1rem;
    margin-bottom: 0.75rem;
    color: #b8c5d6;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    padding-bottom: 0.25rem;
  }
  
  .stacks-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 1rem;
  }
  
  .color-stack {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    padding: 0.75rem;
    text-align: center;
  }
  
  .stack-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
    font-size: 0.9rem;
  }
  
  .color-name {
    font-weight: bold;
    text-transform: capitalize;
  }
  
  .card-count {
    background: rgba(255, 255, 255, 0.2);
    padding: 0.1rem 0.4rem;
    border-radius: 10px;
    font-size: 0.8rem;
  }
  
  .stack-cards {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .hand-cards, .score-cards {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  
  .achievements-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  
  .achievement {
    background: #ffd93d;
    color: #333;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.8rem;
    font-weight: bold;
  }
  
  .icon-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.75rem;
  }
  
  .icon-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    background: rgba(255, 255, 255, 0.05);
    padding: 0.5rem;
    border-radius: 6px;
  }
  
  .icon {
    font-size: 1.5rem;
    margin-bottom: 0.25rem;
  }
  
  .count {
    font-weight: bold;
    color: #4ecdc4;
  }
  
  @media (max-width: 768px) {
    .player-tableau {
      padding: 1rem;
    }
    
    .stacks-grid {
      grid-template-columns: repeat(2, 1fr);
    }
    
    .icon-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style> 