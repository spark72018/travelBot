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

-example usage:
var ourBot = botStore("THIS\nIS\nSPARTA", [{image_url: 'some url link'}]);
console.log(ourBot.response()); //will output Object
                                              attachments: Array[1]
                                              text: "THIS↵IS↵SPARTA"
                                              __proto__: Object
*/
var fac = function(textStr, attachment, toChannel) {
  var store = {}, type, i;
  for(i=0; i<arguments.length; i++) {
    type = typeof arguments[i];
    if(type === 'string') {
      store['text'] = arguments[i];
    }else if(type === 'object') {
      store['attachments'] = arguments[i];
    }else if(arguments[i] === true) {
      store['response_type'] = 'in_channel';
    }
  }
  return {
    response: function() {
      return store;
    }
  }
};


//Auth
app.get('/slack', function(req, res) {
  var data = {form: {
      client_id: process.env.SLACK_CLIENT_ID,
      client_secret: process.env.SLACK_CLIENT_SECRET,
      code: req.query.code
  }};
  request.post('https://slack.com/api/oauth.access', data, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      // Get an auth token
      var token = JSON.parse(body).access_token;

      // Get the team domain name to redirect to the team URL after auth
      request.post('https://slack.com/api/team.info', {form: {token: token}}, function (error, response, body) {
        if (!error && response.statusCode == 200) {
          if(JSON.parse(body).error == 'missing_scope') {
            res.send('MapMe has been added to your team!');
          } else {
            var team = JSON.parse(body).team.domain;
            res.redirect('http://' +team+ '.slack.com');
          }
        }
      });
    }
  })
});


//Create database entry for save command
app.post('/save', function(req, res) {
  var body = req.body;
  var split = body.text.split(">");
  var locationName = split[0];
  var address = split[1];
  var regex = /\d+\s+([a-zA-Z]+|[a-zA-Z]+\s[a-zA-Z]+)/g;

  if (regex.test(location)) {
    var data = new savedLocation({
      userId: body.user_id,
      teamId: body.team_id,
      channelId: body.channel_id,
      location: locationName,
      address: address
    });
    data.save(function(err) {
      if (err) {
        return res.send("Error saving to database");
      }
    });
  } else {
      res.send({
        "text": "Enter a valid address!",
      });
    }
});


//MapMe Commands
app.post('/:command', function(req, res) {
  var command = req.params.command,
      input = req.body.text,
      splitted = input.split(">"),
      regex = /\d+\s+([a-zA-Z]+|[a-zA-Z]+\s[a-zA-Z]+)/g,
      reqObj = {};
  var helpText = "Valid commands: mapme, mapmedrive, mapmepublic, mapmewalk, save.\nTo get directions:/mapme[mode of transportation] 123 N Main St > 456 S Main St.\nTo get a map of a specific location: /mapme 123 N Main St."
  console.log('splitted = ', splitted);

  //Help command
  if (command === "help") {
    res.send(fac(helpText).response());
  }

  //Start of regex test for address input
  if (regex.test(input)) {

      //  /mapme will send post request to homepage/image
    if(splitted.length === 1 && command === "image") {
      var formattedInput = input.replace(/\s/g, '+');
      console.log('formattedInput = ' + formattedInput);
      var url = "https://maps.googleapis.com/maps/api/staticmap?center="+formattedInput+"&size=600x400&markers="+formattedInput;
      res.send({
        attachments:[
          {
            "title": input,
            "title_link": "http://maps.google.com/maps?f=d&source=s_d&saddr=&daddr="+formattedInput,
            image_url: url
          }
        ]
      });
    } else if (splitted.length === 2) { //Directions response if 2 address inputs
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

        //mode values = 'driving', 'walking', 'bicycling', 'transit'
        reqObj.mode = command;
        reqObj.departure_time = new Date;
        reqObj.traffic_model = 'best_guess';
        reqObj.origin = start;
        reqObj.destination = finish;

        googleMapsClient.directions(reqObj).asPromise()

        .then(function(result) {
          //route is an array where each element is an object containing one line
          //of the route in the .html_instructions property
          var route = result.json.routes[0].legs[0],
              distanceText = 'Distance: ' + route.distance.text + '\n',
              durationText,
              resultString;

          if(command === 'driving') {
            durationText = 'ETA: ' + route.duration_in_traffic.text + ' (in current traffic)' + '\n\n';
          }else {
            durationText = 'ETA: ' + route.duration.text + '\n\n';
          }

          resultString = distanceText + durationText;

          route.steps.forEach(function(el) {
            resultString += el.html_instructions
                            .replace(/<b>|<\/b>|<\/div>/g, '')
                            .replace(/<div (.*?)>/g, '\n') + '\n';
          });
          //console.log('resultString is', resultString);
          res.send(fac(resultString).response());
        });
      });
    }
  } else { //Error message if input doesn't pass regex test
      res.send(fac("Enter a valid address!").response());
  }
});


//Listening
var port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log("Listening on port " + port + "!");
});
