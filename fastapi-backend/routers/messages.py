"""
In-memory message storage — same behaviour as the original Express backend.
Messages are stored per shipment_id in a dict and reset on server restart.
"""

from fastapi import APIRouter, Depends
from datetime import datetime, timezone

from auth import get_current_user
from schemas import MessageBody

router = APIRouter()

# Global in-memory store  {shipment_id: [message, ...]}
_message_store: dict[str, list] = {}


@router.get("/api/messages/{shipment_id}")
def get_messages(
    shipment_id: str,
    current_user: dict = Depends(get_current_user),
):
    print(f"[MSG] Fetching messages for shipment: {shipment_id}")

    if shipment_id not in _message_store:
        _message_store[shipment_id] = [
            {
                "id": 1,
                "shipment_id": shipment_id,
                "sender_role": "driver",
                "message": "Hello! Thank you for choosing our service. I'll take good care of your package.",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        ]

    messages = _message_store[shipment_id]
    print(f"[OK] Returning {len(messages)} messages")
    return {"success": True, "messages": messages, "count": len(messages)}


@router.post("/api/messages/{shipment_id}")
def send_message(
    shipment_id: str,
    body: MessageBody,
    current_user: dict = Depends(get_current_user),
):
    print(f"[CHT] New message from {body.sender_role}: {body.message[:50]}")

    if shipment_id not in _message_store:
        _message_store[shipment_id] = []

    new_msg = {
        "id": int(datetime.now(timezone.utc).timestamp() * 1000),
        "shipment_id": shipment_id,
        "sender_role": body.sender_role,
        "message": body.message,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    _message_store[shipment_id].append(new_msg)

    print(f"[OK] Message stored. Total: {len(_message_store[shipment_id])}")
    return {"success": True, "message": "Message sent successfully", "data": new_msg}
