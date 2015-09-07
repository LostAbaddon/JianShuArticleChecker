function send (tab, action, msg) {
	if (!isNaN(tab)) {
		chrome.tabs.sendMessage(tab, {action: action, msg: msg});
	}
}

function requestHandler (request, sender) {
	var data = request.msg;
	switch (request.action) {
		case "log":
			console.log('log: ', data);
			return true;
		case "check_article":
			send(request.tabID, "CheckArticle");
		break;
		default:
			console.log('Get Request:');
			console.log(request);
	}
}

var doesCurrentSend = {};
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
	request.__id = sender.tab ? sender.tab.id : 'popup_' + request.tabID;
	doesCurrentSend[request.__id] = true;
	var result = requestHandler(request, sender);
	if (doesCurrentSend[request.__id] === true) {
		sendResponse({result: result});
		delete doesCurrentSend[request.__id];
	}
});