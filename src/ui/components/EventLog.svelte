<script lang="ts">
  import type { GameData, GameEvent } from '../../types/index.js';
  
  export let gameState: GameData;
  export let onTimeTravel: (eventIndex: number) => void;
  
  // Get events from game state
  $: events = gameState.eventLog?.events || [];
  $: currentEventIndex = events.length - 1;
  
  // Time travel state
  let timeTravelIndex: number = currentEventIndex;
  let showTimeTravel = false;
  
  // Handle time travel
  function handleTimeTravel(index: number) {
    timeTravelIndex = index;
    onTimeTravel(index);
  }
  
  // Get event icon
  function getEventIcon(event: GameEvent): string {
    switch (event.type) {
      case 'start_turn':
        return '🔄';
      case 'end_turn':
        return '⏹️';
      case 'drew':
        return '📚';
      case 'melded':
        return '🎯';
      case 'scored':
        return '🏆';
      case 'tucked':
        return '📥';
      case 'returned':
        return '📤';
      case 'transferred':
        return '🔄';
      case 'splayed':
        return '📐';
      case 'game_end':
        return '🏁';
      default:
        return '📝';
    }
  }
  
  // Get event description
  function getEventDescription(event: GameEvent): string {
    switch (event.type) {
      case 'start_turn':
        return `Player ${event.playerId}'s turn started`;
      case 'end_turn':
        return `Player ${event.playerId}'s turn ended`;
      case 'drew':
        return `Player ${event.playerId} drew card ${event.cardId} from age ${event.fromAge}`;
      case 'melded':
        return `Player ${event.playerId} melded card ${event.cardId}`;
      case 'scored':
        return `Player ${event.playerId} scored card${event.cardIds.length > 1 ? 's' : ''} ${event.cardIds.join(', ')}`;
      case 'tucked':
        return `Player ${event.playerId} tucked card ${event.cardId}`;
      case 'returned':
        return `Card ${event.cardId} returned to supply`;
      case 'transferred':
        return `Card ${event.cardId} transferred from player ${event.fromPlayer} to player ${event.toPlayer}`;
      case 'splayed':
        return `Player ${event.playerId} splayed ${event.color} ${event.direction}`;
      case 'game_end':
        return `Game ended - ${event.winner !== null ? `Player ${event.winner} won` : 'No winner'}`;
      default:
        return 'Game event occurred';
    }
  }
  
  // Get event timestamp
  function getEventTime(event: GameEvent): string {
    if (event.timestamp) {
      return new Date(event.timestamp).toLocaleTimeString();
    }
    return '';
  }
  
  // Toggle time travel mode
  function toggleTimeTravel() {
    showTimeTravel = !showTimeTravel;
    if (!showTimeTravel) {
      timeTravelIndex = currentEventIndex;
    }
  }
</script>

<div class="event-log">
  <div class="event-log-header">
    <h3>Game History</h3>
    <div class="event-controls">
      <span class="event-count">{events.length} events</span>
      <button 
        class="time-travel-toggle {showTimeTravel ? 'active' : ''}"
        on:click={toggleTimeTravel}
        title="Toggle time travel mode"
      >
        ⏰
      </button>
    </div>
  </div>
  
  {#if showTimeTravel}
    <div class="time-travel-controls">
      <div class="time-travel-info">
        Time Travel Mode - Event {timeTravelIndex + 1} of {events.length}
      </div>
      <input 
        type="range" 
        min="0" 
        max={events.length - 1} 
        bind:value={timeTravelIndex}
        class="time-travel-slider"
      />
      <div class="time-travel-buttons">
        <button 
          class="time-travel-btn"
          on:click={() => timeTravelIndex = 0}
          disabled={timeTravelIndex === 0}
        >
          ⏮️ Start
        </button>
        <button 
          class="time-travel-btn"
          on:click={() => timeTravelIndex = Math.max(0, timeTravelIndex - 1)}
          disabled={timeTravelIndex === 0}
        >
          ⏪ Previous
        </button>
        <button 
          class="time-travel-btn"
          on:click={() => timeTravelIndex = Math.min(events.length - 1, timeTravelIndex + 1)}
          disabled={timeTravelIndex === events.length - 1}
        >
          ⏩ Next
        </button>
        <button 
          class="time-travel-btn"
          on:click={() => timeTravelIndex = events.length - 1}
          disabled={timeTravelIndex === events.length - 1}
        >
          ⏭️ End
        </button>
        <button 
          class="time-travel-btn primary"
          on:click={() => handleTimeTravel(timeTravelIndex)}
        >
          🚀 Go to Event
        </button>
      </div>
    </div>
  {/if}
  
  <div class="events-container">
    {#each events as event, index}
      <div 
        class="event-item {index === timeTravelIndex ? 'current-event' : ''} {index <= timeTravelIndex ? 'visible' : 'hidden'}"
        class:highlighted={index === timeTravelIndex}
      >
        <div class="event-icon">
          {getEventIcon(event)}
        </div>
        <div class="event-content">
          <div class="event-description">
            {getEventDescription(event)}
          </div>
          <div class="event-meta">
            <span class="event-time">{getEventTime(event)}</span>
            <span class="event-source">{event.source || 'Game Engine'}</span>
          </div>
        </div>
        <div class="event-index">
          #{index + 1}
        </div>
      </div>
    {/each}
    
    {#if events.length === 0}
      <div class="no-events">
        <p>No events yet. Start playing to see game history!</p>
      </div>
    {/if}
  </div>
</div>

<style>
  .event-log {
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    border-radius: 12px;
    padding: 1.5rem;
    color: white;
    max-height: 600px;
    display: flex;
    flex-direction: column;
  }
  
  .event-log-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  }
  
  .event-log-header h3 {
    margin: 0;
    color: #4ecdc4;
    font-size: 1.3rem;
  }
  
  .event-controls {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  
  .event-count {
    font-size: 0.9rem;
    color: #b8c5d6;
  }
  
  .time-travel-toggle {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 6px;
    padding: 0.5rem;
    color: white;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 1.2rem;
  }
  
  .time-travel-toggle:hover {
    background: rgba(255, 255, 255, 0.2);
  }
  
  .time-travel-toggle.active {
    background: #4ecdc4;
    border-color: #4ecdc4;
  }
  
  .time-travel-controls {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    padding: 1rem;
    margin-bottom: 1rem;
  }
  
  .time-travel-info {
    text-align: center;
    margin-bottom: 1rem;
    color: #b8c5d6;
    font-size: 0.9rem;
  }
  
  .time-travel-slider {
    width: 100%;
    margin-bottom: 1rem;
  }
  
  .time-travel-buttons {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    justify-content: center;
  }
  
  .time-travel-btn {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 6px;
    padding: 0.5rem 0.75rem;
    color: white;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 0.9rem;
  }
  
  .time-travel-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.2);
  }
  
  .time-travel-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .time-travel-btn.primary {
    background: #4ecdc4;
    border-color: #4ecdc4;
  }
  
  .time-travel-btn.primary:hover:not(:disabled) {
    background: #45b7aa;
  }
  
  .events-container {
    flex-grow: 1;
    overflow-y: auto;
    max-height: 400px;
  }
  
  .event-item {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    padding: 0.75rem;
    border-radius: 8px;
    margin-bottom: 0.5rem;
    transition: all 0.3s ease;
    opacity: 0.7;
  }
  
  .event-item.visible {
    opacity: 1;
  }
  
  .event-item.hidden {
    opacity: 0.3;
  }
  
  .event-item.highlighted {
    background: rgba(78, 205, 196, 0.2);
    border: 1px solid #4ecdc4;
    transform: scale(1.02);
  }
  
  .event-item.current-event {
    background: rgba(255, 217, 61, 0.2);
    border: 1px solid #ffd93d;
  }
  
  .event-icon {
    font-size: 1.5rem;
    flex-shrink: 0;
    margin-top: 0.25rem;
  }
  
  .event-content {
    flex-grow: 1;
  }
  
  .event-description {
    font-weight: 500;
    margin-bottom: 0.25rem;
    line-height: 1.3;
  }
  
  .event-meta {
    display: flex;
    gap: 1rem;
    font-size: 0.8rem;
    color: #b8c5d6;
  }
  
  .event-index {
    font-size: 0.8rem;
    color: #b8c5d6;
    font-weight: bold;
    flex-shrink: 0;
  }
  
  .no-events {
    text-align: center;
    padding: 2rem;
    color: #b8c5d6;
    font-style: italic;
  }
  
  @media (max-width: 768px) {
    .event-log {
      padding: 1rem;
    }
    
    .time-travel-buttons {
      flex-direction: column;
    }
    
    .event-item {
      flex-direction: column;
      gap: 0.5rem;
    }
    
    .event-meta {
      flex-direction: column;
      gap: 0.25rem;
    }
  }
</style> 