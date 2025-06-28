// Command queue management for ships
// Handles queuing, execution, and automatic progression of ship commands

import { Ship, ShipCommand, GameState } from './types';
import { NavigationEngine } from './navigation-engine';

export class CommandQueue {
  /**
   * Add a command to a ship's queue
   */
  static addCommand(ship: Ship, command: ShipCommand): void {
    ship.commandQueue.push(command);
  }

  /**
   * Add multiple commands to a ship's queue
   */
  static addCommands(ship: Ship, commands: ShipCommand[]): void {
    ship.commandQueue.push(...commands);
  }

  /**
   * Get the next command from the queue without removing it
   */
  static peekNextCommand(ship: Ship): ShipCommand | null {
    return ship.commandQueue[0] || null;
  }

  /**
   * Remove and return the next command from the queue
   */
  static dequeueCommand(ship: Ship): ShipCommand | null {
    return ship.commandQueue.shift() || null;
  }

  /**
   * Clear all commands from the queue
   */
  static clearQueue(ship: Ship): void {
    ship.commandQueue = [];
    ship.currentCommand = undefined;
  }

  /**
   * Process the command queue for a ship
   * If no current command, start the next queued command
   */
  static processQueue(ship: Ship, gameState: GameState): void {
    // If ship has no current command, start the next queued command
    if (!ship.currentCommand && ship.commandQueue.length > 0) {
      const nextCommand = this.dequeueCommand(ship);
      if (nextCommand) {
        this.startCommand(ship, nextCommand, gameState);
      }
    }
  }

  /**
   * Start executing a command
   */
  private static startCommand(ship: Ship, command: ShipCommand, gameState: GameState): void {
    ship.currentCommand = command;

    switch (command.type) {
      case 'auto-move':
        this.handleAutoMoveCommand(ship, command, gameState);
        break;
      case 'move':
      case 'explore':
      case 'trade':
        // These are handled by existing command system
        break;
    }
  }

  /**
   * Handle auto-move command with cross-sector navigation
   */
  private static handleAutoMoveCommand(ship: Ship, command: ShipCommand, gameState: GameState): void {
    const targetSectorId = command.parameters?.targetSectorId;
    if (!targetSectorId) {
      console.warn('Auto-move command missing targetSectorId');
      ship.currentCommand = undefined;
      return;
    }

    // If already in target sector, command is complete
    if (ship.sectorId === targetSectorId) {
      ship.currentCommand = undefined;
      return;
    }

    // Find route to target sector
    const route = NavigationEngine.findRoute(gameState, ship.sectorId, targetSectorId, ship.maxSpeed);
    if (!route) {
      console.warn(`No route found from ${ship.sectorId} to ${targetSectorId}`);
      ship.currentCommand = undefined;
      return;
    }

    // Convert route steps to individual gate jump commands
    const gateCommands: ShipCommand[] = route.steps.map(step => ({
      type: 'move' as const,
      target: step.gateId,
      parameters: {
        targetSectorId: step.toSectorId
      }
    }));

    // Add gate commands to the front of the queue
    ship.commandQueue.unshift(...gateCommands);
    
    // Clear current command so the next gate command can start
    ship.currentCommand = undefined;
  }

  /**
   * Check if a ship has any commands (current or queued)
   */
  static hasCommands(ship: Ship): boolean {
    return !!ship.currentCommand || ship.commandQueue.length > 0;
  }

  /**
   * Get total number of commands for a ship (current + queued)
   */
  static getCommandCount(ship: Ship): number {
    return (ship.currentCommand ? 1 : 0) + ship.commandQueue.length;
  }

  /**
   * Get all commands for a ship (current + queued)
   */
  static getAllCommands(ship: Ship): ShipCommand[] {
    const commands: ShipCommand[] = [];
    if (ship.currentCommand) {
      commands.push(ship.currentCommand);
    }
    commands.push(...ship.commandQueue);
    return commands;
  }

  /**
   * Create an auto-move command to a specific sector
   */
  static createAutoMoveCommand(targetSectorId: string): ShipCommand {
    return {
      type: 'auto-move',
      parameters: {
        targetSectorId
      }
    };
  }
}