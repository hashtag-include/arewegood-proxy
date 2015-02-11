var http = require('http'),
    httpProxy = require('http-proxy'),
    WebSocket = require('faye-websocket'),
    request = require('request'),
    mdns = require('mdns'),
    config = require('conar')()
              .parse("config.json")
              .defaults({
                host: "arewegood.azurewebsites.net",
                localPort: 8015,
                remotePort: 80,
                serviceName: "arewegood-proxy",
                logsEndpoint: "/logs",
                authEndpoint: "/logs",
                batchInterval: 2000
              })
              .suppress()
              .opts();

console.log("parsed args:", config);

//
// Setup our server to proxy standard HTTP requests
//
var proxy = new httpProxy.createProxyServer({
  target: {
    host: config.host+":"+config.remotePort
  }
});

//
// Listen to the `upgrade` event and proxy the
// WebSocket requests as well.
//
proxy.on('upgrade', function (request, socket, body) {
  console.log("[proxy] got upgrade");
  // For now, we convert ws messages to REST requests to config.host
  if (WebSocket.isWebSocket(request)) {
    var ws = new WebSocket(request, socket, body);
    
    ws._bearerToken = null;
    ws._batchedInterval = null;
    ws._batched = [];

    ws.on('message', function(event) {
      var p = JSON.parse(event.data);
      
      console.log("[proxy] parsed: ", p)

      if (p.type == "api_token") {
        request.get(config.host+":"+config.remotePort+config.authEndpoint, {
          auth: {
            bearer: p.data
          }
        }, function(err, res) {
          if (!err && res.statusCode == 200) {
            ws.send(JSON.stringify({type:"api_token-response", data:"OK"}));
            ws._bearerToken = p.data;
            console.log("[proxy] bearerToken "+p.data);
          } else {
            ws.send(JSON.stringify({type:"api_token-response", data:"FAIL"}));
            console.log("[proxy] bearerToken was invalid");
          }
        });
      } else if (typeof(p.type) !== "undefined") {
        ws._batched.push(p);
        console.log("[proxy] batched ", p);

        if (ws._batchedInterval == null) {
          ws._batchedInterval = setInterval(function(){
            if (ws._batched.length > 0 && ws._bearerToken) {
              request.post(config.host+":"+config.remotePort+config.logsEndpoint, {
                form: {entries: ws._batched},
                auth: {
                  bearer: ws._bearerToken
                }
              }, function(err, res) {
                if (!err && res.statusCode == 200) {
                  ws._batched = [];
                  console.log("[proxy] batch call succeeded");
                } else {
                  console.log("[proxy] batch call failed");
                }
              });
            }
          }, config.batchInterval);
        }
      }
    });
    
    ws.on('close', function(event) {
      ws = null;
    });
  }
});

proxy.listen(config.localPort, function() {
  var ad = mdns.createAdvertisement(mdns.tcp('http'), config.localPort, {txtRecord:{
    name: config.serviceName
  }});
  ad.start();
  console.log("listening on "+config.localPort);
});