const express = require('express');
const https = require('https');
const fs = require('fs');
const socketIo = require('socket.io');

const app = express();
const server = https.createServer({
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem')
}, app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// Serve static files from public directory
app.use(express.static('public'));

// Store connected clients with their locations
let broadcaster = null;
let broadcasterLocation = null;
const viewers = new Map(); // id -> location

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('broadcaster', (location) => {
    broadcaster = socket.id;
    broadcasterLocation = location;
    socket.broadcast.emit('broadcaster');
    console.log('Broadcaster set:', socket.id, 'at location:', location);
  });

  socket.on('viewer', (location) => {
    viewers.set(socket.id, location);
    socket.to(broadcaster).emit('viewer', socket.id, location);
    console.log('Viewer connected:', socket.id, 'at location:', location);
  });

  socket.on('offer', (id, message) => {
    socket.to(id).emit('offer', socket.id, message);
  });

  socket.on('answer', (id, message) => {
    socket.to(id).emit('answer', socket.id, message);
  });

  socket.on('candidate', (id, message) => {
    socket.to(id).emit('candidate', socket.id, message);
  });

  socket.on('location-rejected', (id) => {
    socket.to(id).emit('location-rejected');
    viewers.delete(id);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    if (socket.id === broadcaster) {
      broadcaster = null;
      broadcasterLocation = null;
      viewers.clear();
      io.emit('broadcaster-disconnected');
    } else {
      viewers.delete(socket.id);
      if (broadcaster) {
        io.to(broadcaster).emit('viewer-disconnected', socket.id);
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`HTTPS Server running on port ${PORT}`);
});