// Navigation engine for cross-sector pathfinding
// Implements pathfinding algorithm to find optimal routes between sectors

import { GameState, Sector, Gate } from './types';

export interface RouteStep {
  fromSectorId: string;
  toSectorId: string;
  gateId: string;
  distance: number;
}

export interface Route {
  steps: RouteStep[];
  totalDistance: number;
  estimatedTime: number; // in seconds
}

export class NavigationEngine {
  /**
   * Find the shortest route between two sectors using Dijkstra's algorithm
   */
  static findRoute(
    gameState: GameState,
    fromSectorId: string,
    toSectorId: string,
    shipSpeed: number = 300
  ): Route | null {
    // Same sector, no route needed
    if (fromSectorId === toSectorId) {
      return {
        steps: [],
        totalDistance: 0,
        estimatedTime: 0
      };
    }

    // Build adjacency graph from sectors
    const graph = this.buildSectorGraph(gameState);
    
    // Check if both sectors exist in graph
    if (!graph.has(fromSectorId) || !graph.has(toSectorId)) {
      return null; // Sector not found
    }
    
    // Run Dijkstra's algorithm
    const path = this.dijkstra(graph, fromSectorId, toSectorId);
    
    if (!path) {
      return null; // No route found
    }

    // Build route steps
    const steps: RouteStep[] = [];
    let totalDistance = 0;

    for (let i = 0; i < path.length - 1; i++) {
      const fromSector = gameState.sectors.find(s => s.id === path[i]);
      const toSector = gameState.sectors.find(s => s.id === path[i + 1]);
      
      if (!fromSector || !toSector) continue;

      // Find the connecting gate
      const gate = fromSector.gates.find(g => g.connectsTo === toSector.id);
      if (!gate) continue;

      const distance = this.calculateGateDistance(fromSector, gate);
      totalDistance += distance;

      steps.push({
        fromSectorId: fromSector.id,
        toSectorId: toSector.id,
        gateId: gate.id,
        distance
      });
    }

    const estimatedTime = totalDistance / shipSpeed;

    return {
      steps,
      totalDistance,
      estimatedTime
    };
  }

  /**
   * Build adjacency graph from sectors and gates
   */
  private static buildSectorGraph(gameState: GameState): Map<string, string[]> {
    const graph = new Map<string, string[]>();

    gameState.sectors.forEach(sector => {
      const neighbors = sector.gates
        .filter(gate => gate.connectsTo) // Only gates with valid targets
        .map(gate => gate.connectsTo) as string[];
      
      graph.set(sector.id, neighbors);
    });

    return graph;
  }

  /**
   * Dijkstra's algorithm implementation for finding shortest path
   */
  private static dijkstra(
    graph: Map<string, string[]>,
    start: string,
    end: string
  ): string[] | null {
    // Use BFS for unweighted graph - simpler and more reliable
    const queue: string[] = [start];
    const visited = new Set<string>();
    const previous = new Map<string, string | null>();
    
    visited.add(start);
    previous.set(start, null);

    while (queue.length > 0) {
      const current = queue.shift()!;
      
      if (current === end) {
        // Build path
        const path: string[] = [];
        let step: string | null = end;
        
        while (step) {
          path.unshift(step);
          step = previous.get(step) || null;
        }
        
        return path;
      }

      // Check neighbors
      const neighbors = graph.get(current) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          previous.set(neighbor, current);
          queue.push(neighbor);
        }
      }
    }

    return null; // No path found
  }

  /**
   * Calculate distance from sector center to gate
   * In real implementation, would consider ship's current position
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
  private static calculateGateDistance(_sector: Sector, _gate: Gate): number {
    // For simplicity, use fixed distance estimate
    // In real game, would calculate from ship position to gate
    return 5000; // Average distance to gate
  }

  /**
   * Estimate total travel time for a route including gate jumps
   */
  static estimateTravelTime(
    route: Route,
    shipSpeed: number = 300,
    gateJumpTime: number = 5 // seconds per gate jump
  ): number {
    const travelTime = route.totalDistance / shipSpeed;
    const jumpTime = route.steps.length * gateJumpTime;
    return travelTime + jumpTime;
  }

  /**
   * Check if a sector has been discovered
   */
  static isSectorDiscovered(gameState: GameState, sectorId: string): boolean {
    const sector = gameState.sectors.find(s => s.id === sectorId);
    return sector?.discovered || false;
  }

  /**
   * Get all discovered sectors connected to a given sector
   */
  static getConnectedSectors(gameState: GameState, sectorId: string): string[] {
    const sector = gameState.sectors.find(s => s.id === sectorId);
    if (!sector) return [];

    return sector.gates
      .map(gate => gate.connectsTo)
      .filter(targetId => this.isSectorDiscovered(gameState, targetId));
  }
}