import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { GameState, Station, Ship, Gate, Vector2 } from '../types';

interface SectorMapProps {
  gameState: GameState;
  selectedShipId?: string | null;
  currentViewSectorId: string;
  onShipCommand?: (shipId: string, targetPosition: Vector2, targetSectorId?: string) => void;
}

const SectorMap: React.FC<SectorMapProps> = ({ gameState, selectedShipId, currentViewSectorId, onShipCommand }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredStation, setHoveredStation] = useState<Station | null>(null);
  const [mousePos, setMousePos] = useState<{ screen: Vector2; world: Vector2 } | null>(null);
  
  const currentSector = gameState.sectors.find(s => s.id === currentViewSectorId);

  // Canvas dimensions and world coordinate system
  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 600;
  const WORLD_SIZE = 1000; // Changed from 10000 to match the actual world size
  const SCALE = Math.min(CANVAS_WIDTH / WORLD_SIZE, CANVAS_HEIGHT / WORLD_SIZE);

  // Transform world coordinates to screen coordinates
  const worldToScreen = useCallback((worldX: number, worldY: number): Vector2 => {
    return {
      x: (worldX * SCALE) + CANVAS_WIDTH / 2,
      y: (worldY * SCALE) + CANVAS_HEIGHT / 2
    };
  }, [SCALE]);

  // Transform screen coordinates to world coordinates
  const screenToWorld = useCallback((screenX: number, screenY: number): Vector2 => {
    return {
      x: (screenX - CANVAS_WIDTH / 2) / SCALE,
      y: (screenY - CANVAS_HEIGHT / 2) / SCALE
    };
  }, [SCALE]);

  // Get mouse position relative to canvas
  const getCanvasMousePos = (e: React.MouseEvent<HTMLCanvasElement>): Vector2 => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

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

      // Draw stations
      currentSector.stations.forEach(station => {
        const isHovered = hoveredStation?.id === station.id;
        const { x: screenX, y: screenY } = worldToScreen(station.position.x, station.position.y);
        
        // Station square
        ctx.fillStyle = '#4a9eff';
        ctx.fillRect(screenX - 15, screenY - 15, 30, 30);
        
        if (isHovered) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.strokeRect(screenX - 17, screenY - 17, 34, 34);
        }

        // Station name
        ctx.fillStyle = '#e0e0e0';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(station.name, screenX, screenY + 30);
      });

      // Draw gates
      currentSector.gates.forEach(gate => {
        const { x: screenX, y: screenY } = worldToScreen(gate.position.x, gate.position.y);
        
        // Gate circle
        ctx.fillStyle = '#a78bfa';
        ctx.beginPath();
        ctx.arc(screenX, screenY, 20, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = '#6d28d9';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Gate label
        ctx.fillStyle = '#e0e0e0';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`To ${gate.targetSectorId}`, screenX, screenY + 35);
      });

      // Draw ships (only ships in the currently viewed sector)
      const shipsInSector = gameState.player.ships.filter(ship => ship.sectorId === currentViewSectorId);
      shipsInSector.forEach(ship => {
        const isSelected = ship.id === selectedShipId;
        const { x: screenX, y: screenY } = worldToScreen(ship.position.x, ship.position.y);
        
        ctx.fillStyle = isSelected ? '#4a9eff' : '#4ade80';
        ctx.beginPath();
        ctx.arc(screenX, screenY, 8, 0, Math.PI * 2);
        ctx.fill();

        // Ship name
        ctx.fillStyle = '#e0e0e0';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(ship.name, screenX, screenY - 12);
      });
    };

    render();
    const interval = setInterval(render, 100);
    return () => clearInterval(interval);
  }, [currentSector, gameState, selectedShipId, hoveredStation, worldToScreen, currentViewSectorId]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Canvas clicked (verbose logging disabled)
    if (!canvasRef.current || !currentSector || !selectedShipId || !onShipCommand) {
      // Click ignored - missing required conditions
      return;
    }

    // Allow commands to ships regardless of which sector is being viewed
    // This enables cross-sector ship movement (e.g., ship auto-traveling to viewed sector)

    const { x: screenX, y: screenY } = getCanvasMousePos(e);
    const { x: worldX, y: worldY } = screenToWorld(screenX, screenY);
    // Click position processed

    // Send the click position and target sector to backend for cross-sector movement
    onShipCommand(selectedShipId, { x: worldX, y: worldY }, currentViewSectorId);
  };

  const handleCanvasHover = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !currentSector) return;

    const { x: screenX, y: screenY } = getCanvasMousePos(e);
    const { x: worldX, y: worldY } = screenToWorld(screenX, screenY);

    const hoveredStation = currentSector.stations.find(station => {
      const screen = worldToScreen(station.position.x, station.position.y);
      const dx = screenX - screen.x;
      const dy = screenY - screen.y;
      return Math.sqrt(dx * dx + dy * dy) < 20;
    });

    setHoveredStation(hoveredStation || null);
    setMousePos({ 
      screen: { x: screenX, y: screenY }, 
      world: { x: worldX, y: worldY } 
    });
  };

  if (!currentSector) {
    return <div className="card">No sector data available</div>;
  }

  return (
    <div className="card">
      <h3>Sector Map: {currentSector.name}</h3>
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        style={{ border: '1px solid #444', cursor: 'crosshair' }}
        onClick={handleCanvasClick}
        onMouseMove={handleCanvasHover}
      />
      
      {hoveredStation && (
        <div style={{
          position: 'absolute',
          background: 'rgba(0,0,0,0.9)',
          border: '1px solid #444',
          padding: '10px',
          borderRadius: '4px',
          pointerEvents: 'none',
          left: (mousePos?.screen.x || 0) + 10,
          top: (mousePos?.screen.y || 0) + 10
        }}>
          <h4 style={{ margin: 0, color: '#fff' }}>{hoveredStation.name}</h4>
          <p style={{ margin: '5px 0', color: '#aaa' }}>Inventory: {hoveredStation.inventory.length} items</p>
        </div>
      )}
    </div>
  );
};

export default SectorMap;
