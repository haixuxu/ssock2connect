var net = require('net');
var Transform = require('stream').Transform;

//  sslocal -b "127.0.0.1:1090" -s "127.0.0.1:4000" -m "aes-256-cfb" -k "test123"
//  sslocal -b "127.0.0.1:1090" -s "127.0.0.1:4000" -m "aes-256-gcm" -k "test123"
//  sslocal -b "127.0.0.1:1090" -s "127.0.0.1:4000" -m "none" -k "test123"

const Encryptor = require('./encrypt').Encryptor;

class ShadowsockTansform extends Transform {
    constructor(encryptor, isDecrypt) {
        super();
        this.transformFn = isDecrypt ? encryptor.decrypt.bind(encryptor) : encryptor.encrypt.bind(encryptor);
    }
    // 将可写端写入的数据变换后添加到可读端
    _transform(buf, enc, done) {
        try {
            var newbuf = this.transformFn(buf);
            // 调用push方法将变换后的数据添加到可读端
            this.push(newbuf);
            // 调用next方法准备处理下一个
            done();
        } catch (err) {
            done(err);
        }
    }
}

function parse(buf) {
    const type = buf.readUInt8(0);
    const addrData = buf.slice(1);
    let dstAddr;
    let dstPort;
    let data;
    if (type === 0x1) {
        // IP
        const IP = addrData.slice(0, 4);
        const PORT = addrData.slice(4, 6);
        dstAddr = IP.map((temp) => Number(temp).toString(10)).join('.');
        dstPort = PORT[0] * 256 + PORT[1];
        data = addrData.slice(6);
    } else if (type === 0x3) {
        const addrLen = addrData.readUInt8(0);
        const domain = addrData.slice(1, addrLen + 1);
        const port = addrData.slice(addrLen + 1);
        dstAddr = domain.toString();
        dstPort = port[0] * 256 + port[1];
        data = addrData.slice(1 + addrLen + 2);
    }
    return { type, dstAddr, dstPort, data };
}

module.exports = function transform(remoteHost, remotePort, key, method) {
    return function shadowsock2connect(ss_socket) {
        ss_socket.on('data', function (data) {
            ss_socket.removeAllListeners('data');
            ss_socket.pause();
            // console.log('data:', data);
            try {
                const encryptWorker = new Encryptor(key, method);
                // const encryptWorker = { encrypt: (a) => a, decrypt: (b) => b };
                var dec = encryptWorker.decrypt(data);
                let parsed = parse(dec);
                // console.log(parsed);
                if (parsed.type <= 3 && parsed.dstAddr && parsed.dstPort) {
                    console.log(`forward:${parsed.dstAddr}:${parsed.dstPort}`);
                    connectForward(parsed.dstAddr, parsed.dstPort, ss_socket, parsed.data, encryptWorker);
                } else {
                    console.log('except=====', data);
                    ss_socket.destroy();
                }
            } catch (error) {
                console.log('decrypt error:', error);
            }
        });

        function connectForward(host, port, socket, buf, encryptWorker) {
            var proxysocket = net.Socket();
            proxysocket.connect(remotePort, remoteHost, function () {
                proxysocket.on('data', function (data) {
                    proxysocket.removeAllListeners('data');
                    proxysocket.pause();
                    var datastr = data.toString();
                    if (/Established/i.test(datastr)) {
                        if (buf && buf.length > 0) {
                            proxysocket.write(buf);
                        }
                        var encryptPipe = new ShadowsockTansform(encryptWorker, false);
                        var decryptPipe = new ShadowsockTansform(encryptWorker, true);
                        socket.pipe(decryptPipe).pipe(proxysocket);
                        proxysocket.pipe(encryptPipe).pipe(socket);
                        socket.on('error', (err) => {
                            console.log('left socket err:', err.message);
                            proxysocket.destroy();
                        });
                    } else {
                        console.log('est error');
                    }
                });
            });
            proxysocket.on('error', (err) => {
                console.log('right socket err:', err.message);
                socket.destroy();
            });
            proxysocket.write(`CONNECT ${host}:${port} HTTP/1.1\n`);
        }
    };
};
