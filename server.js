var express = require('express'),
    bodyParser = require('body-parser'),
    //urlencodedParser = bodyParser.urlencoded({extended: false}),
    app = express(),
    apiKey = process.env.MAPKEY,
    slackEnvToken = process.env.SLACKTOKEN,
    googleMapsClient = require('@google/maps').createClient({
      key: apiKey,
      Promise: Promise
    });

app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

/*
-generates our response object
-example usage:
var ourBot = botStore("THIS\nIS\nSPARTA", [{image_url: 'some url link'}]);
console.log(ourBot.response()); //will output Object
                                              attachments: Array[1]
                                              text: "THIS↵IS↵SPARTA"
                                              __proto__: Object
*/
//needs work, code is not DRY

var botStore = function(textInput, attachmentInput) {
  var store,
      argsLength = arguments.length;
  if(argsLength === 2) {
    store = {
      'response_type': 'in_channel',
      'text': arguments[0],
      'attachments': arguments[1]
    };
  }else if(typeof arguments[0] === 'string') {
    store = {
      'response_type': 'in_channel',
      'text': arguments[0]
    };
  }else {
    store = {
      'response_type': 'in_channel',
      'attachments' : arguments[0]
    };
  }
  return {
    response: function() {
      return store;
    }
  };
};

//Auth
app.get('/slack', function(req, res){
  var data = {form: {
      client_id: process.env.SLACK_CLIENT_ID,
      client_secret: process.env.SLACK_CLIENT_SECRET,
      code: req.query.code
  }};
  request.post('https://slack.com/api/oauth.access', data, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      // Get an auth token
      let token = JSON.parse(body).access_token;

      // Get the team domain name to redirect to the team URL after auth
      request.post('https://slack.com/api/team.info', {form: {token: token}}, function (error, response, body) {
        if (!error && response.statusCode == 200) {
          if(JSON.parse(body).error == 'missing_scope') {
            res.send('MapMe has been added to your team!');
          } else {
            let team = JSON.parse(body).team.domain;
            res.redirect('http://' +team+ '.slack.com');
          }
        }
      });
    }
  })
});


//Slash Commands
app.post('/', function(req, res) {
  var input = req.body.text;
  var splitted = input.split(">");
  var regex = /\d+\s+([a-zA-Z]+|[a-zA-Z]+\s[a-zA-Z]+)/g;
  console.log('splitted = ', splitted);

  //Help command
  if (input === "help") {
    res.send({
      response_type: 'in_channel',
      "text": "Get your directions by entering 2 addresses seperated with a >. Example,'123 N Main St > 456 S Main St.'" 
    });
  }

  //Static img if 1 address input
  if (regex.test(input)) {
    if(splitted.length === 1) {
      var formattedInput = input.replace(/\s/g, '+');
      console.log('formattedInput = ' + formattedInput);
      var url = "https://maps.googleapis.com/maps/api/staticmap?center="+formattedInput+"&size=600x400&markers="+formattedInput;

      res.send({
        response_type: 'in_channel',
        attachments:[
          {
            "title": input,
            "title_link": "http://maps.google.com/maps?f=d&source=s_d&saddr=&daddr="+formattedInput,
            image_url: url
          }
        ]
      }); //Directions else if 2 address inputs
    } else if (splitted.length === 2) { 
      //timestamp console.log to easily discern app startup in heroku logs
      console.log(new Date().toLocaleString());

      //to see what user response gets split to
      console.log('splitted is ', splitted);

      //this will go in else block
      var p1 = googleMapsClient.geocode({
        address: splitted[0]
      }).asPromise();

      var p2 = googleMapsClient.geocode({
        address: splitted[1]
      }).asPromise();

      //this promise will wait for p1 and p2 to resolve before resolving itself
      var p3 = Promise.all([p1, p2])

      .then(function(values) {
        start = values[0].json.results[0].geometry.location;
        finish = values[1].json.results[0].geometry.location;

        googleMapsClient.directions({
          origin: start,
          destination: finish
        }).asPromise()

        .then(function(result) {
          //route is an array where each element is an object containing one line
          //of the route in the .html_instructions property
          var route = result.json.routes[0].legs[0].steps,
              resultString = '';

          //need to format last line properly after </div>
          route.forEach(function(el) {
            resultString += el.html_instructions.replace(/<b>|<\/b>|<div (.*?)>|<\/div>/g, '') + '\n';
          });
          //console.log('resultString is', resultString);
          var ourBot = botStore(resultString);
          var theResponse = ourBot.response();
          console.log(theResponse);
          res.send(theResponse);
        });
      });
    }
  } else {
      res.send({
        response_type: 'in_channel',
        "text": "Enter a valid address!",
      });
  }
});


//Listening
var port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log("Listening on port " + port + "!");
});
