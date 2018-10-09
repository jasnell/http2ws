'use strict'

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

server.on('stream', (stream, headers) => {
  if (headers[':method'] === 'CONNECT') {
    stream.respond({
      'sec-websocket-protocol': headers['sec-websocket-protocol']
    })
    const ws = createWebSocket(stream, headers)
    ws.pipe(ws)  // echo echo echo...
  } else {
    // If it's any other method, just respond with 200 and "ok"
    stream.respond()
    stream.end('ok\n')
  }
})

server.listen(0, () => {
  const origin = `http://localhost:${server.address().port}`

  const client = http2.connect(origin)

  // Let's throw other simultaneous requests on the same connection, for fun!
  function ping() {
    client.request().pipe(process.stdout)
  }
  setInterval(ping, 2000)

  // Setup the WebSocket over HTTP/2 tunnel... per RFC 8441, we cannot attempt
  // to do this until after we receive a SETTINGS frame that enables use of
  // the extended CONNECT protocol...
  client.on('remoteSettings', (settings) => {
    if (!settings.enableConnectProtocol)
      throw new Error('whoops! something went wrong!')

    const req = client.request({
      ':method': 'CONNECT',
      ':protocol': 'websocket',
      ':path': '/chat',
      'sec-websocket-protocol': 'chat',
      'sec-websocket-version': 13,
      origin
    })

    // As soon as we get a response, we can set up the client side of the
    // WebSocket....
    req.on('response', (headers) => {
      // We really ought to be checking the status code first...
      const ws = createWebSocket(req, headers)
      ws.setEncoding('utf8')
      ws.on('data', console.log)
      process.stdin.pipe(ws)
    })

    req.on('close', () => {
      server.close()
      client.close()
    })
  })
})
