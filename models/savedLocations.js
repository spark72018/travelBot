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

module.exports = mongoose.model("SavedLocations", locationSchema);
