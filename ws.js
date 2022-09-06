
/* 	NODEJS SQLITE API ///////////////////////////////////////////////////////////////////////////////////////////////////

	resides in sql folder in web-access root folder
	npm install sqlite3
	npm install express	npm install forever
	open port: 3000
	localhost: node sql.js
	server: cd /opt/bitnami/wordpress/sql/ws.js | forever stop ws.js | forever start ws.js 

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////  */

	const express=require("express");
	const sqlite3=require('sqlite3').verbose();

	var db;
	var app=express();
	
	app.listen(3000, () => {
		console.log("Express server running on port 3000");
		});

		app.get("/paGetByEmail", (req, res, next) => {								// ON GET BY EMAIL
			if (req && req.query && req.query.email) {									// If valid params
				Open();																	// Open SQL
				db.serialize(() => {													// Serialize
					db.all(`SELECT * FROM pa WHERE email = '${req.query.email}'`, (err, row) =>{ // Query DB
						if (err) res.json({ err:err.message });							// Show error
						else  	 res.json(row);											// Return data
						});
					});
				Close();																// Close SQL
				}
			 });
	
		app.get("/paGetById", (req, res, next) => {									// ON GET BY ID
			if (req && req.query && req.query.id) {										// If valid params
				Open();																	// Open SQL
				db.all(`SELECT * FROM pa WHERE id = '${req.query.id}'`, (err, row) =>{ 	// Query DB
					if (err) res.json({ err:err.message });								// Show error
					else  	 res.json(row);												// Return data
					});
				Close();																// Close SQL
				}
			});
	
		app.post("/paAddRow", (req, res, next) =>{									// ON ADD ROW
			if (req && req.query && req.query.id) {										// If valid params
				Open();																	// Open SQL
				db.run(`INSERT INTO pa (email, password, date, deleted, type, title, data) 
				VALUES('${email}','${password}',datetime("now"),'0','PA','${title}','${data}')`, 
				function(err) {
					if (err) res.json({ err:err.message });								// Show error
					else 	 res.json({ row: this.lastID });							// Return row added
					});
				Close();																// Close SQL
				}
			});
	

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// HELPERS
////////////////////////////////////////////////////////////////////////////////////////////////////////////////

	function Open()																	// OPEN DB
	{
		db=new sqlite3.Database('agile.db', (err)=> {									// Open DB
			if (err) console.error(err.message);										// If err
			else	 console.log('Connected to the AgileTeacher database');				// Good open
		 	});
	}

	function Close()																// CLOSE DB
	{
		db.close((err)=>{																// Close			
			if (err)  console.error(err.message);										// If err
			else	  console.log('Close the database connection.');					// Good close				
	  		});
	}
	
	function trace(params) {	console.log(params);  	};