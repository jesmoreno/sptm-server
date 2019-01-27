// get an instance of mongoose and mongoose.Schema
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

const pointSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['Point'],
    required: true
  },
  coordinates: {
    type: [Number],
    required: true
  }
});


// set up a mongoose model and pass it using module.exports
module.exports = mongoose.model('Game', new Schema({ 
    _id: mongoose.Schema.Types.ObjectId,
    host: String,
    name: String,
    sport: String,
    maxPlayers: Number,
    date: Date,
    address: {
        address_components: [{
            long_name: String,
            short_name: String,
            types: [String]
        }],
    	formatted_address: String,
    	location: pointSchema,
    	place_id: String
    },
    players: [{
        _id: mongoose.Schema.Types.ObjectId,
    	playerName: String
	}]
}));