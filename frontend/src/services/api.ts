import type { GameState } from '../types';

class ApiService {
  private baseUrl: string;

  constructor() {
    // Use relative URL for API calls - will be proxied to backend
    this.baseUrl = '';
  }

  async createNewGame(playerName: string): Promise<GameState> {
    const response = await fetch(`${this.baseUrl}/api/game/new`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ playerName }),
    });

    if (!response.ok) {
      throw new Error('Failed to create new game');
    }

    return response.json();
  }

  async getGameState(gameId: string): Promise<GameState> {
    const response = await fetch(`${this.baseUrl}/api/game/${gameId}/state`);

    if (!response.ok) {
      throw new Error('Failed to get game state');
    }

    return response.json();
  }

  createWebSocketUrl(gameId: string): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/api/game/${gameId}/ws`;
  }
}

export const apiService = new ApiService();