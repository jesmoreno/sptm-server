const express = require('express');
const router = express.Router();
const config = require('../../config');
const User = require('../../models/user');
const jwt = require( 'jsonwebtoken' );
var mongoose = require('mongoose'); //Para generar el object ID


function getParameters(objIn,fieldName) {

  var obj = objIn.find(function(element){
    return element.param === this.field;
  },{field: fieldName});

  return obj.value;
}


////////////////////////////////////////////////////////////* GETs *////////////////////////////////////////////////////
router.get('/', (req, res) => {
  res.send('api works');
});

//Recibe como parametros el nombre de usuario, numero de elementos a devolver,codigo postal y ciudad
router.get('/games_info', (req, res) => {

  var userName = req.query.userName;
  var userGames;
  req.query.userGames ? userGames=req.query.userGames : null;
  var city = req.query.city;
  var pc = req.query.postCode;
  var sport = req.query.sport;

  //console.log(req.query);
  //Si recibe nombre de usuario filtra las partidas de ese usuario en la localizacion indicada con ciudad y CP y con el deporte elegido (inicialmente el favorito del usuario)
  if(userGames){

    User.find({$and: [{"games.players": {$elemMatch: {playerName: userName} }},{"games.sport": sport},{"games.address.address_components": {$elemMatch: {short_name: city,short_name:pc}}}]}, function(err, docs){
      

      if (err){
        res.status(500).send({ text: 'Server Error', status: 500 });
        return handleError(err);    
      } 

      var games;
      docs.length ? games = docs[0].games : games = docs;

      if(games.length){

          games = games.filter(function(element){
            if(element.sport === req.query.sport){
              return true;
            }else{
              return false;
            }
          });

      }

      res.status(200).send(games);

    })

  }else{//Si el nombre de usuario es null o undefined, devuelvo todas las partidas de la localizacion (ciudad y CP lo indican) del deporte elegido
    User.find({$nor: [{'games.players':{$elemMatch: {playerName: userName}}}], $and: [{"games.sport": sport},{"games.address.address_components": {$elemMatch: {short_name: city,short_name:pc}}}]}, function(err, docs){
      if (err){
        res.status(500).send({ text: 'Server Error', status: 500 });
        return handleError(err);
      } 

      var games = [];

      if(docs.length){
        
        docs.forEach(function(doc){
          doc.games.forEach(function(game){
            games.push(game);
          })
        })

      }

      if(games.length){
        games = games.filter(function(element){
          if(element.sport === req.query.sport){
            return true;
          }else{
            return false;
          }
        })  
      }

      res.status(200).send(games);
    })
  }
});



//Devuelve todos los usuarios disponibles para agregar a amigos
router.get('/friends', (req, res) => {
  
  var username = req.query.userName;
  var filter = req.query.filter;
  var sort = req.query.sortOrder;
  var pageNumber = req.query.pageNumber;
  var pageSize =req.query.pageSize;
  //Para el filtrado por letras del nombre
  var regExp = new RegExp(filter);

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
      usersFound.push({name: user.userName,favSport:user.sport, totalFriends: users.length })
    })

    //if(usersFound.length===0) usersFound.push({totalFriends: 0});

    res.status(200).send(usersFound);

  });

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
  var name = req.body.params.updates[0].value;
  var email = req.body.params.updates[1].value;
  var passwd = req.body.params.updates[2].value;
  var sport = req.body.params.updates[3].value;
  var city = req.body.params.updates[4].value;
  var pc = req.body.params.updates[5].value;


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
        resObject = {text: 'Login correcto.',token: token ,status: 200};
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
  var username = req.body.params.updates[0].value;
  var oldPass = req.body.params.updates[1].value;
  var newPass = req.body.params.updates[2].value;

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

  //console.log(req.body.params.updates[0].value);
  var username = req.body.params.updates[0].value;
  var field = req.body.params.updates[1].value;
  var data = req.body.params.updates[2].value;

  //console.log('Nombre de usuario: '+username+', Campo: '+field+', Valor: '+data);

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
                  res.status(200).send({text: 'Perfil actualizado', status: 200});
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


  var username = req.body.params.updates[0].value;
  var gameName = req.body.params.updates[1].value;
  var sport = req.body.params.updates[2].value;
  var maxPlayers = req.body.params.updates[3].value;
  var date = req.body.params.updates[4].value;
  var address = req.body.params.updates[5].value;

  User.find({games: {$elemMatch: {host:username,name:gameName}}}, (err, doc) => {


        if (err){
          res.status(500).send({ text: 'Server Error', status: 500 });
          
          return handleError(err);
        } 

        if(doc.length){
          res.status(403).send({text:'Nombre de partida ya existente, por favor, introduce uno nuevo.',status:403})
        }else{

          var obj = {
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
              playerName: username
            }]
          }

          var conditions = {userName: username}, update = { $push: {games:obj}}, options = {multi: false};
          User.update(conditions, update,options,callback);

          function callback (err, data){
           if (err){
              res.status(500).send({ text: 'Server Error', status: 500 });
              return handleError(err);
            }
            //Actualizada correctamente la BBDD con la partida creada.
            res.status(200).send({text:'Partida creada correctamente.',status:200});
          }
    
        }   
  });

});
////////////////////////////// ELIMINA LA PARTIDA SELECIONADA ////////////////////////////////////// 

router.post('/remove_game', (req, res) => {

  //console.log(gameName);
  //console.log(players);

  /*var conditions;

  players.forEach(function(user){
    conditions = {userName: user.playerName}, update = {$pull: {games: {$elemMatch: {name: gameName.playerName}}}}, options = {multi: false};
    User.update(conditions, update,options,callback);
    function callback (err, data){
      if(err) {
        res.status(500).send({ text: 'Server Error', status: 500 });
        return handleError(err);
      }

      res.status(200).send({text: 'Partida eliminada', status: 200});
    }
  })*/  



}); 

/////////////////////////////////////// CREO LA PARTIDA PARA EL USUARIO /////////////////////////////////7

router.post('/update_games', (req, res) => {

  //Nombre de la partida para eliminarla del doc de cada usuario inscrito
  var gameName = getParameters(req.body.params.updates,'name');

  //Array de nombres de los jugadores
  var newPlayerName = getParameters(req.body.params.updates,'userToAdd');

  var host = getParameters(req.body.params.updates,'host');

  var sport = getParameters(req.body.params.updates,'sport');

  var maxPlayers = getParameters(req.body.params.updates,'maxPlayers');

  var date = getParameters(req.body.params.updates,'date');


  var address = getParameters(req.body.params.updates,'address');

  var playersOld = getParameters(req.body.params.updates,'players');
  var playersNew = playersOld.slice();
  playersNew.push({_id:mongoose.Types.ObjectId(), playerName: newPlayerName})
  
  
  //Primero creo la partida para el usuario añadido
  var obj = {
    host: host,
    name: gameName,
    sport: sport,
    maxPlayers: maxPlayers,
    date: date,
    address: {
      address_components: address.address_components,
      formatted_address: address.formatted_address,
      location: {
        type: 'Point',
        coordinates: address.location.coordinates
      },
        place_id: address.place_id
    },
    players: playersNew
  }


  var updatedDocs = [];

  //Callback ejecutado despues de cada documento recuperado en el bucle
  function sendResponse () {
    res.status(200).send({text:'Añadido a la partida.',status:200});
  }


  var conditions = {userName: newPlayerName}, update = { $push: {games:obj}}, options = {multi: false};
  User.update(conditions, update,options,callback);
  function callback (err, data){
    if (err){
      res.status(500).send({ text: 'Server Error', status: 500 });
      return handleError(err);
    }
    
    updatedDocs.push(newPlayerName);

    playersOld.forEach(function(username){

      User.findOne({userName: username.playerName}, function(err,doc){

        console.log(username.playerName);

        if (err){
          res.status(500).send({ text: 'Error añadiendo a la partida, intentar más tarde.', status: 500 });
          return handleError(err);     
        }

        var gameIndex = doc.games.findIndex(function(game){
          return game.name === this.value;
        },{value: gameName});

        doc.games[gameIndex].players.push({_id:mongoose.Types.ObjectId(), playerName: newPlayerName});

        //Guardo el documento modificado
        doc.save(function(err, updatedDoc){
          if (err) return handleError(err);
            //console.log('Documento actualizado');
            updatedDocs.push(username.playerName);
            if(updatedDocs.length === playersNew.length){
              sendResponse();
            }
            
        })
        
      })
    })   
  }

});

module.exports = router;