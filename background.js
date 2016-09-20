/**
 * Extension that goes beyond shortlinks.
 */
"use strict";

var MAPPINGS_NAME = "YO_MAPPINGS";

function dbg(obj) {
    chrome.extension.getBackgroundPage().console.log(obj);
}

var mappings = {};

function createEntry(urlText) {
    return {
        url: urlText,
        count: 1
    };
}

mappings["newdoc"] = createEntry("https://docs.google.com/document/create");
mappings["newsheet"] = createEntry("https://docs.google.com/spreadsheet/ccc?new");
mappings["newslides"] = createEntry("https://docs.google.com/presentation/create");
mappings["mail"] = createEntry("https://mail.google.com/mail/u/0/");

var states = {
    SUCCESS: 200,
    FAILURE: 401
};

function initMappings() {
    chrome.storage.sync.set(mappings, function () {
        notify("Yo, welcome!",
            "We started you off with some mappings. Type in 'yo newdoc' into the URL bar!");
    });
}

function initMappingsIfNone() {
    chrome.storage.sync.get(null, function (items) {
        dbg(items);
        if (Object.keys(items).length === 0 &&
            items.constructor === Object) {
            initMappings();
        }
    });
}

function createReturnObject(successValue, returnString) {
    return {
        success: successValue,
        value: returnString
    };
}

function getMappings(callback) {
    return chrome.storage.sync.get(null, callback);
}

function findMapping(keyword, callback) {
    var isSuccess = states.SUCCESS;
    getMappings(function (currentMappings) {
        if (keyword in currentMappings) {
            var ret = currentMappings[keyword];
            ret.count++;
            callback(createReturnObject(isSuccess, ret));
        } else {
            getFirstMatch(keyword, function (matchedEntry) {
                if (!matchedEntry) {
                    isSuccess = states.FAILURE;
                    callback(createReturnObject(isSuccess, null));
                } else {
                    notify("Yo! We guessed!",
                        "We guessed '" + keyword + "' matches to '" + matchedEntry + "'!");
                    var ret = currentMappings[matchedEntry];
                    ret.count++;
                    callback(createReturnObject(isSuccess, ret));
                }
            })(currentMappings);;
        }
    });
}

function navigate(url) {
    chrome.tabs.query({
        active: true,
        currentWindow: true
    }, function (tabs) {
        chrome.tabs.update(tabs[0].id, {
            url: url
        });
    });
}

function parseTextAsCommand(text) {
    return text.split(" ");
}

function convertToUrl(partial) {
    var ret = partial;
    if (partial.indexOf("http") != 0) {
        ret = "http://" + partial;
    }
    return ret;
}

function notify(titleText, messageText) {
    var notificationOptions = {
        type: "basic",
        iconUrl: "yo-icon.png",
        title: titleText,
        message: messageText
    };

    chrome.notifications.create(notificationOptions);
}

function setNewMapping(keyword, url) {
    var newMapping = {};
    newMapping[keyword] = createEntry(convertToUrl(url));
    chrome.storage.sync.set(newMapping, function () {
        notify("Yo, you wanted a new mapping?",
            "We mapped '" + keyword + "' to '" + url + "'!");
        sortMappings();
    });
}

function clear(keyword) {
    if (keyword === "all") {
        chrome.storage.sync.clear(function () {
            notify("Yo, cleared!",
                "We cleared all the mappings.");
        });
    }
}

var legalCommands = {
    "set": {
        length: 3,
        action: setNewMapping
    },
    "clear": {
        length: 2,
        action: clear
    },
    "init": {
        length: 1,
        action: initMappings
    }
};

function isCommandLegal(fullCommand) {
    if (fullCommand.length < 1) {
        return false;
    }

    var commandWord = fullCommand[0];
    return fullCommand.length >= 1 &&
        (commandWord in legalCommands) &&
        legalCommands[commandWord].length == fullCommand.length;
}

function executeTextAsCommand(text) {
    var fullCommand = parseTextAsCommand(text);
    if (!isCommandLegal(fullCommand)) {
        return states.FAILURE;
    }
    var commandWord = fullCommand[0];
    var commandArgs = fullCommand.slice(1);
    legalCommands[commandWord].action.apply(this, commandArgs);
}

function sortMappings() {
    function itemCompare(a, b) {
        return b.count - a.count;
    }

    chrome.storage.sync.get(null, function (items) {
        items.sort(itemCompare);
    });
}

function executeMapping(text, disposition) {
    if (isCommandLegal(parseTextAsCommand(text))) {
        return executeTextAsCommand(text);
    }

    findMapping(text, function (result) {
        if (result.success == states.SUCCESS) {
            navigate(result.value.url);
        } else {
            notify("Yo, not found!",
                "We couldn't find '" + text + "' as a mapping. Type 'yo set " + text + " <target> to define a new mapping!");
        }
    });
};

function getFirstMatch(text, callback) {
    return function (items) {
        for (var entry in items) {
            dbg(entry);
            if (entry.indexOf(text) === 0) {
                callback(entry);
                return entry;
            }
        }

        return null;
    };
}

function setSuggestion(entry) {
    var suggestion = {
        "description": entry
    };
    chrome.omnibox.setDefaultSuggestion(suggestion);
}

function makeSuggestion(text) {
    getMappings(getFirstMatch(text, setSuggestion));
}

initMappingsIfNone();

chrome.omnibox.onInputChanged.addListener(makeSuggestion);

chrome.omnibox.onInputEntered.addListener(executeMapping);
