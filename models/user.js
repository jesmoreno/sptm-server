// get an instance of mongoose and mongoose.Schema
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

// set up a mongoose model and pass it using module.exports
module.exports = mongoose.model('User', new Schema({ 
    userName: String, 
    password: String, 
    email: String,
    sport: String,
    city: String,
    registryDate: Date,
    admin: Boolean,
    friends: [String],
    games: [{
    	host: String,
    	name: String,
    	sport: String,
    	maxPlayers: Number,
    	date: Date,
    	address: String,
    	players: [{
    		playerName: String
    	}]
    }]
}));