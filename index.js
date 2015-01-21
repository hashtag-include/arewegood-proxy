var http = require('http'),
    httpProxy = require('http-proxy'),
    apps = require('polo')(),
    config = require('uniformer')({
      file: "config.json",
      defaults: {
        host: "arewegood.azurewebsites.net",
        port: 8015,
        serviceName: "arewegood-proxy"
      }
    });

//
// Setup our server to proxy standard HTTP requests
//
var proxy = new httpProxy.createProxyServer({
  target: {
    host: config.host
  }
});
var proxyServer = http.createServer(function (req, res) {
  proxy.web(req, res);
});

//
// Listen to the `upgrade` event and proxy the
// WebSocket requests as well.
//
proxyServer.on('upgrade', function (req, socket, head) {
  proxy.ws(req, socket, head);
});

proxyServer.listen(config.port, function() {
  apps.put({
    name: config.serviceName,
    port: config.port
  });

  console.log("listening on "+config.port);
});