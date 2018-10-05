'use strict';

const fs = require('fs');
const http2 = require('http2');
const websocket = require('websocket-stream');
const WebSocket = require('ws');

const settings = { enableConnectProtocol: true };
const server = http2.createServer({ settings });

function createWebSocket(stream, headers) {
  // It's not quite a perfect fit yet... but we have to start somewhere to prove it works.
  stream.setNoDelay = function() {}
  const ws = new WebSocket(null);
  ws.setSocket(stream, headers, 100 * 1024 * 1024);
  return websocket(ws);
}

server.on('stream', (stream, headers) => {
  if (headers[':method'] === 'CONNECT') {
    stream.respond({ 'sec-websocket-protocol': headers['sec-websocket-protocol'] });
    const ws = createWebSocket(stream, headers);
    ws.pipe(ws);
  } else {
    stream.respond();
    stream.end('ok\n');
  }
});

server.listen(0, () => {
  const origin = `http://localhost:${server.address().port}`;
  const client = http2.connect(origin);

  // Let's throw other simultaneous requests on the same
  // connection, for fun!
  function ping() {
    const req = client.request();
    req.pipe(process.stdout);
  }
  setInterval(ping, 2000);

  // Setup the WebSocket over HTTP/2 tunnel
  client.on('remoteSettings', (settings) => {
    const req = client.request({
      ':method': 'CONNECT',
      ':protocol': 'websocket',
      ':path': '/chat',
      'sec-websocket-protocol': 'chat',
      'sec-websocket-version': 13,
      origin
    });
    req.on('response', (headers) => {
      const ws = createWebSocket(req, headers);
      ws.setEncoding('utf8');
      ws.on('data', console.log);
      process.stdin.pipe(ws);
    });

    req.on('close', () => {
      server.close();
      client.close();
    });
  });
});
