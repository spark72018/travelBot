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
    if(publicOrNot) {
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
  var split = body.text.split(" ");
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
    data.save(err => {
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


/*
MapMe Commands available commands so far:
  /mapmewalk
  /mapmedrive
  /mapmebike
  /mapmetransit
  /mapme (static image)
  /maphelp (help command)
-ideas on how to make public? mapme commands too long?
-adding "all" to command will add "_all" to post url
  /mapmewalk address1 > address2
  /mapmewalkall address1 > address2

  /mapme address
  /mapmeall address

  NavPal? (/npwalk, /npdrive np ~ "No Problem") MapPal?(/mpwalk, /mphelp) MaPal? (same)
  /npwalk address1 > address2
  /npwalkall address1 > address2

  /np address (static image)
  /npall address (static image)
*/

app.post('/:command', function(req, res) {
  var command = req.params.command,
      input = req.body.text,
      splitted = input.split(">"),
      commandSplit = command.split("_all");
      regex = /\d+\s+([a-zA-Z]+|[a-zA-Z]+\s[a-zA-Z]+)/g,
      publicRegEx = /_all/g,
      toMeOrAll = commandSplit.length-1,
      sendAway = properSend(toMeOrAll),
      reqObj = {};
  var helpText = "Valid commands: mapme, mapmedrive, mapmepublic, mapmewalk, save.\nTo get directions:/mapme[mode of transportation] 123 N Main St > 456 S Main St.\nTo get a map of a specific location: /mapme 123 N Main St."
  console.log('splitted = ', splitted);
  console.log('commandSplit is', commandSplit);
  //Help command
  if (commandSplit[0] === "help") {
    res.send(sendAway(helpText));
  }

  //Start of regex test for address input
  if (regex.test(input)) {
      //  /mapme will send post request to homepage/image
    if(splitted.length === 1 && commandSplit[0] === "image") {
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
        reqObj.mode = commandSplit[0];
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

          if(commandSplit[0] === 'driving') {
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
          res.send(sendAway(resultString));
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
