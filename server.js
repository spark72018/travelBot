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

var myPromise = function(fn) {
  if(fn === 'geo') {
    return  function(address) {
        return googleMapsClient.geocode({address: address}).asPromise();
      }
  }else if(fn === 'directions') {
    return function(obj) {
        return googleMapsClient.directions(obj).asPromise();
      }
  }else {
    console.log("myPromise only takes 'geo' or 'directions'!");
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
      splitted = input.split(">"),
      cmdSplit = command.split("_"),
      regex = /\d+\s+([a-zA-Z]+|[a-zA-Z]+\s[a-zA-Z]+)/g,
      sendAway = sendTo(cmdSplit[1]),
      reqObj = {},
      start,
      finish,
      startIsProper = false,
      finishIsProper = false;
      console.log('splitted is', splitted);
  var helpText = "Valid commands: drive, bike, walk, transit, mapme, save.\nTo get directions (pick your mode of transport): /drive 123 N Main St > 456 S Main St\nTo get a map of a location: /mapme 123 N Main St\nTo save a location: /save home > 123 N Main St"
  console.log('commandSplit is', cmdSplit);
  
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
