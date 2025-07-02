import type { 
  SectorGraph, 
  SectorConnection, 
  Sector, 
  Gate, 
  GateValidationResult
} from './types';

export interface SectorMetadata {
  id: string;
  name: string;
  coordinates: { x: number; y: number };
}

export class SectorGraphManager {
  private graph: SectorGraph;
  private sectorMetadata: Map<string, SectorMetadata>;

  constructor() {
    this.graph = this.createSectorGraph();
    this.sectorMetadata = this.createSectorMetadata();
  }

  /**
   * Define the canonical sector connection graph
   * This is the single source of truth for all sector connectivity
   * Based on the mathematically perfect graph structure
   */
  private createSectorGraph(): SectorGraph {
    const connections: SectorConnection[] = [
      // Three Worlds connections (2 gates: East, South)
      { fromSectorId: 'three-worlds', toSectorId: 'power-circle', gatePosition: { x: 400, y: 0 } },      // East
      { fromSectorId: 'three-worlds', toSectorId: 'cloudbase-nw', gatePosition: { x: 0, y: 400 } },     // South
      
      // Power Circle connections (3 gates: West, East, South)
      { fromSectorId: 'power-circle', toSectorId: 'three-worlds', gatePosition: { x: -400, y: 0 } },       // West
      { fromSectorId: 'power-circle', toSectorId: 'antigone-memorial', gatePosition: { x: 400, y: 0 } },  // East
      { fromSectorId: 'power-circle', toSectorId: 'herrons-nebula', gatePosition: { x: 0, y: 400 } },     // South
      
      // Antigone Memorial connections (2 gates: West, East)
      { fromSectorId: 'antigone-memorial', toSectorId: 'power-circle', gatePosition: { x: -400, y: 0 } }, // West
      { fromSectorId: 'antigone-memorial', toSectorId: 'the-hole', gatePosition: { x: 400, y: 0 } },      // East
      
      // Cloudbase NW connections (3 gates: North, East, South)
      { fromSectorId: 'cloudbase-nw', toSectorId: 'three-worlds', gatePosition: { x: 0, y: -400 } },       // North
      { fromSectorId: 'cloudbase-nw', toSectorId: 'herrons-nebula', gatePosition: { x: 400, y: 0 } },     // East
      { fromSectorId: 'cloudbase-nw', toSectorId: 'ringo-moon', gatePosition: { x: 0, y: 400 } },          // South
      
      // Herron's Nebula connections (4 gates: North, West, East, South)
      { fromSectorId: 'herrons-nebula', toSectorId: 'power-circle', gatePosition: { x: 0, y: -400 } },     // North
      { fromSectorId: 'herrons-nebula', toSectorId: 'cloudbase-nw', gatePosition: { x: -400, y: 0 } },     // West
      { fromSectorId: 'herrons-nebula', toSectorId: 'the-hole', gatePosition: { x: 400, y: 0 } },          // East
      { fromSectorId: 'herrons-nebula', toSectorId: 'argon-prime', gatePosition: { x: 0, y: 400 } },        // South
      
      // The Hole connections (3 gates: West, North, East) - FIXED OVERLAP
      { fromSectorId: 'the-hole', toSectorId: 'antigone-memorial', gatePosition: { x: -400, y: 0 } },      // West
      { fromSectorId: 'the-hole', toSectorId: 'herrons-nebula', gatePosition: { x: 0, y: -400 } },         // North
      { fromSectorId: 'the-hole', toSectorId: 'the-wall', gatePosition: { x: 400, y: 0 } },              // East
      
      // Ringo Moon connections (3 gates: North, East, South)
      { fromSectorId: 'ringo-moon', toSectorId: 'cloudbase-nw', gatePosition: { x: 0, y: -400 } },         // North
      { fromSectorId: 'ringo-moon', toSectorId: 'argon-prime', gatePosition: { x: 400, y: 0 } },           // East
      { fromSectorId: 'ringo-moon', toSectorId: 'red-light', gatePosition: { x: 0, y: 400 } },          // South
      
      // Argon Prime connections (4 gates: North, West, East, South)
      { fromSectorId: 'argon-prime', toSectorId: 'herrons-nebula', gatePosition: { x: 0, y: -400 } },      // North
      { fromSectorId: 'argon-prime', toSectorId: 'ringo-moon', gatePosition: { x: -400, y: 0 } },          // West
      { fromSectorId: 'argon-prime', toSectorId: 'the-wall', gatePosition: { x: 400, y: 0 } },             // East
      { fromSectorId: 'argon-prime', toSectorId: 'home-of-light', gatePosition: { x: 0, y: 400 } },
      
      // The Wall connections (3 gates: North, West, East) - FIXED OVERLAP
      { fromSectorId: 'the-wall', toSectorId: 'the-hole', gatePosition: { x: 0, y: -400 } },              // North
      { fromSectorId: 'the-wall', toSectorId: 'argon-prime', gatePosition: { x: -400, y: 0 } },           // West
      { fromSectorId: 'the-wall', toSectorId: 'presidents-end', gatePosition: { x: 400, y: 0 } },         // East
      
      // Red Light connections (3 gates: North, East, South)
      { fromSectorId: 'red-light', toSectorId: 'ringo-moon', gatePosition: { x: 0, y: -400 } },            // North
      { fromSectorId: 'red-light', toSectorId: 'home-of-light', gatePosition: { x: 400, y: 0 } },         // East
      { fromSectorId: 'red-light', toSectorId: 'cloudbase-sw', gatePosition: { x: 0, y: 400 } },         // South
      
      // Home of Light connections (4 gates: North, West, East, South)
      { fromSectorId: 'home-of-light', toSectorId: 'argon-prime', gatePosition: { x: 0, y: -400 } },       // North
      { fromSectorId: 'home-of-light', toSectorId: 'red-light', gatePosition: { x: -400, y: 0 } },        // West
      { fromSectorId: 'home-of-light', toSectorId: 'presidents-end', gatePosition: { x: 400, y: 0 } },    // East
      { fromSectorId: 'home-of-light', toSectorId: 'ore-belt', gatePosition: { x: 0, y: 400 } },        // South
      
      // President's End connections (4 gates: North, West, East, South) - FIXED OVERLAP
      { fromSectorId: 'presidents-end', toSectorId: 'the-wall', gatePosition: { x: 0, y: -400 } },         // North
      { fromSectorId: 'presidents-end', toSectorId: 'home-of-light', gatePosition: { x: -400, y: 0 } },    // West
      { fromSectorId: 'presidents-end', toSectorId: 'elena-fortune', gatePosition: { x: 400, y: 0 } },     // East
      { fromSectorId: 'presidents-end', toSectorId: 'cloudbase-se', gatePosition: { x: 0, y: 400 } },     // South
      
      // Cloudbase SW connections (2 gates: North, East)
      { fromSectorId: 'cloudbase-sw', toSectorId: 'red-light', gatePosition: { x: 0, y: -400 } },          // North
      { fromSectorId: 'cloudbase-sw', toSectorId: 'ore-belt', gatePosition: { x: 400, y: 0 } },           // East
      
      // Ore Belt connections (3 gates: North, West, East)
      { fromSectorId: 'ore-belt', toSectorId: 'home-of-light', gatePosition: { x: 0, y: -400 } },          // North
      { fromSectorId: 'ore-belt', toSectorId: 'cloudbase-sw', gatePosition: { x: -400, y: 0 } },           // West
      { fromSectorId: 'ore-belt', toSectorId: 'cloudbase-se', gatePosition: { x: 400, y: 0 } },         // East
      
      // Cloudbase SE connections (2 gates: West, North)
      { fromSectorId: 'cloudbase-se', toSectorId: 'ore-belt', gatePosition: { x: -400, y: 0 } },           // West
      { fromSectorId: 'cloudbase-se', toSectorId: 'presidents-end', gatePosition: { x: 0, y: -400 } },     // North
      
      // Elena's Fortune connections (1 gate: West)
      { fromSectorId: 'elena-fortune', toSectorId: 'presidents-end', gatePosition: { x: -400, y: 0 } }       // West
    ];

    return { connections };
  }

  /**
   * Define metadata for all sectors
   * This is the single source of truth for sector information
   */
  private createSectorMetadata(): Map<string, SectorMetadata> {
    const metadata = new Map<string, SectorMetadata>();
    
    // Define all 16 sectors based on the graph
    metadata.set('three-worlds', { id: 'three-worlds', name: 'Three Worlds', coordinates: { x: 0, y: 0 } });
    metadata.set('power-circle', { id: 'power-circle', name: 'Power Circle', coordinates: { x: 1, y: 0 } });
    metadata.set('antigone-memorial', { id: 'antigone-memorial', name: 'Antigone Memorial', coordinates: { x: 2, y: 0 } });
    metadata.set('cloudbase-nw', { id: 'cloudbase-nw', name: 'Cloudbase Northwest', coordinates: { x: 0, y: 1 } });
    metadata.set('herrons-nebula', { id: 'herrons-nebula', name: "Herron's Nebula", coordinates: { x: 1, y: 1 } });
    metadata.set('the-hole', { id: 'the-hole', name: 'The Hole', coordinates: { x: 2, y: 1 } });
    metadata.set('ringo-moon', { id: 'ringo-moon', name: 'Ringo Moon', coordinates: { x: 0, y: 2 } });
    metadata.set('argon-prime', { id: 'argon-prime', name: 'Argon Prime', coordinates: { x: 1, y: 2 } });
    metadata.set('the-wall', { id: 'the-wall', name: 'The Wall', coordinates: { x: 2, y: 2 } });
    metadata.set('red-light', { id: 'red-light', name: 'Red Light', coordinates: { x: 0, y: 3 } });
    metadata.set('home-of-light', { id: 'home-of-light', name: 'Home of Light', coordinates: { x: 1, y: 3 } });
    metadata.set('presidents-end', { id: 'presidents-end', name: "President's End", coordinates: { x: 2, y: 3 } });
    metadata.set('cloudbase-sw', { id: 'cloudbase-sw', name: 'Cloudbase Southwest', coordinates: { x: 0, y: 4 } });
    metadata.set('ore-belt', { id: 'ore-belt', name: 'Ore Belt', coordinates: { x: 1, y: 4 } });
    metadata.set('cloudbase-se', { id: 'cloudbase-se', name: 'Cloudbase Southeast', coordinates: { x: 2, y: 4 } });
    metadata.set('elena-fortune', { id: 'elena-fortune', name: "Elena's Fortune", coordinates: { x: 3, y: 3 } });
    
    return metadata;
  }

  /**
   * Generate gates for a sector based on the graph
   */
  public generateGatesForSector(sectorId: string): Gate[] {
    const outgoingConnections = this.graph.connections.filter(
      conn => conn.fromSectorId === sectorId
    );

    return outgoingConnections.map(conn => ({
      id: `gate-${conn.fromSectorId}-to-${conn.toSectorId}`,
      position: conn.gatePosition,
      targetSectorId: conn.toSectorId
    }));
  }

  /**
   * Validate that sector gates match the graph
   */
  public validateSectorGates(sectors: Sector[]): GateValidationResult {
    const errors: string[] = [];
    const missingGates: SectorConnection[] = [];
    const extraGates: Gate[] = [];

    for (const sector of sectors) {
      const expectedGates = this.generateGatesForSector(sector.id);
      const actualGates = sector.gates;

      // Check for missing gates
      for (const expectedGate of expectedGates) {
        const matchingGate = actualGates.find(gate => 
          gate.targetSectorId === expectedGate.targetSectorId
        );

        if (!matchingGate) {
          const connection = this.graph.connections.find(conn => 
            conn.fromSectorId === sector.id && 
            conn.toSectorId === expectedGate.targetSectorId
          );
          if (connection) {
            missingGates.push(connection);
            errors.push(
              `Missing gate in sector '${sector.id}' to '${expectedGate.targetSectorId}'`
            );
          }
        } else if (
          Math.abs(matchingGate.position.x - expectedGate.position.x) > 1 ||
          Math.abs(matchingGate.position.y - expectedGate.position.y) > 1
        ) {
          errors.push(
            `Gate position mismatch in sector '${sector.id}' to '${expectedGate.targetSectorId}': ` +
            `expected (${expectedGate.position.x}, ${expectedGate.position.y}), ` +
            `got (${matchingGate.position.x}, ${matchingGate.position.y})`
          );
        }
      }

      // Check for extra gates
      for (const actualGate of actualGates) {
        const expectedGate = expectedGates.find(gate => 
          gate.targetSectorId === actualGate.targetSectorId
        );

        if (!expectedGate) {
          extraGates.push(actualGate);
          errors.push(
            `Extra gate in sector '${sector.id}' to '${actualGate.targetSectorId}' not defined in graph`
          );
        }
      }
    }

    // Check for bidirectional consistency
    for (const connection of this.graph.connections) {
      const reverseConnection = this.graph.connections.find(conn =>
        conn.fromSectorId === connection.toSectorId &&
        conn.toSectorId === connection.fromSectorId
      );

      if (!reverseConnection) {
        errors.push(
          `Unidirectional connection detected: '${connection.fromSectorId}' -> '${connection.toSectorId}' ` +
          `has no return path`
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      missingGates,
      extraGates
    };
  }

  /**
   * Get all connections from the graph
   */
  public getConnections(): SectorConnection[] {
    return [...this.graph.connections];
  }

  /**
   * Check if there's a direct connection between two sectors
   */
  public hasDirectConnection(fromSectorId: string, toSectorId: string): boolean {
    return this.graph.connections.some(conn =>
      conn.fromSectorId === fromSectorId && conn.toSectorId === toSectorId
    );
  }

  /**
   * Get all sectors reachable from a given sector
   */
  public getReachableSectors(sectorId: string): string[] {
    return this.graph.connections
      .filter(conn => conn.fromSectorId === sectorId)
      .map(conn => conn.toSectorId);
  }

  /**
   * Get all sector IDs from the graph
   */
  public getAllSectorIds(): string[] {
    return Array.from(this.sectorMetadata.keys());
  }

  /**
   * Get metadata for a specific sector
   */
  public getSectorMetadata(sectorId: string): SectorMetadata | undefined {
    return this.sectorMetadata.get(sectorId);
  }

  /**
   * Get all sector metadata
   */
  public getAllSectorMetadata(): SectorMetadata[] {
    return Array.from(this.sectorMetadata.values());
  }

  /**
   * Verify graph connectivity (all sectors are reachable from any sector)
   */
  public validateGraphConnectivity(allSectorIds: string[]): { isConnected: boolean; errors: string[] } {
    const errors: string[] = [];

    if (allSectorIds.length === 0) {
      return { isConnected: true, errors: [] };
    }

    // Use BFS to check if all sectors are reachable from the first sector
    const startSector = allSectorIds[0];
    const visited = new Set<string>();
    const queue = [startSector];
    visited.add(startSector);

    while (queue.length > 0) {
      const currentSector = queue.shift()!;
      const reachable = this.getReachableSectors(currentSector);

      for (const nextSector of reachable) {
        if (!visited.has(nextSector)) {
          visited.add(nextSector);
          queue.push(nextSector);
        }
      }
    }

    const unreachableSectors = allSectorIds.filter(id => !visited.has(id));
    if (unreachableSectors.length > 0) {
      errors.push(
        `Unreachable sectors from '${startSector}': ${unreachableSectors.join(', ')}`
      );
    }

    return {
      isConnected: unreachableSectors.length === 0,
      errors
    };
  }
}