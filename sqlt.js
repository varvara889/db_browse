// a bunch of functions for sql templates, that can be used in 
// various add-ons.

// each sqlt item has:
//  - an SQL template
//  - a list of parameters (zero or more)
//  - each parameter may have a type and may have a value.
//  - if a parameter has no value, we need to raise an error 
//    or request that value from the user.
//

/* example sqlt with parameters:

sqlt.get_file = {
	sqlt: 'select * from file where file_id= {id}',
	params: { id: 'string' },
};

sqlt.average_response_time = {
	sqlt: 
'select req_url_path, sum(resp_t_app) as sum_app_time, count(*) as count, \
  sum(resp_t_app) / count(*) as average from requests \
  where req_time between {start} and {end} \
  group by req_url_path having count(*) > {count} \
order by sum_app_time desc',
	params: { start: 'date', end: 'date', count: 'int' },
};

*/

function run_sqlt( sqlt, req, res, next ) {
	res.locals.sqlt = sqlt;
	var values = {};

	for( var i in sqlt.params ) {
		if (req.query[i])     { values[i] = req.query[i]; }
		else if (req.body[i]) { values[i] = req.body[i]; }
	}

	var sa = apply_values( sqlt.sqlt, sqlt.params, values );

	if ( sa.missing ) {
		// error
		// show a form
		res.send( {missing: sa.missing} );

	} else {

		req.dbconnection.query( sa.sql, 
			sa.par,
			function(err,result) {
				if (err) {
					res.json(
						{error: err, 
						 sql: sa.sql } );
				} else res.json( {
					'sqlt':   sqlt.sqlt,
					'sql':    sa.sql, 
					'values': values, 
					'result': result 
				} ); 
			} 
		);

	}
}

// apply_values( template, parameterlist, values )
//
// XXX this function has a postgres-specific part to it
function apply_values( t, p, v ) {
	var s = t;
	var missing = [];
	var par = [];
	console.log( 'apply_values()', t);

	for( var i in p ) {
		console.log( 'par', i, 'value', v[i] );
		if (v[i]=== undefined) { 
			// complain!
			// XXX
			missing.push( i );

		} else { 
			var re = new RegExp( '\\{' + i + '\\}', 'g' );
			console.log( re );

			if (   p[i] == 'string'
				|| p[i] == 'date' 
				|| p[i] == 'int' ) {
				// postgres-specific. follows 'pg' module convention 
				// for parameterized queries 
				// https://github.com/brianc/node-postgres
				// (or is it, actually, the postgres convention?)
				s = s.replace( re, '$' + (par.length + 1).toString() );
				par.push( v[i] );

			} else {
				s = s.replace( re, v[i] );

			}
		}
	}
	if (missing.length) {
		console.log( 'missing: ', missing );
		return {sql:s, missing: missing, par: par};
	}
	console.log( 'apply_values(): sql', s );
	console.log( 'apply_values(): par', par );
	return {sql: s, par: par};
}


function check_sqlt_params(req, res, next) {
	var sqlt   = res.locals.sqlt;
	var params = res.locals.params;
	var values = res.locals.values;
	
	var empty_params = [];
	for (var i in params) {
		if (values[i]) {}
		else { empty_params.push(i); }
	}

	return empty_params;
}

exports.run_sqlt     = run_sqlt;
exports.apply_values = apply_values;
