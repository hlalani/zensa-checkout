(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory();
	else if(typeof define === 'function' && define.amd)
		define([], factory);
	else if(typeof exports === 'object')
		exports["ZensaCheckout"] = factory();
	else
		root["ZensaCheckout"] = factory();
})(this, function() {
return /******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;
/******/
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// identity function for calling harmony imports with the correct context
/******/ 	__webpack_require__.i = function(value) { return value; };
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, {
/******/ 				configurable: false,
/******/ 				enumerable: true,
/******/ 				get: getter
/******/ 			});
/******/ 		}
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "/build/";
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 7);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});

var _react = __webpack_require__(!(function webpackMissingModule() { var e = new Error("Cannot find module \"react\""); e.code = 'MODULE_NOT_FOUND'; throw e; }()));

var _react2 = _interopRequireDefault(_react);

var _reactDom = __webpack_require__(!(function webpackMissingModule() { var e = new Error("Cannot find module \"react-dom\""); e.code = 'MODULE_NOT_FOUND'; throw e; }()));

var _rxLite = __webpack_require__(!(function webpackMissingModule() { var e = new Error("Cannot find module \"rx-lite\""); e.code = 'MODULE_NOT_FOUND'; throw e; }()));

var _rxLite2 = _interopRequireDefault(_rxLite);

var _ramda = __webpack_require__(!(function webpackMissingModule() { var e = new Error("Cannot find module \"ramda\""); e.code = 'MODULE_NOT_FOUND'; throw e; }()));

var _ramda2 = _interopRequireDefault(_ramda);

var _observables = __webpack_require__(4);

var _events = __webpack_require__(3);

var _customEvents = __webpack_require__(2);

__webpack_require__(5);

var _App = __webpack_require__(1);

var _App2 = _interopRequireDefault(_App);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

(0, _customEvents.runCustomEventsPolyfill)();

_observables.state$.subscribe(function (rootState) {
  return (0, _reactDom.render)(_react2.default.createElement(_App2.default, { rootState: rootState }), document.getElementById('app'));
});

(0, _events.changeState)('global', {});

exports.default = _App2.default;

/***/ }),
/* 1 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});

var _react = __webpack_require__(!(function webpackMissingModule() { var e = new Error("Cannot find module \"react\""); e.code = 'MODULE_NOT_FOUND'; throw e; }()));

var _react2 = _interopRequireDefault(_react);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var App = function App(_ref) {
  var rootState = _ref.rootState;

  return _react2.default.createElement(
    "div",
    null,
    _react2.default.createElement(
      "h1",
      { className: "h1" },
      "Hello"
    )
  );
};

exports.default = App;

/***/ }),
/* 2 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});
var runCustomEventsPolyfill = exports.runCustomEventsPolyfill = function runCustomEventsPolyfill() {
  if (typeof window.CustomEvent === "function") return false;
  function CustomEvent(event, params) {
    params = params || { bubbles: false, cancelable: false, detail: undefined };
    var evt = document.createEvent('CustomEvent');
    evt.initCustomEvent(event, params.bubbles, params.cancelable, params.detail);
    return evt;
  }
  CustomEvent.prototype = window.Event.prototype;
  window.CustomEvent = CustomEvent;
};

/***/ }),
/* 3 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.changeState = undefined;

var _ramda = __webpack_require__(!(function webpackMissingModule() { var e = new Error("Cannot find module \"ramda\""); e.code = 'MODULE_NOT_FOUND'; throw e; }()));

var _ramda2 = _interopRequireDefault(_ramda);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

// changeState :: String -> {*} -> IMPURE
var changeState = exports.changeState = function changeState(id, newState) {
  var eventData = _defineProperty({}, id, newState);
  var changeStateEvent = new window.CustomEvent('state:change', { detail: eventData });
  window.document.dispatchEvent(changeStateEvent);
};

/***/ }),
/* 4 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/* WEBPACK VAR INJECTION */(function(global) {

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.stateChanged$$ = exports.state$ = undefined;

var _rxLite = __webpack_require__(!(function webpackMissingModule() { var e = new Error("Cannot find module \"rx-lite\""); e.code = 'MODULE_NOT_FOUND'; throw e; }()));

var _rxLite2 = _interopRequireDefault(_rxLite);

var _ramda = __webpack_require__(!(function webpackMissingModule() { var e = new Error("Cannot find module \"ramda\""); e.code = 'MODULE_NOT_FOUND'; throw e; }()));

var _ramda2 = _interopRequireDefault(_ramda);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/*
  STRATEGY:
  - Custom event ("state:change") is fired for each action
  - Triggers state$ observable which accumulates the state data
  - Re-render react-router on onNext()
  - Handle errors if any
  - NOTE: Each state is saved in the following form - {id: {}} where id = stateId
*/

var state$ = exports.state$ = _rxLite2.default.Observable.fromEvent(window.document, 'state:change').map(function (e) {
  return e.detail;
}).scan(_ramda2.default.mergeWith(_ramda2.default.merge), {}) // Instead of simple R.merge to accommodate for multiple event handlers within the same id
.distinctUntilChanged();

// runs subscribe only if the given state has changed
// stateChanged$$ :: String -> Observable
var stateChanged$$ = exports.stateChanged$$ = function stateChanged$$(stateId) {
  return _rxLite2.default.Observable.fromEvent(global.document, 'state:change').map(function (e) {
    return e.detail;
  }).filter(function (state) {
    return _ramda2.default.compose(_ramda2.default.head, _ramda2.default.keys)(state) === stateId;
  }).distinctUntilChanged().map(_ramda2.default.prop(stateId));
};
/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(6)))

/***/ }),
/* 5 */
/***/ (function(module, exports) {

// removed by extract-text-webpack-plugin

/***/ }),
/* 6 */
/***/ (function(module, exports) {

var g;

// This works in non-strict mode
g = (function() {
	return this;
})();

try {
	// This works if eval is allowed (see CSP)
	g = g || Function("return this")() || (1,eval)("this");
} catch(e) {
	// This works if the window reference is available
	if(typeof window === "object")
		g = window;
}

// g can still be undefined, but nothing to do about it...
// We return undefined, instead of nothing here, so it's
// easier to handle this case. if(!global) { ...}

module.exports = g;


/***/ }),
/* 7 */
/***/ (function(module, exports, __webpack_require__) {

__webpack_require__(0);
(function webpackMissingModule() { throw new Error("Cannot find module \"build\""); }());


/***/ })
/******/ ]);
});