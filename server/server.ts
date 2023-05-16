import express, { Request, Response } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import apiRouter from './api';
import WebSocket from 'ws';
import { WebSocketService } from './services/websocket.service';

const app = express();
const https = require('https');
const fs = require('fs');
const socketIO = require('socket.io');

const options = {
  key: fs.readFileSync('server/ssl/server.key'),
  cert: fs.readFileSync('server/ssl/server.crt')
};

app.use(cors());

app.use(bodyParser.json());

app.use((req, res, next) => {
  if (!req.secure) {
    // Redirect to HTTPS
    res.redirect(`https://${req.headers.host}${req.url}`);
  }

  next();
});

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "https://localhost");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});


app.use(express.static('public', {
  setHeaders: (res, path, stat) => {
    if (path.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    }
  }
}));

app.use('/api', apiRouter);

const server = https.createServer(options, app);

server.listen(444, () => {
  console.log('Server listening on port 444');
});

const wss = new WebSocketService(server);

