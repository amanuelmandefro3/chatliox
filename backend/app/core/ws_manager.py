from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        # { conversation_id: set of active WebSocket connections }
        self._rooms: dict[str, set[WebSocket]] = {}

    async def connect(self, conversation_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._rooms.setdefault(conversation_id, set()).add(websocket)

    def add_connection(self, conversation_id: str, websocket: WebSocket) -> None:
        """Register an already-accepted websocket into a room."""
        self._rooms.setdefault(conversation_id, set()).add(websocket)

    def disconnect(self, conversation_id: str, websocket: WebSocket) -> None:
        room = self._rooms.get(conversation_id)
        if room:
            room.discard(websocket)
            if not room:
                del self._rooms[conversation_id]

    async def broadcast(self, conversation_id: str, data: dict) -> None:
        await self._send_to_room(conversation_id, data, exclude=None)

    async def broadcast_except(
        self, conversation_id: str, data: dict, exclude: WebSocket
    ) -> None:
        await self._send_to_room(conversation_id, data, exclude=exclude)

    async def _send_to_room(
        self,
        conversation_id: str,
        data: dict,
        exclude: WebSocket | None,
    ) -> None:
        room = self._rooms.get(conversation_id)
        if not room:
            return
        dead: set[WebSocket] = set()
        for ws in room.copy():
            if ws is exclude:
                continue
            try:
                await ws.send_json(data)
            except Exception:
                dead.add(ws)
        for ws in dead:
            self.disconnect(conversation_id, ws)


manager = ConnectionManager()
