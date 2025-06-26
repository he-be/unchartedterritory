import { create } from 'zustand';
import { GameState, ShipCommand, TradeOpportunity } from '../types/game';
import gameApi from '../services/api';

interface GameStore {
  gameState: GameState | null;
  selectedShipId: string | null;
  selectedSectorId: string | null;
  tradeOpportunities: TradeOpportunity[] | null;
  isLoading: boolean;
  error: string | null;
  pollingInterval: NodeJS.Timeout | null;

  startNewGame: (playerName: string) => Promise<void>;
  loadGame: (gameId: string) => Promise<void>;
  refreshGameState: () => Promise<void>;
  selectShip: (shipId: string | null) => void;
  selectSector: (sectorId: string | null) => void;
  sendShipCommand: (shipId: string, command: ShipCommand) => Promise<void>;
  performTrade: (
    shipId: string,
    stationId: string,
    wareId: string,
    quantity: number,
    action: 'buy' | 'sell'
  ) => Promise<void>;
  loadTradeOpportunities: () => Promise<void>;
  startPolling: (interval?: number) => void;
  stopPolling: () => void;
  clearError: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  gameState: null,
  selectedShipId: null,
  selectedSectorId: null,
  tradeOpportunities: null,
  isLoading: false,
  error: null,
  pollingInterval: null,

  startNewGame: async (playerName: string) => {
    set({ isLoading: true, error: null });
    try {
      const gameState = await gameApi.createNewGame(playerName);
      set({ gameState, isLoading: false });
      get().startPolling();
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  loadGame: async (gameId: string) => {
    set({ isLoading: true, error: null });
    try {
      const gameState = await gameApi.getGameState(gameId);
      set({ gameState, isLoading: false });
      get().startPolling();
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

  sendShipCommand: async (shipId: string, command: ShipCommand) => {
    const { gameState } = get();
    if (!gameState) return;

    set({ isLoading: true, error: null });
    try {
      await gameApi.sendShipCommand(gameState.id, shipId, command);
      await get().refreshGameState();
      set({ isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  performTrade: async (
    shipId: string,
    stationId: string,
    wareId: string,
    quantity: number,
    action: 'buy' | 'sell'
  ) => {
    const { gameState } = get();
    if (!gameState) return;

    set({ isLoading: true, error: null });
    try {
      await gameApi.tradeAtStation(gameState.id, shipId, stationId, wareId, quantity, action);
      await get().refreshGameState();
      set({ isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

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
}));