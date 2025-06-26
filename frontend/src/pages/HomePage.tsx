import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import './HomePage.css';

function HomePage() {
  const [playerName, setPlayerName] = useState('');
  const [gameId, setGameId] = useState('');
  const navigate = useNavigate();
  const { startNewGame, loadGame, isLoading, error } = useGameStore();

  const handleNewGame = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) return;

    await startNewGame(playerName);
    const gameState = useGameStore.getState().gameState;
    if (gameState) {
      navigate(`/game/${gameState.id}`);
    }
  };

  const handleLoadGame = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gameId.trim()) return;

    await loadGame(gameId);
    const gameState = useGameStore.getState().gameState;
    if (gameState) {
      navigate(`/game/${gameState.id}`);
    }
  };

  return (
    <div className="home-page">
      <h1>Uncharted Territory</h1>
      <p className="subtitle">Space Economic Simulation</p>

      <div className="game-options">
        <div className="option-card">
          <h2>New Game</h2>
          <form onSubmit={handleNewGame}>
            <input
              type="text"
              placeholder="Enter your name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              disabled={isLoading}
              maxLength={20}
            />
            <button type="submit" disabled={isLoading || !playerName.trim()}>
              Start New Game
            </button>
          </form>
        </div>

        <div className="option-card">
          <h2>Load Game</h2>
          <form onSubmit={handleLoadGame}>
            <input
              type="text"
              placeholder="Enter game ID"
              value={gameId}
              onChange={(e) => setGameId(e.target.value)}
              disabled={isLoading}
            />
            <button type="submit" disabled={isLoading || !gameId.trim()}>
              Load Game
            </button>
          </form>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}
    </div>
  );
}

export default HomePage;