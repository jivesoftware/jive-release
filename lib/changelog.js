var fs = require( "fs" ),
	changelogplease = require( "changelogplease" ),
	chalk = require( "chalk"),
	capitalize = require( "lodash/string/capitalize"),
	getProperty = require( "lodash/object/get" ),
	config = require( "config").changelogplease;

module.exports = function( Release ) {

Release.define({
	_generateChangelog: function( callback ) {
		Release._generateCommitChangelog(function( commitChangelog ) {
			Release.generateIssueTrackerChangelog(function( issueChangelog ) {
				var changelogPath = Release.dir.base + "/changelog",
					changelog = Release.changelogShell() +
						commitChangelog +
						"\n\n\n" +
						"--- Issue List ---\n" +
						issueChangelog;

				fs.writeFileSync( changelogPath, changelog );
				console.log( "Stored changelog in " + chalk.cyan( changelogPath ) + "." );

				callback();
			});
		});
	},

	changelogShell: function() {
		return "# Changelog for " + Release.readPackage().name + " v" + Release.newVersion + "\n";
	},

	tracMilestone: function() {
		return Release.newVersion;
	},

	_generateCommitChangelog: function( callback ) {
		console.log( "Adding commits..." );

		changelogplease({
			ticketTypes: [ Release.issueTracker ],
			ticketUrl: Release._ticketUrl() + "{id}",
			commitUrl: Release.repositoryCommitBaseUrl() + "{id}",
			repo: Release.dir.repo,
			committish: Release.getTagFromVersion( Release.prevVersion ) + ".." + Release.getTagFromVersion( Release.newVersion ),
			sort: getProperty( config, "sort", true )
		}, function( error, log ) {
			if ( error ) {
				Release.abort( "Error generating commit changelog.", error );
			}

			callback( log );
		});
	}
});

};
