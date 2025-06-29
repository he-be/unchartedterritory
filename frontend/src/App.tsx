import React, { useState, useEffect } from 'react';
import { apiService } from './services/api';
import { WebSocketService } from './services/websocket';
import type { GameState, GameEvent, ConnectionStatus, Vector2 } from './types';
import SectorMap from './components/SectorMap';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [playerName, setPlayerName] = useState('');
  const [events, setEvents] = useState<GameEvent[]>([]);
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
        console.log('Received game state update:', newGameState);
        setGameState(newGameState);
        setError(null); // Clear any errors when we receive game state
      });
      ws.setOnEvents((newEvents) => {
        setEvents(prev => [...prev, ...newEvents].slice(-50)); // Keep last 50 events
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
    setEvents([]);
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

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

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
    
    console.log('Sending ship action:', message);
    wsService.sendMessage(message);
  };

  const handleSectorNavigation = (sectorId: string) => {
    setCurrentViewSectorId(sectorId);
  };

  return (
    <div className="container">
      <h1>Uncharted Territory</h1>
      
      {error && (
        <div className="card" style={{ backgroundColor: '#dc3545', color: 'white' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {!gameState ? (
        <div className="card">
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
              className="button"
              onClick={handleCreateGame}
              disabled={isLoading || !playerName.trim()}
            >
              {isLoading ? 'Creating...' : 'Create Game'}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>Game Status</h2>
              <button className="button" onClick={handleDisconnect}>
                Leave Game
              </button>
            </div>
            <p><strong>Player:</strong> {gameState.player.name}</p>
            <p><strong>Credits:</strong> {gameState.player.credits.toLocaleString()}</p>
            <p><strong>Game Time:</strong> {formatGameTime(gameState.gameTime)}</p>
            <p><strong>Current Sector:</strong> {gameState.sectors.find(s => s.id === gameState.currentSectorId)?.name}</p>
            <p>
              <strong>Connection:</strong>{' '}
              <span className={`status ${connectionStatus}`}>
                {connectionStatus.toUpperCase()}
              </span>
            </p>
          </div>

          <div className="card">
            <h3>Sector Navigation</h3>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
              {gameState.sectors.map(sector => (
                <button
                  key={sector.id}
                  className={`button ${sector.id === (currentViewSectorId || gameState.currentSectorId) ? 'active' : ''}`}
                  onClick={() => handleSectorNavigation(sector.id)}
                  style={{
                    backgroundColor: sector.id === (currentViewSectorId || gameState.currentSectorId) ? '#4a9eff' : '#555',
                    color: '#fff',
                    cursor: 'pointer'
                  }}
                >
                  {sector.name}
                </button>
              ))}
            </div>
            <p style={{ fontSize: '14px', color: '#888' }}>
              Viewing: {gameState.sectors.find(s => s.id === (currentViewSectorId || gameState.currentSectorId))?.name} | 
              Ships in: {gameState.sectors.find(s => s.id === gameState.currentSectorId)?.name}
            </p>
          </div>

          <SectorMap 
            gameState={gameState} 
            selectedShipId={selectedShipId}
            currentViewSectorId={currentViewSectorId || gameState.currentSectorId}
            onShipCommand={handleShipCommand}
          />

          <div className="card">
            <h3>Ships ({gameState.player.ships.length})</h3>
            {gameState.player.ships.map(ship => (
              <div 
                key={ship.id} 
                onClick={() => setSelectedShipId(ship.id)}
                style={{ 
                  border: selectedShipId === ship.id ? '2px solid #4a9eff' : '1px solid #444', 
                  borderRadius: '4px', 
                  padding: '10px', 
                  margin: '10px 0',
                  cursor: 'pointer',
                  transition: 'border-color 0.2s'
                }}
              >
                <h4>{ship.name}</h4>
                <p><strong>Position:</strong> ({Math.round(ship.position.x)}, {Math.round(ship.position.y)})</p>
                <p><strong>Sector:</strong> {ship.sectorId}</p>
                <p><strong>Status:</strong> {ship.isMoving ? 'Moving' : 'Idle'}</p>
                <p><strong>Cargo:</strong> {ship.cargo.length}/{ship.maxCargo}</p>
              </div>
            ))}
          </div>

          <div className="card">
            <h3>Sectors ({gameState.sectors.length})</h3>
            {gameState.sectors.map(sector => (
              <div key={sector.id} style={{ 
                border: '1px solid #444', 
                borderRadius: '4px', 
                padding: '10px', 
                margin: '10px 0' 
              }}>
                <h4>{sector.name}</h4>
                <p><strong>Coordinates:</strong> ({sector.coordinates.x}, {sector.coordinates.y})</p>
                <p><strong>Stations:</strong> {sector.stations.length}</p>
                <p><strong>Gates:</strong> {sector.gates.length}</p>
              </div>
            ))}
          </div>

          {events.length > 0 && (
            <div className="card">
              <h3>Recent Events</h3>
              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {events.slice().reverse().map(event => (
                  <div key={event.id} style={{ 
                    borderBottom: '1px solid #444', 
                    padding: '5px 0' 
                  }}>
                    <span style={{ fontSize: '12px', color: '#888' }}>
                      [{formatTime(event.timestamp)}]
                    </span>{' '}
                    {event.message}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default App;