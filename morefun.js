'use strict'

const { Worker, isMainThread, parentPort } = require('worker_threads')

if (isMainThread) {
  const http2 = require('http2')
  const websocket = require('websocket-stream')
  const WebSocket = require('ws')

  const settings = { enableConnectProtocol: true }
  const server = http2.createServer({ settings })

  function createWebSocket(stream, headers) {
    // Take the Http2Stream object and set it as the "socket" on a new
    // ws module WebSocket object.. then wrap that using the websocket-stream...
    // It's not quite a perfect fit yet... but we have to start somewhere to
    // prove it works.
    stream.setNoDelay = function() {}   // fake it for now...
    const ws = new WebSocket(null)
    ws.setSocket(stream, headers, 100 * 1024 * 1024)
    return websocket(ws)
  }

  const worker = new Worker(__filename)

  server.on('stream', (stream, headers) => {
    stream.respond({
      'sec-websocket-protocol': headers['sec-websocket-protocol']
    })
    const ws = createWebSocket(stream, headers)

    // Just for fun, let's use a worker to feed data into to the WebSocket
    worker.on('message', (message) => {
      ws.write(`Http2Stream ${stream.id} - ${message}`)
    })
  })

  server.listen(0, () => {
    const origin = `http://localhost:${server.address().port}`
    const client = http2.connect(origin)
  
    client.on('remoteSettings', (settings) => {
      const reqheaders = {
        ':method': 'CONNECT',
        ':protocol': 'websocket',
        ':path': '/time',
        'sec-websocket-protocol': 'time',
        'sec-websocket-version': 13,
        origin
      }

      // Let's get wild! 5 different WebSocket sessions over a single
      // HTTP/2 connection...
      for (let n = 0; n < 5; n++) {
        const req = client.request(reqheaders)
        req.on('response', (headers) => {
          const ws = createWebSocket(req, headers)
          ws.setEncoding('utf8')
          ws.pipe(process.stdout)
        })
      }

    })
  })
} else {
  // Worker Thread!
  setInterval(() => {
    parentPort.postMessage(`${new Date().toISOString()}\n`)
  }, 1000)
}
