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

/**
 * @function setInfo
 * @description sets Slack response text, attachments, and public/private response
 * @param { string } text of the message
 * @param { object } any attachments (images, etc)
 * @param { boolean } coerce to true if send to public, otherwise private
 * @returns { object } response object that will be sent to Slack
 */
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

/**
 * @function sendTo
 * @description will curry the setInfo function above by setting 'toChannel' param
 * @param { string } must be 'all' to send to everyone, otherwise private response
 * @returns { function } returns setInfo function
*/

var sendTo = function(publicOrNot) {
  return function(param1, param2) {
    if(publicOrNot === 'all') {
      return setInfo(param1, param2, true);
    }else {
      return setInfo(param1, param2);
    }
  }
};


// OAuth
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

/**
 * @function retrieve
 * @description will retrieve either geocodes or directions depending on arg
 * @param { string } must either be 'geo' or 'directions'
 * @returns { object } will contain either lat/lng or directions object
*/

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
    return console.log("retrieve fn only takes 'geo' or 'directions'!");
  }
};

/**
 * address revealing module that constructs address book for slack response
 * and also exposes regex format function to capitalize first letter of
 * every word in a string separated by a space
 * @module
*/
var addressMod = (function() {
  /**
   * Address class whose constructor will initialize instantiated objects with
   * appropriate properties (including delete button) as per Slack API guidelines
   * @class
   * @classdesc will contain address name, address, and delete button
   *            that user previously saved with /save Slack slash command
  */
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

  /**
   * @function format
   * @description will return string with first letter of every word capitalized
   * @param { string }
   * @returns { string }
  */
  var format = function(str) {
    return str.replace(upCaseRegEx, function(match) {
      if(match !== " ") {
        return match.toUpperCase();
      }else {
        return match.charAt(0) + match.charAt(1).toUpperCase();
      }
    })
  };
  /**
   * @function makeAddress
   * @description instantiates an Address class with formatted address string
   * @param { string } name of saved address
   * @param { string } address string
   * @param { string } unique database id assigned to entry
   * @returns { object } instantiated Address object 
  */
  var makeAddress = (addressName, addressStr, dbId) =>
        new Address(addressName, format(addressStr), dbId)

  var addressBookText = "Your address book: ";

  return {
    addressBookText: addressBookText,
    makeAddress: makeAddress,
    format: format
  };
})();

// slash command to give user address book
app.post('/mylocations', function(req, res) {
  console.log('locations req.body is: ', req.body);
  var a = addressMod;
  var addressBook = sendTo('private');
  var teamID = req.body.team_id;
  var userID = req.body.user_id;
  var addressAttachment;

  // search db using Mongoose
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
  var buttonInfo = JSON.parse(req.body.payload);
  var addressBook = sendTo('private');
  var addressAttachment;
  //console.log('the button payload is ', buttonInfo);
  //console.log('button value is ', buttonInfo.actions[0].value);

  // search db for user's saved locations
  SavedLocations.find({userId: buttonInfo.user.id, teamId: buttonInfo.team.id}, function(err, userInfo) {
    if(err) {
      console.log('button userInfo err is', err);
    }else {
      console.log(userInfo[0]);
      // delete saved location from array using database id attained from button action
      SavedLocations.findByIdAndUpdate(userInfo[0]._id, {$pull: {locations: {_id: buttonInfo.actions[0].value}}}, {new: true}, function(err, updated) {
        if(err) {
          console.log(err);
        }else {
          // construct new address book list and send back to user
          addressAttachment = updated.locations.map((savedLoc) =>
            a.makeAddress(savedLoc.name, savedLoc.address, savedLoc._id));
          //console.log('deletion success!');
          res.send(addressBook(a.addressBookText, addressAttachment));
        }
      });
    }
  });
});

// Create database entry for save command
app.post('/save', function(req, res) {
  var split = req.body.text.split(" > ");
  var locationName = split[0].trim().toLowerCase();
  var address = split[1].trim().toLowerCase();
  var regex = /\d+\s+([a-zA-Z]+|[a-zA-Z]+\s[a-zA-Z]+)/g;

  console.log("location name = " + locationName);
  console.log("address = " + address);

  // Regex test
  if (regex.test(address)) {
    // Check if location already exists first
    SavedLocations.find({userId: req.body.user_id, teamId: req.body.team_id}, function(err, userInfo) {
      if(err) {
        console.log('userInfo err is', err);
      }
      console.log('userInfo is', userInfo);
      // If already exists, update it
      if (userInfo.length > 0 && userInfo[0].locations.length > 0) {
        // check each address' name to see if it matches user input
        console.log(userInfo[0].locations);
        userInfo[0].locations.forEach(function (el, idx, arr) {
          // if match, update with new address input
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
        // if user exists in db but no locations array is empty, push new entry in
      }else if(userInfo.length > 0 && userInfo[0].locations.length === 0) {
        SavedLocations.findByIdAndUpdate(userInfo[0]._id, {$push: {locations: {name: locationName, address: address}}}, {new: true}, function(err, updated) {
          if(err) {
            console.log(err);
            return;
          }
          console.log('pushed new', updated);
          res.send({"text": "Location added!"});
        });
      }else { // User does not exist at all, create new user entry in db
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

// handles /drive, /bike, /walk, /transit, /mapme slash commands
app.post('/:command', function(req, res) {
  var command = req.params.command,
      input = req.body.text,
      addressSplit = input.split(">"),
      addressSplitLength = addressSplit.length,
      cmdSplit = command.split("_"),
      regex = /\d+\s+([a-zA-Z]+|[a-zA-Z]+\s[a-zA-Z]+)/g,
      sendAway = sendTo(cmdSplit[1]),
      a = addressMod,
      reqObj = {},
      start,
      finish,
      startIsValid = false,
      finishIsValid = false;
  console.log('addressSplit is', addressSplit);
  var helpText = "Valid commands: drive, bike, walk, transit, mapme, save.\nTo get directions (pick your mode of transport): /drive 123 N Main St > 456 S Main St\nTo get a map of a location: /mapme 123 N Main St\nTo save a location: /save home > 123 N Main St"
  console.log('commandSplit is', cmdSplit);

  // check db to see if any of the inputs are saved addresses
  SavedLocations.find({userId: req.body.user_id, teamId: req.body.team_id}, function(err, found) {
    if(err) {
      return console.log('command SavedLocations.find error is', err);
    }
    if(found[0].locations.length > 0) { // user has saved at least one address
      // iterate over saved locations to check if user input matches saved address name
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
    // if address didn't match in db, regex test them for address validation
    if(!startIsValid) {
      if(regex.test(addressSplit[0])) {
        start = addressSplit[0];
        console.log('first address is valid address!');
        startIsValid = true;
      }
    }
    if(!finishIsValid) {
      console.log('in !finishisValid block');
      console.log('regex test for second address is', regex.test(addressSplit[1]));
      // if statement below wouldn't evaluate regex.test(string) to true
      // under any circumstance, only works by hardcoding regex object as
      // below, investigate later!
      if(/\d+\s+([a-zA-Z]+|[a-zA-Z]+\s[a-zA-Z]+)/g.test(addressSplit[1])) {
        console.log('second address is valid address!');
        finish = addressSplit[1];
        finishIsValid = true;
      }
    }
    console.log('startIsValid is', startIsValid);
    console.log('endIsValid is', finishIsValid);
    // if two valid addresses are detected, get geocodes and directions via Promises
    if(addressSplitLength === 2 && startIsValid && finishIsValid) {
      let startGeo = retrieve('geo')(start);
      let endGeo = retrieve('geo')(finish)
      var geoCodes = Promise.all([startGeo, endGeo]); // Promise gate

      geoCodes.then((geos) => {
        console.log('geos are', geos[0], geos[1]);

        reqObj.departure_time = new Date;
        reqObj.traffic_model = 'best_guess';
        reqObj.origin = geos[0].json.results[0].geometry.location;
        reqObj.destination = geos[1].json.results[0].geometry.location;
        if(cmdSplit[0] !== 'image') { // set mode of transportation if not /mapme
          reqObj.mode = cmdSplit[0];
        }

        let directions = retrieve('directions')(reqObj);
        directions.then((result) => {
          // if /mapme invoked, will construct static image polyline map url
          if(cmdSplit[0] === 'image') {
            console.log('image command');
            let poly = result.json.routes[0].overview_polyline.points;
            var urlFormatAddress1 = start.trim().replace(/\s/g, '+'),
                urlFormatAddress2 = finish.trim().replace(/\s/g, '+');
            var url = "https://maps.googleapis.com/maps/api/staticmap?size=600x400&markers="+
            urlFormatAddress1 + '|' + urlFormatAddress2 +
            '&path=weight:6%7Ccolor:blue%7Cenc:' + poly + "&key=" + apiKey;
            var attachObj = [
              {
                "title": a.format(input.replace(">", "to")),
                "title_link": "https://www.google.com/maps/dir/" + urlFormatAddress1 + '/' + urlFormatAddress2,
                "image_url": url
              }
            ];
            console.log('attachObj is', attachObj);
            res.send(sendAway(attachObj));
          }else { // not /mapme, so must be one of four directions commands
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
    }else if(addressSplitLength === 1 && startIsValid) {
      console.log('addressSplit is', addressSplit);
      console.log('else block for one address');
      if(cmdSplit[0] === 'image') { // /mapme invoked on one address
        console.log('in image block for one address');
        var formattedInput = addressSplit[0].replace(/\s/g, '+');
        console.log('formattedInput = ' + formattedInput);
        var url = "https://maps.googleapis.com/maps/api/staticmap?center="+formattedInput+"&size=600x400&markers="+formattedInput+"&key="+apiKey;
        var attachObj = [
          {
            "title": a.format(input),
            "title_link": "http://maps.google.com/maps?f=d&source=s_d&saddr=&daddr="+formattedInput,
            "image_url": url
          }
        ];
        res.send(sendAway(attachObj));
      }
    }
  });
  // Help command
  if (cmdSplit[0] === "help") {
    res.send(sendAway(helpText));
  }
});

// Listening
var port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log("Listening on port " + port + "!");
});
