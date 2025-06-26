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
  const { gameState, loadGame, selectedShipId, selectedSectorId } = useGameStore();

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