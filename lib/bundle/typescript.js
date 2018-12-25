"use strict";

let { loadExtension } = require("faucet-pipeline-core/lib/util");

// NB: Browserslist is not supported
module.exports = function generateTranspiler(config, { browsers }) {
	let ts = loadExtension("rollup-plugin-typescript2",
			"failed to activate TypeScript", "faucet-pipeline-typescript");
	let jsx = !!config.jsx; // XXX: breaks encapsulation
	config = generateConfig(config === true ? {} : config);
	// TODO: optionally auto-generate `tsconfig.json`
	return {
		plugin: ts(config),
		extensions: jsx ? [".ts", ".tsx"] : [".ts"]
	};
};

// XXX: passing through `compilerOptions` is a leaky abstraction - but necessary?
function generateConfig({ jsx, transpile, strict, compilerOptions }) {
	let config = {
		module: "es6",
		newLine: "lf" // XXX: controversial?
	};
	if(strict !== undefined) {
		config.strict = strict;
	}
	if(transpile) { // TODO: rename?
		config.target = transpile === true ? "ES5" : transpile; // XXX: leaky abstraction
	}
	if(jsx) {
		if(typeof jsx === "string") { // shortcut
			jsx = { pragma: jsx };
		}
		let { mode, pragma } = jsx;
		config.jsx = mode || "react";
		if(pragma) {
			config.jsxFactory = pragma;
		}
	}
	return {
		tsconfigDefaults: {
			compilerOptions: Object.assign(config, compilerOptions)
		}
	};
}
