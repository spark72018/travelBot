var express = require('express'),
    bodyParser = require('body-parser'),
    urlencodedParser = bodyParser.urlencoded({extended: false}),
    app = express(),
    apiKey = process.env.MAPKEY,
    slackEnvToken = process.env.SLACKTOKEN,
    googleMapsClient = require('@google/maps').createClient({
      key: apiKey
    });

//https://tranquil-harbor-42592.herokuapp.com/
var isEqual = function(p1, p2) {
    return p1 === p2;
};

var replacer = function(str, obj) {
  var replacerStr = str,
      regex,
      expression;
  for(expression in obj) {
      regex = new RegExp(expression, 'g');
      replacerStr = replacerStr.replace(regex, obj[expression]);
  }
  return replacerStr;
};

app.get('/', function(req, res) {
    console.log('success!');
    res.send('success!');
});

app.post('/slack/hello', urlencodedParser, function(req, res) {
    if(isEqual(req.body.token, slackEnvToken)) {
        res.send({
            'response_type': 'in_channel',
            'text': "Hello there!"
        });
    }else {
        res.sendStatus(500);
    }
});

app.post('/slack/inspire', urlencodedParser, function(req, res) {
    //get random quote and send if token matches
    var myPromise = new Promise(function(resolve, reject) {
        http.get('http://quotesondesign.com/wp-json/posts?filter[orderby]=rand&filter[posts_per_page]=1&callback=' +
        new Date().getTime(), function(res) {
            var statusCode = res.statusCode;
            if(statusCode != 200) {
                console.log('did not get quote!');
                return -1;
            }
            res.setEncoding('utf-8');
            var rawData = '';
            res.on('data', function(chunk) {
                rawData += chunk;
            });
            res.on('end', function() {
                var parsedData = JSON.parse(rawData);
                resolve(parsedData);
            });
        });
    });
    myPromise.then(function(quoteData) {
        if(isEqual(req.body.token, envToken)) {
            var formattedQuote = replacer(quoteData[0].content, {
                '<p>|<\/p>': '',
                '&#8217;': '\'',
                '&#8220;|&#8221': '\"',
                '&#038;': '&',
                '&#8230;': '...'
            });
            res.send({
                'response_type': 'in_channel',
                'text': formattedQuote + ' -' + quoteData[0].title
            });
        }else {
            console.log('isEqual for quoteData failed');
            res.sendStatus(500);
        }
    });
});

app.listen(process.env.PORT || 8080, function() {
    console.log('Listening on port ', process.env.PORT + '!');
});

app.get('/', function(req, res) {
  googleMapsClient.geocode({
    address: '1600 Amphitheatre Parkway, Mountain View, CA'
  }, function(err, response) {
    if(!err) {
      console.log(response.json.results);
      res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
      res.send(response.json.results);
    }else {
      console.log(err);
    }
  });
});

app.listen(process.env.PORT || 3000);
