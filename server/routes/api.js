const express = require('express');
const router = express.Router();
const config = require('../../config');
const User = require('../../models/user');
const Game = require('../../models/games');
const jwt = require( 'jsonwebtoken' );
var mongoose = require('mongoose'); //Para generar el object ID
const nodemailer = require("nodemailer"); //Envio de emails con notificaciones

const gmail = require('../../config/keys'); //Contraseña gmail

var transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
         user: gmail.email,
         pass: gmail.pass
     }
 });

function getParameters(objIn,fieldName) {

  var obj = objIn.find(function(element){
    return element.param === this.field;
  },{field: fieldName});

  return obj.value;
}

////////////////////////////////////////////////////////////* GETs *////////////////////////////////////////////////////

//Recibe como parametros el nombre de usuario, numero de elementos a devolver,codigo postal y ciudad
router.get('/games_info', (req, res) => {


  //Callback ejecutado despues de cada documento recuperado en el bucle
  function sendResponse (games) {
    res.status(200).send(games);
  }

  var userName = req.query.userName;
  var userGames;
  req.query.userGames ? userGames=req.query.userGames : null;
  var city = req.query.city;
  var pc = req.query.postCode;
  var sport = req.query.sport;

  //Si recibe nombre de usuario filtra las partidas de ese usuario en la localizacion indicada con ciudad y CP y con el deporte elegido (inicialmente el favorito del usuario)
  if(userGames){

    User.findOne({userName: userName}, function(err, doc){
      if (err){
        res.status(500).send({ text: 'Fallo recuperando la información de las partidas del usuario.', status: 500 });
        return handleError(err);    
      }

      if(doc.games.length){

        var gamesFiltered = doc.games.filter(function(game){
          return (game.sport == this.sportFilter && game.postCode == this.pcFilter);
        },{sportFilter: sport, pcFilter: pc})

        if(gamesFiltered.length){ 

          var gamesInserted = [];

          gamesFiltered.forEach(function(game){
            Game.findById(game._id,function(err, gameDoc){

              if (err){
                res.status(500).send({ text: 'Fallo recuperando la información de las partidas del usuario.', status: 500 });
                return handleError(err);    
              }

              //console.log(gameDoc);

              gamesInserted.push(gameDoc);
              //console.log('Partidas insertadas: '+gamesInserted.length+', de: '+gamesFiltered.length);
              if(gamesInserted.length === gamesFiltered.length) {
                sendResponse(gamesInserted);
              }
            })
          });

        }else{// Sus partidas no cumplen los filtros
          res.status(200).send([]);
        }


      }else{
        //No tiene partidas
        res.status(200).send([])
      }
      

    })

  }else{//Si el nombre de usuario es null o undefined, devuelvo todas las partidas de la localizacion (ciudad y CP lo indican) del deporte elegido
    Game.find({$nor: [{'players':{$elemMatch: {playerName: userName}}}], $and: [{"sport": sport},{"address.address_components": {$elemMatch: {short_name: city,short_name:pc}}}]}, function(err, docs){
      if (err){
        res.status(500).send({ text: 'Server Error', status: 500 });
        return handleError(err);
      } 

      var games = [];

      if(docs.length){
        docs.forEach(function(doc){
          games.push(doc);
        })
      }

      res.status(200).send(games);

    })
  }
});

//Devuelve todos los usuarios disponibles para agregar a amigos
router.get('/friends', (req, res) => {

  var username = req.query.username;
  var filter = req.query.filter;
  //Para el filtrado por letras del nombre
  var regExp = new RegExp(filter);

  if(req.query.sortOrder){

    var sort = req.query.sortOrder;
    var pageNumber = req.query.pageNumber;
    var pageSize =req.query.pageSize;
    //Indice para coger los usuarios según la página y el numero de elementos por pagina
    startIndex = pageNumber*pageSize;
    endIndex = parseInt(startIndex)+parseInt(pageSize);

    User.find({friends:username})
    .where({userName: regExp})
    .sort({sport:sort})
    .then(function(users){

      var usersFound = [];
      //me quedo con la parte del array de amigos correspondiente según página y el numero de elementos por pagina
      selectedUsers = users.slice(startIndex,endIndex);

      selectedUsers.forEach(function(user){
        usersFound.push({id: user._id,name: user.userName,favSport:user.sport, totalFriends: users.length })
      })

      //if(usersFound.length===0) usersFound.push({totalFriends: 0});

      res.status(200).send(usersFound);

    });

  }else{

    User.find({friends:username})
    .where({userName: regExp})
    .then(function(users){

      var usersFound = [];

      users.forEach(function(user){
        usersFound.push({id: user._id,name: user.userName,favSport:user.sport, totalFriends: users.length })
      })

      res.status(200).send(usersFound);
    });
  }

});


router.get('/all_users', (req, res) => {
  
  var username = req.query.userName;
  var filter = req.query.filter;
  var sort = req.query.sortOrder;
  var pageNumber = req.query.pageNumber;
  var pageSize =req.query.pageSize;

  var regExp = new RegExp(filter);

  //Indice para coger los usuarios según la página y el numero de elementos por pagina 
  startIndex = pageNumber*pageSize;
  endIndex = parseInt(startIndex)+parseInt(pageSize);

  //Array de excepciones en la busqueda
  var exceptions = [];
  //La primera excepcion es el propio usuario
  exceptions.push({userName:username});

  //Busco todos los amigos
  User.find({friends: username}).then(function(friends){

    //Meto los nombres de los amigos en las excepciones
    friends.forEach(function(element){
      exceptions.push({userName: element.userName});
    });

    //Realizo la busqueda definitiva de usuarios descartando al propio usuario y amigos
    User.find().where({userName: regExp})
    .nor(exceptions)
    .sort({sport:sort})
    .then(function(users){

      var usersFound = [];
      //me quedo con la parte del array de amigos correspondiente según página y el numero de elementos por pagina
      selectedUsers = users.slice(startIndex,endIndex);

      selectedUsers.forEach(function(user){
        usersFound.push({name: user.userName,favSport:user.sport, totalUsers: users.length })
      })

      res.status(200).send(usersFound);

    });
  })

});

router.get('/user_info', (req, res) => {
  
  var username = req.query.userName;

  //Busco todos los amigos
  User.findOne({userName: username}).then(function(userInfo){

    var info = {
      name: userInfo.userName,
      email: userInfo.email,
      favSport: userInfo.sport,
      city: userInfo.city,
      postCode: userInfo.postCode
    };

    res.status(200).send(info);
  })

});


/////////////////////////////////////////////////////// POSTS ///////////////////////////////////////////////////////////////////////////
router.post('/register-user', (req, res) => {

  //console.log(req.body.params.updates)
  var name = getParameters(req.body.params.updates,'name');
  var email = getParameters(req.body.params.updates,'email');
  var passwd = getParameters(req.body.params.updates,'password');
  var sport = getParameters(req.body.params.updates,'favSport');
  var city = getParameters(req.body.params.updates,'city');
  var pc = getParameters(req.body.params.updates,'pc');


  User.count({email:email}, (err,  count) => {

    if (err){
      res.status(500).send({ text: 'Server Error', status: 500 });
      return handleError(err);
      //return handleError(err);
    } 

    //objeto que contiene los datos para la respuesta
    resObject = undefined;
    //console.log(count);

    if(count === 0){
      //console.log('No existe el email');
      User.count({userName: name}, (err,  count) => {
        if (err){
          //throw err;
          res.status(500).send({ text: 'Server Error', status: 500 });
          return handleError(err);
          //return handleError(err);
        }

        if(count === 0){
          //console.log('No existe el nombre de usuario e inserto en BBDD');
          
          var user = new User({
            userName: name, 
            password: passwd, 
            email: email,
            sport: sport,
            city: city, 
            postCode: pc,
            registryDate : Date.now(),
            admin: false,
            friends: [String]
          });

          user.save(function (err, user) {
            if (err) return console.error(err);
            res.status(200).send({text: 'Usuario registrado correctamente.', status: 200});
            //redirecciono a LOGIN, envia un 302 FOUND por defecto
            //res.redirect('/log-in');
          });
          
        }else{
          //console.log('Nombre de usuario ya existente');
          res.status(403).send({text: 'Nombre de usuario ya existente', status: 403});
        }

      });   
    }else{
      //console.log('Email ya resgistrado');
      //res.status(403).send({text: 'Email ya resgistrado'});
      res.status(403).send({text: 'Email ya resgistrado' ,status: 403});
    } 

  });

});


router.post('/authenticate', (req, res) => {

  User.findOne({
    userName: req.query.userName
  }, (err,  user) =>{
    if (err){
      //throw err;
      res.status(500).send({ text: 'Server Error', status: 500 });
      return handleError(err);
    } 

    var resObject;
    var token;

    if(!user) {
      //console.log( 'Authentication failed. User not found.');
      resObject = {text: 'Usuario no encontrado.' ,status: 401};
    }else{
      if (user.password != req.query.password) {
        //console.log( 'Authentication failed. Wrong password.');
        resObject = {text: 'Contraseña errónea' ,status: 401};
      } else {
        //user valid
        token = jwt.sign( { admin : req.body.admin }, config.secret, { expiresIn: 3600 } );
        resObject = {text: 'Login correcto.',token: token ,status: 200, userId: user._id};
      }
    }
    //console.log('token: '+resObject.content);
    //res.setHeader('Content-Type', 'application/json');
    res.status(resObject.status).send(resObject);

  });

});

//CONTROLAR EL FALLO
router.post('/add_friend', (req, res) => {

  var username = req.body.username;
  var friendName = req.body.friendname;

  //Añado amigo a la lista del usuario
  User.findOneAndUpdate({userName: username},{$push: {friends: friendName}}).then(function(doc1){
    //Añado usuario a la lista del amigo
    User.findOneAndUpdate({userName: friendName},{$push: {friends: username}}).then(function(doc2){
      res.status(200).send({text: friendName+' añadido a la lista', status: 200});

      /*User.findOne({userName: friendName}).then(function(doc){
        //Envio correo al amigo añadido
        var message = {
          from: "sporttimecenter@gmail.com",
          to: doc.email,
          subject: "Amigos en sptm",
          text: friendName+" te ha añadido como amigo",
          html: "<p>"+friendName+" te ha añadido como amigo"+"</p>"
        };

        var message = {
          from: "sporttimecenter@gmail.com",
          to: "jesusbasket8@gmail.com",
          subject: "Amigos en sptm",
          text: friendName+" te ha añadido como amigo",
          html: "<p>"+friendName+" te ha añadido como amigo"+"</p>"
        };

        console.log(gmail.email);
        console.log(gmail.pass);

        // send mail with defined transport object
        transporter.sendMail(message, function(error, info){
          if(error){
            return console.log(error);
          }
          console.log('Message sent: ' + info.response);
        });
      })*/
    });
  });
  


});


//ELIMINO EL USUARIO SELECCIONADO D ELA LISTA DE AMIGOS
router.post('/remove_friend', (req, res) => {

  var username = req.body.username;
  var friendName = req.body.friendname;

  //Elimino del array del amigo el del usuario
  var conditionsRemoveUserFromFriend = {userName: friendName}, update = { $pull: {friends: username} }, options = {multi: false};
  User.update(conditionsRemoveUserFromFriend, update,options,callback);
    function callback (err, data){
      if(err) return handleError(err);

      //Elimino del array del usuario el amigo seleccionado
      var conditionsRemoveFriendFromUser= {userName: username}, update = { $pull: {friends: friendName} }, options = {multi: false};
      User.update(conditionsRemoveFriendFromUser, update,options, callback2);
        function callback2 (err, data2){
          if(err) return handleError(err);

          res.status(200).send({text: friendName+' eliminad@ de la lista de '+username, status: 200});                
        }
    }
});


//ACTUALIZA CONTRASEÑA, SI LA ANTERIOR ES CORRECTA
router.post('/update_password', (req, res) => {

  //console.log(req.body.params.updates[0].value);
  var username = getParameters(req.body.params.updates,'userName');
  var oldPass = getParameters(req.body.params.updates,'oldPassword');
  var newPass = getParameters(req.body.params.updates,'newPassword');

  User.findOne({userName:username, password: oldPass},function(err, data){
      if(err) return handleError(err);

      if(data){//Coincide la contraseña vieja con la guardada
        var conditions = {userName: username}, update = { $set: {"password":newPass}}, options = {multi: false};
        User.update(conditions, update,options,callback);
        function callback (err, data){
          if(err) return handleError(err);
          res.status(200).send({text: 'Contraseña actualizada con éxito', status: 200});
          //console.log(data);
        }
      }else{//Mensaje de contraseña incorrecta
        res.status(403).send({text: 'Contraseña incorrecta', status: 403});
      }
  });

});

//////////////////////// ACTUALIZA EL PERFIL DEL USUARIO, NOMBRE;CIUDAD,DEPORTE /////////////////////////////////////////////////
router.post('/update_profile', (req, res) => {

  var userId = req.body.params.updates[0].value;
  var username = req.body.params.updates[1].value;
  var field = req.body.params.updates[2].value;
  var data = req.body.params.updates[3].value;

  //console.log('Nombre de usuario: '+username+', Campo: '+field+', Valor: '+data);

  //Callback ejecutado despues de cada documento actualizado en el bucle
  function sendResponse () {
    res.status(200).send({text:"Perfil actualizado",status:200});
  }

  if(field === 'newName'){

    User.findOne({userName: data}, (err, user) => {

        if (err) return handleError(err);
        //console.log(user);

        if(user){// Si me devuelve el documento es que existe ya ese nombre
          res.status(403).send({text: 'Nombre de usuario ya existente', status: 403, errorCodeToShow: 0});
        
        }else{//No existe el nombre por lo que lo guardo
          
          var conditions = {userName: username}, update = { $set: {"userName":data}}, options = {multi: false};
          User.update(conditions, update,options,callback);
            function callback (err, data2){
              if(err) return handleError(err);

              //Añado a la lista de amigos ese nombre y elimino el viejo el nuevo (data)

              var conditionsAdd= {friends: username}, update = { $push: {friends: data} }, options = {multi: true};
              User.update(conditionsAdd, update,options, callback2);
              function callback2 (err, data3){
                if(err) return handleError(err);

                var conditionsRemove = {friends: username}, update = { $pull: {friends: username} }, options = {multi: true};
                User.update(conditionsRemove, update,options,callback3);
                function callback3 (err,data4){
                  if(err) return handleError(err);
                  //console.log(data4);

                  //En las partidas actualizo tmb el nombre de usuario

                  Game.find({players: {$elemMatch:{_id: userId}}}, function(err,gamesDocs){    
                    
                    var docUpdated = [];

                    gamesDocs.forEach(function(gameDoc,index,allDocs){
                      var pos = gameDoc.players.findIndex(function(e){
                        return e._id == this.value;
                      },{value: userId});

                      gameDoc.players[pos].playerName = data;

                      gameDoc.save(function(err){
                        if (err){
                          res.status(500).send({ text: 'Fallo actualizando nombre en lista de partidas', status: 500 });
                          return handleError(err);
                        }

                        docUpdated.push(data);
                        if(docUpdated.length === allDocs.length){
                          sendResponse();
                        }

                      })
                      
                    });
                  });
                }
                
              }
            }
        }
    });

  }else if(field === 'favSport'){

    var conditions = {userName: username}, update = { $set: {"sport":data}}, options = {multi: false};
    User.update(conditions, update,options,callback);
    function callback (err, data2){
      if(err) return handleError(err);
      res.status(200).send({text: 'Perfil actualizado', status: 200});
    }

  }else if(field === 'city'){// es la ciudad

    var conditions = {userName: username}, update = { $set: {"city":data}}, options = {multi: false};
    User.update(conditions, update,options,callback);
    function callback (err, data){
      if(err) return handleError(err);
      res.status(200).send({text: 'Perfil actualizado', status: 200});
    }
  }else{//es el codigo postal de la ciudad

    if(data.length != 5){
      res.status(403).send({text: 'El código postal debe ser de 5 dígitos', status: 403, errorCodeToShow: 1});
    }else{
      var conditions = {userName: username}, update = { $set: {"postCode":data}}, options = {multi: false};
      User.update(conditions, update,options,callback);
      function callback (err, data){
        if(err) return handleError(err);
        res.status(200).send({text: 'Perfil actualizado', status: 200});
      }
    }
  }

});

//////////////////////// CREA INFORMACIÓN PARA UNA NUEVA PARTIDA /////////////////////////////////////////////////
router.post('/new_game', (req, res) => {


  var username = getParameters(req.body.params.updates,'host');
  var gameName = getParameters(req.body.params.updates,'name');
  var sport = getParameters(req.body.params.updates,'sport');
  var maxPlayers = getParameters(req.body.params.updates,'maxPlayers');
  var date = getParameters(req.body.params.updates,'date');
  var address = getParameters(req.body.params.updates,'address');
  var userId = getParameters(req.body.params.updates,'userId');
  var pc = getParameters(req.body.params.updates,'postCode');

  Game.find({name: gameName, sport: sport}, (err, docs) => {
    if (err){ 
      res.status(500).send({ text: 'Server Error', status: 500 });    
      return handleError(err);
    }

    if(docs.length){//Si existe el nombre devuelvo respuesta de que ya existe
      res.status(403).send({text:'Nombre de partida ya existente, por favor, introduce uno nuevo.',status:403})
    }else{
      //Genero id para la partida nueva
      var gameId = {
        _id : mongoose.Types.ObjectId(),
        sport: sport,
        postCode: pc
      };

      //Inserto el ID de la nueva partida en el array del jugador que la ha creado
      var conditions = {userName: username}, update = { $push: {games:gameId}}, options = {multi: false};
      User.update(conditions, update,options,callback);
      function callback (err, data){
        if (err){
          res.status(500).send({ text: 'Fallo creando la partida', status: 500 });
          return handleError(err);
        }

        //Genero nuevo documento en la coleccion de partidas.
        var gameObj = new Game({
          _id: gameId,
          host: username,
          name: gameName,
          sport: sport,
          maxPlayers: maxPlayers,
          date: new Date(date),
          address: {
            address_components: address.address_components,
            formatted_address: address.formatted_address,
            location: {
              type: 'Point',
                coordinates: [address.location.lng, address.location.lat]
              },
              place_id: address.place_id
          },
          players: [{
            _id: userId,
            playerName: username
          }]
        });

        gameObj.save(function(err) {
          if (err){
            res.status(500).send({ text: 'Fallo creando la partida', status: 500 });
            return handleError(err);
          }

          //Actualizada correctamente la BBDD con la partida creada.
          res.status(200).send({text:'Partida creada correctamente.',status:200});
        });     
      }

    }//cierro else

  })

});
////////////////////////////// ELIMINA LA PARTIDA SELECIONADA ////////////////////////////////////// 

router.post('/remove_game', (req, res) => {

  var gameId = getParameters(req.body.params.updates,'_id');

  function sendResponse () {
    res.status(200).send({text:'Partida eliminada.',status:200});
  }

  Game.deleteOne({_id:gameId}, function(err) {
    if (err){
      res.status(500).send({ text: 'Error eliminando la partida, intentar más tarde.', status: 500 });
      return handleError(err);     
    }

    var updatedDocs = [];

    User.find({games: {$elemMatch: {_id: gameId}}}, function(err, docs){

      docs.forEach(function(doc){

        var gameIndex = doc.games.findIndex(function(game){
          return game._id === this.value;
        },{value: gameId});

        doc.games.splice(gameIndex,1);
        
        //Guardo el documento modificado
        doc.save(function(err, updatedDoc){
          if (err) return handleError(err);
            updatedDocs.push(updatedDoc);
            if(updatedDocs.length === docs.length){
              sendResponse();
            }
            
        })

      })

    })

  });

}); 

/////////////////////////////////////// CREO LA PARTIDA PARA EL USUARIO /////////////////////////////////

router.post('/update_games', (req, res) => {

  var newPlayerInfo = getParameters(req.body.params.updates,'userToAdd');
  var newPlayerName = newPlayerInfo.name;
  var newPlayerId = newPlayerInfo.id;

  var sport = getParameters(req.body.params.updates,'sport');
  var postalCode = getParameters(req.body.params.updates,'address').address_components[6].long_name;
  var gameId = getParameters(req.body.params.updates,'_id');

  Game.findOne({_id:gameId}, function(err, gameInfo){

    if (err){
      res.status(500).send({ text: 'Fallo añadiendo a la partida.', status: 500});
      return handleError(err);
    }

    var obj = {
      _id: gameInfo._id,
      sport: sport,
      postCode: postalCode
    }

    var conditions = {userName: newPlayerName}, update = { $push: {games:obj}}, options = {multi: false};
    User.update(conditions, update,options,callback);

    function callback (err, data){
      if (err){
        res.status(500).send({ text: 'Fallo añadiendo a la partida.', status: 500 });
        return handleError(err);
      }

      gameInfo.players.push({_id: newPlayerId, playerName: newPlayerName});
      gameInfo.save(function(err){
        if (err){
          res.status(500).send({ text: 'Fallo añadiendo a la partida.', status: 500});
          return handleError(err);
        }

        res.status(200).send({ text: 'Añadido a la partida.', status: 200 });

        /*gameInfo.players.forEach(function(player){

          User.findById(player._id,function(err,doc){

            var message = {
              from: "sporttimecenter@gmail.com",
              to: doc.email,
              subject: "Partida: "+gameInfo.name,
              text: doc.userName+" se ha añadido a la partida"+gameInfo.name,
              html: "<p>"+doc.userName+" se ha añadido a la partida: "+gameInfo.name+"</p>"
            };

            // send mail with defined transport object
            transporter.sendMail(message, function(error, info){
              if(error){
                return console.log(error);
              }
              console.log('Message sent: ' + info.response);
            });
          })
        })*/
      })
    }

  })

});

//////////////////////////////////////////// ELIMINO AL JUGADOR DE LA PARTIDA //////////////////////////////////////

router.post('/remove_player', (req, res) => {

  var userToRemove = getParameters(req.body.params.updates,'userToRemove');
  var removedPlayerName = userToRemove.name;
  var removedPlayerId = userToRemove.id;

  var gameId = getParameters(req.body.params.updates,'_id');


  Game.findById(gameId , function(err, doc){
    if (err){
      console.log(err);
      res.status(500).send({ text: 'Fallo eliminando de la partida.', status: 500 });
      return handleError(err);
    }

    doc.players = doc.players.filter(function(player){
      return  player._id != removedPlayerId;
    });

    doc.save(function (err, doc) {
      if (err){
        res.status(500).send({ text: 'Fallo eliminando de la partida.', status: 500 });
        return handleError(err);
      }

      //Elimino del documento del usuario la partidas
      User.findById(removedPlayerId, function(err,doc2){
        if (err){
          console.log(err);
          res.status(500).send({ text: 'Fallo eliminando de la partida.', status: 500 });
          return handleError(err);
        }

        doc2.games = doc2.games.filter(function(game){
          return game._id != gameId;
        });

        console.log(doc2.games);

        doc2.save(function (err, doc2) {
          if (err){
            res.status(500).send({ text: 'Fallo eliminando de la partida.', status: 500 });
            return handleError(err);
          }

          res.status(200).send({text: removedPlayerName + ' eliminad@ de la partida',status:200});

        });
        

      })
    });

  });

});

module.exports = router;