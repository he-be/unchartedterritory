import { useState, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { Ship, WareStock } from '../types/game';
import './TradePanel.css';

interface TradePanelProps {
  ship: Ship;
}

function TradePanel({ ship }: TradePanelProps) {
  const { gameState, performTrade, loadTradeOpportunities, tradeOpportunities } = useGameStore();
  const [selectedWareId, setSelectedWareId] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [tradeAction, setTradeAction] = useState<'buy' | 'sell'>('buy');

  useEffect(() => {
    loadTradeOpportunities();
    const interval = setInterval(loadTradeOpportunities, 10000);
    return () => clearInterval(interval);
  }, [loadTradeOpportunities]);

  if (!gameState) return null;

  const currentSector = gameState.sectors.find(s => s.id === ship.sectorId);
  const nearbyStation = currentSector?.stations.find(station => {
    const dx = station.position.x - ship.position.x;
    const dy = station.position.y - ship.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance <= 200;
  });

  const handleTrade = async () => {
    if (!nearbyStation || !selectedWareId) return;

    await performTrade(
      ship.id,
      nearbyStation.id,
      selectedWareId,
      quantity,
      tradeAction
    );

    setQuantity(1);
    setSelectedWareId('');
  };

  const getMaxBuyQuantity = (wareStock: WareStock): number => {
    if (!nearbyStation) return 0;
    
    const ware = gameState.wares.find(w => w.id === wareStock.wareId);
    if (!ware) return 0;

    const affordableQuantity = Math.floor(gameState.player.credits / wareStock.buyPrice);
    const cargoSpace = ship.cargoCapacity - ship.cargo.reduce((sum, c) => sum + c.quantity, 0);
    const spaceQuantity = Math.floor(cargoSpace / ware.cargoSize);
    const availableQuantity = wareStock.quantity;

    return Math.min(affordableQuantity, spaceQuantity, availableQuantity);
  };

  const getMaxSellQuantity = (wareId: string): number => {
    const cargoItem = ship.cargo.find(c => c.wareId === wareId);
    return cargoItem?.quantity || 0;
  };

  const relevantOpportunities = tradeOpportunities?.filter(opp => {
    if (ship.sectorId === opp.from.sectorId) return true;
    if (ship.sectorId === opp.to.sectorId) return true;
    return ship.cargo.some(c => c.wareId === opp.wareId);
  }) || [];

  return (
    <div className="trade-panel">
      <h2>Trade Operations</h2>

      {!nearbyStation ? (
        <div className="no-station">
          <p>No station within trading range (200m)</p>
          <p className="hint">Move your ship closer to a station to trade</p>
        </div>
      ) : (
        <div className="trade-interface">
          <div className="station-info">
            <h3>{nearbyStation.name}</h3>
            <p className="station-type">{nearbyStation.type.replace('_', ' ')}</p>
          </div>

          <div className="trade-controls">
            <div className="action-selector">
              <button
                className={tradeAction === 'buy' ? 'active' : ''}
                onClick={() => setTradeAction('buy')}
              >
                Buy
              </button>
              <button
                className={tradeAction === 'sell' ? 'active' : ''}
                onClick={() => setTradeAction('sell')}
              >
                Sell
              </button>
            </div>

            <div className="ware-selector">
              <label>Select Ware:</label>
              <select
                value={selectedWareId}
                onChange={(e) => setSelectedWareId(e.target.value)}
              >
                <option value="">-- Select --</option>
                {tradeAction === 'buy'
                  ? nearbyStation.wares.map(wareStock => {
                      const ware = gameState.wares.find(w => w.id === wareStock.wareId);
                      const maxQty = getMaxBuyQuantity(wareStock);
                      return (
                        <option
                          key={wareStock.wareId}
                          value={wareStock.wareId}
                          disabled={maxQty === 0}
                        >
                          {ware?.name} - ¢{wareStock.buyPrice} (Max: {maxQty})
                        </option>
                      );
                    })
                  : ship.cargo.map(cargoItem => {
                      const ware = gameState.wares.find(w => w.id === cargoItem.wareId);
                      const stationWare = nearbyStation.wares.find(w => w.wareId === cargoItem.wareId);
                      if (!stationWare) return null;
                      return (
                        <option key={cargoItem.wareId} value={cargoItem.wareId}>
                          {ware?.name} - ¢{stationWare.sellPrice} (Have: {cargoItem.quantity})
                        </option>
                      );
                    }).filter(Boolean)
                }
              </select>
            </div>

            {selectedWareId && (
              <div className="quantity-controls">
                <label>Quantity:</label>
                <input
                  type="number"
                  min="1"
                  max={tradeAction === 'buy' 
                    ? getMaxBuyQuantity(nearbyStation.wares.find(w => w.wareId === selectedWareId)!)
                    : getMaxSellQuantity(selectedWareId)
                  }
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                />
                <button
                  className="max-button"
                  onClick={() => {
                    const max = tradeAction === 'buy'
                      ? getMaxBuyQuantity(nearbyStation.wares.find(w => w.wareId === selectedWareId)!)
                      : getMaxSellQuantity(selectedWareId);
                    setQuantity(max);
                  }}
                >
                  Max
                </button>
              </div>
            )}

            <button
              className="execute-trade"
              onClick={handleTrade}
              disabled={!selectedWareId || quantity < 1}
            >
              Execute Trade
            </button>
          </div>
        </div>
      )}

      {relevantOpportunities.length > 0 && (
        <div className="trade-opportunities">
          <h3>Trade Opportunities</h3>
          {relevantOpportunities.map((opp, index) => {
            const ware = gameState.wares.find(w => w.id === opp.wareId);
            return (
              <div key={index} className="opportunity">
                <div className="opportunity-header">
                  <span className="ware-name">{ware?.name}</span>
                  <span className="profit-margin">+{opp.profitMargin.toFixed(1)}%</span>
                </div>
                <div className="opportunity-route">
                  <span>Buy: ¢{opp.from.price} at {opp.from.stationId}</span>
                  <span>→</span>
                  <span>Sell: ¢{opp.to.price} at {opp.to.stationId}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default TradePanel;