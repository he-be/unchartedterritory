import type { GameState, GameEvent, ConnectionStatus } from '../types';

export interface WebSocketMessage {
  type: 'shipCommand' | 'shipAction' | 'trade' | 'ping' | 'requestState';
  shipId?: string;
  command?: any;
  targetPosition?: { x: number; y: number };
  tradeData?: any;
  data?: Record<string, unknown>;
}

export interface WebSocketResponse {
  type: 'gameState' | 'commandResult' | 'tradeResult' | 'error' | 'pong' | 'stateUpdate';
  gameState?: GameState;
  shipId?: string;
  events?: GameEvent[];
  message?: string;
  data?: Record<string, unknown>;
}

export class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private status: ConnectionStatus = 'disconnected';
  private heartbeatInterval: number | null = null;

  // Event listeners
  private onStatusChange: ((status: ConnectionStatus) => void) | null = null;
  private onGameStateUpdate: ((gameState: GameState) => void) | null = null;
  private onEvents: ((events: GameEvent[]) => void) | null = null;
  private onError: ((error: string) => void) | null = null;

  constructor(url: string) {
    this.url = url;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      this.setStatus('connecting');

      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.setStatus('connected');
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onclose = (event) => {
          console.log('WebSocket closed:', event.code, event.reason);
          this.setStatus('disconnected');
          this.stopHeartbeat();
          
          if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.setStatus('error');
          this.onError?.('WebSocket connection error');
          reject(new Error('WebSocket connection failed'));
        };

      } catch (error) {
        console.error('Failed to create WebSocket:', error);
        this.setStatus('error');
        reject(error);
      }
    });
  }

  disconnect(): void {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    this.setStatus('disconnected');
  }

  send(message: WebSocketMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected, message not sent:', message);
    }
  }

  requestState(): void {
    this.send({ type: 'requestState' });
  }

  sendMessage(message: WebSocketMessage): void {
    this.send(message);
  }

  // Event listener setters
  setOnStatusChange(callback: (status: ConnectionStatus) => void): void {
    this.onStatusChange = callback;
  }

  setOnGameStateUpdate(callback: (gameState: GameState) => void): void {
    this.onGameStateUpdate = callback;
  }

  setOnEvents(callback: (events: GameEvent[]) => void): void {
    this.onEvents = callback;
  }

  setOnError(callback: (error: string) => void): void {
    this.onError = callback;
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  private handleMessage(data: string): void {
    try {
      const response: WebSocketResponse = JSON.parse(data);
      
      switch (response.type) {
        case 'gameState':
        case 'stateUpdate':
          if (response.gameState) {
            this.onGameStateUpdate?.(response.gameState);
          }
          if (response.events && response.events.length > 0) {
            this.onEvents?.(response.events);
          }
          break;
          
        case 'error':
          // Always log errors for debugging
          console.log('WebSocket error received:', response.message);
          // Only show error if it's not about game initialization
          if (!response.message?.includes('Game not initialized')) {
            this.onError?.(response.message || 'Unknown server error');
          }
          break;
          
        case 'commandResult':
          // Command executed successfully
          console.log('Command result:', response.message);
          break;
          
        case 'pong':
          // Heartbeat response - connection is alive
          break;
          
        default:
          console.warn('Unknown WebSocket message type:', response.type);
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
      this.onError?.('Failed to parse server message');
    }
  }

  private setStatus(status: ConnectionStatus): void {
    if (this.status !== status) {
      this.status = status;
      this.onStatusChange?.(status);
    }
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff
    
    console.log(`Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    
    setTimeout(() => {
      this.connect().catch(() => {
        // Reconnect failed, will try again if under limit
      });
    }, delay);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.heartbeatInterval = window.setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping' });
      }
    }, 30000); // 30 seconds
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
}