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

// Store connected clients
let broadcaster = null;
const viewers = new Set();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('broadcaster', () => {
    broadcaster = socket.id;
    socket.broadcast.emit('broadcaster');
    console.log('Broadcaster set:', socket.id);
  });

  socket.on('viewer', () => {
    viewers.add(socket.id);
    socket.to(broadcaster).emit('viewer', socket.id);
    console.log('Viewer connected:', socket.id);
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

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    if (socket.id === broadcaster) {
      broadcaster = null;
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