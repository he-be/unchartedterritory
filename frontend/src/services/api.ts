import axios from 'axios';
import { GameState, Sector, TradeOpportunity, ShipCommand, Player } from '../types/game';

const api = axios.create({
  baseURL: (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export const gameApi = {
  async createNewGame(playerName: string): Promise<GameState> {
    const response = await api.post<GameState>('/api/game/new', { playerName });
    return response.data;
  },

  async getGameState(gameId: string): Promise<GameState> {
    const response = await api.get<GameState>(`/api/game/${gameId}/state`);
    return response.data;
  },

  async getSectors(gameId: string): Promise<Sector[]> {
    const response = await api.get<Sector[]>(`/api/game/${gameId}/sectors`);
    return response.data;
  },

  async getSector(gameId: string, sectorId: string): Promise<Sector> {
    const response = await api.get<Sector>(`/api/game/${gameId}/sectors/${sectorId}`);
    return response.data;
  },

  async sendShipCommand(gameId: string, shipId: string, command: ShipCommand): Promise<void> {
    await api.post(`/api/game/${gameId}/ships/${shipId}/commands`, command);
  },

  async tradeAtStation(
    gameId: string,
    shipId: string,
    stationId: string,
    wareId: string,
    quantity: number,
    action: 'buy' | 'sell'
  ): Promise<void> {
    await api.post(`/api/game/${gameId}/ships/${shipId}/trade`, {
      stationId,
      wareId,
      quantity,
      action,
    });
  },

  async getTradeOpportunities(gameId: string): Promise<TradeOpportunity[]> {
    const response = await api.get<TradeOpportunity[]>(`/api/game/${gameId}/trade-opportunities`);
    return response.data;
  },

  async getPlayer(gameId: string): Promise<Player> {
    const response = await api.get<Player>(`/api/game/${gameId}/player`);
    return response.data;
  },
};

export default gameApi;