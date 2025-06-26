import { useGameStore } from '../store/gameStore';
import { Sector, Station } from '../types/game';
import './StationPanel.css';

interface StationPanelProps {
  sector: Sector;
}

function StationPanel({ sector }: StationPanelProps) {
  const { gameState, selectedShipId, sendShipCommand } = useGameStore();

  if (!gameState) return null;

  const getStationTypeIcon = (type: Station['type']): string => {
    switch (type) {
      case 'trading_port': return '🏪';
      case 'shipyard': return '🔧';
      case 'hightech_factory': return '🏭';
      case 'basic_factory': return '🏢';
      case 'refinery': return '🛢️';
      case 'mine': return '⛏️';
      default: return '📍';
    }
  };

  const handleExplore = () => {
    if (!selectedShipId) return;
    
    sendShipCommand(selectedShipId, {
      type: 'explore',
      target: sector.id
    });
  };

  return (
    <div className="station-panel">
      <div className="panel-header">
        <h2>Stations in {sector.name}</h2>
        {selectedShipId && (
          <button className="explore-button" onClick={handleExplore}>
            Explore Sector
          </button>
        )}
      </div>

      <div className="station-list">
        {sector.stations.map(station => (
          <div key={station.id} className="station-card">
            <div className="station-header">
              <span className="station-icon">{getStationTypeIcon(station.type)}</span>
              <h3>{station.name}</h3>
            </div>
            
            <div className="station-type">{station.type.replace('_', ' ')}</div>

            {station.produces && station.produces.length > 0 && (
              <div className="station-production">
                <span className="label">Produces:</span>
                <div className="production-list">
                  {station.produces.map(wareId => {
                    const ware = gameState.wares.find(w => w.id === wareId);
                    return <span key={wareId} className="production-item">{ware?.name || wareId}</span>;
                  })}
                </div>
              </div>
            )}

            {station.consumes && station.consumes.length > 0 && (
              <div className="station-consumption">
                <span className="label">Consumes:</span>
                <div className="consumption-list">
                  {station.consumes.map(wareId => {
                    const ware = gameState.wares.find(w => w.id === wareId);
                    return <span key={wareId} className="consumption-item">{ware?.name || wareId}</span>;
                  })}
                </div>
              </div>
            )}

            <div className="station-wares">
              <h4>Available Wares</h4>
              {station.wares.map(wareStock => {
                const ware = gameState.wares.find(w => w.id === wareStock.wareId);
                return (
                  <div key={wareStock.wareId} className="ware-row">
                    <span className="ware-name">{ware?.name || wareStock.wareId}</span>
                    <div className="ware-details">
                      <span className="ware-stock">{wareStock.quantity}/{wareStock.maxQuantity}</span>
                      <span className="ware-prices">
                        B: ¢{wareStock.buyPrice} / S: ¢{wareStock.sellPrice}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {selectedShipId && (
              <button
                className="dock-button"
                onClick={() => sendShipCommand(selectedShipId, {
                  type: 'move',
                  target: station.id
                })}
              >
                Dock at Station
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default StationPanel;