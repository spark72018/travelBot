const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const locationSchema = new Schema({
	userName: String,
	userId: String,
	teamId: String,
	channelId: String,
	name: String, 
	address: String
});

const ModelClass = mongoose.model("savedLocations", locationSchema);

module.exports = ModelClass;
