const express = require('express'),
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

app.get('/favicon.ico', (req, res) => { //disable favicon
  res.sendStatus(204);
});

app.get('/', (req, res) => {
  let mapPromise = new Promise((resolve, reject) => {
    googleMapsClient.geocode({
      address: '1600 Amphitheatre Parkway, Mountain View, CA'
    }, (err, response) {
      if(!err) {
        console.log(response.json.results);
        res.send(response.json.results);
      }else {
        console.log('error occurred, ', err);
      }
    });
  });
});

app.listen(process.env.PORT || 3000);
