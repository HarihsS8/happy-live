const socket = io();
let localStream;
let peerConnections = new Map(); // For broadcaster: multiple connections
let peerConnection; // For viewer: single connection
let isBroadcaster = false;
let userLocation = null; // {latitude, longitude}
const MAX_LOCATION_DISTANCE = 50; // kilometers

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const getLocationBtn = document.getElementById('getLocation');
const locationStatus = document.getElementById('locationStatus');
const startBroadcastBtn = document.getElementById('startBroadcast');
const stopBroadcastBtn = document.getElementById('stopBroadcast');
const joinStreamBtn = document.getElementById('joinStream');

const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' }
  ]
};

// Get user's location
getLocationBtn.addEventListener('click', () => {
  if (navigator.geolocation) {
    getLocationBtn.disabled = true;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        userLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };
        const distance = 'Location detected';
        locationStatus.textContent = `Location: ${userLocation.latitude.toFixed(4)}, ${userLocation.longitude.toFixed(4)}`;
        locationStatus.className = 'location-ok';
        startBroadcastBtn.disabled = false;
        joinStreamBtn.disabled = false;
        getLocationBtn.textContent = 'Location Updated';
      },
      (error) => {
        locationStatus.textContent = `Location Error: ${error.message}`;
        locationStatus.className = 'location-error';
        getLocationBtn.disabled = false;
      }
    );
  } else {
    locationStatus.textContent = 'Geolocation not supported by this browser';
    locationStatus.className = 'location-error';
  }
});

// Calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Start broadcasting
startBroadcastBtn.addEventListener('click', async () => {
  if (!userLocation) {
    alert('Please get your location first');
    return;
  }
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;
    socket.emit('broadcaster', userLocation);
    isBroadcaster = true;
    startBroadcastBtn.disabled = true;
    stopBroadcastBtn.disabled = false;
    joinStreamBtn.disabled = true;
    getLocationBtn.disabled = true;
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
  getLocationBtn.disabled = false;
});

// Join stream as viewer
joinStreamBtn.addEventListener('click', () => {
  if (!userLocation) {
    alert('Please get your location first');
    return;
  }
  socket.emit('viewer', userLocation);
  joinStreamBtn.disabled = true;
  startBroadcastBtn.disabled = true;
  getLocationBtn.disabled = true;
});

// Socket event handlers
socket.on('broadcaster', () => {
  console.log('Broadcaster connected');
});

socket.on('viewer', (id, viewerLocation) => {
  if (isBroadcaster && userLocation && viewerLocation) {
    const distance = calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      viewerLocation.latitude,
      viewerLocation.longitude
    );
    
    if (distance > MAX_LOCATION_DISTANCE) {
      console.log(`Viewer ${id} is ${distance.toFixed(2)}km away (max: ${MAX_LOCATION_DISTANCE}km)`);
      socket.emit('location-rejected', id);
      return;
    }
    
    console.log(`Viewer ${id} is ${distance.toFixed(2)}km away - accepted`);
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

socket.on('location-rejected', () => {
  alert('You are too far from the broadcaster. Streaming is limited to ' + MAX_LOCATION_DISTANCE + 'km radius.');
  joinStreamBtn.disabled = false;
  startBroadcastBtn.disabled = false;
  getLocationBtn.disabled = false;
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