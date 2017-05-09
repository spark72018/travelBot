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
/*
var URL = process.env.DATABASEURL || "mongodb://localhost/navbuddy";
mongoose.connect(URL);
*/
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

//Connect to db
mongoose.connect(process.env.MONGOLAB_URI || "mongodb://localhost/travelBot", function(err, go) {
  if(err) {
    console.log('connect err is', err);
  }
});
var setInfo = function(str, attachment, toChannel) {
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
  console.log('setInfo called, store is', store);
  return store;
};

var sendTo = function(publicOrNot) {
  return function(param1, param2) {
    if(publicOrNot === 'all') {
      return setInfo(param1, param2, true);
    }else {
      return setInfo(param1, param2);
    }
  }
};


//Auth
app.get('/auth', function(req, res) {
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

var retrieve = function(fn) {
  if(fn === 'geo') {
    return  function(address) {
        return googleMapsClient.geocode({address: address}).asPromise();
      }
  }else if(fn === 'directions') {
    return function(obj) {
        return googleMapsClient.directions(obj).asPromise();
      }
  }else {
    console.log("retrieve fn only takes 'geo' or 'directions'!");
  }
};

var addressMod = (function() {
  class Address {
    constructor(alias, address, mongooseId) {
      this.text = alias + ":" + "\n" + address;
      this.fallback = "An error occurred!";
      this.color = "#3AA3E3";
      this.callback_id = "delete";
      this.attachment_type = "default";
      this.actions = [{
        "name": "address",
        "text": "Delete",
        "type": "button",
        "value": mongooseId
      }];
    }
  }
  var upCaseRegEx = /^[a-z]|\s[a-z]/g;
  var format = function(str) {
    return str.replace(upCaseRegEx, function(match) {
      if(match !== " ") {
        return match.toUpperCase();
      }else {
        return match.charAt(0) + match.charAt(1).toUpperCase();
      }
    })
  };
  var makeAddress = (addressName, addressStr, dbId) =>
        new Address(addressName, format(addressStr), dbId)

  var addressBookText = "Your address book: ";

  return {
    addressBookText: addressBookText,
    makeAddress: makeAddress
  };
})();

app.post('/mylocations', function(req, res) {
  console.log('locations req.body is: ', req.body);
  var a = addressMod;
  var addressBook = sendTo('private');
  var teamID = req.body.team_id;
  var userID = req.body.user_id;
  var addressAttachment;

  // retrieve from db using Mongoose
  SavedLocations.find({userId: userID, teamId: teamID}, function(err, foundLoc) {
    if(err) {
      console.log('mylocations err', err);
      return;
    }
    // array of user's locations
    var loc = foundLoc[0].locations;
    console.log(`Locations for ${req.body.user_name} in db are ${loc}`);

    // make slack attachment array elements by instantiating
    // addressMod's Address class on each saved entry
    addressAttachment = loc.map((savedLoc) =>
      a.makeAddress(savedLoc.name, savedLoc.address, savedLoc._id));

    res.send(addressBook(a.addressBookText, addressAttachment));
  });
});

// button to delete address and receive an updated address book
app.post('/button', function(req, res) {
  var a = addressMod;
  var idk = JSON.parse(req.body.payload);
  var addressBook = sendTo('private');
  var addressAttachment;
  console.log('the button payload is ', idk);

  //console.log('idk is', idk);
  //console.log('button value is ', idk.actions[0].value);
  SavedLocations.find({userId: idk.user.id, teamId: idk.team.id}, function(err, userInfo) {
    if(err) {
      console.log('button userInfo err is', err);
    }else {
      console.log(userInfo[0]);
      SavedLocations.findByIdAndUpdate(userInfo[0]._id, {$pull: {locations: {_id: idk.actions[0].value}}}, {new: true}, function(err, updated) {
        if(err) {
          console.log(err);
        }else {
          addressAttachment = updated.locations.map((savedLoc) =>
            a.makeAddress(savedLoc.name, savedLoc.address, savedLoc._id));
          //console.log('deletion success!');
          res.send(addressBook(a.addressBookText, addressAttachment));
        }
      });
    }
  });
});

//Create database entry for save command
app.post('/save', function(req, res) {
  var split = req.body.text.split(" > ");
  var locationName = split[0].trim().toLowerCase();
  var address = split[1].trim().toLowerCase();
  var regex = /\d+\s+([a-zA-Z]+|[a-zA-Z]+\s[a-zA-Z]+)/g;

  console.log("location name = " + locationName);
  console.log("address = " + address);

  //Regex test
  if (regex.test(address)) {
    //Check if location already exists first
    SavedLocations.find({userId: req.body.user_id, teamId: req.body.team_id}, function(err, userInfo) {
      if(err) {
        console.log('userInfo err is', err);
      }
      console.log('userInfo is', userInfo);
      //If already exists, update it
      if (userInfo.length > 0 && userInfo[0].locations.length > 0) {
        // check each address' name to see if it matches user input, if match, update
        console.log(userInfo[0].locations);
        userInfo[0].locations.forEach(function (el, idx, arr) {
          if(locationName === el.name) {
            SavedLocations.findByIdAndUpdate(userInfo[0]._id, userInfo[0], {new: true}, function(err, updated) {
              console.log('replaced existing', updated);
              res.send({"text": "Location updated!"});
            });
          }else if(idx === arr.length - 1) { // has reached end of array, and still no match, so add address
            SavedLocations.findByIdAndUpdate(userInfo[0]._id, {$push: {locations: {name: locationName, address: address}}}, {new: true}, function(err, updated) {
              if(err) {
                console.log(err);
                return;
              }
              console.log('pushed new', updated);
              res.send({"text": "Location added!"});
            });
          }
        });
      }else if(userInfo.length > 0 && userInfo[0].locations.length === 0) {
        SavedLocations.findByIdAndUpdate(userInfo[0]._id, {$push: {locations: {name: locationName, address: address}}}, {new: true}, function(err, updated) {
          if(err) {
            console.log(err);
            return;
          }
          console.log('pushed new', updated);
          res.send({"text": "Location added!"});
        });
      }else { //If not, create it
          var data = {
            userName: req.body.user_name,
            userId: req.body.user_id,
            teamId: req.body.team_id,
            channelId: req.body.channel_id,
            locations: [{name: locationName, address: address}]
          };
          SavedLocations.create(data, function(error, location) {
            console.log(location);
            res.send({"text": "Location saved!"});
          });
        }
    });
    console.log("Success!");
    } else {
        res.send({"text": "Enter a valid address!"});
        console.log("FAIL");
      }
});

app.post('/:command', function(req, res) {
  var command = req.params.command,
      input = req.body.text,
      addressSplit = input.split(">"),
      addressSplitLength = addressSplit.length,
      cmdSplit = command.split("_"),
      regex = /\d+\s+([a-zA-Z]+|[a-zA-Z]+\s[a-zA-Z]+)/g,
      sendAway = sendTo(cmdSplit[1]),
      reqObj = {},
      start,
      finish,
      startIsValid = false,
      finishIsValid = false;
  console.log('addressSplit is', addressSplit);
  var helpText = "Valid commands: drive, bike, walk, transit, mapme, save.\nTo get directions (pick your mode of transport): /drive 123 N Main St > 456 S Main St\nTo get a map of a location: /mapme 123 N Main St\nTo save a location: /save home > 123 N Main St"
  console.log('commandSplit is', cmdSplit);
  SavedLocations.find({userId: req.body.user_id, teamId: req.body.team_id}, function(err, found) {
    if(err) {
      return console.log('command SavedLocations.find error is', err);
    }
    if(found[0].locations.length > 0) {
      found[0].locations.forEach(function(entry) {
        if(addressSplit[0].trim().toLowerCase() === entry.name) {
          console.log('first address in db!');
          start = entry.address;
          console.log('start entry.address is', entry.address);
          startIsValid = true;
        }
        if(addressSplit[1]) { // if there's a second address, check in db
        console.log('second address detected');
          if(addressSplit[1].trim().toLowerCase() === entry.name) {
            console.log('second address in db!');
            finish = entry.address;
            console.log('finish entry.address is', entry.address);
            finishIsValid = true;
          }
        }
      });
    }
    if(!startIsValid) {
      if(regex.test(addressSplit[0])) {
        start = addressSplit[0];
        console.log('first address is valid address!');
        startIsValid = true;
      }
    }
    if(!finishIsValid) {
      console.log('in !finishisValid block');
      console.log(regex.test(addressSplit[1]));
      if(regex.test(addressSplit[1])) {
        console.log('second address is valid address!');
        finish = addressSplit[1];
        finishIsValid = true;
      }
    }
    console.log('startIsValid is', startIsValid);
    console.log('endIsValid is', finishIsValid);
    if(addressSplitLength === 2 && startIsValid && finishIsValid) {
      let startGeo = retrieve('geo')(start);
      let endGeo = retrieve('geo')(finish)
      var geoCodes = Promise.all([startGeo, endGeo]);

      geoCodes.then((geos) => {
        console.log('geos are', geos[0], geos[1]);

        reqObj.departure_time = new Date;
        reqObj.traffic_model = 'best_guess';
        reqObj.origin = geos[0].json.results[0].geometry.location;
        reqObj.destination = geos[1].json.results[0].geometry.location;
        if(cmdSplit[0] !== 'image') {
          reqObj.mode = cmdSplit[0];
        }

        let directions = retrieve('directions')(reqObj);
        directions.then((result) => {
          if(cmdSplit[0] === 'image') {
            console.log('image command');
            let poly = result.json.routes[0].overview_polyline.points;
            var urlFormatAddress1 = start.trim().replace(/\s/g, '+'),
                urlFormatAddress2 = finish.trim().replace(/\s/g, '+');
            var url = "https://maps.googleapis.com/maps/api/staticmap?size=600x400&markers="+
            urlFormatAddress1 + '|' + urlFormatAddress2 +
            '&path=weight:6%7Ccolor:blue%7Cenc:' + poly;
            var attachObj = [
              {
                "title": input,
                "title_link": "https://www.google.com/maps/dir/" + urlFormatAddress1 + '/' + urlFormatAddress2,
                image_url: url
              }
            ];
            console.log('attachObj is', attachObj);
            res.send(sendAway(attachObj));
          }else {
            let route = result.json.routes[0].legs[0],
            distanceText = 'Distance: ' + route.distance.text + '\n',
            durationText,
            resultString;

            if(route.steps.length > 40) {
              var redirectUrl ='Directions were too long! Just so we don\'t spam your channel, here\'s a directions link: ' + '\n\n' +
              'https://www.google.com/maps/dir/' +
              addressSplit[0].trim().replace(/\s/g, '+') + '/' +
              addressSplit[1].trim().replace(/\s/g, '+');

              res.send(sendAway(redirectUrl));
            }

            if(cmdSplit[0] === 'driving') {
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
            console.log(resultString);
            res.send(sendAway(resultString));
          }
        })
      })
    }else { // onlly one address
      console.log('addressSplit is', addressSplit);
      console.log('else block for one address');
      if(cmdSplit[0] === 'image') {
        console.log('in image block for one address');
        var formattedInput = addressSplit[0].replace(/\s/g, '+');
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
      }
    }
  });
  //Help command
  if (cmdSplit[0] === "help") {
    res.send(sendAway(helpText));
  }
});

//Listening
var port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log("Listening on port " + port + "!");
});
