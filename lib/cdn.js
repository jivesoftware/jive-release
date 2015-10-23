var chalk = require( "chalk"),
	fs = require( "fs" ),
	path = require( "path"),
	shell = require( "shelljs" );

module.exports = function( Release ) {
	Release.define({
		// Where to pick up CDN assets in the project being released
		cdnPublish: "dist/cdn",

		// Git repo where CDN resources need to be pushed
		cdnRepo: "git@github.com:jquery/codeorigin.jquery.com.git",

		// Git repo where CDN resources need to be pushed during test releases
		cdnFakeRepo: "git@github.com:jquery/fake-cdn.git",

		// Directory in which CDN repo is going to be cloned in. Relative to Release.dir.base
		cdnCloneDir: "codeorigin.jquery.com",

		_cdnClonedRepo: "",

		// Returns CDN directory in current project will dump files to be pushed to CDN
		getCdnReleaseDir: function() {
			var npmPackage = Release.readPackage().name,
				cdn = Release._cdnClonedRepo + "/cdn";
			return cdn + "/" + npmPackage + "/" + Release.newVersion;
		},

		_cloneCdnRepo: function() {
			var local = path.join( Release.dir.base, Release.cdnCloneDir ),
				remote = Release.isTest ? Release.cdnFakeRepo : Release.cdnRepo;

			if ( fs.existsSync( local ) ) {
				return local;
			}

			console.log( "Cloning " + chalk.cyan( remote ) + "..." );
			Release.chdir( Release.dir.base );
			Release.exec( "git clone " + remote + " " + local, "Error cloning CDN repo." );
			console.log();

			Release._cdnClonedRepo = local;
		},

		copyCdnArtifacts: function( src, dst ) {
			shell.cp( "-r", src + "/*", dst );
		},

		_copyCdnArtifacts: function() {
			var npmPackage = Release.readPackage().name,
				targetCdn = Release.getCdnReleaseDir(),
				releaseCdn = Release.dir.repo + "/" + Release.cdnPublish,
				commitMessage = npmPackage + ": Added version " + Release.newVersion;

			Release.chdir( Release.dir.base );
			console.log( "Copying files from " + chalk.cyan( releaseCdn ) + " to " + chalk.cyan( targetCdn ) + "." );
			shell.mkdir( "-p", targetCdn );
			Release.copyCdnArtifacts( releaseCdn, targetCdn );

			console.log( "Adding files..." );
			Release.chdir( targetCdn );
			Release.exec( "git add ." , "Error adding files." );
			Release.exec( "git commit -m '" + commitMessage + "'" , "Error commiting files." );
		},

		_pushToCdn: function() {
			Release.chdir( Release.getCdnReleaseDir() );
			Release.exec( "git push origin HEAD", "Error pushing to CDN repo." );
			console.log();
		}
	});
};
