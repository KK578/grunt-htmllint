'use strict';

const htmllint = require('htmllint');
const path = require('path');

function getFormatter(format) {
	let formatterPath;

	// default is stylish
	format = format || 'stylish';

	// only strings are valid formatters
	if (typeof format === 'string') {
		// replace \ with / for Windows compatibility
		format = format.replace(/\\/g, '/');

		// if there's a slash, then it's a file
		if (format.indexOf('/') > -1) {
			formatterPath = path.resolve(process.cwd(), format);
		}
		else {
			formatterPath = `eslint/lib/formatters/${format}`;
		}

		try {
			return require(formatterPath);
		}
		catch (ex) {
			ex.message = `There was a problem loading formatter: ${formatterPath}\nError: ${ex.message}`;
			throw ex;
		}
	}
	else {
		return null;
	}
}

module.exports = (grunt) => {
	grunt.registerMultiTask('htmllint', 'HTML5 linter and validator.', function () {
		const done = this.async();

		// Merge task-specific and/or target-specific options with these defaults.
		let options = this.options({
			//force: false,
			format: 'node_modules/eslint-formatter-pretty',
			plugins: [],
			htmllintrc: false
		});

		const formatter = getFormatter(options.format);
		// const force = options.force;

		// delete options.force;

		if (options.htmllintrc) {
			const htmllintrcPath = (options.htmllintrc === true ?
				'.htmllintrc' :
				options.htmllintrc);

			options = grunt.file.readJSON(htmllintrcPath);
		}

		const plugins = options.plugins || [];
		let fileCount = this.filesSrc.length;
		const issues = [];

		htmllint.use(plugins);
		delete options.plugins;
		delete options.htmllintrc;

		this.filesSrc.forEach((filePath) => {
			if (!grunt.file.exists(filePath)) {
				grunt.log.warn(`Source file "${filePath}" not found.`);

				return;
			}

			const src = grunt.file.read(filePath);
			const output = htmllint(src, options);

			output.then((results) => {
				if (results.length > 0) {
					const fileIssues = {
						filePath: filePath,
						warningCount: 0,
						errorCount: 0,
						messages: []
					};

					results.map((result) => {
						const message = {
							ruleId: result.rule,
							line: result.line,
							column: result.column,
							message: result.msg || htmllint.messages.renderIssue(result),
							severity: 2
						};

						fileIssues.errorCount++;
						fileIssues.messages.push(message);
					});

					issues.push(fileIssues);
				}

				if (--fileCount === 0) {
					writeOutput();
				}
			});
		});

		function writeOutput() {
			// console.log(JSON.stringify(issues, null, 2));
			const resultCount = issues.reduce((a, b, index) => {
				return index === 1 ?
					a.errorCount + b.errorCount :
					a + b.errorCount;
			});
			const fileCount = issues.length;

			let filePlural = grunt.util.pluralize(fileCount, 'file/files');

			if (resultCount > 0) {
				const resultFormat = formatter(issues);

				// Log linting output.
				grunt.log.writeln(resultFormat);

				// Handle exit.
				if (resultCount > 0) {
					filePlural = grunt.util.pluralize(fileCount, 'file/files');
					grunt.fail.warn(`Linting errors in ${fileCount} ${filePlural}.`);
				}
			}

			grunt.log.ok(`${fileCount} ${filePlural} lint free.`);
			done();
		}
	});
};
