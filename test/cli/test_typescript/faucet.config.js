"use strict";

let path = require("path");

module.exports = {
	js: [{
		source: "./src/index.ts",
		target: "./dist/bundle.js",
		typescript: true
	}, {
		source: "./src/index.ts",
		target: "./dist/bundle_es5.js",
		typescript: {
			transpile: true,
			strict: true
		}
	}, {
		source: "./src/index.tsx",
		target: "./dist/bundle_jsx.js",
		typescript: {
			jsx: "createElement"
		}
	}],
	plugins: {
		js: {
			plugin: path.resolve(__dirname, "../../.."),
			bucket: "scripts"
		}
	}
};
