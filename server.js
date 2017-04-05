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

//Start of if block (serves static image when user enters 1 input)

/*
app.get('/', function(req, res) {
  var cmd = req.body.text;
  if (cmd.split(">").length === 1) {
    if (cmd.test("\\d+\\s+([a-zA-Z]+|[a-zA-Z]+\\s[a-zA-Z]+")) {
      var formattedInput = cmd.replace(\/s\g, '+');
      var url = "https://maps.googleapis.com/maps/api/staticmap?center="+formattedInput+"&size=600x400&markers="+formattedInput;

      res.send({
        response_type: 'in_channel',
        "title": cmd,
        "title_link": url,
        attachments:[
          {
            image_url: url;
          }
        ]
      });
    } else {
      res.send({
        response_type: 'in_channel',
        "text": "Enter a valid address!",
      });
    }
  } else {

  }
}
*/


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

//need to add token validation
//need to add valerie's address validation
app.post('/directions', function(req, res) {
  /*
  var splitted = req.body.text.split('>'),
      splittedLength = splitted.length,
      directionsString = '',
      start, //starting geocode
      finish; //finishing geocode
*/
//valerie's if block first (static map)
//steve's else block second (directions)
// '/dirMap' for integrated response?
var input = req.body.text;
var regex = /\d+\s+([a-zA-Z]+|[a-zA-Z]+\s[a-zA-Z]+)/g;
console.log(input);
if (regex.test(input)) {
  if(input.split(">").length === 1) {
    var formattedInput = input.replace(/\s/g, '+');
    console.log('this is formattedInput ' + formattedInput);
    var url = "https://maps.googleapis.com/maps/api/staticmap?center="+formattedInput+"&size=600x400&markers="+formattedInput;

    res.send({
      response_type: 'in_channel',
      "title": input,
      "title_link": "http://maps.google.com/maps?f=d&source=s_d&saddr=&daddr="+formattedInput,
      attachments:[
        {
          image_url: url
        }
      ]
    });
  }
}
  /*
  if (cmd.test("\\d+\\s+([a-zA-Z]+|[a-zA-Z]+\\s[a-zA-Z]+")) {
  } else {
    res.send({
      response_type: 'in_channel',
      "text": "Enter a valid address!",
    });
  }
} else {

}
*/

/*
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
    */
  //});
});


app.listen(process.env.PORT || 3000);
