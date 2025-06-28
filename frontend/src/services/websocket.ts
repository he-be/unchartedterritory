// WebSocket service for real-time game communication
import { GameState, ShipCommand, GameEvent, Vector2, ShipCargo } from '../types/game';

export interface TradeData {
  stationId: string;
  wareId: string;
  quantity: number;
  action: 'buy' | 'sell';
}

export interface WebSocketMessage {
  type: 'shipCommand' | 'trade' | 'ping' | 'requestState';
  shipId?: string;
  command?: ShipCommand;
  tradeData?: TradeData;
  data?: Record<string, unknown>;
}

export interface ShipInfo {
  id: string;
  name: string;
  position: Vector2;
  sectorId: string;
  isMoving: boolean;
  currentCommand?: ShipCommand;
  commandQueue?: ShipCommand[];
  cargo: ShipCargo[];
}

export interface PlayerInfo {
  credits: number;
}

export interface WebSocketResponse {
  type: 'gameState' | 'commandResult' | 'tradeResult' | 'error' | 'pong' | 'stateUpdate';
  gameState?: GameState;
  shipId?: string;
  ship?: ShipInfo;
  player?: PlayerInfo;
  events?: GameEvent[];
  message?: string;
  data?: Record<string, unknown>;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface WebSocketServiceConfig {
  baseUrl: string;
  reconnectAttempts?: number;
  reconnectDelay?: number;
  heartbeatInterval?: number;
}

export class WebSocketService {
  private ws: WebSocket | null = null;
  private gameId: string | null = null;
  private config: Required<WebSocketServiceConfig>;
  private reconnectCount = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private status: ConnectionStatus = 'disconnected';
  private messageQueue: WebSocketMessage[] = [];
  
  // Event listeners
  private statusChangeHandler: ((status: ConnectionStatus) => void) | null = null;
  private gameStateUpdateHandler: ((gameState: GameState) => void) | null = null;
  private commandResultHandler: ((result: WebSocketResponse) => void) | null = null;
  private errorHandler: ((error: string) => void) | null = null;
  private eventsHandler: ((events: GameEvent[]) => void) | null = null;

  constructor(config: WebSocketServiceConfig) {
    this.config = {
      baseUrl: config.baseUrl,
      reconnectAttempts: config.reconnectAttempts ?? 5,
      reconnectDelay: config.reconnectDelay ?? 1000,
      heartbeatInterval: config.heartbeatInterval ?? 30000, // 30 seconds
    };
  }

  public connect(gameId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      this.gameId = gameId;
      this.setStatus('connecting');

      // Convert HTTP(S) URL to WebSocket URL
      const wsUrl = this.config.baseUrl
        .replace('http://', 'ws://')
        .replace('https://', 'wss://') + `/game/${gameId}/ws`;

      try {
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
          console.log('WebSocket connected to:', wsUrl);
          this.setStatus('connected');
          this.reconnectCount = 0;
          this.startHeartbeat();
          this.processMessageQueue();
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onclose = (event) => {
          console.log('WebSocket closed:', event.code, event.reason);
          this.setStatus('disconnected');
          this.stopHeartbeat();
          
          if (!event.wasClean && this.reconnectCount < this.config.reconnectAttempts) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.setStatus('error');
          this.errorHandler?.('WebSocket connection error');
          reject(new Error('WebSocket connection failed'));
        };

      } catch (error) {
        console.error('Failed to create WebSocket:', error);
        this.setStatus('error');
        reject(error);
      }
    });
  }

  public disconnect(): void {
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    
    this.setStatus('disconnected');
    this.gameId = null;
    this.reconnectCount = 0;
    this.messageQueue = [];
  }

  public sendCommand(shipId: string, command: ShipCommand): void {
    this.sendMessage({
      type: 'shipCommand',
      shipId,
      command,
    });
  }

  public sendTrade(shipId: string, tradeData: TradeData): void {
    this.sendMessage({
      type: 'trade',
      shipId,
      tradeData,
    });
  }

  public requestState(): void {
    this.sendMessage({
      type: 'requestState',
    });
  }

  // Event listener setters
  public setOnStatusChange(callback: (status: ConnectionStatus) => void): void {
    this.statusChangeHandler = callback;
  }

  public setOnGameStateUpdate(callback: (gameState: GameState) => void): void {
    this.gameStateUpdateHandler = callback;
  }

  public setOnCommandResult(callback: (result: WebSocketResponse) => void): void {
    this.commandResultHandler = callback;
  }

  public setOnError(callback: (error: string) => void): void {
    this.errorHandler = callback;
  }

  public setOnEvents(callback: (events: GameEvent[]) => void): void {
    this.eventsHandler = callback;
  }

  public getStatus(): ConnectionStatus {
    return this.status;
  }

  public isConnected(): boolean {
    return this.status === 'connected' && this.ws?.readyState === WebSocket.OPEN;
  }

  private sendMessage(message: WebSocketMessage): void {
    if (this.isConnected()) {
      this.ws!.send(JSON.stringify(message));
    } else {
      // Queue message for when connection is restored
      this.messageQueue.push(message);
      console.log('Message queued (not connected):', message.type);
    }
  }

  private handleMessage(data: string): void {
    try {
      const response: WebSocketResponse = JSON.parse(data);
      
      switch (response.type) {
        case 'gameState':
          if (response.gameState) {
            this.gameStateUpdateHandler?.(response.gameState);
          }
          break;
          
        case 'stateUpdate':
          if (response.gameState) {
            this.gameStateUpdateHandler?.(response.gameState);
          }
          if (response.events && response.events.length > 0) {
            this.eventsHandler?.(response.events);
          }
          break;
          
        case 'commandResult':
        case 'tradeResult':
          this.commandResultHandler?.(response);
          break;
          
        case 'error':
          this.errorHandler?.(response.message || 'Unknown server error');
          break;
          
        case 'pong':
          // Heartbeat response - connection is alive
          break;
          
        default:
          console.warn('Unknown WebSocket message type:', response.type);
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
      this.errorHandler?.('Failed to parse server message');
    }
  }

  private setStatus(status: ConnectionStatus): void {
    if (this.status !== status) {
      this.status = status;
      this.statusChangeHandler?.(status);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    
    this.reconnectCount++;
    const delay = this.config.reconnectDelay * Math.pow(2, this.reconnectCount - 1); // Exponential backoff
    
    console.log(`Scheduling reconnect attempt ${this.reconnectCount}/${this.config.reconnectAttempts} in ${delay}ms`);
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.gameId) {
        this.connect(this.gameId).catch(() => {
          // Reconnect failed, will try again if under limit
        });
      }
    }, delay);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected()) {
        this.sendMessage({ type: 'ping' });
      }
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private processMessageQueue(): void {
    if (this.messageQueue.length > 0) {
      console.log(`Processing ${this.messageQueue.length} queued messages`);
      const messages = [...this.messageQueue];
      this.messageQueue = [];
      
      messages.forEach(message => {
        this.sendMessage(message);
      });
    }
  }
}