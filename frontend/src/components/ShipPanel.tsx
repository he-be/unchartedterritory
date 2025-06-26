import { useGameStore } from '../store/gameStore';
import { Ship } from '../types/game';
import './ShipPanel.css';

function ShipPanel() {
  const { gameState, selectedShipId, selectShip } = useGameStore();

  if (!gameState) return null;

  const getShipStatus = (ship: Ship): string => {
    if (ship.isMoving) return 'Moving';
    if (ship.currentCommand) {
      switch (ship.currentCommand.type) {
        case 'explore': return 'Exploring';
        case 'trade': return 'Trading';
        default: return 'Busy';
      }
    }
    return 'Idle';
  };

  const getCargoUsage = (ship: Ship): number => {
    return ship.cargo.reduce((total, item) => total + item.quantity, 0);
  };

  return (
    <div className="ship-panel">
      <h2>Fleet</h2>
      <div className="ship-list">
        {gameState.player.ships.map((ship) => (
          <div
            key={ship.id}
            className={`ship-card ${selectedShipId === ship.id ? 'selected' : ''}`}
            onClick={() => selectShip(ship.id)}
          >
            <div className="ship-header">
              <h3>{ship.name}</h3>
              <span className={`ship-status ${getShipStatus(ship).toLowerCase()}`}>
                {getShipStatus(ship)}
              </span>
            </div>
            
            <div className="ship-info">
              <div className="info-row">
                <span>Type:</span>
                <span>{ship.type}</span>
              </div>
              <div className="info-row">
                <span>Location:</span>
                <span>{gameState.sectors.find(s => s.id === ship.sectorId)?.name || 'Unknown'}</span>
              </div>
              <div className="info-row">
                <span>Cargo:</span>
                <span>{getCargoUsage(ship)} / {ship.cargoCapacity}</span>
              </div>
            </div>

            {ship.cargo.length > 0 && (
              <div className="ship-cargo">
                <h4>Cargo Hold</h4>
                {ship.cargo.map((item) => {
                  const ware = gameState.wares.find(w => w.id === item.wareId);
                  return (
                    <div key={item.wareId} className="cargo-item">
                      <span>{ware?.name || item.wareId}</span>
                      <span>{item.quantity}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default ShipPanel;