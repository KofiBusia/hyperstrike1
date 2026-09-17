import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { MatchManager } from './game/MatchManager.js';
import { registerSocketHandlers } from './net/socketHandlers.js';
import { TICK_RATE } from '../shared/constants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const SNAPSHOT_RATE = 20; // Hz sent to clients (independent of internal sim tick rate)

const app = express();
app.use(express.static(path.join(__dirname, '..', 'client')));
app.use('/shared', express.static(path.join(__dirname, '..', 'shared')));
app.use('/vendor/three.module.js', express.static(path.join(__dirname, '..', 'node_modules', 'three', 'build', 'three.module.js')));
app.use('/vendor/addons', express.static(path.join(__dirname, '..', 'node_modules', 'three', 'examples', 'jsm')));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' },
});

const matchManager = new MatchManager(io);
registerSocketHandlers(io, matchManager);

setInterval(() => matchManager.tickAll(), 1000 / TICK_RATE);
setInterval(() => matchManager.broadcastSnapshots(), 1000 / SNAPSHOT_RATE);

httpServer.listen(PORT, () => {
  console.log(`Hyper Strike server listening on http://localhost:${PORT}`);
});
