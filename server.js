var express = require('express'),
    bodyParser = require('body-parser'),
    mongoose = require('mongoose'),
    SavedLocations = require("./models/savedLocations"),
    request = require('request'),
    app = express(),
    apiKey = process.env.MAPKEY,
    slackEnvToken = process.env.SLACKTOKEN,
    googleMapsClient = require('@google/maps').createClient({
      key: apiKey,
      Promise: Promise
    });

var URL = process.env.DATABASEURL || "mongodb://localhost/navbuddy";
mongoose.connect(URL);

app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

var setInfo = function(str, attachment, toChannel) {
  var store = {}, type, i;

  for(i=0; i<arguments.length; i++) {
    type = typeof arguments[i];
    if(type === 'string') {
      store['text'] = arguments[i];
    }else if(type === 'object') {
      store['attachments'] = arguments[i];
    }else if(arguments[i] == true) {
      store['response_type'] = 'in_channel';
    }
  }
  var away = function() {
    return store;
  };
  return {
    away: away
  };
};

var properSend = function(publicOrNot) {
  return function(param1, param2) {
    if(publicOrNot === 'all') {
      return setInfo(param1, param2, true).away();
    }else {
      return setInfo(param1, param2).away();
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
          // if(JSON.parse(body).error == 'missing_scope') {
          //   res.send('NavBuddy has been added to your team!');
          // } else {
            var team = JSON.parse(body).team.domain;
            res.redirect('http://'+team+'.slack.com');
          //}
        }
      });
    }
  })
});


//Create database entry for save command
app.post('/save', function(req, res) {
  var split = req.body.text.split(" > ");
  var locationName = split[0].toLowerCase();
  var address = split[1].toLowerCase();
  var regex = /\d+\s+([a-zA-Z]+|[a-zA-Z]+\s[a-zA-Z]+)/g;

  console.log("location name = " + locationName);
  console.log("address = " + address);


  if (regex.test(address)) {
    var data = {
      userName: req.body.user_name,
      userId: req.body.user_id,
      teamId: req.body.team_id,
      channelId: req.body.channel_id,
      name: locationName,
      address: address
    };
    SavedLocations.find({userId: req.body.user_id, teamId: req.body.team_id, name: locationName}, function(err, foundthing) {
      console.log(foundthing);

      if (foundthing.length > 0) {
        SavedLocations.findByIdAndUpdate(foundthing[0]._id, {$set: {address: address}}, {new: true}, function(err, updated) {
          console.log(updated);
          res.send("Updated");
        });
      } else {
          SavedLocations.create(data, function(error, location) {
          console.log(location);
          res.send({
            "text": "Location saved!",
          });
        });
      }
    });

    console.log("Success!");
  } else {
      res.send({
        "text": "Enter a valid address!",
      });
      console.log("FAIL");
    }
});


app.post('/:command', function(req, res) { //add option to get geocodes? too much?
  var command = req.params.command,
      input = req.body.text,
      splitted = input.split(">"),
      cmdSplit = command.split("_");
      regex = /\d+\s+([a-zA-Z]+|[a-zA-Z]+\s[a-zA-Z]+)/g,
      sendAway = properSend(cmdSplit[1]),
      reqObj = {};
  var helpText = "Valid commands: mapme, mapmedrive, mapmepublic, mapmewalk, save.\nTo get directions:/mapme[mode of transportation] 123 N Main St > 456 S Main St.\nTo get a map of a specific location: /mapme 123 N Main St."
  console.log('commandSplit is', cmdSplit);

  //Help command
  if (cmdSplit[0] === "help") {
    res.send(sendAway(helpText));
  }

  //Start of regex test for address input
  if (regex.test(input)) {
      //  /mapme will send post request to homepage/image
    if(splitted.length === 1 && cmdSplit[0] === "image") {
      var formattedInput = input.replace(/\s/g, '+');
      console.log('formattedInput = ' + formattedInput);
      var url = "https://maps.googleapis.com/maps/api/staticmap?center="+formattedInput+"&size=600x400&markers="+formattedInput;
      var attachObj = [
        {
          "title": input,
          "title_link": "http://maps.google.com/maps?f=d&source=s_d&saddr=&daddr="+formattedInput,
          image_url: url
        }
      ];
      res.send(sendAway(attachObj));
    } else if (splitted.length === 2) {
      //timestamp console.log to easily discern app startup in logs
      console.log(new Date().toLocaleString());

      //to see what user response gets split to
      console.log('splitted is ', splitted);

      var p1 = googleMapsClient.geocode({
        address: splitted[0]
      }).asPromise();

      var p2 = googleMapsClient.geocode({
        address: splitted[1]
      }).asPromise();

      var p3 = Promise.all([p1, p2])

      .then(function(values) {
        start = values[0].json.results[0].geometry.location;
        finish = values[1].json.results[0].geometry.location;

        //mode values = 'driving', 'walking', 'bicycling', 'transit'
        reqObj.mode = cmdSplit[0];
        reqObj.departure_time = new Date;
        reqObj.traffic_model = 'best_guess';
        reqObj.origin = start;
        reqObj.destination = finish;

        googleMapsClient.directions(reqObj).asPromise()

        .then(function(result) {
          var route = result.json.routes[0].legs[0],
              distanceText = 'Distance: ' + route.distance.text + '\n',
              durationText,
              resultString;

          if(cmdSplit[0] === 'driving') {
            durationText = 'ETA: ' + route.duration_in_traffic.text + ' (in current traffic)' + '\n\n';
          }else {
            durationText = 'ETA: ' + route.duration.text + '\n\n';
          }

          resultString = distanceText + durationText;

          if(cmdSplit.length === 2 && cmdSplit[1] === 'eta') {
            res.send(sendAway(resultString));
          }else{
            route.steps.forEach(function(el) {
              resultString += el.html_instructions
                              .replace(/<b>|<\/b>|<\/div>/g, '')
                              .replace(/<div (.*?)>/g, '\n') + '\n';
            });
            res.send(sendAway(resultString));
          }
        });
      });
    }
  } else { //Error message if input doesn't pass regex test
      res.send(sendAway('Enter a valid address!'));
  }
});

//Listening
var port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log("Listening on port " + port + "!");
});
