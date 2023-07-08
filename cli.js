var net = require('net');
var transform = require('./transform');

var shadowsock2connect = transform('127.0.0.1', 1087, 'test123', 'aes-256-cfb');

var server = net.createServer(shadowsock2connect);

var port = 9000;

server.listen(port, '0.0.0.0');

console.log('server listen on 0.0.0.0:' + port);
