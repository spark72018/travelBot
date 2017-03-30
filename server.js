var express = require('express'),
    bodyParser = require('body-parser'),
    urlencodedParser = bodyParser.urlencoded({extended: false}),
    app = express(),
    apiKey = process.env.MAPKEY,
    slackEnvToken = process.env.SLACKTOKEN,
    googleMapsClient = require('@google/maps').createClient({
      key: apiKey,
      Promise: Promise
    });

/*
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
        if(isEqual(req.body.token, slackEnvToken)) {
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
*/

/*
app.get('/', function(req, res) {
  googleMapsClient.geocode({
    address: '1600 Amphitheatre Parkway, Mountain View, CA'
  }, function(err, response) {
    if(!err) {
      console.log(response.json.results);
      //res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
      res.send(response.json.results);
    }else {
      console.log(err);
    }
  });
});

app.listen(process.env.PORT || 3000);
*/


//Start of if block (static image part)
/*
var cmd = req.body.text;
if (cmd.split(">").length === 1) {
  cmd = cmd.replace(\/s\g, '+');

  var img = "https://maps.googleapis.com/maps/api/staticmap?center="+cmd+"&size=600x400&markers="+cmd;

  res.send({
    response_type: 'in_channel',
    attachments:[
      {
        image_url: img;
      }
    ]
  });
} else {}
*/

/*
//we can input appropriate responses, will return response object

//also, if we want to send error text, just put our error message
//into textInput param

//attachmentInput is an array of objects, debating whether to write
//argument validation in function body, leaning towards not
var botStore = function(textInput, attachmentInput) {
  var store = {
    'text': textInput,
    'attachments': attachmentInput
  };
  return {
    response: function() {
      return store;
    }
  };
};

example usage:
var ourBot = botStore("THIS\nIS\nSPARTA", [{image_url: img}]);
ourBot.response();
*/

/*initial attempt at getting user input and doing stuff with it
app.get('/someCommand', function(req, res) {
  //cache appropriate lookups here?
    //valerie's if block code here
    //steve's  else code here
      //googleMapsClient.geocode code here, then
      //process geocode with googleMapsClient.directions code here
        //figure out how to process google's directions response, use my
        //replacer function from slack quote command (not sure)
  //var ourBot = botStore(directions, image);
  //var ourResponse = ourBot.response();
  //res.send(ourResponse);

});

*/

app.get('/', function(req, res) {
  googleMapsClient.directions({
    origin: { lat: 40.7720280, lng: -73.4974010 },
    destination: {lat: 40.8425820, lng: -73.7171510 }
  }).asPromise()
  .then(function(response) {
    console.log(response.json);
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
    res.send(response.json);
  });

});

app.listen(process.env.PORT || 3000);
