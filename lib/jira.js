var querystring = require( "querystring" );
var JiraApi = require( "jira" ).JiraApi;
var config = require( "config" ).jira;
var getProperty = require( "lodash/object/get" );
var moment = require( "moment" );
var url = require( "url" );

module.exports = function( Release ) {

Release.define({

	_generateJiraChangelog: function( callback ) {
		var jiraUrl = url.parse( Release._packageUrl( "bugs" ));
		var jiraProtocol = jiraUrl.protocol.slice(0, -1);
		var jira = new JiraApi(jiraProtocol, jiraUrl.hostname, jiraUrl.port, config.user, config.password, '2');
		var pkg = Release.readPackage();
		var project = getProperty( pkg, "bugs.project" );
		var component = getProperty( pkg, "bugs.component" );

		var now = (new Date()).getTime();

		var clauses = [];

		if ( project ) {
			clauses.push( "project='" + project + "'" );
		}
		if ( component ) {
			clauses.push( "component='" + component + "'" )
		}
		clauses.push(
			"status CHANGED TO 'closed' " +
			"DURING('" + moment(Release.prevVersionDate).format( "YYYY/MM/DD" ) + "','" + moment(now).format( "YYYY/MM/DD" ) + "')"
		);

		var searchString = clauses.join( " AND " );
		jira.searchJira(
			searchString,
			{
				fields: [ "summary" ],
				maxResults: 200
			},
		 	function( error, result ) {
				if ( error ) {
					return Release.abort( "Error getting issues.", error );
				}

				var changelog = result.issues

					// Convert each issue to text
					.map(function( issue ) {
						return [
							issue.key,
							issue.fields.summary
						]
						.join( "\t" );
					})

					// Concatenate the issues into a string
					.join( "\n" ) + "\n";

				callback( changelog );
			}
		);
	}
});

};
