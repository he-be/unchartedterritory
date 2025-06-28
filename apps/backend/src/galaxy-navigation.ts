// Galaxy-level navigation system for cross-sector ship movement
// Provides high-level navigation using the galaxy map concept

import { GameState, GalaxyConnection, Vector2 } from './types';

export interface GalaxyRoute {
  steps: GalaxyStep[];
  totalConnections: number;
}

export interface GalaxyStep {
  fromSector: string;
  toSector: string;
  connection: GalaxyConnection;
  gateId: string; // Gate ID to use in the current sector
}

export class GalaxyNavigation {
  /**
   * Find all gates in the galaxy (including those in other sectors)
   */
  static findAllGates(gameState: GameState): Array<{ gateId: string; sectorId: string; sectorName: string; targetSectorId: string }> {
    const allGates: Array<{ gateId: string; sectorId: string; sectorName: string; targetSectorId: string }> = [];
    
    gameState.sectors.forEach(sector => {
      sector.gates.forEach(gate => {
        allGates.push({
          gateId: gate.id,
          sectorId: sector.id,
          sectorName: sector.name,
          targetSectorId: gate.connectsTo
        });
      });
    });
    
    return allGates;
  }

  /**
   * Find a gate by ID across all sectors
   */
  static findGateById(gameState: GameState, gateId: string): { gate: any; sector: any } | null {
    for (const sector of gameState.sectors) {
      const gate = sector.gates.find(g => g.id === gateId);
      if (gate) {
        return { gate, sector };
      }
    }
    return null;
  }

  /**
   * Get the connection for a specific gate
   */
  static getConnectionForGate(gameState: GameState, gateId: string): GalaxyConnection | null {
    const gateInfo = this.findGateById(gameState, gateId);
    if (!gateInfo) return null;

    return gameState.galaxyMap.connections.find(conn => 
      conn.gateAId === gateId || conn.gateBId === gateId
    ) || null;
  }

  /**
   * Get the opposite gate ID for a connection
   */
  static getOppositeGate(connection: GalaxyConnection, currentGateId: string): string {
    return connection.gateAId === currentGateId ? connection.gateBId : connection.gateAId;
  }

  /**
   * Get the target sector for a gate
   */
  static getTargetSector(connection: GalaxyConnection, currentSectorId: string): string {
    return connection.sectorA === currentSectorId ? connection.sectorB : connection.sectorA;
  }

  /**
   * Find route between sectors using galaxy map
   */
  static findGalaxyRoute(gameState: GameState, fromSectorId: string, toSectorId: string): GalaxyRoute | null {
    if (fromSectorId === toSectorId) {
      return { steps: [], totalConnections: 0 };
    }

    // Use BFS to find shortest path
    const queue: Array<{ sectorId: string; path: GalaxyStep[] }> = [
      { sectorId: fromSectorId, path: [] }
    ];
    const visited = new Set<string>([fromSectorId]);

    while (queue.length > 0) {
      const current = queue.shift()!;
      
      // Find all connections from current sector
      const connections = gameState.galaxyMap.connections.filter(conn =>
        conn.sectorA === current.sectorId || conn.sectorB === current.sectorId
      );

      for (const connection of connections) {
        const nextSectorId = this.getTargetSector(connection, current.sectorId);
        
        if (nextSectorId === toSectorId) {
          // Found the target
          const gateId = current.sectorId === connection.sectorA ? connection.gateAId : connection.gateBId;
          const finalStep: GalaxyStep = {
            fromSector: current.sectorId,
            toSector: nextSectorId,
            connection,
            gateId
          };
          
          return {
            steps: [...current.path, finalStep],
            totalConnections: current.path.length + 1
          };
        }

        if (!visited.has(nextSectorId)) {
          visited.add(nextSectorId);
          const gateId = current.sectorId === connection.sectorA ? connection.gateAId : connection.gateBId;
          const step: GalaxyStep = {
            fromSector: current.sectorId,
            toSector: nextSectorId,
            connection,
            gateId
          };
          
          queue.push({
            sectorId: nextSectorId,
            path: [...current.path, step]
          });
        }
      }
    }

    return null; // No route found
  }

  /**
   * Check if a sector is discovered
   */
  static isSectorDiscovered(gameState: GameState, sectorId: string): boolean {
    return gameState.galaxyMap.sectors[sectorId]?.discovered || false;
  }

  /**
   * Get all discovered sectors
   */
  static getDiscoveredSectors(gameState: GameState): string[] {
    return Object.keys(gameState.galaxyMap.sectors).filter(sectorId =>
      gameState.galaxyMap.sectors[sectorId]?.discovered
    );
  }

  /**
   * Get galaxy map position for a sector
   */
  static getSectorPosition(gameState: GameState, sectorId: string): Vector2 | null {
    return gameState.galaxyMap.sectors[sectorId]?.position || null;
  }

  /**
   * Update galaxy map when a sector is discovered
   */
  static updateSectorDiscovered(gameState: GameState, sectorId: string): void {
    if (gameState.galaxyMap.sectors[sectorId]) {
      gameState.galaxyMap.sectors[sectorId].discovered = true;
    }
  }
}