from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException
from typing import List, Dict
from app.core.security import verify_token
from app.core.config import settings
import logging
import json

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

# Store active connections
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, channel: str):
        try:
            await websocket.accept()
            if channel not in self.active_connections:
                self.active_connections[channel] = []
            self.active_connections[channel].append(websocket)
            logger.info(f"New connection established for channel {channel}")
        except Exception as e:
            logger.error(f"Error accepting connection: {str(e)}")
            raise

    def disconnect(self, websocket: WebSocket, channel: str):
        try:
            if channel in self.active_connections:
                self.active_connections[channel].remove(websocket)
                if not self.active_connections[channel]:
                    del self.active_connections[channel]
                logger.info(f"Connection closed for channel {channel}")
        except Exception as e:
            logger.error(f"Error during disconnect: {str(e)}")

    async def broadcast(self, message: dict, channel: str):
        if channel in self.active_connections:
            disconnected = []
            for connection in self.active_connections[channel]:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logger.error(f"Error broadcasting message: {str(e)}")
                    disconnected.append(connection)
            
            # Clean up disconnected clients
            for connection in disconnected:
                self.disconnect(connection, channel)

manager = ConnectionManager()

@router.websocket("/ws/workflows")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str,
    channel: str = "workflow_updates"
):
    try:
        # Verify token
        user = verify_token(token)
        if not user:
            logger.warning(f"Invalid token attempt from {websocket.client}")
            await websocket.close(code=4001, reason="Invalid token")
            return

        logger.info(f"New WebSocket connection from {websocket.client}")
        await manager.connect(websocket, channel)

        try:
            while True:
                data = await websocket.receive_text()
                try:
                    message = json.loads(data)
                    logger.debug(f"Received message: {message}")

                    # Handle different message types
                    if message.get("type") == "subscribe":
                        await websocket.send_json({
                            "type": "subscribed",
                            "channel": channel
                        })
                    elif message.get("type") == "unsubscribe":
                        break
                    else:
                        # Broadcast message to all connected clients in the channel
                        await manager.broadcast(message, channel)
                except json.JSONDecodeError:
                    logger.error(f"Invalid JSON received: {data}")
                    await websocket.send_json({
                        "type": "error",
                        "message": "Invalid JSON format"
                    })

        except WebSocketDisconnect:
            logger.info(f"WebSocket disconnected: {websocket.client}")
            manager.disconnect(websocket, channel)
        except Exception as e:
            logger.error(f"Error in WebSocket connection: {str(e)}")
            await websocket.close(code=4000, reason=str(e))
            manager.disconnect(websocket, channel)

    except Exception as e:
        logger.error(f"Error handling WebSocket connection: {str(e)}")
        try:
            await websocket.close(code=4000, reason=str(e))
        except:
            pass  # Connection might already be closed 