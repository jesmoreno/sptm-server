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
    postCode: String,
    registryDate: Date,
    admin: Boolean,
    friends: [String],
    games: [
      {
        _id: mongoose.Schema.Types.ObjectId,
        sport: String,
        postCode: String
      }
    ]
}));