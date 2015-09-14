// Basic
var send = function (action, msg, callback) {
	chrome.runtime.sendMessage({action: action, msg: msg}, callback);
};

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
	var msg = request.msg;
	switch (request.action) {
		case "log":
			console.log('log: ', msg);
		break;
		case "CheckArticle":
			CheckArticle(msg);
		break;
		case "BaiduResult":
			getCheckResult(msg.slug, msg.url, msg.state, msg.result);
		break;
		case "BingResult":
			getCheckResult(msg.slug, msg.url, msg.state, msg.result);
		break;
		case "SogouResult":
			getCheckResult(msg.slug, msg.url, msg.state, msg.result);
		break;
		// default:
		// 	console.log("Get Request:");
		// 	console.log(request);
	}
});

// Initial
var frame, frame_content, articles_mention = '';
document.addEventListener('DOMContentLoaded', function () {
	var body = document.body;
	// 创建提示UI
	frame = newUI('div', 'crx_frame hide');
	// 内容呈现
	frame_content = newUI('div', 'crx_content');
	frame.appendChild(frame_content);
	// 添加到页面
	body.appendChild(frame);

	// 提示UI内事件
	frame.addEventListener('click', function (e) {
		var target = e.target;
		var comment = document.querySelector('#comment_content');
		// 自动生成字数太少的回复
		if (target.classList.contains('action_wordage')) {
			hideFrame();
			comment.textContent = '抱歉，简书首页对文章的篇幅是有一定要求的（诗歌除外）！\n您的文章有点短哟！';
			comment.focus();
		}
		// 自动生成相似文章的回复
		else if (target.classList.contains('action_samearticle')) {
			hideFrame();
			comment.textContent = '抱歉，请问您是这篇文章的原作者么？\n因为在网上发现' + articles_mention + '\n所以想询问一下是否是原作者，避免错误处理。\n谢谢！';
			comment.focus
		}
		// 避免事件冒泡
		e.stopPropagation();
		e.cancelBubble = true;
	});
	// 关闭提示UI的事件
	body.addEventListener('click', function () {
		hideFrame();
	});
	// 快捷键
	body.addEventListener('keyup', function (e) {
		if ((e.altKey || e.ctrlKey || e.metaKey) && e.which === 83) {
			var url = location.href;
			url = url.match(URL_CHECKER);
			if (!!url) {
				url = url[1];
				CheckArticle(url);
			}
			e.stopPropagation();
			e.preventDefault();
			e.cancelBubble = true;
		}
	});
});

// Functons
const TRIM = /^\s+|\s+$/g;
const SYMBOLS = /[\?,\.;:'"`!=\+\*\\\/_~<>\(\)\[\]\{\}\|@#\$\%\^\&\-＋＝－？！／、《》【】｛｝（）×｀～＠＃￥％…＆&｜“”‘’；：，。·〈〉〖〗［］「」『』　]/g;

const LINENUM = 5;
const LINERATE = 0.16;
const RNDLINENUM = 3;
const RNDLINERATE = 0.09;
const MINLINELEN = 10;
const MAXLINELEN = 40;
const WORDAGELIMIT = 500;

const POWERPOWER = 3;
const RANKPOWER = 5;
const CLASSRANKGATE = 0.15;
const CLASSREDSHIFTPOWER = 2.5;
const CLASSBLUESHIFTPOWER = 1.5;
const KEYWORDRANKAMPLIFIER = 5;
const WILSONLIMIT = 0;
const PAGERANGELIMIT = 0.1;

const USEBAIDU = true;
const QUERYBAIDU = 'https://www.baidu.com/s?wd=';
const USEBING = false;
const QUERYBING = 'http://cn.bing.com/search?q=';
const USESOGOU = false;
const QUERYSOGOU = 'https://www.sogou.com/web?query=';
const USESGWEIXIN = false;
const QUERYSGWEIXIN = 'http://weixin.sogou.com/weixin?type=2&query=';

var tasks = {};

function CheckArticle (slug) {
	tasks[slug] = {};
	var task = tasks[slug];
	var article = document.querySelector('div.article');
	var wordage = article.querySelector('span.wordage');
	wordage = wordage.innerText;
	wordage = wordage.match(/\d+/);
	if (!!wordage) {
		wordage = wordage[0];
		wordage = parseInt(wordage);
	}
	else {
		wordage = 0;
	}
	var title = article.querySelector('h1.title');
	title = title.innerText;
	var content = article.querySelector('div.show-content');
	var image_count = content.querySelectorAll('img').length;
	var video_count = content.querySelectorAll('div.video-package').length;
	var origin = content.innerText;
	content = origin
		.split(/[。.!?！？;；\n]+/)
		.map(function (line) {
			return line.replace(SYMBOLS, ' ').replace(/[a-zA-Z\d]+/g, ' ').replace(/\s+/g, ' ').replace(TRIM, '');
		})
		.filter(function (line) {
			var len = line.replace(/ +/g, '').length;
			return (len >= MINLINELEN) && (len <= MAXLINELEN); // 百度搜索字段最长不得超过40字符
		})
		.sort(function (la, lb) {
			return lb.length - la.length;
		});
	var lines = [], len = content.length, index, i, limit;
	limit = Math.ceil(len * LINERATE);
	if (limit < LINENUM) limit = LINENUM;
	if (len > limit) len = limit;
	lines = content.splice(0, len);
	len = content.length;
	limit = Math.ceil(len * RNDLINERATE);
	if (limit < RNDLINENUM) limit = RNDLINENUM;
	if (len > limit) len = limit;
	for (i = 0; i < len; i++) {
		index = Math.floor(Math.random() * content.length);
		lines.push(content.splice(index, 1)[0]);
	}

	if (wordage < WORDAGELIMIT) {
		dealErrorTooLittle(wordage, image_count, video_count, origin);
	}
	else {
		frame_content.innerHTML = '<div class="crx_wordage_mention">检查相似文章中，请稍候……</div>';
		// Show UI
		showFrame();
		// Call Worker
		lines.map(function (line) {
			var url, power = line.replace(/ +/g, '').length, array = line.split(' ');
			if (USEBAIDU) {
				url = QUERYBAIDU + line.replace(/ /mg, '%20');
				task[url] = {
					done: false,
					result: null,
					power: power,
					line: line,
				};
				send('check_url_baidu', {
					slug: slug,
					url: url,
					keys: array
				});
			}
			if (USEBING) {
				url = QUERYBING + line.replace(/ /mg, '+');
				task[url] = {
					done: false,
					result: null,
					power: power,
					line: line,
				};
				send('check_url_bing', {
					slug: slug,
					url: url,
					keys: array
				});
			}
			if (USESOGOU) {
				url = QUERYSOGOU + line.replace(/ /mg, '+');
				task[url] = {
					done: false,
					result: null,
					power: power,
					line: line,
				};
				send('check_url_sogou', {
					slug: slug,
					url: url,
					keys: array
				});
			}
			if (USESGWEIXIN) {
				url = QUERYSGWEIXIN + line.replace(/ /mg, '+');
				task[url] = {
					done: false,
					result: null,
					power: power,
					line: line,
				};
				send('check_url_sgweixin', {
					slug: slug,
					url: url,
					keys: array
				});
			}
		});
	}
}

function getCheckResult (slug, url, state, result) {
	var task = tasks[slug][url];
	task.done = true;
	// Check State for Errors
	if (state === 'ParseError') {
		dealErrorParse(url);
		task.result = [];
	}
	else if (state === 'FetchError') {
		dealErrorFetch(url);
		task.result = [];
	}
	else {
		task.result = result;
		task.url = url;
	}
	// Check Tasks
	var left = checkTasks(slug);
	var total = Object.keys(tasks[slug]).length;
	frame_content.innerHTML = '<div class="crx_wordage_mention">检查相似文章中，请稍候…… (' + (total - left) + '/' + total + ')</div>';
	if (checkTasks(slug) === 0) {
		analyzeTasks(slug);
	}
}

function checkTasks (slug) {
	var task_list = tasks[slug];
	var doing = 0;
	Object.keys(task_list).map(function (url) {
		var task = task_list[url];
		if (!task.done) {
			doing++;
		}
	});
	return doing;
}

// 计算Wilson权重
function getWilsonIndex (total, number) {
	if (total < 1) total = 1;
	if (number < 0) return 0;
	if (number > total) number = total;
	var rate = number / total;
	var inverse = 1 / total;
	var result = rate + 2 / 3 * (1 - 2 * rate) * inverse - Math.sqrt(2 * rate * (1 - rate) * inverse);
	if (result > rate) result = rate;
	if (result < WILSONLIMIT) result = WILSONLIMIT;
	return result;
}

// 筛选出最相似的文章和最常见的句子
function analyzeTasks (slug) {
	var lists = tasks[slug], querys = Object.keys(lists);
	var keyword_list = {}, page_list = {};

	// 对相同页面的相同结果的规整
	// keyword_list 主关键字为查询内容，pages关键字为页面地址
	// page_list 主关键字为页面地址，rank关键字为查询内容
	querys.map(function (url) {
		var task = lists[url];
		var line = task.line;
		keyword_list[line] = keyword_list[line] || {
			line: line,
			power: task.power,
			querys: [],
			pages: []
		};
		var kw_info = keyword_list[line];
		var url = task.url;
		if (!url) return;
		if ((kw_info.querys.indexOf(url) < 0) && (task.result.length > 0)) kw_info.querys.push(url);
		task.result.map(function (page) {
			var link = page.link, pg = page_list[link], info;
			if (pg) {
				if (!!pg.rank[line]) {
					if (pg.rank[line] < page.rank) pg.rank[line] = page.rank;
				}
				else {
					pg.rank[line] = page.rank;
				}
			}
			else {
				info = {
					url: link,
					title: page.title,
					rank: {},
				};
				info.rank[line] = page.rank;
				page_list[link] = info;
			}
			if (kw_info.pages.indexOf(link) < 0) kw_info.pages.push(link);
		});
	});
	lists = null;

	// 计算长度权重
	var total_power = 0;
	querys = Object.keys(keyword_list);
	querys.map(function (keywords) {
		var task = keyword_list[keywords];
		task.power = Math.pow(task.power, POWERPOWER); // 计算长度权重
		total_power += task.power; // 计算总长度权重
		// 计算文章符合度
		var total = 0, index = 0;
		task.pages.map(function (page) {
			var page = page_list[page];
			total ++;
			index += page.rank[task.line] / 100;
		});
		task.match = getWilsonIndex(total * KEYWORDRANKAMPLIFIER, index * KEYWORDRANKAMPLIFIER);
	});
	querys.map(function (keywords) {
		var task = keyword_list[keywords];
		task.power /= total_power; // 归一化长度权重
	});
	// 过滤不匹配的关键字
	querys.map(function (keywords) {
		var task = keyword_list[keywords];
		if (task.pages.length === 0) {
			delete keyword_list[keywords];
		}
	});
	querys = Object.keys(keyword_list);
	// 计算总体符合度
	var keyword_match = 1;
	total_power = 0;
	querys.map(function (keywords) {
		var task = keyword_list[keywords];
		total_power += task.power;
		keyword_match *= Math.pow(1 - task.match, task.power);
	});
	keyword_match = Math.pow(keyword_match, 1 / total_power) || 1;
	keyword_match = 1 - keyword_match;

	// 结果排序
	lists = querys.map(function (line) {
		return keyword_list[line];
	});
	lists.sort(function (kw1, kw2) {
		return kw2.match - kw1.match;
	});

	// 分析单个页面与当前文章的匹配度
	var page_match = 1;
	total_power = 0;
	querys = Object.keys(page_list);
	querys.map(function (url) {
		var page = page_list[url], total = 0, index = 0;
		var ranks = Object.keys(page.rank);
		ranks.map(function (line) {
			var kw = keyword_list[line];
			total += kw.power;
			index += page.rank[line] * kw.power / 100;
		});
		index = index / total;
		total = ranks.length;
		page.match = getWilsonIndex(total, index * total);
		total_power += page.match;
		page_match *= Math.pow(1 - page.match, page.match);
	});
	page_match = Math.pow(page_match, 1 / total_power) || 1;
	page_match = 1 - page_match;
	// 过滤不匹配的页面
	querys.map(function (url) {
		var page = page_list[url];
		if (page.match < PAGERANGELIMIT) {
			delete page_list[url];
		}
	});
	querys = Object.keys(page_list);

	// 结果排序
	querys = querys.map(function (url) {
		return page_list[url];
	});
	querys.sort(function (pg1, pg2) {
		return pg2.match - pg1.match;
	});

	// 生成结果
	var html = '';
	if (keyword_match === 0 && page_match === 0) {
		html = '<div class="crx_samearticle_mention">目前网上没有文章与这篇文章相似！</div>';
	}
	else {
		html = '<div class="crx_action_area"><button class="action_samearticle">自动生成回复</button></div>';
		html += '<div class="crx_samearticle_mention">本文在网上有相似文章的总概率为：' + (Math.round(page_match * 10000) / 100) + '％，关键字匹配率为：' + (Math.round(keyword_match * 10000) / 100) + '％</div>';
		html += '<div class="crx_samearticle_mention">下列关键字与本文匹配度很高：</div>';
		lists.map(function (info) {
			html += '<div class="crx_samearticle_lemma">' + info.line + '<span class="crx_samearticle_rate">匹配度：' + (Math.round(info.match * 10000) / 100) + '％</span><span class="crx_samearticle_rate">匹配文章数：' + (info.pages.length) + '</span></div>';
		});
		html += '<div class="crx_samearticle_mention">　　　　</div>';
		html += '<div class="crx_samearticle_mention">下列文章与本文很相似：</div>';
		articles_mention = '以下文章与您这篇文章非常相似：\n\n';
		querys.map(function (page) {
			html += '<div class="crx_samearticle_lemma"><a class="crx_samearticle_link" href="' + page.url + '" target="_blank">' + page.title + '</a><span class="crx_samearticle_rate">相似度：' + (Math.round(page.match * 10000) / 100) + '％</span></div>';
			var ranks = Object.keys(page.rank);
			ranks.sort(function (pr1, pr2) {
				return page.rank[pr2] - page.rank[pr1];
			});
			ranks.map(function (rank) {
				var string = [], index = 0;
				keyword_list[rank].querys.map(function (query) {
					index ++;
					string.push('<a href="' + query + '" target="_blank">搜索页[' + index + ']</a>');
				});
				html += '<div class="crx_samearticle_lemma">　　<span class="crx_samearticle_rate">' + rank + '　　　　匹配度：' + (Math.round(page.rank[rank] * 100) / 100) + '%</span></div>';
				html += '<div class="crx_samearticle_lemma">　　　　<span class="crx_samearticle_rate">' + string.join('，') + '</span></div>';
			});
			articles_mention += '《' + page.title + '》（' + page.url + '）\n';
		});
	}

	// Set Mention
	frame_content.innerHTML = html;
	// Show UI
	showFrame();
}

function dealErrorTooLittle (wordage, images, videos, content) {
	// Set Mention
	frame_content.innerHTML = '<div class="crx_wordage_mention">字数太少！</div><div class="crx_action_area"><button class="action_wordage">自动生成回复</button></div>';
	// Show UI
	showFrame();
}
function dealErrorParse (url) {
	console.log('Parse Error: ' + url);
}
function dealErrorFetch (url) {
	console.log('Fetch Error: ' + url);
}

function showFrame () {
	frame.classList.remove('hide');
}
function hideFrame () {
	frame_content.innerHTML = '';
	frame.classList.add('hide');
}