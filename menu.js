var tab = null;

// Badget Common
var send = function (action, msg) {
	if (!!tab) chrome.tabs.sendMessage(tab.id, {action: action, msg: msg});
	chrome.runtime.sendMessage({action: action, msg: msg, tabID: tab.id});
};
var log = function (msg) {
	send('log', msg);
};

document.addEventListener('DOMContentLoaded', function () {
	chrome.tabs.query({currentWindow: true, active: true}, function (tabs) {
		tab = tabs[0];
		var url = tab.url;
		url = url.match(URL_CHECKER);
		if (!!url) {
			url = url[1];
			send("CheckArticle", url);
		}
		window.close();
	});
});