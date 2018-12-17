const express = require('express');
const router = express.Router();
const config = require('../../config');
const User = require('../../models/user');
const jwt = require( 'jsonwebtoken' );


////////////////////////////////////////////////////////////* GETs *////////////////////////////////////////////////////
router.get('/games_info', (req, res) => {
  console.log('recived');
  //res.status(200).send({});
});


//Devuelve informacion sobre las partidas de un jugador
router.get('/', (req, res) => {
  res.send('api works');
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
      city: userInfo.city
    };

    res.status(200).send(info);
  })

});


/////////////////////////////////////////////////////// POSTS ///////////////////////////////////////////////////////////////////////////
router.post('/register-user', (req, res) => {

  //console.log(req.body);
  User.count({email:req.body.email}, (err,  count) => {

    if (err){
      throw err;
      res.status(500).send({ text: 'Server Error', status: 500 });
      //return handleError(err);
    } 

    //objeto que contiene los datos para la respuesta
    resObject = undefined;
    //console.log(count);

    if(count === 0){
      //console.log('No existe el email');
      User.count({userName:req.body.name}, (err,  count) => {
        if (err){
          throw err;
          res.status(500).send({ text: 'Server Error', status: 500 });
          //return handleError(err);
        }

        if(count === 0){
          //console.log('No existe el nombre de usuario e inserto en BBDD');
          
          var user = new User({
            userName: req.body.name, 
            password: req.body.password, 
            email: req.body.email,
            sport: req.body.favSport,
            city: req.body.city, 
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
          res.status(403).send({text: 'Nombre de usuario ya existente', status: 403});
        
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

  }else{// es la ciudad el caso restante

    var conditions = {userName: username}, update = { $set: {"city":data}}, options = {multi: false};
    User.update(conditions, update,options,callback);
    function callback (err, data){
      if(err) return handleError(err);
      res.status(200).send({text: 'Perfil actualizado', status: 200});
    }
  }

});

//////////////////////// CREA INFORMACIÓN PARA UNA NUEVA PARTIDA /////////////////////////////////////////////////
router.post('/new_game', (req, res) => {


  //console.log(req.body.params.updates[0].value);

  

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
        console.log(doc);

        if(doc.length){
          res.status(403).send({text:'Nombre de partida ya existente, por favor, introduce uno nuevo.',status:403})
        }else{

          var obj = {
            host: username,
            name: gameName,
            sport: sport,
            maxPlayers: maxPlayers,
            date: new Date(date),
            address: address,
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


module.exports = router;