import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from aiortc import RTCPeerConnection, RTCSessionDescription

# Store active peer connections
PEERS = set()

@csrf_exempt
async def webrtc_offer(request):
    """
    Receives WebRTC offer from browser and returns answer.
    Webcam NOT used yet.
    """
    data = json.loads(request.body.decode("utf-8"))

    offer = RTCSessionDescription(
        sdp=data["sdp"],
        type=data["type"]
    )

    pc = RTCPeerConnection()
    PEERS.add(pc)

    await pc.setRemoteDescription(offer)
    answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    return JsonResponse({
        "sdp": pc.localDescription.sdp,
        "type": pc.localDescription.type
    })
