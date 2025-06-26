import { useEffect, useRef, useState, useCallback } from 'react';
import { useGameStore } from '../store/gameStore';
import { Station } from '../types/game';
import './SectorMap.css';

function SectorMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { gameState, selectedShipId, selectedSectorId, selectSector, sendShipCommand } = useGameStore();
  const [hoveredStation, setHoveredStation] = useState<Station | null>(null);
  const [mousePos, setMousePos] = useState<{ screen: { x: number; y: number }; world: { x: number; y: number } } | null>(null);
  const [showCommands, setShowCommands] = useState(false);
  const [commandTarget, setCommandTarget] = useState<{ x: number; y: number } | null>(null);

  const currentSector = selectedSectorId 
    ? gameState?.sectors.find(s => s.id === selectedSectorId)
    : gameState?.sectors.find(s => s.discovered);

  // Coordinate transformation framework
  const CANVAS_WIDTH = 1200;
  const CANVAS_HEIGHT = 800;
  const WORLD_SIZE = 10000; // World is -5000 to 5000
  const SCALE = Math.min(CANVAS_WIDTH / WORLD_SIZE, CANVAS_HEIGHT / WORLD_SIZE);

  // Transform world coordinates to screen coordinates
  const worldToScreen = useCallback((worldX: number, worldY: number): { x: number; y: number } => {
    return {
      x: (worldX * SCALE) + CANVAS_WIDTH / 2,
      y: (worldY * SCALE) + CANVAS_HEIGHT / 2
    };
  }, [SCALE, CANVAS_WIDTH, CANVAS_HEIGHT]);

  // Transform screen coordinates to world coordinates
  const screenToWorld = useCallback((screenX: number, screenY: number): { x: number; y: number } => {
    return {
      x: (screenX - CANVAS_WIDTH / 2) / SCALE,
      y: (screenY - CANVAS_HEIGHT / 2) / SCALE
    };
  }, [SCALE, CANVAS_WIDTH, CANVAS_HEIGHT]);

  // Get mouse position relative to canvas, accounting for CSS scaling
  const getCanvasMousePos = (e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };
    
  // Debug logging
  useEffect(() => {
    if (currentSector) {
      console.log('Current sector:', currentSector.name, {
        stations: currentSector.stations?.length || 0,
        gates: currentSector.gates?.length || 0,
        discovered: currentSector.discovered
      });
      
      // Log station positions
      currentSector.stations?.forEach(station => {
        console.log(`Station ${station.name} at:`, station.position);
      });
      
      // Log gate positions  
      currentSector.gates?.forEach(gate => {
        console.log(`Gate ${gate.id} at:`, gate.position);
      });
    }
  }, [currentSector]);

  useEffect(() => {
    if (!currentSector || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Background
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Debug: Show sector bounds
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);

      // Grid
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += 50) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Stations
      if (currentSector.stations && currentSector.stations.length > 0) {
        currentSector.stations.forEach(station => {
          const isHovered = hoveredStation?.id === station.id;
          const { x: screenX, y: screenY } = worldToScreen(station.position.x, station.position.y);
          
          // Draw station square
          ctx.fillStyle = getStationColor(station.type);
          ctx.fillRect(screenX - 15, screenY - 15, 30, 30);
          
          // Draw station border
          ctx.strokeStyle = '#000';
          ctx.lineWidth = 1;
          ctx.strokeRect(screenX - 15, screenY - 15, 30, 30);

        if (isHovered) {
          ctx.strokeStyle = '#4a9eff';
          ctx.lineWidth = 2;
          ctx.strokeRect(screenX - 17, screenY - 17, 34, 34);
        }

        // Station name
        ctx.fillStyle = '#e0e0e0';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(station.name, screenX, screenY + 30);
      });
    }

    // Gates
    if (currentSector.gates && currentSector.gates.length > 0) {
        currentSector.gates.forEach(gate => {
          const { x: screenX, y: screenY } = worldToScreen(gate.position.x, gate.position.y);
          
          // Draw gate circle with gradient
          const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, 20);
          gradient.addColorStop(0, '#a78bfa');
          gradient.addColorStop(1, '#8b5cf6');
          
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(screenX, screenY, 20, 0, Math.PI * 2);
          ctx.fill();
          
          // Draw gate border
          ctx.strokeStyle = '#6d28d9';
          ctx.lineWidth = 2;
          ctx.stroke();

        ctx.fillStyle = '#e0e0e0';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        const targetSector = gameState?.sectors.find(s => s.id === gate.connectsTo);
        ctx.fillText(targetSector?.name || 'Unknown', screenX, screenY + 35);
      });
    }

    // Ships
    const shipsInSector = gameState?.player.ships.filter(ship => ship.sectorId === currentSector.id) || [];
      shipsInSector.forEach(ship => {
        const isSelected = ship.id === selectedShipId;
        const { x: screenX, y: screenY } = worldToScreen(ship.position.x, ship.position.y);
        
        ctx.fillStyle = isSelected ? '#4a9eff' : '#4ade80';
        ctx.beginPath();
        ctx.arc(screenX, screenY, 8, 0, Math.PI * 2);
        ctx.fill();

        // Ship destination line
        if (ship.destination && ship.isMoving) {
          const { x: destScreenX, y: destScreenY } = worldToScreen(ship.destination.x, ship.destination.y);
          
          ctx.strokeStyle = '#4a9eff';
          ctx.lineWidth = 1;
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.moveTo(screenX, screenY);
          ctx.lineTo(destScreenX, destScreenY);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Ship name
        ctx.fillStyle = '#e0e0e0';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(ship.name, screenX, screenY - 12);
      });
      
      // Debug info
      ctx.fillStyle = '#666';
      ctx.font = '10px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`Scale: 1:${Math.round(1/0.08)}`, 10, 20);
      
      // Show command target if any
      if (commandTarget) {
        const targetScreenX = (commandTarget.x * 0.08) + canvas.width / 2;
        const targetScreenY = (commandTarget.y * 0.08) + canvas.height / 2;
        
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(targetScreenX - 10, targetScreenY);
        ctx.lineTo(targetScreenX + 10, targetScreenY);
        ctx.moveTo(targetScreenX, targetScreenY - 10);
        ctx.lineTo(targetScreenX, targetScreenY + 10);
        ctx.stroke();
        
        ctx.fillStyle = '#ff0000';
        ctx.fillText(`Target: (${Math.round(commandTarget.x)}, ${Math.round(commandTarget.y)})`, 10, 40);
      }
      
      // Show mouse position
      if (mousePos) {
        ctx.fillStyle = '#888';
        ctx.fillText(`Mouse Screen: (${Math.round(mousePos.screen.x)}, ${Math.round(mousePos.screen.y)})`, 10, 60);
        ctx.fillText(`Mouse World: (${Math.round(mousePos.world.x)}, ${Math.round(mousePos.world.y)})`, 10, 75);
      }
    };

    render();
    const interval = setInterval(render, 100);

    return () => clearInterval(interval);
  }, [currentSector, gameState, selectedShipId, hoveredStation, commandTarget, mousePos, worldToScreen]);

  const getStationColor = (type: Station['type']): string => {
    switch (type) {
      case 'trading_port': return '#4a9eff';
      case 'shipyard': return '#f59e0b';
      case 'hightech_factory': return '#8b5cf6';
      case 'basic_factory': return '#6b7280';
      case 'refinery': return '#ef4444';
      case 'mine': return '#a78bfa';
      default: return '#4a9eff';
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !currentSector || !selectedShipId) return;

    const { x: screenX, y: screenY } = getCanvasMousePos(e);
    const { x: worldX, y: worldY } = screenToWorld(screenX, screenY);
    
    console.log('Click:', { screenX, screenY, worldX, worldY });

    // Check if clicked on a station
    const clickedStation = currentSector.stations.find(station => {
      const dx = station.position.x - worldX;
      const dy = station.position.y - worldY;
      return Math.sqrt(dx * dx + dy * dy) < 250; // Adjusted for scale
    });

    // Check if clicked on a gate
    const clickedGate = currentSector.gates.find(gate => {
      const dx = gate.position.x - worldX;
      const dy = gate.position.y - worldY;
      return Math.sqrt(dx * dx + dy * dy) < 300; // Adjusted for scale
    });

    if (clickedStation) {
      // Update ship state optimistically
      if (gameState) {
        const ship = gameState.player.ships.find(s => s.id === selectedShipId);
        if (ship) {
          ship.isMoving = true;
          ship.destination = clickedStation.position;
          ship.currentCommand = {
            type: 'move',
            target: clickedStation.id
          };
        }
      }
      
      // Move to station
      sendShipCommand(selectedShipId, {
        type: 'move',
        target: clickedStation.id
      });
    } else if (clickedGate) {
      // Update ship state optimistically
      if (gameState) {
        const ship = gameState.player.ships.find(s => s.id === selectedShipId);
        if (ship) {
          ship.isMoving = true;
          ship.destination = clickedGate.position;
          ship.currentCommand = {
            type: 'move',
            target: clickedGate.id
          };
        }
      }
      
      // Move to gate (and potentially travel through it)
      sendShipCommand(selectedShipId, {
        type: 'move',
        target: clickedGate.id
      });
    } else {
      // Show command menu for free space movement
      setCommandTarget({ x: worldX, y: worldY });
      setShowCommands(true);
    }
  };

  const handleCanvasHover = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !currentSector) return;

    const { x: screenX, y: screenY } = getCanvasMousePos(e);
    const { x: worldX, y: worldY } = screenToWorld(screenX, screenY);

    const hoveredStation = currentSector.stations.find(station => {
      const dx = station.position.x - worldX;
      const dy = station.position.y - worldY;
      return Math.sqrt(dx * dx + dy * dy) < 250; // Adjusted for scale
    });

    setHoveredStation(hoveredStation || null);
    setMousePos({ 
      screen: { x: screenX, y: screenY }, 
      world: { x: worldX, y: worldY } 
    });
  };

  const handleMoveCommand = () => {
    if (!selectedShipId || !commandTarget) return;
    
    console.log('Move command to:', commandTarget);
    
    // Update the ship state optimistically
    const ship = gameState?.player.ships.find(s => s.id === selectedShipId);
    if (ship) {
      console.log('Ship current position:', ship.position);
      ship.isMoving = true;
      ship.destination = commandTarget;
      ship.currentCommand = {
        type: 'move',
        parameters: { x: commandTarget.x, y: commandTarget.y }
      };
    }
    
    sendShipCommand(selectedShipId, {
      type: 'move',
      parameters: { x: commandTarget.x, y: commandTarget.y }
    });
    
    setShowCommands(false);
    setCommandTarget(null);
  };

  if (!currentSector) {
    return (
      <div className="sector-map">
        <div className="no-sector">No sector selected</div>
      </div>
    );
  }

  return (
    <div className="sector-map">
      <div className="sector-header">
        <h2>{currentSector.name}</h2>
        <div className="sector-tabs">
          {gameState?.player.discoveredSectors.map(sectorId => {
            const sector = gameState.sectors.find(s => s.id === sectorId);
            return (
              <button
                key={sectorId}
                className={`sector-tab ${sectorId === currentSector.id ? 'active' : ''}`}
                onClick={() => selectSector(sectorId)}
              >
                {sector?.name || sectorId}
              </button>
            );
          })}
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="sector-canvas"
        onClick={handleCanvasClick}
        onMouseMove={handleCanvasHover}
      />
      
      <div className="debug-info" style={{ position: 'absolute', bottom: '60px', left: '10px', background: 'rgba(0,0,0,0.8)', padding: '10px', fontSize: '12px', color: '#fff' }}>
        <div>Canvas: {CANVAS_WIDTH}x{CANVAS_HEIGHT}</div>
        <div>Scale: {SCALE.toFixed(3)} (world to screen)</div>
        <div>World bounds: -{WORLD_SIZE/2},-{WORLD_SIZE/2} to {WORLD_SIZE/2},{WORLD_SIZE/2}</div>
        <div>Visible bounds: {screenToWorld(0, 0).x.toFixed(0)},{screenToWorld(0, 0).y.toFixed(0)} to {screenToWorld(CANVAS_WIDTH, CANVAS_HEIGHT).x.toFixed(0)},{screenToWorld(CANVAS_WIDTH, CANVAS_HEIGHT).y.toFixed(0)}</div>
        {currentSector && (
          <>
            <div>Sector: {currentSector.name}</div>
            <div>Stations: {currentSector.stations?.length || 0}</div>
            <div>Gates: {currentSector.gates?.length || 0}</div>
          </>
        )}
      </div>

      {showCommands && commandTarget && (
        <div
          className="command-menu"
          style={{
            left: worldToScreen(commandTarget.x, commandTarget.y).x + 10,
            top: worldToScreen(commandTarget.x, commandTarget.y).y + 10
          }}
        >
          <button onClick={handleMoveCommand}>Move Here</button>
          <button onClick={() => setShowCommands(false)}>Cancel</button>
        </div>
      )}

      {hoveredStation && (
        <div className="station-tooltip">
          <h4>{hoveredStation.name}</h4>
          <p>Type: {hoveredStation.type}</p>
          <p>Wares: {hoveredStation.wares.length}</p>
        </div>
      )}
    </div>
  );
}

export default SectorMap;