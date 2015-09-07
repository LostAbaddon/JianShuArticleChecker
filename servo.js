// Basic
function send (tab, action, msg) {
	if (!isNaN(tab)) {
		chrome.tabs.sendMessage(tab, {action: action, msg: msg});
	}
}

function requestHandler (request, sender, callback) {
	var data = request.msg;
	switch (request.action) {
		case "log":
			console.log('log: ', data);
			return true;
		case "check_url_baidu":
			checkBaiduURL(request.__id, data.slug, data.url, data.keys);
		break;
		// default:
		// 	console.log('Get Request:');
		// 	console.log(request);
	}
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
	request.__id = sender.tab ? sender.tab.id : 'popup_' + request.tabID;
	requestHandler(request, sender, sendResponse);
});

// Functions
const RANKLIMIT = 50;

function checkBaiduURL (tab, slug, url, keys) {
	ajax(url, {
		success: function (text) {
			text = convertPageToContent(text);
			var container = document.createElement('div');
			container.innerHTML = text;
			container = container.querySelector('#content_left');
			if (!container) {
				send(tab, 'BaiduResult', {
					state: 'ParseError',
					slug: slug,
					url: url
				});
				return;
			}
			container = container.querySelectorAll('.c-container');
			var links = [];
			[].map.call(container, function (elem) {
				var title = elem.querySelector('h3.t').querySelector('a');
				var link = title.href;
				title = title.innerText;
				console.log(title, link);
				var content = elem.querySelector('.c-abstract');
				// 去除百度知道等链接中的提问部分，这是干扰因素
				var last = content.children;
				last = last[last.length - 1];
				if (last.nodeName.toLowerCase() === 'a' && last.className === 'c') content.removeChild(last);
				content = content.innerText;
				var rank = rankPage(content, keys);
				if (rank > RANKLIMIT) {
					links.push({
						title: title,
						link: link,
						rank: rank
					});
				}
			});
			send(tab, 'BaiduResult', {
				state: 'OK',
				result: links,
				slug: slug,
				url: url
			});
		},
		fail: function () {
			send(tab, 'BaiduResult', {
				state: 'FetchError',
				slug: slug,
				url: url
			});
		}
	});
}

function convertPageToContent (page) {
	page = page.replace(/<doctype[\w\W]*?>/gi, '');
	page = page.replace(/<head[\w\W]*?>[\w\W]*?<\/head>/gi, '');
	page = page.replace(/<script[\w\W]*?>[\w\W]*?<\/script>/gi, '');
	page = page.replace(/<meta[\w\W]*?>[\w\W]*?<\/meta>/gi, '');
	page = page.replace(/<iframe[\w\W]*?>[\w\W]*?<\/iframe>/gi, '');
	page = page.replace(/<\/?body[\w\W]*?>/gi, '');
	return page;
}
function rankPage (page, keys) {
	var total = 0, rank = 0;
	keys.map(function (line) {
		var score = line.length;
		total += score;
		if (page.indexOf(line) >= 0) rank += score;
	});
	rank /= total;
	rank *= 100;
	return rank;
}