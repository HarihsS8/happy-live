const socket = io();
let localStream;
let peerConnections = new Map(); // For broadcaster: multiple connections
let peerConnection; // For viewer: single connection
let isBroadcaster = false;

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const startBroadcastBtn = document.getElementById('startBroadcast');
const stopBroadcastBtn = document.getElementById('stopBroadcast');
const joinStreamBtn = document.getElementById('joinStream');

const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' }
  ]
};

// Start broadcasting
startBroadcastBtn.addEventListener('click', async () => {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;
    socket.emit('broadcaster');
    isBroadcaster = true;
    startBroadcastBtn.disabled = true;
    stopBroadcastBtn.disabled = false;
    joinStreamBtn.disabled = true;
  } catch (error) {
    console.error('Error accessing media devices:', error);
    alert('Could not access camera and microphone. Please check permissions.');
  }
});

// Stop broadcasting
stopBroadcastBtn.addEventListener('click', () => {
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localVideo.srcObject = null;
  }
  peerConnections.forEach(pc => pc.close());
  peerConnections.clear();
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  socket.emit('stop-broadcast');
  isBroadcaster = false;
  startBroadcastBtn.disabled = false;
  stopBroadcastBtn.disabled = true;
  joinStreamBtn.disabled = false;
});

// Join stream as viewer
joinStreamBtn.addEventListener('click', () => {
  socket.emit('viewer');
  joinStreamBtn.disabled = true;
  startBroadcastBtn.disabled = true;
});

// Socket event handlers
socket.on('broadcaster', () => {
  console.log('Broadcaster connected');
});

socket.on('viewer', (id) => {
  if (isBroadcaster) {
    const pc = createPeerConnection(id);
    peerConnections.set(id, pc);
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
    pc.createOffer().then(offer => {
      pc.setLocalDescription(offer);
      socket.emit('offer', id, offer);
    });
  }
});

socket.on('offer', (id, offer) => {
  peerConnection = createPeerConnection(id);
  peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
    localStream = stream;
    localVideo.srcObject = stream;
    stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));
    peerConnection.createAnswer().then(answer => {
      peerConnection.setLocalDescription(answer);
      socket.emit('answer', id, answer);
    });
  });
});

socket.on('answer', (id, answer) => {
  const pc = peerConnections.get(id);
  if (pc) {
    pc.setRemoteDescription(new RTCSessionDescription(answer));
  }
});

socket.on('candidate', (id, candidate) => {
  if (isBroadcaster) {
    const pc = peerConnections.get(id);
    if (pc) {
      pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  } else {
    if (peerConnection) {
      peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }
});

socket.on('broadcaster-disconnected', () => {
  if (!isBroadcaster) {
    remoteVideo.srcObject = null;
    if (peerConnection) {
      peerConnection.close();
      peerConnection = null;
    }
    joinStreamBtn.disabled = false;
    startBroadcastBtn.disabled = false;
  }
});

socket.on('viewer-disconnected', (id) => {
  if (isBroadcaster) {
    const pc = peerConnections.get(id);
    if (pc) {
      pc.close();
      peerConnections.delete(id);
    }
  }
});

function createPeerConnection(id) {
  const pc = new RTCPeerConnection(configuration);

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('candidate', id, event.candidate);
    }
  };

  pc.ontrack = (event) => {
    remoteVideo.srcObject = event.streams[0];
  };

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'connected') {
      console.log('Peer connection established with', id);
    } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
      console.log('Peer connection lost with', id);
      if (isBroadcaster) {
        peerConnections.delete(id);
      }
    }
  };

  return pc;
}