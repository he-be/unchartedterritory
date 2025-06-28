import { create } from 'zustand';
import { GameState, ShipCommand, TradeOpportunity, GameEvent } from '../types/game';
import gameApi from '../services/api';
import { WebSocketService, ConnectionStatus } from '../services/websocket';

interface GameStore {
  gameState: GameState | null;
  selectedShipId: string | null;
  selectedSectorId: string | null;
  tradeOpportunities: TradeOpportunity[] | null;
  isLoading: boolean;
  error: string | null;
  connectionStatus: ConnectionStatus;
  recentEvents: GameEvent[];
  pollingInterval: NodeJS.Timeout | null; // Deprecated, keeping for backward compatibility
  
  // WebSocket-based methods
  connectToGame: (gameId: string) => Promise<void>;
  disconnectFromGame: () => void;
  sendShipCommand: (shipId: string, command: ShipCommand) => void;
  performTrade: (
    shipId: string,
    stationId: string,
    wareId: string,
    quantity: number,
    action: 'buy' | 'sell'
  ) => void;
  
  // HTTP fallback methods (deprecated but maintained for compatibility)
  startNewGame: (playerName: string) => Promise<void>;
  loadGame: (gameId: string) => Promise<void>;
  refreshGameState: () => Promise<void>;
  loadTradeOpportunities: () => Promise<void>;
  startPolling: (interval?: number) => void;
  stopPolling: () => void;
  
  // UI state management
  selectShip: (shipId: string | null) => void;
  selectSector: (sectorId: string | null) => void;
  clearError: () => void;
  clearEvents: () => void;
}

// WebSocket service instance
const wsService = new WebSocketService({
  baseUrl: (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL || 
           window.location.origin + '/api',
  reconnectAttempts: 5,
  reconnectDelay: 1000,
  heartbeatInterval: 30000,
});

// Set up WebSocket event handlers
wsService.setOnStatusChange((status) => {
  useGameStore.setState({ connectionStatus: status });
});

wsService.setOnGameStateUpdate((gameState) => {
  useGameStore.setState({ gameState });
});

wsService.setOnEvents((events) => {
  const currentEvents = useGameStore.getState().recentEvents;
  useGameStore.setState({ 
    recentEvents: [...currentEvents, ...events].slice(-50) // Keep last 50 events
  });
});

wsService.setOnError((error) => {
  useGameStore.setState({ error });
});

wsService.setOnCommandResult((result) => {
  // Handle command results - could trigger UI notifications
  if (result.type === 'error') {
    useGameStore.setState({ error: result.message || 'Command failed' });
  }
});

export const useGameStore = create<GameStore>((set, get) => ({
  gameState: null,
  selectedShipId: null,
  selectedSectorId: null,
  tradeOpportunities: null,
  isLoading: false,
  error: null,
  connectionStatus: 'disconnected',
  recentEvents: [],
  pollingInterval: null,

  // WebSocket-based methods
  connectToGame: async (gameId: string) => {
    set({ isLoading: true, error: null });
    try {
      await wsService.connect(gameId);
      // Request initial state after connection
      wsService.requestState();
      set({ isLoading: false });
    } catch (error) {
      set({ 
        error: (error as Error).message || 'Failed to connect to game',
        isLoading: false 
      });
      throw error;
    }
  },

  disconnectFromGame: () => {
    wsService.disconnect();
    set({ 
      gameState: null,
      connectionStatus: 'disconnected',
      recentEvents: [],
      selectedShipId: null,
      selectedSectorId: null 
    });
  },

  sendShipCommand: (shipId: string, command: ShipCommand) => {
    if (wsService.isConnected()) {
      wsService.sendCommand(shipId, command);
    } else {
      set({ error: 'Not connected to game server' });
    }
  },

  performTrade: (
    shipId: string,
    stationId: string,
    wareId: string,
    quantity: number,
    action: 'buy' | 'sell'
  ) => {
    if (wsService.isConnected()) {
      wsService.sendTrade(shipId, {
        stationId,
        wareId,
        quantity,
        action,
      });
    } else {
      set({ error: 'Not connected to game server' });
    }
  },

  // HTTP fallback methods (deprecated but maintained for compatibility)
  startNewGame: async (playerName: string) => {
    set({ isLoading: true, error: null });
    try {
      const gameState = await gameApi.createNewGame(playerName);
      set({ gameState, isLoading: false });
      
      // Try to connect via WebSocket, fallback to polling if failed
      try {
        await get().connectToGame(gameState.id);
      } catch (wsError) {
        console.warn('WebSocket connection failed, falling back to HTTP polling:', wsError);
        get().startPolling();
      }
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  loadGame: async (gameId: string) => {
    set({ isLoading: true, error: null });
    try {
      const gameState = await gameApi.getGameState(gameId);
      set({ gameState, isLoading: false });
      
      // Try to connect via WebSocket, fallback to polling if failed
      try {
        await get().connectToGame(gameId);
      } catch (wsError) {
        console.warn('WebSocket connection failed, falling back to HTTP polling:', wsError);
        get().startPolling();
      }
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  refreshGameState: async () => {
    const { gameState } = get();
    if (!gameState) return;

    try {
      const newGameState = await gameApi.getGameState(gameState.id);
      set({ gameState: newGameState });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  selectShip: (shipId: string | null) => {
    set({ selectedShipId: shipId });
  },

  selectSector: (sectorId: string | null) => {
    set({ selectedSectorId: sectorId });
  },

  // Note: sendShipCommand and performTrade are now implemented above as WebSocket methods

  loadTradeOpportunities: async () => {
    const { gameState } = get();
    if (!gameState) return;

    try {
      const opportunities = await gameApi.getTradeOpportunities(gameState.id);
      set({ tradeOpportunities: opportunities });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  startPolling: (interval = 1000) => {
    const { pollingInterval } = get();
    if (pollingInterval) clearInterval(pollingInterval);

    const newInterval = setInterval(() => {
      get().refreshGameState();
    }, interval);

    set({ pollingInterval: newInterval });
  },

  stopPolling: () => {
    const { pollingInterval } = get();
    if (pollingInterval) {
      clearInterval(pollingInterval);
      set({ pollingInterval: null });
    }
  },

  clearError: () => {
    set({ error: null });
  },

  clearEvents: () => {
    set({ recentEvents: [] });
  },
}));