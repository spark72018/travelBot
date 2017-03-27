const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const apiKey = process.env.MAPKEY;
const googleMapsClient = require('@google/maps').createClient({
  key: apiKey
});
console.log(apiKey);

app.get('/favicon.ico', (req, res) => { //disable favicon
  res.sendStatus(204);
});

app.get('/', (req, res) => {
  googleMapsClient.geocode({
    address: '1600 Amphitheatre Parkway, Mountain View, CA'
  }, function(err, res) {
    if(!err) {
      console.log(res.json.results);
      res.send(res.json.results);
    }else {
      console.log('error occurred: ', err);
    }
  });
});

app.listen(process.env.PORT || 3000);
