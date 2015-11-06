var fs = require( "fs" ),
	chalk = require( "chalk"),
	getProperty = require( "lodash/object/get"),
	moment = require( "moment" );

module.exports = function( Release ) {

Release.define({
	_jsonFiles: [ "package.json", "bower.json" ],
	_cloneRepo: function() {
		var projectRelease, releaseDependencies;

		Release.chdir( Release.dir.base );
		console.log( "Cloning " + chalk.cyan( Release.remote ) + "..." );
		Release.exec( "git clone " + Release.remote + " " + Release.dir.repo,
			"Error cloning repo." );
		Release.chdir( Release.dir.repo );

		console.log( "Checking out " + chalk.cyan( Release.branch ) + " branch..." );
		Release.exec( "git checkout " + Release.branch, "Error checking out branch." );
		console.log();

		console.log( "Installing dependencies..." );
		Release.exec( "npm install -q", "Error installing dependencies." );
		console.log();

		try {
			projectRelease = require( Release.dir.repo + "/build/release" );

			if ( projectRelease.dependencies ) {
				console.log( "Installing release dependencies..." );
				releaseDependencies = projectRelease.dependencies.join( " " );
				Release.exec( "npm install -q " + releaseDependencies,
					"Error installing release dependencies." );
				console.log();
			}

			console.log( "Loading project-specific release script..." );
			projectRelease( Release );
			console.log();
		} catch (e) {
			// It's ok to not have project-specific release script
			if (!/^Cannot find module/.test(e)) {
				throw e;
			}
		}
	},

	_checkRepoState: function( fn ) {
		var pkg = Release.readPackage();
		if ( !Release.issueTracker ) {
			console.log( "Trying to guess issue tracker from package.json's 'bugs' property" );

			Release.issueTracker = getProperty( pkg, "bugs.type" );
		}

		if ( !Release.issueTracker ) {
			Release.abort( "Missing required config: issueTracker." );
		}

		Release.issueTracker = Release.issueTracker.toLowerCase();
		if ( [ "github", "trac", "jira" ].indexOf( Release.issueTracker ) === -1 ) {
			Release.abort( "Invalid value for issueTracker. Must be 'github', 'trac' or 'jira'." );
		}

		if ( Release.issueTracker === "trac" ) {
			if ( !Release.contributorReportId ) {
				Release.abort( "Missing required config: contributorReportId." );
			}
		}

		Release._checkAuthorsTxt();

		Release.walk( [ Release.checkRepoState ], fn );
	},

	_checkAuthorsTxt: function() {
		if ( Release.noAuthorsFile ) {
			return;
		}

		console.log( "Checking AUTHORS.txt..." );
		var result, lastActualAuthor,
			lastListedAuthor = fs.readFileSync( "AUTHORS.txt", "utf8" )
				.trim()
				.split( /\r?\n/ )
				.pop();

		Release.chdir( Release.dir.repo );
		result = Release.exec({
			command: "grunt authors",
			silent: true
		}, "Error getting list of authors." );
		lastActualAuthor = result.split( /\r?\n/ ).splice( -4, 1 )[ 0 ];

		if ( lastListedAuthor !== lastActualAuthor ) {
			console.log( "Last listed author is " + chalk.red( lastListedAuthor ) + "." );
			console.log( "Last actual author is " + chalk.green( lastActualAuthor ) + "." );
			Release.abort( "Please update AUTHORS.txt." );
		}

		console.log( "Last listed author (" + chalk.cyan( lastListedAuthor ) + ") is correct." );
	},

	checkRepoState: function() {},

	// Unwrapped URL field from package.json, no trailing slash
	_packageUrl: function( field ) {
		var result = Release.readPackage()[ field ];

		// Make sure it exists
		if ( !result ) {
			Release.abort( "Failed to read '" + field + "' URL field from package.json" );
		}

		// Unwrap
		if ( result.url ) {
			result = result.url;
		}

		// Strip trailing slash
		return result.replace( /\/$/, "" );
	},

	_ticketUrl: function() {
		var issueTracker = Release.issueTracker;
		var url = Release._packageUrl( "bugs" );

		if ( issueTracker === "trac" ) {
			// Trac bugs URL is just the host
			url += "/ticket/";
		} else if ( issueTracker === "jira" ) {
			url += "/browse/";
		} else {
			// GitHub bugs URL is host/user/repo/issues
			url += "/";
		}

		return url;
	},

	repositoryUrl: function() {
		var url = Release._packageUrl( "repository" )
			.replace( /^git/, "https" )
			.replace( /^ssh:\/\/(?:(\w+)@)?/, "https://" )
			.replace( /\.git$/, "" );

		var serverType = getProperty( Release.readPackage(), "repository.serverType", "" );
		if ( serverType === "stash" ) {
			url = url.replace(/https:\/\/([^\/]+)\/([^/]+)\/(.+)$/, "https://$1/projects/$2/repos/$3");
		}

		// Strip trailing slash
		return url.replace( /\/$/, "" );
	},

	repositoryCommitBaseUrl: function() {
		var serverType = getProperty( Release.readPackage(), "repository.serverType", "" );
		var endPoint = Release.repositoryUrl();

		if ( serverType === "stash" ) {
			endPoint +=  "/commits/";
		} else {
			endPoint = "/commit/";
		}

		return endPoint;
	},

	_readJSON: function( fileName ) {
		var json = fs.readFileSync( Release.dir.repo + "/" + fileName, "utf8" );
		Release.packageIndentation = json.match( /\n([\t\s]+)/ )[ 1 ];
		return JSON.parse( json );
	},

	_writeJSON: function( fileName, json ) {
		fs.writeFileSync( Release.dir.repo + "/" + fileName,
			JSON.stringify( json, null, Release.packageIndentation ) + "\n" );
	},

	readPackage: function() {
		return Release._readJSON( "package.json" );
	},

	writePackage: function( json ) {
		Release._writeJSON( "package.json", json );
	},

	_versionJSON: function( fileName, version ) {
		if ( !fs.existsSync( Release.dir.repo + "/" + fileName ) ) {
			return;
		}
		console.log( "Updating " + fileName + "..." );
		var json = Release._readJSON( fileName );
		json.version = version;
		Release._writeJSON( fileName, json );
	},

	_setVersion: function( version ) {
		Release._jsonFiles.forEach(function( file ) {
			Release._versionJSON( file, version );
		});
	},

	_getVersions: function() {
		var parts, major, minor, patch,
			currentVersion = Release.readPackage().version;

		console.log( "Validating current version..." );
		if ( currentVersion.substr( -4, 4 ) !== "-pre" ) {
			console.log( "The current version is " + chalk.red( currentVersion ) + "." );
			Release.abort( "The version must be a pre version, e.g., 1.2.3-pre." );
		}

		Release.newVersion = Release.preRelease ?
			Release.preRelease :
			currentVersion.substr( 0, currentVersion.length - 4 );

		parts = Release.newVersion.split( "." );
		major = parseInt( parts[ 0 ], 10 );
		minor = parseInt( parts[ 1 ], 10 );
		patch = parseInt( parts[ 2 ], 10 );

		if ( minor === 0 && patch === 0 ) {
			Release.prevVersion = process.env.PREV_VERSION;
			if ( !Release.prevVersion ) {
				Release.abort( "For major releases, set PREV_VERSION in the environment." );
			}
		} else if ( patch === 0 ) {
			Release.prevVersion = Release.getVersionFromTag(
				Release.exec(
					"git for-each-ref --count=1 --sort=-taggerdate --format='%(refname:short)' " +
					"refs/tags/" + Release.getTagFromVersion( [ major, minor - 1 ].join( "." ) ) + "*"
				).trim()
			);
		} else {
			Release.prevVersion = [ major, minor, patch - 1 ].join( "." );
		}

		var prevVersionDate = Release.exec(
			"git for-each-ref --count=1 --format='%(taggerdate)' " +
			"refs/tags/" + Release.getTagFromVersion( Release.prevVersion )
		).trim();

		Release.prevVersionDate = moment(prevVersionDate, "ddd MMM D HH:mm:ss YYYY").toDate();

		Release.nextVersion = Release.preRelease ?
			currentVersion :
			[ major, minor, patch + 1 ].join( "." ) + "-pre";

		console.log( "We are going from " + chalk.cyan( Release.prevVersion ) +
			" to " + chalk.cyan( Release.newVersion ) + "." );
		console.log( "After the release, the version will be " + chalk.cyan( Release.nextVersion ) + "." );
	},

	_createReleaseBranch: function( fn ) {
		var json;

		Release.chdir( Release.dir.repo );
		console.log( "Creating " + chalk.cyan( "release" ) + " branch..." );
		Release.exec( "git checkout -b release/" + Release.newVersion, "Error creating release branch." );
		console.log();

		Release._setVersion( Release.newVersion );

		// Update package.json URLs
		console.log( "Updating package.json URLs..." );
		json = Release.readPackage();
		if ( json.author.url ) {
			json.author.url = json.author.url.replace( "master", Release.newVersion );
		}
		if ( json.licenses ) {
			json.licenses.forEach(function( license ) {
				license.url = license.url.replace( "master", Release.newVersion );
			});
		}
		Release.writePackage( json );

		Release.generateArtifacts(function( paths ) {
			Release._shrinkwrap();
			Release._createTag( paths );
			fn();
		});
	},

	_createTag: function( paths ) {
		var jsonFiles = [];
		var newTag = Release.getTagFromVersion( Release.newVersion );
		Release._jsonFiles.forEach(function( name ) {
			if ( fs.existsSync( name ) ) {
				jsonFiles.push( name );
			}
		});

		// Ensure that at least one file is in the array so that `git add` won't error
		paths = paths.concat( jsonFiles );

		Release.chdir( Release.dir.repo );
		console.log( "Committing release artifacts..." );
		Release.exec( "git add -f " + paths.join( " " ), "Error adding release artifacts to git." );
		Release.exec( "git commit -m '" + Release.newVersion + "'",
			"Error committing release changes." );
		console.log();

		console.log( "Tagging release..." );
		Release.exec( "git tag " + newTag, "Error tagging " + newTag + "." );
		Release.tagTime = Release.exec( "git log -1 --format='%ad'",
			"Error getting tag timestamp." ).trim();
	},

	generateArtifacts: function( fn ) {
		fn( [] );
	},

	_pushRelease: function() {
		Release.chdir( Release.dir.repo );
		console.log( "Pushing release to git repo..." );
		Release.exec( "git push origin --tags", "Error pushing tags to git repo." );
	},

	_updateBranchVersion: function() {
		Release.chdir( Release.dir.repo );
		console.log( "Checking out " + chalk.cyan( Release.branch ) + " branch..." );
		Release.exec( "git checkout " + Release.branch,
			"Error checking out " + Release.branch + " branch." );

		// Update only canonical version
		Release._versionJSON( "package.json", Release.nextVersion );

		console.log( "Committing version update..." );
		Release.exec( "git commit -am 'Build: Update version to " + Release.nextVersion + "'",
			"Error committing package.json." );
	},

	_pushBranch: function() {
		Release.chdir( Release.dir.repo );
		console.log( "Pushing " + chalk.cyan( Release.branch ) + " to remote repo..." );
		Release.exec( "git push origin " + Release.branch, "Error pushing to remote repo." );
	}
});

};
