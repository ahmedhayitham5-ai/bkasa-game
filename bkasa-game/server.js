const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, 'public')));

const rooms = {};
const WORDS = ["بيتزا", "سيارة", "طيارة", "ايفون", "كرة قدم", "مستشفى", "شاطئ", "سينما"];

io.on('connection', (socket) => {
  socket.on('joinRoom', ({ roomId, username, avatar }) => {
    socket.join(roomId);
    if (!rooms[roomId]) {
      rooms[roomId] = { id: roomId, players: [], state: 'lobby', secretWord: '', imposterId: null };
    }

    const player = { id: socket.id, username, avatar, isHost: rooms[roomId].players.length === 0 };
    rooms[roomId].players.push(player);

    io.to(roomId).emit('roomUpdated', rooms[roomId]);
    socket.to(roomId).emit('userConnected', { peerId: socket.id, username });
  });

  socket.on('signal', ({ to, signal }) => {
    io.to(to).emit('signal', { from: socket.id, signal });
  });

  socket.on('startGame', (roomId) => {
    const room = rooms[roomId];
    if (!room) return;

    room.state = 'playing';
    room.secretWord = WORDS[Math.floor(Math.random() * WORDS.length)];
    const randomIndex = Math.floor(Math.random() * room.players.length);
    room.imposterId = room.players[randomIndex].id;

    room.players.forEach(p => {
      const wordToSend = p.id === room.imposterId ? "أنت البراني (المختلف)! حاول تخمن الكلمة" : `الكلمة السرية: ${room.secretWord}`;
      io.to(p.id).emit('gameStarted', { word: wordToSend, state: 'playing' });
    });
  });

  socket.on('disconnect', () => {
    for (const roomId in rooms) {
      const room = rooms[roomId];
      const index = room.players.findIndex(p => p.id === socket.id);
      if (index !== -1) {
        room.players.splice(index, 1);
        if (room.players.length === 0) {
          delete rooms[roomId];
        } else {
          io.to(roomId).emit('roomUpdated', room);
          io.to(roomId).emit('userDisconnected', { peerId: socket.id });
        }
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 السيرفر شغال بنجاح على PORT ${PORT}`));