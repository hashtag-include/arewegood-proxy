var http = require('http'),
    WebSocket = require('faye-websocket'),
    REQ = require('request'),
    mdns = require('mdns'),
    config = require('conar')()
              .parse("config.json")
              .defaults({
                host: "http://localhost",
                localPort: 8015,
                remotePort: 3000,
                serviceName: "arewegood-proxy",
                logsEndpoint: "/logs",
                authEndpoint: "/logs",
                batchInterval: 2000
              })
              .suppress()
              .opts();

console.log("parsed args:", config);

var server = http.createServer();

server.on('upgrade', function(request, socket, body) {
  console.log("ok");
  if (WebSocket.isWebSocket(request)) {
    var ws = new WebSocket(request, socket, body);

    ws._batched = [];

    ws.on('message', function(event) {
      var p = JSON.parse(event.data);
      
      console.log("[proxy] parsed: ", p)

      if (p.type == "api_token") {
        //TODO: trevor didn't implement this on the service yet, so we can't verify tokens
        // REQ(config.host+":"+config.remotePort+config.authEndpoint, {
        //   auth: {
        //     bearer: p.data
        //   }
        // }, function(err, res) {
        //   if (!err && res.statusCode == 200) {
            ws.send(JSON.stringify({type:"api_token-response", data:"OK"}));
            ws._bearerToken = p.data;
            console.log("[proxy] bearerToken "+p.data);
          // } else {
          //   ws.send(JSON.stringify({type:"api_token-response", data:"FAIL"}));
          //   console.log("[proxy] bearerToken was invalid");
          // }
        //});
      } else if (typeof(p.type) !== "undefined") {
        ws._batched.push(p);
        console.log("[proxy] batched ", p);

        if (ws._batchedInterval == null) {
          ws._batchedInterval = setInterval(function() {
            if (ws._batched.length > 0 && ws._bearerToken) {
              REQ.post(config.host+":"+config.remotePort+config.logsEndpoint, {
                json: {userId: ws._bearerToken, logs: ws._batched} //TODO: remove userId when TREVOR does real auth /blame
              }, function(err, res) {
                if (!err && res.statusCode == 200) {
                  ws._batched = [];
                  console.log("[proxy] batch call succeeded");
                } else {
                  console.log("[proxy] batch call failed "+(err || res.statusCode));
                }
              });
            }
          }, config.batchInterval);
        }
      }
    });

    ws.on('close', function(event) {
      console.log('close', event.code, event.reason);
      
      if (ws._batchedInterval) clearInterval(ws._batchedInterval);
      ws = null;
    });
  }
});


server.listen(config.localPort, function(){
  var ad = mdns.createAdvertisement({name: 'http', protocol: 'tcp', subtypes: [config.serviceName]}, config.localPort);
  ad.start();
  console.log("up on "+config.localPort);
});