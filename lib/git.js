var config = require( "config" );
var getProperty = require( "lodash/object/get" );

module.exports = function( Release ) {

Release.define({
	gitLog: function( format ) {
		var command = "git log " + Release.getTagFromVersion( Release.prevVersion ) + ".." + Release.getTagFromVersion( Release.newVersion ) + " " +
				"--format='" + format + "'",
			result = Release.exec({
				command: command,
				silent: true
			}, "Error getting git log, command was: " + command );

		result = result.split( /\r?\n/ );
		if ( result[ result.length - 1 ] === "" ) {
			result.pop();
		}

		return result;
	},

	getTagFromVersion: function( version ) {
		var prefix = getProperty( config, "git.tags.prefix", "" );
		return prefix + version;
	},

	getVersionFromTag: function( tag ) {
		var prefix = getProperty( config, "git.tags.prefix", "" );
		return tag.substr( prefix.length );
	}
});

};
