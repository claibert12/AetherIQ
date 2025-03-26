import { useEffect, useCallback } from 'react';
import { websocketService } from '../services/websocket';

type WebSocketMessageHandler = (data: any) => void;

interface UseWebSocketOptions {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
}

export const useWebSocket = (
  type: string,
  handler: WebSocketMessageHandler,
  options: UseWebSocketOptions = {}
) => {
  const { onConnect, onDisconnect, onError } = options;

  useEffect(() => {
    // Subscribe to WebSocket messages
    const unsubscribe = websocketService.subscribe(type, handler);

    // Set up connection event handlers
    const handleConnect = () => {
      console.log(`WebSocket connected for ${type}`);
      onConnect?.();
    };

    const handleDisconnect = () => {
      console.log(`WebSocket disconnected for ${type}`);
      onDisconnect?.();
    };

    const handleError = (error: Error) => {
      console.error(`WebSocket error for ${type}:`, error);
      onError?.(error);
    };

    // Add event listeners
    window.addEventListener('ws:connect', handleConnect);
    window.addEventListener('ws:disconnect', handleDisconnect);
    window.addEventListener('ws:error', (event) => handleError(event as unknown as Error));

    // Cleanup function
    return () => {
      unsubscribe();
      window.removeEventListener('ws:connect', handleConnect);
      window.removeEventListener('ws:disconnect', handleDisconnect);
      window.removeEventListener('ws:error', (event) => handleError(event as unknown as Error));
    };
  }, [type, handler, onConnect, onDisconnect, onError]);

  // Send message function
  const sendMessage = useCallback((message: any) => {
    try {
      websocketService.send({
        type,
        payload: message,
      });
    } catch (error) {
      console.error(`Error sending WebSocket message for ${type}:`, error);
      onError?.(error as Error);
    }
  }, [type, onError]);

  return { sendMessage };
}; 