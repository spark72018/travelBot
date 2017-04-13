const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const userLocations = new Schema({
	//user id
	//team id
	//channel id
	//location {name: String, address: String}
});

const ModelClass = mongoose.model("shortUrl", urlSchema);

module.exports = ModelClass;