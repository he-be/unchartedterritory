import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import GameHeader from '../components/GameHeader';
import SectorMap from '../components/SectorMap';
import ShipPanel from '../components/ShipPanel';
import StationPanel from '../components/StationPanel';
import TradePanel from '../components/TradePanel';
import './GamePage.css';

function GamePage() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const { 
    gameState, 
    loadGame, 
    selectedShipId, 
    selectedSectorId,
    connectToGame,
    disconnectFromGame,
    connectionStatus
  } = useGameStore();

  useEffect(() => {
    if (!gameState && gameId) {
      loadGame(gameId);
    }
  }, [gameId, gameState, loadGame]);

  useEffect(() => {
    if (!gameState) {
      navigate('/');
    }
  }, [gameState, navigate]);

  // Handle WebSocket connection lifecycle
  useEffect(() => {
    if (gameId && connectionStatus === 'disconnected') {
      // Try to establish WebSocket connection for real-time updates
      connectToGame(gameId).catch((error) => {
        console.warn('WebSocket connection failed, using HTTP fallback:', error);
      });
    }

    // Cleanup on unmount
    return () => {
      if (connectionStatus === 'connected') {
        disconnectFromGame();
      }
    };
  }, [gameId, connectionStatus, connectToGame, disconnectFromGame]);

  if (!gameState) {
    return <div className="loading">Loading game...</div>;
  }

  const selectedShip = gameState.player.ships.find(ship => ship.id === selectedShipId);
  const selectedSector = gameState.sectors.find(sector => sector.id === selectedSectorId);

  return (
    <div className="game-page">
      <GameHeader />
      <div className="game-content">
        <div className="left-panel">
          <ShipPanel />
        </div>
        <div className="center-panel">
          <SectorMap />
        </div>
        <div className="right-panel">
          {selectedSector && <StationPanel sector={selectedSector} />}
          {selectedShip && <TradePanel ship={selectedShip} />}
        </div>
      </div>
    </div>
  );
}

export default GamePage;