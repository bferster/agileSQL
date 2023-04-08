
////////////////////////////////////////////////////////////////////////////////////////////////////////////

//  NODEJS SQLITE SERVER

//	resides in sql folder under web access root
//	npm install sqlite3
//	npm install forever
//	npm install os
//	npm install fs
///	open port:8081
//	local: node ../agileSQL/sql.js
//	server: cd /opt/bitnami/wordpress/db | forever stop sql.js | forever start sql.js 
//	admin with sqlStudio.exe in c:/cc
//  ssh -i c:/Bill/CC/js/agile.pem bitnami@54.88.128.161

// 	RENEW LETSENCRYPT SSL
//	sudo /opt/bitnami/ctlscript.sh stop
//	sudo /opt/bitnami/letsencrypt/lego --tls --email="bferster@stagetools.com" --domains="agileteacher.org" --path="/opt/bitnami/letsencrypt" renew --days 90
//	sudo /opt/bitnami/letsencrypt/lego --path /opt/bitnami/letsencrypt list
// 	sudo /opt/bitnami/ctlscript.sh start

	const sqlite3 = require('sqlite3').verbose();
	const os = require("os");	
	const https = require('https');
	const http = require('http');
	const fs = require('fs');

//SERVER ///////////////////////////////////////////////////////////////////////////////////////////////////

	const local=os.hostname().match(/^bill|desktop/i) ? true : false;					// Running on localhost?
	const dbPath=local ? "../agileSQL/agile.db" : "../db/agile.db";						// Set path
	let archiveTerm=1000*60*60*24*2;													// Archive DB every 2 days
	
	setInterval(()=>{																	// ARCHIVE TIMER
		try{
			let newName="BU-"+new Date().toISOString().substring(0,10)+".db";				// File name
			fs.copyFile(dbPath,newName, (e)=>{ if (e) console.log(e) });					// Copy db file
			} catch(e) { console.log("set interval",e) }
		}, archiveTerm);																	// Every 10 seconds


	const OnRequest = function (req, res) 												// REQUEST LOOP
		{
		try{
			const headers={																	// Create headers
				'Access-Control-Allow-Origin': '*',
				'Access-Control-Allow-Methods': 'POST, GET',
				'Access-Control-Max-Age': 2592000 // 30 days
				 };
			
			res.writeHead(200, headers);													// Write headers
			let act=req.url.match(/[?&]q=([^&]+).*$/);										// Get action
			let e=req.url.match(/[?&]email=([^&]+).*$/);									// Get email
			let pw=req.url.match(/[?&]password=([^&]+).*$/);								// Get pw
			let t=req.url.match(/[?&]type=([^&]+).*$/);										// Get type
			let role=req.url.match(/[?&]role=([^&]+).*$/);									// Get role
			let id=req.url.match(/[?&]id=([^&]+).*$/);										// Get id
			let qy=req.url.match(/[?&]qy=([^&]+).*$/);										// Get query
			e=e ? e[1] : "";	pw=pw ? pw[1] : "";    	role=role ? role[1] : "";			// Get values, if any
			t=t ? t[1] : "";  	qy=qy ? qy[1] : "";		id=id ? id[1] : ""; 				
			act=act ? act[1] : ""; 
			if (act == "login") 															// LOGIN
				LogIn(e, pw, "PALOGIN",role,(r)=>{ SendResponse(r, res) });					// Do login
			else if (act == "list")															// LIST
				List(e,t,(r)=>{ SendResponse(JSON.stringify(r), res); })					// Get from DB
			else if (act == "query")														// LIST
				Query(qy,t,(r)=>{ SendResponse(JSON.stringify(r), res); })					// Get from DB
			else if (act == "load")															// LOAD
				Load(req.url.match(/id=(.*)/)[1],(r)=>{ SendResponse(JSON.stringify(r), res); }) // Get from DB
			else if (act == "loadall")														// LOAD ALL
				LoadAll(t,(r)=>{ SendResponse(JSON.stringify(r), res); }) 					// Get from DB
			else if (act == "save") {														// SAVE
				let body="";																// Hold body
				req.on('data', function(data) {	body+=data;	});								// ON data
				req.on('end', function() {													// On done
					let title=JSON.parse(body).title;										// Get title
					Save(e, pw, title ? title : "", body, t, (r)=>{ SendResponse(r, res); });	// Save to DB
					});
				}
			else if (act == "update") {														// UPDATE
				let body="";																// Hold body
				req.on('data', function(data) {	body+=data;	});								// ON data
				req.on('end', function() {													// On done
					Update(id, JSON.parse(body), (r)=>{ SendResponse(r, res); });			// Save to DB
					});
				}
			else if (act == "delete")														// DELETE
				Delete(id, (r)=>{ SendResponse(JSON.stringify(r), res); }) 					// Remove from DB
			}
		catch(e) { console.log("on request",e); }
	}

	let server;
	if (!local) {																		// If on web
		server=https.createServer({														// Create an https server
			cert: fs.readFileSync("/opt/bitnami/apache/conf/agileteacher.org.crt"),		// Point at cert
			key: fs.readFileSync("/opt/bitnami/apache/conf/agileteacher.org.key")		// And key
			},OnRequest);																// Add listener
		}
	else server=http.createServer(OnRequest);											// Create an http server
	server.listen(8081);																// Listen on port 8081
	trace("SQL nodeJS Server running on "+os.hostname());								// Log server stats

// SQL ////////////////////////////////////////////////////////////////////////////////////////////////////////

	var db;																				// Holds database

	function Open()																	// OPEN DB
	{
		db=new sqlite3.Database(dbPath, (err)=> {										// Open DB
			if (err) console.error(err.message);										// If err
			else	 console.log('Connected to the AgileTeacher database');				// Good open
			});
		}

	function Close()																// CLOSE DB
	{
		db.close((err)=>{																// Close			
			if (err)  console.error(err.message);										// If err
			//else	  console.log('Close the database connection.');					// Good close				
			});
	}
	
	function SendResponse(msg, res)													// SEND RESPONSE
	{
		res.end(msg);																	// Send message
		console.log(msg.substring(0,128));												// Log
	}	

	function LogIn(email, password, type, role, callback)								// LOGIN
	{
		try {
			Open();																			// Open DB
			let q=`SELECT * FROM db WHERE email = '${email}' AND type = '${type}'`;			// Make query
			if (role) q+=` AND role = '${role}'`;											// Add role if set
			db.all(q, (err, rows) => {														// Look for email
				if (err) console.error(err.message);										// An error
				else{																		// Good query
					if (!rows.length) {														// No emails matched, must be a new user
						db.run(`INSERT INTO db (email, password, date, type) VALUES('${email}','${password}',datetime("now"),'${type}')`, 
							function(err) {													// Add their LOGIN											
								if (err)	callback(err.message);							// Error
								else 		callback(role ? role : "user");					// Return role
								});
						return;																// Quit
						}
					if (rows[0] && rows[0].password &&	(rows[0].password == password))	callback("OK");			// A valid user
					else 																callback("PASSWORD");	// Bad password
					}
				});
			Close();																		// Close DB
		}
		catch(e) { console.log(e) }
	}

	function List(email, type, callback)												// GET LIST OF ROW(S) BY EMAIL
	{
		try{
			Open();																			// Open DB
			db.all(`SELECT * FROM db WHERE email = '${email}' AND type = '${type}'`, (err, rows) => { 	// Query
				if (err)	callback(err.message);											// Error
				else 		callback(rows);													// Registered
				});
			Close();																		// Close db
		}
		catch(e) { "list",console.log(e) }
	}

	function Load(id, callback)															// GET ROW BY ID
	{
		try{
			Open();																			// Open DB
			db.all(`SELECT * FROM db WHERE id = '${id}'`, (err, row) => { 					// Query
				if (err)	callback(err.message);											// Error
				else 		callback(row);													// Registered
				});
			Close();																		// Close db
		}
		catch(e) { console.log(e) }
	}
	
	function LoadAll(type, callback)													// GET ALL ROWS BY TYPE
	{
		try{
			Open();																			// Open DB
			db.all(`SELECT * FROM db WHERE type = '${type}'`, (err, row) => { 				// Query
				if (err)	callback(err.message);											// Error
				else 		callback(row);													// Registered
				});
			Close();																		// Close db
		}
		catch(e) { "loadall", console.log(e) }
	}
	
	function Save(email, password, title, data, type, callback)							// SAVE ROW
	{
		try{
			Open();																			// Open DB
			db.run(`INSERT INTO db (email, password, date, type, title, data) 
					VALUES('${email}','${password}',datetime("now"),'${type}','${title}','${data}')`, 
					function(err) {															// Insert
						trace(email+" saved...");
						if (err)	callback(err.message);									// Error
						else 		callback(""+this.lastID);								// Return row id
				});
			Close();																		// Close db
			}
		catch(e) { "save", console.log(e) }
	}

	function Update(id, d, callback)													// UPDATE ROW
	{
		try{
			Open();																			// Open DB
			db.run(`UPDATE db SET date=datetime("now"), title='${d.title}', data='${d.data}', email='${d.email}',
					role='${d.role}', password='${d.password}' WHERE id='${id}'`,
					function(err) {															// Insert
						trace(d+" updated...");
						if (err)	callback(err.message);									// Error
						else 		callback(""+id);										// Return row id
				});
			Close();																		// Close db
			}
		catch(e) { "update", console.log(e) }
	}

	function Delete(id, callback)														// DELETE ROW
	{
		try{
			Open();																			// Open DB
			db.run(`DELETE FROM db WHERE id='${id}'`,
					function(err) {															// Insert
						trace(id+" delete...");
						if (err)	callback(err.message);									// Error
						else 		callback(""+id);										// Return row id
				});
			Close();																		// Close db
			}
		catch(e) { "delete", console.log(e) }
	}

	function Query(query, type, callback)												// GET LIST OF ROW(S) BY QUERY
	{
		try{
			Open();																			// Open DB
			query=query.replace(/%20/g," ");												// Back to spaces
			query=query.replace(/%27/g,"'");												// Apos
			db.all(`SELECT * FROM db WHERE ${query} AND type = '${type}'`, (err, rows) => { // Query
				if (err)	callback(err.message);											// Error
				else 		callback(rows);													// Registered
				});
			Close();																		// Close db
		}
		catch(e) {"query",console.log(e), query }
	}


	
// HELPERS ////////////////////////////////////////////////////////////////////////////////////////////////////////

function trace(msg, p1, p2, p3, p4)																// CONSOLE 
{
	if (p4 != undefined)
		console.log(msg,p1,p2,p3,p4);
	else if (p3 != undefined)
		console.log(msg,p1,p2,p3);
	else if (p2 != undefined)
		console.log(msg,p1,p2);
	else if (p1 != undefined)
		console.log(msg,p1);
	else
		console.log(msg);
}


