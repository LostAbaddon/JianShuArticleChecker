const URL_CHECKER = /(?:www\.)?jianshu\.(?:com|io)\/p\/(\w+)/i;
var tab = null;

// Badget Common
function sendCallback (request) {
	if (!request || !request.origin || !request.success) return;
	switch(request.origin) {
		case "analyzeArticles":
			// buttons.startAnalyze._triggers.map(function (target) {
			// 	target[1].value = '';
			// 	localStorage.removeItem(target[0]);
			// });
		break;
	}
}
var send = function (action, msg) {
	if (!!tab) chrome.tabs.sendMessage(tab.id, {action: action, msg: msg}, sendCallback);
	chrome.runtime.sendMessage({action: action, msg: msg, tabID: tab.id}, sendCallback);
};
var log = function (msg) {
	send('log', msg);
};

// Privates
var menu = null;

var lastTab = null;
var switchTab = function (tabID) {
	var tab = query(tabID);
	if (lastTab === tab) return;
	if (lastTab) {
		lastTab.style.display = 'none';
	}
	tab.style.display = 'block';
	lastTab = tab;
};

var buttons = {};
var initButtons = function () {
	var btns = query('.button', true);
	[].map.call(btns, function (btn) {
		var name, isWidget, target, options;
		name = btn.getAttribute('name');
		if (!name || name.length === 0) return;
		name = name.trim();
		buttons[name] = btn;
		// Switcher
		isWidget = btn.classList.contains('switch');
		if (isWidget) {
			target = btn.getAttribute('target');
			if (target && target.length) target = target.trim();
			if (target && target.length > 0) linkPanelSwitch(btn, '.panel.' + target);
		}
		// Trigger
		isWidget = btn.classList.contains('trigger');
		if (isWidget) {
			target = btn.getAttribute('target');
			if (target && target.length) target = target.trim();
			if (target && target.length > 0) {
				options = btn.getAttribute('trigger');
				if (options) {
					options = options.split(' ');
					triggerEvent(btn, target, options);
				}
			}
		}
		// Entry
		isWidget = btn.classList.contains('entry');
		if (isWidget) {
			target = btn.getAttribute('target');
			if (target && target.length > 0) {
				entryEvent(btn, target);
			}
		}
	});
};
var linkPanelSwitch = function (button, panelID) {
	button._panel = query(panelID);
	addEvent(button, 'click', function () {
		switchTab(panelID);
	});
};
var triggerEvent = function (button, triggerName, options) {
	var targets = [];
	options.map(function (opt) {
		var target;
		opt = opt.trim();
		if (!opt || opt.length === 0) return;
		target = query('input[name="' + opt + '"]');
		target.value = localStorage[opt] || '';
		target.onchange = function () {
			localStorage[opt] = this.value;
		};
		targets.push([opt, target]);
	});
	button._triggers = targets;
	button.addEventListener('click', function (e) {
		var data = {};
		targets.map(function (target) {
			data[target[0]] = target[1].value;
			localStorage[target[0]] = target[1].value;
		});
		send(triggerName, data);
	});
};
var entryEvent = function (button, target) {
	button.addEventListener('click', function (e) {
		send(target);
	})
}

document.addEventListener('DOMContentLoaded', function () {
	chrome.tabs.query({currentWindow: true, active: true}, function (tabs) {
		tab = tabs[0];
		var url = tab.url;
		url = url.match(URL_CHECKER);
		if (!!url) {
			url = url[1];
			send("check_article", url);
		}
		window.close();

		// menu = query('body');
		// switchTab('.main');
		// initButtons();
	});
});