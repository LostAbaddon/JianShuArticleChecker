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
	})
});

// Functons
const TRIM = /^\s+|\s+$/g;
const SYMBOLS = /[\?,\.;:'"`!=\+\*\\\/_~<>\(\)\[\]\{\}\|@#\$\%\^\&－＋＝—？！／、《》【】｛｝（）×｀～＠＃￥％…＆&｜“”‘’；：，。·〈〉〖〗［］「」『』　]/g;

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

const USEBAIDU = true;
const QUERYBAIDU = 'https://www.baidu.com/s?wd=';
const USEBING = false;
const QUERYBING = 'http://cn.bing.com/search?q=';

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
			var baidu, bing, power = line.replace(/ +/g, '').length;
			if (USEBAIDU) {
				baidu = QUERYBAIDU + line.replace(/ /mg, '%20');
				task[baidu] = {
					done: false,
					result: null,
					power: power,
					line: line,
				};
			}
			if (USEBING) {
				bing = QUERYBING + line.replace(/ /mg, '+');
				task[bing] = {
					done: false,
					result: null,
					power: power,
					line: line,
				};
			}
			line = line.split(' ');
			if (USEBAIDU) send('check_url_baidu', {
				slug: slug,
				url: baidu,
				keys: line
			});
			if (USEBING) send('check_url_bing', {
				slug: slug,
				url: bing,
				keys: line
			});
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

function analyzeTasks (slug) {
	var result = [];
	var task_list = tasks[slug], task_keys = Object.keys(task_list);
	var html = '', total = 0, rank = 0, class_rank = 0, class_total = 0, rank_shift = 1, class_shift_red = true;

	// 计算额外权重
	task_keys.map(function (url) {
		var task = task_list[url], max = 0;
		total += Math.pow(task.power, POWERPOWER); // 计算总长度权重
		class_total ++; // 总额外权重
		task.result.map(function (site) {
			if (site.rank > max) max = site.rank;
		});
		class_rank += max / 100;
	});
	// 计算额外权重分界阀值
	rank_shift = class_total * CLASSRANKGATE;
	if (rank_shift < 1) rank_shift = 1;
	// 计算额外权重
	if (class_rank < rank_shift) {
		class_shift_red = true;
		rank_shift = class_rank / rank_shift;
		rank_shift = Math.pow(rank_shift, CLASSREDSHIFTPOWER);
	}
	else {
		class_shift_red = false;
		rank_shift = (class_total - class_rank) / (class_total - rank_shift);
		rank_shift = Math.pow(rank_shift, CLASSBLUESHIFTPOWER);
	}
	// 计算长度权重
	task_keys.map(function (url) {
		var task = task_list[url];
		task.power = Math.pow(task.power, POWERPOWER) / total;
	});
	// 计算每篇文章的权重
	task_keys.map(function (url) {
		var task = task_list[url];
		var search_url = task.url;
		var power = task.power;
		var line = task.line;
		task.result.map(function (site) {
			site.search_url = search_url;
			site.power = power;
			site.line = line;
			result.push(site);
		});
	});
	// 整理结果
	result.sort(function (site1, site2) {
		var result = 0;
		if (site2.title > site1.title) result = 1;
		else if (site2.title < site1.title) result = -1;
		if (result === 0) {
			if (site2.line > site1.line) result = 1;
			else if (site2.line < site1.line) result = -1;
		}
		if (result === 0) result = site2.rank - site1.rank;
		return result;
	});

	// Append Result
	if (result.length > 0) {
		rank = 0;
		total = 1 / result.length;
		result.map(function (site) {
			rank += Math.pow(site.rank, RANKPOWER) * site.power * total;
		});
		rank = Math.pow(rank, 1 / RANKPOWER);
		if (class_shift_red) {
			rank *= rank_shift;
		}
		else {
			rank = 100 - rank;
			rank *= rank_shift;
			rank = 100 - rank;
		}
		html = '<div class="crx_action_area"><button class="action_samearticle">自动生成回复</button></div>';
		html += '<div class="crx_samearticle_mention">本文在网上有相似文章的总概率为：' + (Math.round(rank * 100) / 100) + '％</div>';
		html += '<div class="crx_samearticle_mention">下列文章与本文很相似：</div>';
		articles_mention = '以下文章与您这篇文章非常相似：\n\n';
		result.map(function (site) {
			console.log(site.title, Math.round(site.rank), site.link, site.line);
			html += '<div class="crx_samearticle_lemma"><a class="crx_samearticle_link" href="' + site.link + '" target="_blank">' + site.title + '</a><span class="crx_samearticle_rate">局部相似度：' + (Math.round(site.rank * 100) / 100) + '％</span><span class="crx_samearticle_rate"><a href="' + site.search_url + '" target="_blank">查看搜索页</a></span></div>';
			articles_mention += '《' + site.title + '》（' + site.link + '）\n';
		});
	}
	else {
		html += '<div class="crx_samearticle_mention">目前网上没有文章与这篇文章相似！</div>';
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