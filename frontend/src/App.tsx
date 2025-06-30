import React, { useState, useEffect } from 'react';
import { apiService } from './services/api';
import { WebSocketService } from './services/websocket';
import type { GameState, ConnectionStatus, Vector2 } from './types';
import SectorMap from './components/SectorMap';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [playerName, setPlayerName] = useState('');
  const [wsService, setWsService] = useState<WebSocketService | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedShipId, setSelectedShipId] = useState<string | null>(null);
  const [currentViewSectorId, setCurrentViewSectorId] = useState<string | null>(null);

  const handleCreateGame = async () => {
    if (!playerName.trim()) {
      setError('Please enter a player name');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const newGameState = await apiService.createNewGame(playerName.trim());
      setGameState(newGameState);
      setCurrentViewSectorId(newGameState.currentSectorId); // Initialize view with game's initial sector
      
      // Establish WebSocket connection
      const wsUrl = apiService.createWebSocketUrl(newGameState.id);
      const ws = new WebSocketService(wsUrl);
      
      ws.setOnStatusChange(setConnectionStatus);
      ws.setOnGameStateUpdate((newGameState) => {
        // Game state updated (verbose logging disabled)
        setGameState(newGameState);
        setError(null); // Clear any errors when we receive game state
      });
      ws.setOnError(setError);
      
      await ws.connect();
      setWsService(ws);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create game');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = () => {
    if (wsService) {
      wsService.disconnect();
      setWsService(null);
    }
    setGameState(null);
    setConnectionStatus('disconnected');
    setCurrentViewSectorId(null);
  };

  useEffect(() => {
    return () => {
      if (wsService) {
        wsService.disconnect();
      }
    };
  }, [wsService]);

  const formatGameTime = (gameTime: number) => {
    const hours = Math.floor(gameTime / 3600000);
    const minutes = Math.floor((gameTime % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  };

  const handleShipCommand = (shipId: string, targetPosition: Vector2, targetSectorId?: string) => {
    if (!wsService) {
      console.error('WebSocket service not available');
      return;
    }
    
    // Send abstract command - backend determines specific action based on world context
    const message = {
      type: 'shipAction' as const,
      shipId,
      targetPosition,
      targetSectorId: targetSectorId || currentViewSectorId || gameState?.currentSectorId
    };
    
    // Sending ship action (verbose logging disabled)
    wsService.sendMessage(message);
  };

  const handleSectorNavigation = (sectorId: string) => {
    setCurrentViewSectorId(sectorId);
  };

  return (
    <div className="container">
      <header className="header">
        <h1>Uncharted Territory</h1>
        {gameState && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span>Credits: {gameState.player.credits.toLocaleString()}</span>
            <span className={`status ${connectionStatus}`}>
              {connectionStatus.toUpperCase()}
            </span>
            <button className="button" onClick={handleDisconnect}>
              Leave Game
            </button>
          </div>
        )}
      </header>
      
      {error && (
        <div className="error">
          <strong>Error:</strong> {error}
        </div>
      )}

      {!gameState ? (
        <div className="game-creation">
          <h2>Create New Game</h2>
          <div style={{ marginBottom: '20px' }}>
            <input
              type="text"
              className="input"
              placeholder="Enter your player name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleCreateGame()}
              disabled={isLoading}
              style={{ marginRight: '10px', width: '200px' }}
            />
            <button
              className="button primary"
              onClick={handleCreateGame}
              disabled={isLoading || !playerName.trim()}
            >
              {isLoading ? 'Creating...' : 'Create Game'}
            </button>
          </div>
        </div>
      ) : (
        <div className="game-layout">
          {/* Left Pane - Ships */}
          <div className="left-pane">
            <div className="card">
              <div className="card-header">
                <h3>Ships ({gameState.player.ships.length})</h3>
              </div>
              <div className="card-content">
                {gameState.player.ships.map(ship => (
                  <div 
                    key={ship.id} 
                    onClick={() => setSelectedShipId(ship.id)}
                    className={`ship-item ${selectedShipId === ship.id ? 'selected' : ''}`}
                  >
                    <div className="ship-name">{ship.name}</div>
                    <div className="ship-details">Position: ({Math.round(ship.position.x)}, {Math.round(ship.position.y)})</div>
                    <div className="ship-details">Sector: {ship.sectorId}</div>
                    <div className="ship-details">Status: {ship.isMoving ? 'Moving' : 'Idle'}</div>
                    <div className="ship-details">Cargo: {ship.cargo.length}/{ship.maxCargo}</div>
                    {ship.commandQueue && ship.commandQueue.length > 0 && (
                      <div className="command-queue">
                        <div><strong>Queue ({ship.commandQueue.length}):</strong></div>
                        {ship.currentCommand && (
                          <div className="command-current">
                            ▶ {ship.currentCommand.type}
                            {ship.currentCommand.targetSectorId && ` → ${ship.currentCommand.targetSectorId}`}
                          </div>
                        )}
                        {ship.commandQueue.slice(0, 2).map((cmd, index) => (
                          <div key={cmd.id} className="command-queued">
                            {index + 1}. {cmd.type}
                            {cmd.targetSectorId && ` → ${cmd.targetSectorId}`}
                          </div>
                        ))}
                        {ship.commandQueue.length > 2 && (
                          <div className="command-queued">
                            ... +{ship.commandQueue.length - 2} more
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Game Status in left pane */}
            <div className="card">
              <div className="card-header">
                <h3>Game Status</h3>
              </div>
              <div className="card-content">
                <div className="ship-details">Player: {gameState.player.name}</div>
                <div className="ship-details">Game Time: {formatGameTime(gameState.gameTime)}</div>
                <div className="ship-details">Current Sector: {gameState.sectors.find(s => s.id === gameState.currentSectorId)?.name}</div>
              </div>
            </div>
          </div>

          {/* Center Pane - Map */}
          <div className="center-pane">
            <div className="map-container">
              <div className="map-header">
                <h3>Sector Map: {gameState.sectors.find(s => s.id === (currentViewSectorId || gameState.currentSectorId))?.name}</h3>
                <div className="sector-buttons">
                  {gameState.sectors.map(sector => (
                    <button
                      key={sector.id}
                      className={`button ${sector.id === (currentViewSectorId || gameState.currentSectorId) ? 'active' : ''}`}
                      onClick={() => handleSectorNavigation(sector.id)}
                    >
                      {sector.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="map-content">
                <SectorMap 
                  gameState={gameState} 
                  selectedShipId={selectedShipId}
                  currentViewSectorId={currentViewSectorId || gameState.currentSectorId}
                  onShipCommand={handleShipCommand}
                />
              </div>
            </div>
          </div>

          {/* Right Pane - Stations */}
          <div className="right-pane">
            <div className="card">
              <div className="card-header">
                <h3>Stations</h3>
              </div>
              <div className="card-content">
                {gameState.sectors.find(s => s.id === (currentViewSectorId || gameState.currentSectorId))?.stations.map(station => (
                  <div key={station.id} className="station-item">
                    <div className="station-name">{station.name}</div>
                    <div className="station-details">Position: ({Math.round(station.position.x)}, {Math.round(station.position.y)})</div>
                    <div className="station-details">Inventory: {station.inventory.length} items</div>
                  </div>
                )) || <div className="station-details">No stations in this sector</div>}
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h3>Sector Info</h3>
              </div>
              <div className="card-content">
                {gameState.sectors.map(sector => (
                  <div key={sector.id} className={sector.id === (currentViewSectorId || gameState.currentSectorId) ? "station-item" : "station-details"}>
                    <div className="station-name">{sector.name}</div>
                    <div className="station-details">Coordinates: ({sector.coordinates.x}, {sector.coordinates.y})</div>
                    <div className="station-details">Stations: {sector.stations.length}</div>
                    <div className="station-details">Gates: {sector.gates.length}</div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default App;