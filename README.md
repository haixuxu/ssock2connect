# ssock2connect

transform shadowsock protocol to http connect protocol

#  core file

- `encrypt.js`     stream aes encrypt 
- `transform.js`   transform shadowsock protocol to http connect
# example

```js
var net = require('net');
var transform = require('./transform');

// arg1: http(connect) server host
// arg2: http(connect) server port
// arg3: shadowsocks encrypt password
// arg4: shadowsocks encrypt method

var shadowsock2connect = transform('127.0.0.1', 1087, 'test123', 'aes-256-cfb');

var server = net.createServer(shadowsock2connect);

// listen port
var port = 9000;

server.listen(port, '0.0.0.0');

console.log('server listen on 0.0.0.0:' + port);
```