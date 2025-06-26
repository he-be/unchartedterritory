import { useGameStore } from '../store/gameStore';
import './GameHeader.css';

function GameHeader() {
  const { gameState, error, clearError } = useGameStore();

  if (!gameState) return null;

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
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