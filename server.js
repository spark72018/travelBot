var express = require('express'),
      bodyParser = require('body-parser'),
      urlencodedParser = bodyParser.urlencoded({extended: false}),
      app = express(),
      apiKey = process.env.MAPKEY,
      slackToken = process.env.SLACKTOKEN,
      googleMapsClient = require('@google/maps').createClient({
  key: apiKey
});

/*
app.post('/slack/map', urlencodedParser, (req, res) => {

});
*/
app.get('/', function(req, res) {
  googleMapsClient.geocode({
    address: '1600 Amphitheatre Parkway, Mountain View, CA'
  }, function(err, response) {
    if(!err) {
      console.log(response.json.results);
      res.send(response.json.results);
    }else {
      console.log(err);
    }
  });
});

app.listen(process.env.PORT || 3000);
