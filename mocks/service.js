var express = require('express')
var bodyParser = require('body-parser')
var app = express()
var conf = require('conar')()
            .defaults({
              port: 1337
            })
            .opts();
 
console.log("parsed args: ", conf)

app.use(bodyParser.urlencoded({ extended: false }))

app.get('/logs', function (req, res) {
  console.log(req.get('Authorization'))
  res.sendStatus(200)
})

app.post('/logs', function (req, res) {
  if(!req.body) return res.sendStatus(400)
  console.log(JSON.parse(req.body));
  res.sendStatus(200)
})
 
app.listen(conf.port)