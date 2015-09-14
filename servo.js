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
		case "check_url_bing":
			checkBingURL(request.__id, data.slug, data.url, data.keys);
		break;
		case "check_url_sogou":
			checkSogouURL(request.__id, data.slug, data.url, data.keys);
		break;
		case "check_url_sgweixin":
			checkSGWeixinURL(request.__id, data.slug, data.url, data.keys);
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
const RANKLIMIT = 40;
const RANKGATE = 4;
const USE_REAL_URL = true;

function checkBaiduURL (tab, slug, url, keys) {
	console.log('Call: ' + url);
	ajax(url, {
		success: function (text) {
			console.log('Fetch:: ' + url);
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
			var links = [], real_url_tasks = 0;
			[].map.call(container, function (elem) {
				var title = elem.querySelector('h3.t');
				// 百度知道
				if (!title) {
					title = elem.querySelector('div.op_best_answer_content');
				}
				if (!title) return;
				title = title.querySelector('a');
				var link = title.href;
				title = title.innerText;
				var content = elem.querySelector('.c-abstract'), last;
				// Normal Page
				if (content) {
					// 去除百度知道等链接中的提问部分，这是干扰因素
					last = content.children;
					last = last[last.length - 1];
					if (last && last.nodeName && last.nodeName.toLowerCase() === 'a' && last.className === 'c') content.removeChild(last);
				}
				else {
					content = elem.querySelector('.c-row');
					// 百度百科、百度图片、百度知道
					if (content) {
						content = content.querySelector('p');
						// 百度图片
						if (!content) {
							content = elem.querySelector('.c-row .c-span-last')
							// 百度知道
							if (!content) {
								content = elem.querySelector('.c-row .op_best_answer_content');
							}
						}
					}
					else {
						content = elem.querySelector('table');
						// 百度贴吧
						if (content) {
							content = content.querySelector('.op-tieba-general-main-col');
						}
						else {

						}
					}
				}
				if (content) content = content.innerText;
				else content = '';
				var power = rankPower(keys);
				var rank = rankPage(content, keys, power);
				if (rank > RANKLIMIT) {
					if (USE_REAL_URL) {
						real_url_tasks ++;
						console.log('Seek >>>> ' + link);
						ajax(link, {
							success: function (text, xhr) {
								var real_url = xhr.responseURL;
								if (real_url !== link) {
									link = real_url;
								}
								else {
									real_url = text.match(/window\.location\.replace\(('|")([\w\W]+)\1\)/);
									if (real_url) {
										real_url = real_url[2];
										link = real_url;
									}
								}
							},
							always: function () {
								// 如果是简书上同一篇文章，则不记录在内
								var jianshu_check = link.match(URL_CHECKER);
								if (!jianshu_check || (jianshu_check[1] !== slug)) {
									links.push({
										title: title,
										link: link,
										rank: rank
									});
								}
								real_url_tasks --;
								if (real_url_tasks === 0) {
									send(tab, 'BaiduResult', {
										state: 'OK',
										result: links,
										slug: slug,
										url: url
									});
								}
							}
						});
					}
					else {
						links.push({
							title: title,
							link: link,
							rank: rank
						});
					}
				}
			});
			if (real_url_tasks === 0) {
				send(tab, 'BaiduResult', {
					state: 'OK',
					result: links,
					slug: slug,
					url: url
				});
			}
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
function checkBingURL (tab, slug, url, keys) {
	console.log('Call: ' + url);
	ajax(url, {
		success: function (text) {
			console.log('Fetch:: ' + url);
			text = convertPageToContent(text);
			var container = document.createElement('div');
			container.innerHTML = text;
			container = container.querySelector('#b_results');
			if (!container) {
				send(tab, 'BingResult', {
					state: 'ParseError',
					slug: slug,
					url: url
				});
				return;
			}
			container = container.querySelectorAll('li.algo');
			var links = [];
			[].map.call(container, function (elem) {
				var title = elem.querySelector('h2').querySelector('a');
				if (!title) return;
				var link = title.href;
				// 如果是简书上同一篇文章，则不记录在内
				var jianshu_check = link.match(URL_CHECKER);
				if (jianshu_check && (jianshu_check[1] === slug)) return;
				title = title.innerText;
				var content = elem.querySelector('.b_caption');
				content = content.querySelector('p');
				content = content.innerText;
				var power = rankPower(keys);
				var rank = rankPage(content, keys, power);
				if (rank > RANKLIMIT) {
					links.push({
						title: title,
						link: link,
						rank: rank
					});
				}
			});
			send(tab, 'BingResult', {
				state: 'OK',
				result: links,
				slug: slug,
				url: url
			});
		},
		fail: function () {
			send(tab, 'BingResult', {
				state: 'FetchError',
				slug: slug,
				url: url
			});
		}
	});
}
function checkSogouURL (tab, slug, url, keys) {
	console.log('Call: ' + url);
	ajax(url, {
		success: function (text) {
			console.log('Fetch:: ' + url);
			text = convertPageToContent(text);
			var container = document.createElement('div'), error = false;
			try {
				container.innerHTML = text;
				container = container.querySelectorAll('div.results>div');
				if (!container || container.length === 0) error = true;
			}
			catch (err) {
				error = true;
			}
			if (error) {
				send(tab, 'SogouResult', {
					state: 'ParseError',
					slug: slug,
					url: url
				});
				return;
			}
			var links = [], real_url_tasks = 0;
			[].map.call(container, function (elem) {
				var title, link, error = false;
				try {
					title = elem.querySelector('h3>a');
					if (!title) error = true;
					link = title.href;
					title = title.innerText;
				}
				catch (err) {
					error = true;
				}
				if (error) return;
				var content = elem.querySelector('div.fb');
				content = content.previousElementSibling;
				content = content.innerText;
				var power = rankPower(keys);
				var rank = rankPage(content, keys, power);
				if (rank > RANKLIMIT) {
					if (USE_REAL_URL) {
						real_url_tasks ++;
						console.log('Seek >>>> ' + link);
						ajax(link, {
							success: function (text, xhr) {
								var real_url, error = false;
								try {
									real_url = xhr.responseURL;
								}
								catch (err) {
									error = true;
								}
								if (error) return;
								if (real_url !== link) {
									link = real_url;
								}
								else {
									try {
										real_url = text.match(/window\.location\.replace\(('|")([\w\W]+)\1\)/);
									}
									catch (err) {
										error = true;
									}
									if (error) return;
									if (real_url) {
										real_url = real_url[2];
										link = real_url;
									}
								}
							},
							always: function () {
								// 如果是简书上同一篇文章，则不记录在内
								var jianshu_check = link.match(URL_CHECKER);
								if (!jianshu_check || (jianshu_check[1] !== slug)) {
									links.push({
										title: title,
										link: link,
										rank: rank
									});
								}
								real_url_tasks --;
								if (real_url_tasks === 0) {
									send(tab, 'SogouResult', {
										state: 'OK',
										result: links,
										slug: slug,
										url: url
									});
								}
							}
						});
					}
					else {
						links.push({
							title: title,
							link: link,
							rank: rank
						});
					}
				}
			});
			if (real_url_tasks === 0) {
				send(tab, 'SogouResult', {
					state: 'OK',
					result: links,
					slug: slug,
					url: url
				});
			}
		},
		fail: function () {
			send(tab, 'SogouResult', {
				state: 'FetchError',
				slug: slug,
				url: url
			});
		}
	});
}
function checkSGWeixinURL (tab, slug, url, keys) {
	console.log('Call: ' + url);
	ajax(url, {
		success: function (text) {
			console.log('Fetch:: ' + url);
			text = convertPageToContent(text);
			var container = document.createElement('div'), error = false;
			try {
				container.innerHTML = text;
				container = container.querySelectorAll('div.results>div.wx-rb');
				if (!container || container.length === 0) error = true;
			}
			catch (err) {
				error = true;
			}
			if (error) {
				send(tab, 'SogouResult', {
					state: 'ParseError',
					slug: slug,
					url: url
				});
				return;
			}
			var links = [], real_url_tasks = 0;
			[].map.call(container, function (elem) {
				var title, link, error = false;
				try {
					title = elem.querySelector('h4>a');
					if (!title) error = true;
					if (!error) {
						link = 'http://weixin.sogou.com' + title.getAttribute('href');
						title = title.innerText;
					}
				}
				catch (err) {
					error = true;
				}
				if (error) return;
				var content = elem.querySelector('h4');
				content = content.nextElementSibling;
				content = content.innerText;
				var power = rankPower(keys);
				var rank = rankPage(content, keys, power);
				if (rank > RANKLIMIT) {
					if (USE_REAL_URL) {
						real_url_tasks ++;
						console.log('Seek >>>> ' + link);
						ajax(link, {
							success: function (text, xhr) {
								var real_url, error = false;
								try {
									real_url = xhr.responseURL;
								}
								catch (err) {
									error = true;
								}
								if (error) return;
								if (real_url !== link) {
									link = real_url;
								}
								else {
									try {
										real_url = text.match(/window\.location\.replace\(('|")([\w\W]+)\1\)/);
									}
									catch (err) {
										error = true;
									}
									if (error) return;
									if (real_url) {
										real_url = real_url[2];
										link = real_url;
									}
								}
							},
							always: function () {
								// 如果是简书上同一篇文章，则不记录在内
								var jianshu_check = link.match(URL_CHECKER);
								if (!jianshu_check || (jianshu_check[1] !== slug)) {
									links.push({
										title: title,
										link: link,
										rank: rank
									});
								}
								real_url_tasks --;
								if (real_url_tasks === 0) {
									send(tab, 'SogouResult', {
										state: 'OK',
										result: links,
										slug: slug,
										url: url
									});
								}
							}
						});
					}
					else {
						links.push({
							title: title,
							link: link,
							rank: rank
						});
					}
				}
			});
			if (real_url_tasks === 0) {
				send(tab, 'SogouResult', {
					state: 'OK',
					result: links,
					slug: slug,
					url: url
				});
			}
		},
		fail: function () {
			send(tab, 'SogouResult', {
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
function rankPower (keys) {
	var total = 0;
	keys.map(function (line) {
		var score = line.length;
		score -= RANKGATE;
		if (score < 0) score = 0;
		total += score;
	});
	if (total === 0) total = 1;
	return total;
}
function rankPage (page, keys, power) {
	var rank = 0;
	keys.map(function (line) {
		var score = line.length;
		score -= RANKGATE;
		if (score < 0) score = 0;
		if (page.indexOf(line) >= 0) rank += score;
	});
	rank /= power;
	rank *= 100;
	return rank;
}