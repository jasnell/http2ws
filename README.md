# WebSockets over HTTP/2 in Node.js POC

This is a POC demonstrating that WebSockets over HTTP/2 in Node.js works.

Requires current Node.js master

Echo server... whatever you type into stdin is echoed back via a WebSocket... while others HTTP GET requests occur simultaneously over the same connection.
```js
node http2ws
```

Time server... five concurrent WebSockets are created over a single HTTP/2 connection... a single server-side Worker thread is used to send current time to each connected socket.

```js
node morefun
```
