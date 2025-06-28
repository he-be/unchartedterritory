import { useGameStore } from '../store/gameStore';
import './GameHeader.css';

function GameHeader() {
  const { gameState, error, clearError, connectionStatus } = useGameStore();

  if (!gameState) return null;

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const getConnectionStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected': return '🟢';
      case 'connecting': return '🟡';
      case 'disconnected': return '🔴';
      case 'error': return '🔴';
      default: return '⚪';
    }
  };

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case 'connected': return 'Real-time';
      case 'connecting': return 'Connecting...';
      case 'disconnected': return 'Offline';
      case 'error': return 'Connection Error';
      default: return 'Unknown';
    }
  };

  return (
    <header className="game-header">
      <div className="header-section">
        <h1>Uncharted Territory</h1>
        <span className="game-id">Game: {gameState.id}</span>
      </div>
      
      <div className="header-section center">
        <div className="stat">
          <span className="label">Commander:</span>
          <span className="value">{gameState.player.name}</span>
        </div>
        <div className="stat">
          <span className="label">Credits:</span>
          <span className="value credits">¢{gameState.player.credits.toLocaleString()}</span>
        </div>
        <div className="stat">
          <span className="label">Ships:</span>
          <span className="value">{gameState.player.ships.length}</span>
        </div>
        <div className="stat">
          <span className="label">Sectors:</span>
          <span className="value">{gameState.player.discoveredSectors.length}</span>
        </div>
      </div>

      <div className="header-section">
        <div className="connection-status">
          <span className="connection-icon">{getConnectionStatusIcon()}</span>
          <span className="connection-text">{getConnectionStatusText()}</span>
        </div>
        <div className="game-time">
          <span className="label">Game Time:</span>
          <span className="value">{formatTime(gameState.gameTime)}</span>
        </div>
      </div>

      {error && (
        <div className="error-bar">
          <span>{error}</span>
          <button onClick={clearError}>×</button>
        </div>
      )}
    </header>
  );
}

export default GameHeader;