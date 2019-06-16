"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var v1_1 = require("uuid/v1");
// @ts-ignore it's not worth writing a TS declaration file in this repo for a tiny module we use once like this
var term_size_1 = require("term-size");
var logger_1 = require("./logger");
// @ts-ignore
var enquirer_1 = require("enquirer");
/* Notes on using inquirer:
 * Each question needs a key, as inquirer is assembling an object behind-the-scenes.
 * At each call, the entire responses object is returned, so we need a unique
 * identifier for the name every time. This is why we are using UUIDs.
 */
var limit = Math.max(term_size_1["default"]().rows - 5, 10);
function askCheckboxPlus(message, choices, format) {
    return __awaiter(this, void 0, void 0, function () {
        var name;
        return __generator(this, function (_a) {
            name = "CheckboxPlus-" + v1_1["default"]();
            return [2 /*return*/, enquirer_1.prompt({
                    type: "autocomplete",
                    name: name,
                    message: message,
                    // @ts-ignore
                    prefix: logger_1.prefix,
                    multiple: true,
                    choices: choices,
                    format: format,
                    limit: limit
                }).then(function (responses) { return responses[name]; })];
        });
    });
}
exports.askCheckboxPlus = askCheckboxPlus;
function askQuestion(message) {
    return __awaiter(this, void 0, void 0, function () {
        var name;
        return __generator(this, function (_a) {
            name = "Question-" + v1_1["default"]();
            return [2 /*return*/, enquirer_1.prompt([
                    {
                        type: "input",
                        message: message,
                        name: name,
                        // @ts-ignore
                        prefix: logger_1.prefix
                    }
                ]).then(function (responses) { return responses[name]; })];
        });
    });
}
exports.askQuestion = askQuestion;
function askConfirm(message) {
    return __awaiter(this, void 0, void 0, function () {
        var name;
        return __generator(this, function (_a) {
            name = "Confirm-" + v1_1["default"]();
            return [2 /*return*/, enquirer_1.prompt([
                    {
                        message: message,
                        name: name,
                        // @ts-ignore
                        prefix: logger_1.prefix,
                        type: "confirm",
                        initial: true
                    }
                ]).then(function (responses) { return responses[name]; })];
        });
    });
}
exports.askConfirm = askConfirm;
function askList(message, choices) {
    return __awaiter(this, void 0, void 0, function () {
        var name;
        return __generator(this, function (_a) {
            name = "List-" + v1_1["default"]();
            return [2 /*return*/, enquirer_1.prompt([
                    {
                        choices: choices,
                        message: message,
                        name: name,
                        // @ts-ignore
                        prefix: logger_1.prefix,
                        type: "select"
                    }
                ]).then(function (responses) { return responses[name]; })];
        });
    });
}
exports.askList = askList;
