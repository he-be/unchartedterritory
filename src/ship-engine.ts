// Ship movement and exploration engine for Uncharted Territory

import { GameState, Ship, ShipCommand, Vector2, GameEvent, Station } from './types';
import { CommandQueue } from './command-queue';
import { GalaxyNavigation } from './galaxy-navigation';

export class ShipEngine {
  private static MOVEMENT_SPEED_MULTIPLIER = 100; // pixels per second

  static getDistance(pos1: Vector2, pos2: Vector2): number {
    const dx = pos2.x - pos1.x;
    const dy = pos2.y - pos1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  static moveTowards(current: Vector2, target: Vector2, speed: number, deltaTime: number): Vector2 {
    const distance = this.getDistance(current, target);
    
    if (distance <= speed * deltaTime) {
      return { ...target };
    }

    const direction = {
      x: (target.x - current.x) / distance,
      y: (target.y - current.y) / distance
    };

    return {
      x: current.x + direction.x * speed * deltaTime,
      y: current.y + direction.y * speed * deltaTime
    };
  }

  static executeCommand(ship: Ship, command: ShipCommand, gameState: GameState): GameEvent[] {
    const events: GameEvent[] = [];

    switch (command.type) {
      case 'move':
        this.startMovement(ship, command, gameState, events);
        break;
      case 'explore':
        this.startExploration(ship, gameState, events);
        break;
      case 'trade':
        this.executeTrade(ship, command, gameState, events);
        break;
      case 'auto-move':
        // auto-move commands are handled by CommandQueue
        break;
    }

    return events;
  }

  private static startMovement(ship: Ship, command: ShipCommand, gameState: GameState, events: GameEvent[]): void {
    const currentSector = gameState.sectors.find(s => s.id === ship.sectorId);
    if (!currentSector) return;

    let targetPosition: Vector2 | undefined;

    if (command.target) {
      // First check current sector for station or gate
      const station = currentSector.stations.find(s => s.id === command.target);
      const gate = currentSector.gates.find(g => g.id === command.target);
      
      if (station) {
        targetPosition = station.position;
      } else if (gate) {
        targetPosition = gate.position;
      } else {
        // Check if target is a gate in any sector
        const gateInfo = GalaxyNavigation.findGateById(gameState, command.target);
        if (gateInfo) {
          // Target is a gate in another sector - navigate to that sector first
          const galaxyRoute = GalaxyNavigation.findGalaxyRoute(gameState, ship.sectorId, gateInfo.sector.id);
          if (galaxyRoute && galaxyRoute.steps.length > 0) {
            // Add commands to navigate to the target gate's sector
            galaxyRoute.steps.forEach(step => {
              const moveCommand: ShipCommand = {
                type: 'move',
                target: step.gateId
              };
              CommandQueue.addCommand(ship, moveCommand);
            });
            
            // Add final command to move to the target gate
            const finalMoveCommand: ShipCommand = {
              type: 'move',
              target: command.target
            };
            CommandQueue.addCommand(ship, finalMoveCommand);
            
            events.push({
              timestamp: Date.now(),
              type: 'movement',
              message: `${ship.name} planning route to gate ${command.target} in ${gateInfo.sector.name}`,
              details: { shipId: ship.id, targetSector: gateInfo.sector.id, targetGate: command.target }
            });
            
            // Start processing the command queue
            CommandQueue.processQueue(ship, gameState);
            return;
          }
        } else {
          // Check if target is a station in another sector
          const targetStation = this.findStationInAllSectors(command.target, gameState);
          if (targetStation) {
            // Generate auto-move command to the station's sector
            const autoMoveCommand = CommandQueue.createAutoMoveCommand(targetStation.sectorId);
            CommandQueue.addCommand(ship, autoMoveCommand);
            
            // Add move command to the station after reaching the sector
            const moveToStationCommand: ShipCommand = {
              type: 'move',
              target: targetStation.station.id
            };
            CommandQueue.addCommand(ship, moveToStationCommand);
            
            events.push({
              timestamp: Date.now(),
              type: 'movement',
              message: `${ship.name} planning route to ${targetStation.station.name} in ${targetStation.sectorName}`,
              details: { shipId: ship.id, targetSector: targetStation.sectorId, targetStation: targetStation.station.id }
            });
            
            // Start processing the command queue
            CommandQueue.processQueue(ship, gameState);
            return;
          }
        }
      }
    } else if (command.parameters?.x !== undefined && command.parameters?.y !== undefined) {
      targetPosition = { x: command.parameters.x, y: command.parameters.y };
    }

    if (targetPosition) {
      ship.destination = targetPosition;
      ship.isMoving = true;
      ship.currentCommand = command;

      events.push({
        timestamp: Date.now(),
        type: 'movement',
        message: `${ship.name} started moving to ${command.target || 'coordinates'}`,
        details: { shipId: ship.id, destination: targetPosition }
      });
    }
  }

  private static findStationInAllSectors(stationId: string, gameState: GameState): { station: Station; sectorId: string; sectorName: string } | null {
    for (const sector of gameState.sectors) {
      const station = sector.stations.find(s => s.id === stationId);
      if (station) {
        return {
          station,
          sectorId: sector.id,
          sectorName: sector.name
        };
      }
    }
    return null;
  }

  private static startExploration(ship: Ship, gameState: GameState, events: GameEvent[]): void {
    const currentSector = gameState.sectors.find(s => s.id === ship.sectorId);
    if (!currentSector) return;

    // Find unexplored gates in current sector
    const unexploredGates = currentSector.gates.filter(gate => 
      !gameState.player.discoveredSectors.includes(gate.connectsTo)
    );

    if (unexploredGates.length === 0) {
      events.push({
        timestamp: Date.now(),
        type: 'discovery',
        message: `${ship.name}: No unexplored gates found in ${currentSector.name}`,
        details: { shipId: ship.id }
      });
      return;
    }

    // Head to the nearest unexplored gate
    const nearestGate = unexploredGates.reduce((nearest, gate) => {
      const distToGate = this.getDistance(ship.position, gate.position);
      const distToNearest = this.getDistance(ship.position, nearest.position);
      return distToGate < distToNearest ? gate : nearest;
    });

    ship.destination = nearestGate.position;
    ship.isMoving = true;
    ship.currentCommand = { type: 'explore', target: nearestGate.id };

    events.push({
      timestamp: Date.now(),
      type: 'movement',
      message: `${ship.name} heading to unexplored gate`,
      details: { shipId: ship.id, gateId: nearestGate.id }
    });
  }

  private static executeTrade(ship: Ship, command: ShipCommand, gameState: GameState, events: GameEvent[]): void {
    const currentSector = gameState.sectors.find(s => s.id === ship.sectorId);
    if (!currentSector) return;

    const station = currentSector.stations.find(s => s.id === command.target);
    if (!station) return;

    const { action, wareId, quantity } = command.parameters || {};
    
    if (action === 'buy' && wareId && quantity !== undefined) {
      this.buyWare(ship, station, wareId, quantity, gameState, events);
    } else if (action === 'sell' && wareId && quantity !== undefined) {
      this.sellWare(ship, station, wareId, quantity, gameState, events);
    }
  }

  private static buyWare(ship: Ship, station: Station, wareId: string, quantity: number, gameState: GameState, events: GameEvent[]): void {
    const stationStock = station.wares.find(w => w.wareId === wareId);
    const ware = gameState.wares.find(w => w.id === wareId);
    
    if (!stationStock || !ware || stationStock.sellPrice === 0) {
      events.push({
        timestamp: Date.now(),
        type: 'trade',
        message: `${ship.name}: Cannot buy ${wareId} from ${station.name}`,
        details: { shipId: ship.id, stationId: station.id, reason: 'not_available' }
      });
      return;
    }

    const maxAffordable = Math.floor(gameState.player.credits / stationStock.sellPrice);
    const maxCapacity = Math.floor((ship.cargoCapacity - this.getUsedCargo(ship)) / ware.cargoSize);
    const availableStock = stationStock.quantity;
    
    const actualQuantity = Math.min(quantity, maxAffordable, maxCapacity, availableStock);
    
    if (actualQuantity <= 0) {
      events.push({
        timestamp: Date.now(),
        type: 'trade',
        message: `${ship.name}: Cannot buy ${wareId} - insufficient credits/cargo space/stock`,
        details: { shipId: ship.id, stationId: station.id }
      });
      return;
    }

    const totalCost = actualQuantity * stationStock.sellPrice;
    
    // Update player credits
    gameState.player.credits -= totalCost;
    
    // Update station stock
    stationStock.quantity -= actualQuantity;
    
    // Update ship cargo
    const existingCargo = ship.cargo.find(c => c.wareId === wareId);
    if (existingCargo) {
      existingCargo.quantity += actualQuantity;
    } else {
      ship.cargo.push({ wareId, quantity: actualQuantity });
    }

    events.push({
      timestamp: Date.now(),
      type: 'trade',
      message: `${ship.name} bought ${actualQuantity} ${wareId} for ${totalCost} Cr`,
      details: { 
        shipId: ship.id, 
        stationId: station.id, 
        wareId, 
        quantity: actualQuantity, 
        price: stationStock.sellPrice,
        totalCost 
      }
    });
  }

  private static sellWare(ship: Ship, station: Station, wareId: string, quantity: number, gameState: GameState, events: GameEvent[]): void {
    const stationStock = station.wares.find(w => w.wareId === wareId);
    const shipCargo = ship.cargo.find(c => c.wareId === wareId);
    
    if (!stationStock || !shipCargo || stationStock.buyPrice === 0) {
      events.push({
        timestamp: Date.now(),
        type: 'trade',
        message: `${ship.name}: Cannot sell ${wareId} to ${station.name}`,
        details: { shipId: ship.id, stationId: station.id, reason: 'not_wanted' }
      });
      return;
    }

    const maxStationCanBuy = stationStock.maxQuantity - stationStock.quantity;
    const actualQuantity = Math.min(quantity, shipCargo.quantity, maxStationCanBuy);
    
    if (actualQuantity <= 0) {
      events.push({
        timestamp: Date.now(),
        type: 'trade',
        message: `${ship.name}: Station ${station.name} cannot buy more ${wareId}`,
        details: { shipId: ship.id, stationId: station.id }
      });
      return;
    }

    const totalRevenue = actualQuantity * stationStock.buyPrice;
    
    // Update player credits
    gameState.player.credits += totalRevenue;
    
    // Update station stock
    stationStock.quantity += actualQuantity;
    
    // Update ship cargo
    shipCargo.quantity -= actualQuantity;
    if (shipCargo.quantity <= 0) {
      ship.cargo = ship.cargo.filter(c => c.wareId !== wareId);
    }

    events.push({
      timestamp: Date.now(),
      type: 'trade',
      message: `${ship.name} sold ${actualQuantity} ${wareId} for ${totalRevenue} Cr`,
      details: { 
        shipId: ship.id, 
        stationId: station.id, 
        wareId, 
        quantity: actualQuantity, 
        price: stationStock.buyPrice,
        totalRevenue 
      }
    });
  }

  private static getUsedCargo(ship: Ship): number {
    return ship.cargo.reduce((total, cargo) => {
      const ware = WARES.find(w => w.id === cargo.wareId);
      return total + (cargo.quantity * (ware?.cargoSize || 1));
    }, 0);
  }

  static updateShipMovement(gameState: GameState, deltaTime: number): GameEvent[] {
    const events: GameEvent[] = [];

    gameState.player.ships.forEach(ship => {
      // Process command queue if no current movement
      if (!ship.isMoving) {
        CommandQueue.processQueue(ship, gameState);
      }

      if (!ship.isMoving || !ship.destination) return;

      ship.position = this.moveTowards(
        ship.position, 
        ship.destination, 
        ship.maxSpeed * this.MOVEMENT_SPEED_MULTIPLIER, 
        deltaTime
      );

      // Check if reached destination
      const distance = this.getDistance(ship.position, ship.destination);
      if (distance < 50) { // Close enough
        ship.position = { ...ship.destination };
        ship.isMoving = false;
        ship.destination = undefined;

        // Handle arrival
        if (ship.currentCommand?.type === 'explore') {
          this.handleGateArrival(ship, gameState, events);
        } else if (ship.currentCommand?.type === 'move' && ship.currentCommand.target) {
          this.handleMoveArrival(ship, gameState, events);
        }

        events.push({
          timestamp: Date.now(),
          type: 'movement',
          message: `${ship.name} arrived at destination`,
          details: { shipId: ship.id, position: ship.position }
        });

        ship.currentCommand = undefined;
        
        // Process next command in queue after arrival
        CommandQueue.processQueue(ship, gameState);
      }
    });

    return events;
  }

  private static handleMoveArrival(ship: Ship, gameState: GameState, events: GameEvent[]): void {
    const currentSector = gameState.sectors.find(s => s.id === ship.sectorId);
    if (!currentSector || !ship.currentCommand?.target) return;

    const targetGate = currentSector.gates.find(g => g.id === ship.currentCommand?.target);
    if (targetGate && this.getDistance(ship.position, targetGate.position) < 100) {
      // Ship reached a gate - travel through it
      const targetSector = gameState.sectors.find(s => s.id === targetGate.connectsTo);
      if (targetSector) {
        ship.sectorId = targetSector.id;
        
        // Find the corresponding gate in the target sector
        const returnGate = targetSector.gates.find(g => g.connectsTo === currentSector.id);
        if (returnGate) {
          ship.position = { ...returnGate.position };
        } else {
          ship.position = { x: 0, y: 0 };
        }

        // Discover the sector if not already discovered
        if (!gameState.player.discoveredSectors.includes(targetSector.id)) {
          targetSector.discovered = true;
          gameState.player.discoveredSectors.push(targetSector.id);
          
          // Update galaxy map
          GalaxyNavigation.updateSectorDiscovered(gameState, targetSector.id);
          
          events.push({
            timestamp: Date.now(),
            type: 'discovery',
            message: `${ship.name} discovered new sector: ${targetSector.name}`,
            details: { shipId: ship.id, sectorId: targetSector.id }
          });
        }

        events.push({
          timestamp: Date.now(),
          type: 'movement',
          message: `${ship.name} traveled to ${targetSector.name}`,
          details: { shipId: ship.id, fromSector: currentSector.id, toSector: targetSector.id }
        });
      }
    }
  }

  private static handleGateArrival(ship: Ship, gameState: GameState, events: GameEvent[]): void {
    const currentSector = gameState.sectors.find(s => s.id === ship.sectorId);
    if (!currentSector) return;

    const nearbyGate = currentSector.gates.find(gate => 
      this.getDistance(ship.position, gate.position) < 100
    );

    if (nearbyGate && !gameState.player.discoveredSectors.includes(nearbyGate.connectsTo)) {
      // Discover new sector
      const newSector = gameState.sectors.find(s => s.id === nearbyGate.connectsTo);
      if (newSector) {
        newSector.discovered = true;
        gameState.player.discoveredSectors.push(newSector.id);
        
        // Update galaxy map
        GalaxyNavigation.updateSectorDiscovered(gameState, newSector.id);

        events.push({
          timestamp: Date.now(),
          type: 'discovery',
          message: `${ship.name} discovered new sector: ${newSector.name}`,
          details: { shipId: ship.id, sectorId: newSector.id }
        });
      }
    }
  }
}

// Import WARES from world-generator (this would be better handled with proper dependency injection)
import { WARES } from './world-generator';