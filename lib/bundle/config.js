/* eslint-disable object-curly-newline */
"use strict";

let generateTranspiler = require("./babel");
let { loadExtension, abort, repr } = require("faucet-pipeline-core/lib/util");
let commonjs = require("@rollup/plugin-commonjs");
let { nodeResolve } = require("@rollup/plugin-node-resolve");

let MODULE_FORMATS = { // maps faucet identifiers to Rollup identifiers
	esm: true,
	es: "esm", // alias
	es6: "esm", // alias
	umd: true,
	amd: true,
	commonjs: "cjs",
	cjs: false, // deprecated in favor of `commonjs`
	iife: true
};
let NAMELESS_MODULES = new Set(["es", "amd", "cjs"]); // NB: Rollup identifiers

module.exports = generateConfig;

// generates Rollup configuration
// * `extensions` is a list of additional file extensions for loading modules
//   (e.g. `[".jsx"]`)
// * `externals` determines which modules/packages to exclude from the bundle
//   (e.g. `{ jquery: "jQuery" }` - the key refers to the respective
//   module/package name, the value refers to a corresponding global variable)
// * `format` determines the bundle format: ES, UMD, AMD, CommonJS or IIFE
//    (case-insensitive, defaults to IIFE)
// * `exports` determines the bundle's API, as per the entry point's exported
//   value (if any)
// * `esnext`, if truthy, activates ESNext transpilation
//     * `esnext.browserslist` is the name of the Browserslist group to select -
//       if `false`, this suppresses automatic configuration via Browserslist
//     * `esnext.exclude` is a list of modules for which to skip transpilation
//       (e.g. `esnext: { exclude: ["jquery"] }`, perhaps due to a distribution
//       already optimized for ES5)
// * `jsx`, if truthy, activates JSX transpilation
//     * `jsx.pragma` determines the function to use for JSX expressions
//       (e.g. `jsx: { pragma: "createElement" }`)
//     * `jsx.fragment` determines the function to use for JSX fragments
//       (e.g. `jsx: { fragment: "Fragment" }`)
//     * additionally accepts the same options as `esnext`
// * `typescript`, if truthy, activates TypeScript transpilation - anything
//   other than `true` will be passed through as TypeScript compiler options
// * `sourcemaps`, if truthy, activates inline source-map generation
// * `compact`, if truthy, compresses the bundle's code - see `determineCompacting`
//    for compression levels, determined by the respective value
function generateConfig({ extensions = [], // eslint-disable-next-line indent
		externals, format, exports, // eslint-disable-next-line indent
		esnext, jsx, typescript, // eslint-disable-next-line indent
		sourcemaps, sourcemap, compact }, { browsers }) {
	if(sourcemap !== undefined) { // for backwards compatibility (explicit error)
		abort(`ERROR: ${repr("sourcemap", false)} has been deprecated in ` +
				`favor of ${repr("sourcemaps", false)}`);
	}

	let cfg = { sourcemap: sourcemaps };
	let plugins = [];

	if(esnext || jsx) {
		let transpiler = Object.assign({}, esnext, jsx);
		if(esnext) {
			transpiler.esnext = true;
		}
		if(jsx) {
			// just to be safe, discard JSX-specifics on parent object
			delete transpiler.pragma;
			delete transpiler.fragment;

			transpiler.jsx = selectiveAssign({}, {
				pragma: jsx.pragma,
				pragmaFrag: jsx.fragment
			});
		}

		let { browserslist } = transpiler;
		browsers = browserslist === false ? null : browsers[browserslist || "defaults"];
		if(browsers && browsers.length) {
			console.error("transpiling JavaScript for", browsers.join(", "));
		}

		let { plugin, extensions: ext } = generateTranspiler(transpiler, { browsers });
		extensions = ext.concat(extensions);
		plugins.push(plugin);
	}
	if(typescript) {
		let ts = loadExtension("@rollup/plugin-typescript",
				"failed to activate TypeScript", "faucet-pipeline-typescript");
		extensions.push(".ts");
		// TODO: provide defaults and abstractions for low-level options?
		plugins.push(typescript === true ? ts() : ts(typescript));
	}

	let resolve = {
		// NB: `jsnext:main` retained for backwards compatibility
		mainFields: ["module", "jsnext:main", "main"]
	};
	if(extensions.length) {
		resolve.extensions = [".js"].concat(extensions);
	}

	plugins = plugins.concat([
		nodeResolve(resolve),
		commonjs({ include: "node_modules/**" })
	]);
	if(compact) {
		cfg.compact = true;
		plugins = plugins.concat(determineCompacting(compact));
	}
	cfg.plugins = plugins;

	cfg.format = determineModuleFormat(format);
	if(exports) {
		if(NAMELESS_MODULES.has(format)) {
			console.error(`WARNING: ${repr(format, false)} bundles ignore ` +
					`${repr("exports", false)} configuration`);
		}
		cfg.name = exports;
	}

	if(externals) { // excluded from bundle
		cfg.external = Object.keys(externals);
		cfg.globals = externals;
	}

	// distinguish between (roughly) read and write settings
	let read = ["external", "plugins"];
	return Object.keys(cfg).reduce((memo, key) => {
		let type = read.includes(key) ? "readConfig" : "writeConfig";
		memo[type][key] = cfg[key];
		return memo;
	}, {
		readConfig: {},
		writeConfig: { indent: false }
	});
}

function determineModuleFormat(format = "iife") {
	format = format.toLowerCase();
	let _format = MODULE_FORMATS[format];
	switch(_format) {
	case undefined:
		return abort(`unrecognized module format: ${repr(format)}`);
	case false:
		console.error(`WARNING: ${repr(format)} is deprecated`);
		return format;
	case true:
		return format;
	default:
		return _format;
	}
}

function determineCompacting(type = true) {
	switch(type) {
	case true: // default
	case "compact":
		return require("rollup-plugin-cleanup")();
	case "minify":
		var options = { compress: false, mangle: false }; // eslint-disable-line no-var
		break;
	case "mangle":
		options = { compress: false, mangle: true };
		break;
	default:
		abort(`unknown compacting option ${type}`);
	}

	let { terser } = loadExtension("rollup-plugin-terser",
			"failed to activate minification", "faucet-pipeline-jsmin");
	return terser(options);
}

// merges `source` properties into `target`, skipping `undefined` values
function selectiveAssign(target, source) {
	Object.entries(source).forEach(([key, value]) => {
		if(value !== undefined) {
			target[key] = value;
		}
	});
	return target;
}
