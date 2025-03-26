import { WS_BASE_URL, AUTH_CONFIG } from '../config';

type WebSocketMessageHandler = (data: any) => void;

interface WebSocketSubscription {
  type: string;
  handler: WebSocketMessageHandler;
}

class WebSocketService {
  private static instance: WebSocketService;
  private ws: WebSocket | null = null;
  private subscriptions: Map<string, Set<WebSocketMessageHandler>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout = 1000;
  private isConnecting = false;
  private messageQueue: any[] = [];
  private channel: string = 'workflow_updates';

  private constructor() {
    this.connect();
  }

  public static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  private async connect() {
    if (this.isConnecting) {
      return;
    }

    this.isConnecting = true;
    const token = localStorage.getItem(AUTH_CONFIG.tokenKey);
    
    if (!token) {
      console.error('No authentication token found');
      this.isConnecting = false;
      return;
    }

    try {
      this.ws = new WebSocket(`${WS_BASE_URL}/ws/workflows?token=${token}&channel=${this.channel}`);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        this.isConnecting = false;
        
        // Send subscribe message
        this.send({
          type: 'subscribe',
          token,
          channel: this.channel
        });
        
        // Process any queued messages
        while (this.messageQueue.length > 0) {
          const message = this.messageQueue.shift();
          this.send(message);
        }

        // Dispatch connect event
        window.dispatchEvent(new Event('ws:connect'));
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
          window.dispatchEvent(new ErrorEvent('ws:error', { error }));
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        window.dispatchEvent(new ErrorEvent('ws:error', { error }));
        this.handleDisconnect();
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        window.dispatchEvent(new Event('ws:disconnect'));
        this.handleDisconnect();
      };
    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
      this.isConnecting = false;
      this.handleDisconnect();
    }
  }

  private handleMessage(data: any) {
    const { type, payload } = data;
    const handlers = this.subscriptions.get(type);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(payload);
        } catch (error) {
          console.error(`Error in message handler for type ${type}:`, error);
        }
      });
    }
  }

  private handleDisconnect() {
    this.isConnecting = false;
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectTimeout * Math.pow(2, this.reconnectAttempts - 1);
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms...`);
      setTimeout(() => this.connect(), delay);
    } else {
      console.error('Max reconnection attempts reached');
      window.dispatchEvent(new ErrorEvent('ws:error', { 
        error: new Error('Max reconnection attempts reached')
      }));
    }
  }

  public subscribe(type: string, handler: WebSocketMessageHandler): () => void {
    if (!this.subscriptions.has(type)) {
      this.subscriptions.set(type, new Set());
    }
    this.subscriptions.get(type)?.add(handler);

    return () => {
      const handlers = this.subscriptions.get(type);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.subscriptions.delete(type);
        }
      }
    };
  }

  public send(message: any): boolean {
    if (this.ws?.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(message));
        return true;
      } catch (error) {
        console.error('Error sending WebSocket message:', error);
        return false;
      }
    } else {
      // Queue message if socket is connecting or reconnecting
      if (this.isConnecting || this.reconnectAttempts > 0) {
        this.messageQueue.push(message);
        return true;
      }
      console.error('WebSocket is not connected');
      return false;
    }
  }

  public disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.subscriptions.clear();
    this.messageQueue = [];
    this.isConnecting = false;
    this.reconnectAttempts = 0;
  }

  public isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  public getConnectionState(): string {
    if (!this.ws) return 'CLOSED';
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING: return 'CONNECTING';
      case WebSocket.OPEN: return 'OPEN';
      case WebSocket.CLOSING: return 'CLOSING';
      case WebSocket.CLOSED: return 'CLOSED';
      default: return 'UNKNOWN';
    }
  }
}

export const websocketService = WebSocketService.getInstance();

// Example usage:
/*
// Subscribe to workflow updates
const unsubscribe = websocketService.subscribe('workflow_update', (data) => {
  console.log('Workflow update received:', data);
});

// Later, unsubscribe
unsubscribe();

// Send a message
websocketService.send({
  type: 'optimize_workflow',
  payload: { workflowId: 123 }
});
*/ 