import { describe, test, expect, beforeEach } from 'vitest';
import { CommandQueue } from '../command-queue';
import { Ship, ShipCommand, GameState } from '../types';

describe('CommandQueue', () => {
  let testShip: Ship;
  let testGameState: GameState;

  beforeEach(() => {
    testShip = {
      id: 'test-ship',
      name: 'Test Ship',
      type: 'trader',
      position: { x: 0, y: 0 },
      sectorId: 'sector1',
      maxSpeed: 300,
      cargoClass: 'L',
      cargoCapacity: 50,
      cargo: [],
      commandQueue: [],
      isMoving: false
    };

    testGameState = {
      id: 'test-game',
      player: {
        name: 'TestPlayer',
        credits: 100000,
        ships: [testShip],
        discoveredSectors: ['sector1', 'sector2', 'sector3']
      },
      sectors: [
        {
          id: 'sector1',
          name: 'Sector 1',
          discovered: true,
          stations: [],
          gates: [
            { id: 'gate1', position: { x: 100, y: 0 }, connectsTo: 'sector2' }
          ],
          asteroids: []
        },
        {
          id: 'sector2',
          name: 'Sector 2',
          discovered: true,
          stations: [],
          gates: [
            { id: 'gate2a', position: { x: -100, y: 0 }, connectsTo: 'sector1' },
            { id: 'gate2b', position: { x: 100, y: 0 }, connectsTo: 'sector3' }
          ],
          asteroids: []
        },
        {
          id: 'sector3',
          name: 'Sector 3',
          discovered: true,
          stations: [],
          gates: [
            { id: 'gate3', position: { x: -100, y: 0 }, connectsTo: 'sector2' }
          ],
          asteroids: []
        }
      ],
      wares: [],
      gameTime: 0,
      lastUpdate: Date.now()
    };
  });

  describe('Basic queue operations', () => {
    test('should add command to queue', () => {
      const command: ShipCommand = { type: 'move', target: 'station1' };
      
      CommandQueue.addCommand(testShip, command);
      
      expect(testShip.commandQueue).toHaveLength(1);
      expect(testShip.commandQueue[0]).toEqual(command);
    });

    test('should add multiple commands to queue', () => {
      const commands: ShipCommand[] = [
        { type: 'move', target: 'station1' },
        { type: 'trade', target: 'station1' },
        { type: 'move', target: 'station2' }
      ];
      
      CommandQueue.addCommands(testShip, commands);
      
      expect(testShip.commandQueue).toHaveLength(3);
      expect(testShip.commandQueue).toEqual(commands);
    });

    test('should peek next command without removing it', () => {
      const command1: ShipCommand = { type: 'move', target: 'station1' };
      const command2: ShipCommand = { type: 'trade', target: 'station1' };
      
      CommandQueue.addCommands(testShip, [command1, command2]);
      
      const peeked = CommandQueue.peekNextCommand(testShip);
      expect(peeked).toEqual(command1);
      expect(testShip.commandQueue).toHaveLength(2);
    });

    test('should dequeue command', () => {
      const command1: ShipCommand = { type: 'move', target: 'station1' };
      const command2: ShipCommand = { type: 'trade', target: 'station1' };
      
      CommandQueue.addCommands(testShip, [command1, command2]);
      
      const dequeued = CommandQueue.dequeueCommand(testShip);
      expect(dequeued).toEqual(command1);
      expect(testShip.commandQueue).toHaveLength(1);
      expect(testShip.commandQueue[0]).toEqual(command2);
    });

    test('should clear queue', () => {
      const commands: ShipCommand[] = [
        { type: 'move', target: 'station1' },
        { type: 'trade', target: 'station1' }
      ];
      testShip.currentCommand = { type: 'explore' };
      
      CommandQueue.addCommands(testShip, commands);
      CommandQueue.clearQueue(testShip);
      
      expect(testShip.commandQueue).toHaveLength(0);
      expect(testShip.currentCommand).toBeUndefined();
    });
  });

  describe('Command processing', () => {
    test('should start next command when no current command', () => {
      const command: ShipCommand = { type: 'move', target: 'station1' };
      
      CommandQueue.addCommand(testShip, command);
      CommandQueue.processQueue(testShip, testGameState);
      
      expect(testShip.currentCommand).toEqual(command);
      expect(testShip.commandQueue).toHaveLength(0);
    });

    test('should not start new command when one is already running', () => {
      const currentCommand: ShipCommand = { type: 'explore' };
      const queuedCommand: ShipCommand = { type: 'move', target: 'station1' };
      
      testShip.currentCommand = currentCommand;
      CommandQueue.addCommand(testShip, queuedCommand);
      CommandQueue.processQueue(testShip, testGameState);
      
      expect(testShip.currentCommand).toEqual(currentCommand);
      expect(testShip.commandQueue).toHaveLength(1);
    });
  });

  describe('Auto-move commands', () => {
    test('should create auto-move command', () => {
      const command = CommandQueue.createAutoMoveCommand('sector3');
      
      expect(command).toEqual({
        type: 'auto-move',
        parameters: {
          targetSectorId: 'sector3'
        }
      });
    });

    test('should complete auto-move when already in target sector', () => {
      const command = CommandQueue.createAutoMoveCommand('sector1');
      
      CommandQueue.addCommand(testShip, command);
      CommandQueue.processQueue(testShip, testGameState);
      
      expect(testShip.currentCommand).toBeUndefined();
    });

    test('should generate gate commands for cross-sector auto-move', () => {
      const command = CommandQueue.createAutoMoveCommand('sector3');
      
      CommandQueue.addCommand(testShip, command);
      CommandQueue.processQueue(testShip, testGameState);
      
      // Should have generated 2 gate commands (sector1 -> sector2 -> sector3)
      expect(testShip.commandQueue.length).toBeGreaterThan(0);
      expect(testShip.commandQueue[0]?.type).toBe('move');
      expect(testShip.commandQueue[0]?.target).toBe('gate1'); // First gate from sector1 to sector2
    });
  });

  describe('Utility methods', () => {
    test('should check if ship has commands', () => {
      expect(CommandQueue.hasCommands(testShip)).toBe(false);
      
      CommandQueue.addCommand(testShip, { type: 'move', target: 'station1' });
      expect(CommandQueue.hasCommands(testShip)).toBe(true);
      
      testShip.commandQueue = [];
      testShip.currentCommand = { type: 'explore' };
      expect(CommandQueue.hasCommands(testShip)).toBe(true);
    });

    test('should count total commands', () => {
      expect(CommandQueue.getCommandCount(testShip)).toBe(0);
      
      CommandQueue.addCommands(testShip, [
        { type: 'move', target: 'station1' },
        { type: 'trade', target: 'station1' }
      ]);
      expect(CommandQueue.getCommandCount(testShip)).toBe(2);
      
      testShip.currentCommand = { type: 'explore' };
      expect(CommandQueue.getCommandCount(testShip)).toBe(3);
    });

    test('should get all commands', () => {
      const queuedCommands: ShipCommand[] = [
        { type: 'move', target: 'station1' },
        { type: 'trade', target: 'station1' }
      ];
      const currentCommand: ShipCommand = { type: 'explore' };
      
      CommandQueue.addCommands(testShip, queuedCommands);
      testShip.currentCommand = currentCommand;
      
      const allCommands = CommandQueue.getAllCommands(testShip);
      expect(allCommands).toHaveLength(3);
      expect(allCommands[0]).toEqual(currentCommand);
      expect(allCommands[1]).toEqual(queuedCommands[0]);
      expect(allCommands[2]).toEqual(queuedCommands[1]);
    });
  });
});