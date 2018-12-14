// Get dependencies
const express = require('express');
const path = require('path');
const http = require('http');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const config = require('./config'); // get our config file
// librerias para JWT (Json Web Token)
var expressJwt = require('express-jwt');

//Conexion con la BD
var db = mongoose.connection;

mongoose.connect(config.database);
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {
// we're connected!
  console.log('were connected');
});


// Get our API routes
const api = require('./server/routes/api');

const app = express();

// Parsers for POST data
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// Point static path to dist
app.use(express.static(path.join(__dirname, '../sptm-app/sptm-app/dist')));

// Middleware para el control de acceso con el token
app.use( 
  config.rootPath, // Ruta raíz de los servicios del API
  expressJwt( 
        { 
            secret : config.secret 
        } 
    )
  .unless( { path: [config.rootPath+'/register-user',config.rootPath+'/authenticate']} ) // Ruta del servicio de login 
);

// Set our api routes
app.use(config.rootPath, api);

// Catch all other routes and return the index file
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../sptm-app/sptm-app/dist/index.html'));
});

/**
 * Get port from environment and store in Express.
 */
const port = process.env.PORT || '3000';
app.set('port', port);

/**
 * Create HTTP server.
 */
const server = http.createServer(app);

/**
 * Listen on provided port, on all network interfaces.
 */
server.listen(port, () => console.log(`API running on localhost:${port}`));