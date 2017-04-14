const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const locationSchema = new Schema({
	userId: String,
	teamId: String,
	channelId: String,
	location: String, 
	address: String
});

const ModelClass = mongoose.model("savedLocation", locationSchema);

module.exports = ModelClass;