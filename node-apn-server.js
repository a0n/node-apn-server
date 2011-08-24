var apns  = require('apn'),
	http  = require('http'),
	qs    = require('qs')
	util  = require('util'),
	path  = require("path"),
	fs    = require('fs');

var _ = require('underscore')._;
var certificates_base_path = path.join(__dirname, "certificates");

//parse certificates folder and search for complete apps
function initialize_apps() {
  function apn_app_options(app) {
    var apnErrorCallback = function(errorCode, note){
  		console.log("Push notification error, error code: " + errorCode + " Note: " + util.inspect(note) );
  	}

    return options = { cert: path.join(certificates_base_path, app, "cert.pem") /* Certificate file */
	            , key:  path.join(certificates_base_path, app, "key.pem")  /* Key file */
	            , gateway: 'gateway.push.apple.com' /* gateway address */
	            , port: 2195 /* gateway port */
	            , enhanced: true /* enable enhanced format */
	            , errorCallback: apnErrorCallback /* Callback when error occurs */
	            , cacheLength: 5 /* Notifications to cache for error purposes */
	            };    
  }
  
  var apps_collection = {};
  var apps = _.select(fs.readdirSync(certificates_base_path), function(certificate_folder){ return /^[a-z][a-z0-9]+$/.test(certificate_folder) });
  _.each(apps, function(app){ 
    var certificates = _.select(fs.readdirSync(path.join(certificates_base_path, app)), function(certificate){ return /^[a-z][a-z0-9]+\.pem$/.test(certificate) });
    if (!_.include(certificates, "key.pem") && !_.include(certificates, "cert.pem")) {
      console.log("Not loading " + app + " because key and certs are missing");
    } else if (!_.include(certificates, "cert.pem")) {  
      console.log("Not loading " + app + " because cert is missing");
    } else if (!_.include(certificates, "key.pem")) {
      console.log("Not loading " + app + " because key is missing");
    } else {
      apps_collection[app] = new apns.connection(apn_app_options(app));
    }
  });
    
  return apps_collection;
}

var apnsConnections = initialize_apps();
console.log(apnsConnections);


// create a Notification object from application/x-url-encoded data
// the data should be a string representation of the data needed to create
// the Notification in application/x-url-encoded form e.g.
//deviceToken=760ff5e341de1ca9209bcfbd320625b047b44f5b394c191899dd5885a1f65bf2&notificationText=What%3F&badgeNumber=4&sound=default&payload=5+and+7
var createNotification = function(params){
	var note = new apns.notification();
	note.device = new apns.device(params.deviceToken /*, ascii=true*/);
	note.alert = params.notificationText;
	note.payload = {'info': params.payload };
	note.badge = parseInt(params.badgeNumber);
	note.sound = params.sound;
	return note;
}

// create the http server
http.createServer(function (req, res) {

	var method = req.method;

	// when the requests's data event is emitted
	// append the incoming data
	var data = '';
	req.on('data', function(chunk){
		data += chunk;
	});

	// when the requests's end event is emitted
	// handle sending the notification and response
	req.on('end', function(){
		console.log(data);
		// if the request isn't a POST, return a 405
		if(method != "POST"){
			res.writeHead(405, {'Content-Type': 'text/plain'});
			res.end("Request method: " + method + " not supported.\r\n");
			return;
		}
  	var params = qs.parse(data);
  	console.log(params);
		if (params.app && _.include(_.keys(apnsConnections), params.app)) {
		  console.log("app does exist!");
  		var note = createNotification(params);
  		apnsConnections[params.app.toLowerCase()].sendNotification(note);
  		
  		// return a 200 response
  		res.writeHead(200, {'Content-Type': 'text/plain'});
  		res.end("Notification sent for" + params.app + ".\r\n");
  		return;
		} else {
		  console.log("app does not exists!");
		  // return a 200 response
  		res.writeHead(405, {'Content-Type': 'text/plain'});
  		res.end("Sorry! No Certificates for this app installed.\r\n");
  		return;
		}
		
	});
}).listen(8124, "127.0.0.1");

console.log('Server running at http://127.0.0.1:8124/');