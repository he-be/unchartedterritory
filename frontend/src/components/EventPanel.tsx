import { useGameStore } from '../store/gameStore';
import { GameEvent } from '../types/game';
import './EventPanel.css';

function EventPanel() {
  const { recentEvents, clearEvents } = useGameStore();

  if (!recentEvents || recentEvents.length === 0) {
    return (
      <div className="event-panel empty">
        <h3>Game Events</h3>
        <p className="no-events">No recent events</p>
      </div>
    );
  }

  const formatEventTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  const getEventIcon = (type: GameEvent['type']): string => {
    switch (type) {
      case 'discovery': return '🔍';
      case 'trade': return '💰';
      case 'movement': return '🚀';
      case 'production': return '🏭';
      default: return '📝';
    }
  };

  const getEventClass = (type: GameEvent['type']): string => {
    return `event-item ${type}`;
  };

  return (
    <div className="event-panel">
      <div className="event-header">
        <h3>Game Events</h3>
        <button className="clear-events" onClick={clearEvents} title="Clear events">
          🗑️
        </button>
      </div>
      
      <div className="event-list">
        {recentEvents.slice(-10).reverse().map((event, index) => (
          <div key={`${event.timestamp}-${index}`} className={getEventClass(event.type)}>
            <div className="event-content">
              <span className="event-icon">{getEventIcon(event.type)}</span>
              <span className="event-message">{event.message}</span>
            </div>
            <div className="event-time">{formatEventTime(event.timestamp)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default EventPanel;