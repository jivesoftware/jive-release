module.exports = function( Release ) {
	Release.define({
		generateIssueTrackerChangelog: function( callback ) {
			switch( Release.issueTracker ) {
				case 'trac':
					Release._generateTracChangelog( callback );
					break;

				case 'jira':
					Release._generateJiraChangelog( callback );
					break;

				default:
					Release._generateGithubChangelog( callback );
			}
		}
	});
};
