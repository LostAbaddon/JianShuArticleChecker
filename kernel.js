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
		else {
			console.log(e);
		}
		// 避免事件冒泡
		e.stopPropagation();
		e.preventDefault();
		e.cancelBubble = true;
	});
	// 关闭提示UI的事件
	body.addEventListener('click', function () {
		hideFrame();
	});
});

// Functons
const TRIM = /^\s+|\s+$/g;
const SYMBOLS = /[\?,\.;:'"`!=\+\*\\\/_~<>\(\)\[\]\{\}\|@#\$\%\^\&－＋＝—？！／、《》【】｛｝（）×｀～＠＃￥％…＆&｜“”‘’；：，。·〈〉〖〗［］「」『』　]/g;

const LINENUM = 1;
const WORDAGELIMIT = 500;

const QUERYBAIDU = 'https://www.baidu.com/s?wd=';
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
		.split(/[。.\n]+/)
		.map(function (line) {
			return line.replace(SYMBOLS, ' ').replace(/[a-zA-Z\d]+/g, ' ').replace(/\s+/g, ' ').replace(TRIM, '');
		})
		.filter(function (line) {
			var len = line.length;
			return (len > 0) && (len <= 40); // 百度搜索字段最长不得超过40字符
		})
		.sort(function (la, lb) {
			return lb.length - la.length;
		});
	var lines = [], len = content.length, index, i;
	if (len > LINENUM) len = LINENUM;
	lines = content.splice(0, len);
	len = content.length;
	if (len > LINENUM) len = LINENUM;
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
			var baidu = QUERYBAIDU + line.replace(/ /mg, '%20');
			var bing = QUERYBING + line.replace(/ /mg, '+');
			task[baidu] = {
				done: false,
				result: null
			};
			task[bing] = {
				done: false,
				result: null
			};
			line = line.split(' ');
			send('check_url_baidu', {
				slug: slug,
				url: baidu,
				keys: line
			});
			send('check_url_bing', {
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
	task.result = result;
	// Check State for Errors
	if (state === 'ParseError') {
		dealErrorParse(url);
	}
	else if (state === 'FetchError') {
		dealErrorFetch(url);
	}
	// Check Tasks
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
	var task_list = tasks[slug];
	Object.keys(task_list).map(function (url) {
		task_list[url].result.map(function (site) {
			result.push(site);
		});
	});
	result.sort(function (site1, site2) {
		var result = site2.rank - site1.rank;
		if (result === 0) result = site1.title.length - site2.title.length;
		return result;
	});

	// Append Result
	var html = '';
	if (result.length > 0) {
		html = '<div class="crx_action_area"><button class="action_samearticle">自动生成回复</button></div>';
		html += '<div class="crx_samearticle_mention">下列文章与本文很相似：</div>';
		articles_mention = '以下文章与您这篇文章非常相似：\n\n';
		result.map(function (site) {
			html += '<div class="crx_samearticle_lemma"><a class="crx_samearticle_link" href="' + site.link + '" target="_blank">' + site.title + '</a><span class="crx_samearticle_rate">相似度：' + site.rank + '</span></div>';
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






// UnUsed
function show (msg) {
	openElement(mention);
	mention.innerHTML = msg;
}

function getCollectionID () {
	return window.location.pathname.replace(/^\/collection\//, '');
}

function statistics (from, to, records) {
	show('Start Statistics');
	start_time = new Date().getTime();

	from = from.toLowerCase().trim();
	to = to.toLowerCase().trim();
	var list = document.querySelectorAll('#list-container li');
	var indexFrom = -1, indexTo = -1, i = 0;
	var links = [].map.call(list, function (article) {
		var link = article.querySelector('h5 a');
		var title = link.innerHTML;
		if (!!title.match(/^[#《].+?([总小]结|好文推荐)$/)) return null;
		title = title.toLowerCase().trim();
		var slug = link.getAttribute('href');
		if (slug) {
			slug = slug.replace('/p/', '');
			slug = slug.toLowerCase().trim();
		}
		var comment = article.querySelector('.fa-comments-o');
		var like = article.querySelector('.like-icon-button');
		// console.log(title, from, title === from, to, title === to);
		if (title === from || slug === from) indexFrom = i;
		if (title === to || slug === to) indexTo = i;
		if (comment) {
			comment = comment.parentElement.innerText.trim() * 1;
		}
		else {
			comment = -1;
		}
		if (like) {
			like = like.innerText.trim() * 1;
		}
		else {
			like = -1;
		}
		i++;
		return [title, slug, article, comment, like];
	});
	if (indexFrom === -1 || indexTo === -1) {
		console.log('From:', indexFrom, 'To:', indexTo);
		return true;
	}
	if (indexFrom > indexTo) {
		indexTo = indexFrom + indexTo;
		indexFrom = indexTo - indexFrom;
		indexTo = indexTo - indexFrom;
	}
	i = 0;
	list = links.filter(function (article) {
		if (article === null) return false;
		if (i >= indexFrom && i <= indexTo) {
			i++;
			return true;
		}
		i++;
		return false;
	});
	console.log('Get Links:', list.length);

	setTimeout(function () {
		console.log('Start Page-Loading and Analyzing...');
		loadAndStatic(list, records);
	}, 0);
	return true;
}

const AVE_READ = 200;
const AVE_ACT = 10;
function getWilsonIndex (total, number) {
	total -= 10;
	if (total < 1) total = 1;
	number -= 5;
	if (number < 0) return 0;
	if (number > total) number = total;
	// total = Math.log(total / AVE_READ + 1);
	number = Math.log(number / AVE_ACT + 1) * AVE_READ; // 去除累进优势 //
	var rate = number / total;
	var inverse = 1 / total;
	var result = rate + 2 / 3 * (1 - 2 * rate) * inverse - Math.sqrt(2 * rate * (1 - rate) * inverse);
	if (result > rate) result = rate;
	return result;
}

function loadAndStatic (list, records) {
	var total = list.length, articles = [], loaded = {};
	function readPage (text, like, comment) {
		text = text.replace(/<!DOCTYPE .*?>\n*/gi, '');
		text = text.replace(/<\/?(html|body).*?>\n*/gi, '');
		text = text.replace(/<head.*?>[\w\W]*<\/head>\n*/gi, '');
		text = text.replace(/<!--[\w\W]*?-->\n*/gi, '');
		var article = document.createElement('div'), temp;
		article.innerHTML = text;
		var content = getContent(article.querySelector('.show-content'));
		var title = article.querySelector('h1').innerText.trim().replace(/\|/g, '｜').replace(/《/g, '〈').replace(/》/g, '〉');
		temp = article.querySelector('.author-info .info-r>p>a');
		var author = {
			name : temp.innerText.replace(/\n/gi, '').trim(),
			url : temp.getAttribute('href')
		};
		temp = article.querySelector('script[data-name=note]').innerHTML;
		temp = eval('(' + temp + ')');
		var wordage = temp.wordage || 0;
		var readCount = temp.views_count || 0;
		if (like < 0) like = temp.likes_count || 0;
		return {
			title: title,
			author: author.name,
			authorURL: author.url,
			read: readCount,
			word: wordage,
			like: like,
			comment: comment,
			content: content
		}
	}
	function loadPage (index) {
		var slug = list[index][1], comment = list[index][3], like = list[index][4], url = '/p/' + slug;
		ajax(
			url,
			{
				ready: function () {
					index ++;
					if (index < total) loadPage(index);
				},
				success: function (text) {
					var result = readPage(text, like, comment);
					result.url = url;
					result.slug = slug;
					result.likeRate = getWilsonIndex(result.read, result.like) * 100;
					result.commentRate = getWilsonIndex(result.read, result.comment) * 100;
					result.likePerKWord = getWilsonIndex(result.word, result.like) * 1000;
					result.commentPerKWord = getWilsonIndex(result.word, result.comment) * 1000;
					articles.push(result);
					loaded[result.slug] = true;
					send('AnalyzeKeyWord', {
						slug: slug,
						content: result.content,
						title: result.title,
						author: {
							name: result.author,
							url: result.authorURL
						},
						like: result.like
					});
					delete result.content;
				},
				fail: function (err) {
				},
				always: function () {
					show('完成度：' + index + '/' + total);
					if (index === total) {
						// Combine the saved records //
						Object.keys(records).map(function (slug) {
							if (!loaded[slug]) {
								articles.push(records[slug]);
							}
						});
						analyzeArticles(articles);
					}
				}
			}
		);
	}
	show('完成度：' + 0 + '/' + total);
	loadPage(0);
}

const SHOW_MENTIONED_AUTHORS = true;
const HOST_URL = 'http://www.jianshu.com';
function createArticleReport (articles) {
	show('分析中...');

	// 将数据保存到Servo端 //
	sendToServoAndSave(articles);

	var results = '#卷首语\n\n　　大家好，我是简书总结者，[LostAbaddon](http://www.jianshu.com/users/sbLy2t)。\n\n----\n\n';
	results += '#上周活动数据统计\n\n　　**一如既往，本活动的统计将剔除四大刷赞文——干货文，工具文，单列文，鸡汤文（含成功学）。**\n\n';

	var num, MAX = 10, MAX2 = 10, mentions = [], mentions2 = [];
	function arrangeArticle (itemName, words, title, options) {
		results += '\n###' + title + '：\n';
		if (options && options.description) {
			results += '\n　　**' + options.description + '**\n';
		}
		if (options && options.hideData) {
			results += '\n| |作者|文章|';
			results += '\n|-|-|-|';
		}
		else {
			results += '\n| |作者|文章|' + words.title + '|';
			results += '\n|-|-|-|-|';
		}
		var isSingle = (typeof itemName === 'string');
		if (isSingle) {
			articles.sort(function (a1, a2) {
				return a2[itemName] - a1[itemName];
			});
		}
		else {
			articles.sort(function (a1, a2) {
				var v1 = a1, v2 = a2;
				var t = itemName.length, i;
				for (i = 0; i < t; i++) {
					v1 = v1[itemName[i]];
					v2 = v2[itemName[i]];
				}
				return v2 - v1;
			});
		}
		num = MAX;
		var table_index = 1;
		articles.some(function (article) {
			var value, t, i, extras = '';
			if (isSingle) {
				value = article[itemName];
			}
			else {
				value = article;
				t = itemName.length;
				for (i = 0; i < t; i++) {
					value = value[itemName[i]];
				}
			}
			if (options) {
				if (options.calculate) {
					value = options.calculate(value);
				}
				if (options.extras) {
					t = options.extras.length;
					for (i = 0; i < t; i++) {
						extras += '' + options.extras[i].title + article[options.extras[i].item] + options.extras[i].end;
					}
				}
			}
			if (num > 0) {
				if (mentions.indexOf(article.author) === -1) mentions.push(article.author);
				if (num + MAX2 > MAX && mentions2.indexOf(article.author) === -1) mentions2.push(article.author);
				// results += '\n1. [' + article.author + '](' + HOST_URL + article.authorURL + ')的[《' + article.title + '》](' + HOST_URL + article.url + ')　　' + words.pro + value + words.post + extras;
				if (options && options.hideData) {
					results += '\n|' + table_index + '|[' + article.author + '](' + HOST_URL + article.authorURL + ')|[《' + article.title + '》](' + HOST_URL + article.url + ')|';
				}
				else if (options && options.showItem === false) {
					results += '\n|' + table_index + '|[' + article.author + '](' + HOST_URL + article.authorURL + ')|[《' + article.title + '》](' + HOST_URL + article.url + ')|' + extras + '|';
				}
				else {
					results += '\n|' + table_index + '|[' + article.author + '](' + HOST_URL + article.authorURL + ')|[《' + article.title + '》](' + HOST_URL + article.url + ')|' + value + (extras.length > 0 ? '　｜　' : '') + extras + '|';
				}
				table_index++;
			}
			num --;
			article._select++;
			return num <= 0;
		});
		results += '\n\n';
	}
	function arrangeAuthor (itemName, words, title, options) {
		results += '\n###' + title + '：\n';
		if (options && options.description) {
			results += '\n　　**' + options.description + '**\n';
		}
		if (options && options.hideData) {
			results += '\n| |作者|';
			results += '\n|-|-|';
		}
		else {
			results += '\n| |作者|' + words.title + '|';
			results += '\n|-|-|-|';
		}
		var isSingle = (typeof itemName === 'string');
		if (isSingle) {
			authors.sort(function (a1, a2) {
				return authorInfo[a2][itemName] - authorInfo[a1][itemName];
			});
		}
		else {
			authors.sort(function (a1, a2) {
				var v1 = authorInfo[a1], v2 = authorInfo[a2];
				var t = itemName.length, i;
				for (i = 0; i < t; i++) {
					v1 = v1[itemName[i]];
					v2 = v2[itemName[i]];
				}
				return v2 - v1;
			});
		}
		num = MAX;
		var table_index = 1;
		authors.some(function (author) {
			var value, t, i, extras = '', info = authorInfo[author];
			if (isSingle) {
				value = info[itemName];
			}
			else {
				value = info;
				t = itemName.length;
				for (i = 0; i < t; i++) {
					value = value[itemName[i]];
				}
			}
			if (options) {
				if (options.calculate) {
					value = options.calculate(value);
				}
				if (options.extras) {
					t = options.extras.length;
					for (i = 0; i < t; i++) {
						extras += '' + options.extras[i].title + info[options.extras[i].item] + options.extras[i].end;
					}
				}
			}
			if (num > 0) {
				if (mentions.indexOf(author) === -1) mentions.push(author);
				if (num + MAX2 > MAX && mentions2.indexOf(author) === -1) mentions2.push(author);
				// results += '\n1. [' + author + '](' + HOST_URL + info.url + ')　　' + words.pro + value + words.post + extras;
				if (options && options.hideData) {
					results += '\n|' + table_index + '|[' + author + '](' + HOST_URL + info.url + ')|';
				}
				else if (options && options.showItem === false) {
					results += '\n|' + table_index + '|[' + author + '](' + HOST_URL + info.url + ')|' + extras + '|';
				}
				else {
					results += '\n|' + table_index + '|[' + author + '](' + HOST_URL + info.url + ')|' + value + (extras.length > 0 ? '　｜　' : '') + extras + '|';
				}
			}
			table_index++;
			num --;
			return num <= 0;
		});
		results += '\n\n';
	}

	results += '\n\n----\n'

	// Get totals:
	var total = articles.length, wordages = 0, readers = 0, likes = 0, comments = 0, authors = [], authorInfo = {};
	articles.map(function (article) {
		article.arrange = {};
		wordages += article.word;
		readers += article.read;
		likes += article.like;
		comments += article.comment;
		if (authors.indexOf(article.author) < 0) {
			authors.push(article.author);
			authorInfo[article.author] = {url: article.authorURL, articles: []};
			authorInfo[article.author].articles.push(article);
		}
		else {
			authorInfo[article.author].articles.push(article);
		}
	});
	results += '\n##整体情况：\n';
	results += '\n　　本次活动统计从[' + articles[articles.length - 1].author + '](' + HOST_URL + articles[articles.length - 1].authorURL + ')的[《' + articles[articles.length - 1].title + '》](' + HOST_URL + articles[articles.length - 1].url + ')到[' + articles[0].author + '](' + HOST_URL + articles[0].authorURL + ')的[《' + articles[0].title + '》](' + HOST_URL + articles[0].url + ')，总共收到了来自' + authors.length + '位作者的' + total + '篇文章，共计' + wordages + '字。';
	results += '\n　　共有' + readers + '人次阅读，收获了' + likes + '个赞，引发了' + comments + '条讨论。';
	results += '\n\n>　　\n';
	results += '\n----\n'

	// GetLists
	function round (v) {
		result = Math.round(v * 100) / 100;
		result = '' + result;
		if (result.indexOf('.') >= 0) {
			while (result.length < 4) result = result + '0';
			if (result.length > 4) result = result.substring(0, 4);
		}
		else {
			result = result + '.';
			while (result.length < 4) result = result + '0';
		}
		return result;
	}

	var ALR = 10, ALK = 8, ACR = 5, ACM = 3;

	// Recommendation Index
	num = articles.length;
	articles.sort(function (art1, art2) {
		return art2.like - art1.like;
	}).map(function (article) {
		article.arrange.like = num * num;
		num--;
	});
	num = articles.length;
	articles.sort(function (art1, art2) {
		return art2.likeRate - art1.likeRate;
	}).map(function (article) {
		article.arrange.likeRate = num * num;
		num--;
	});
	num = articles.length;
	articles.sort(function (art1, art2) {
		return art2.comment - art1.comment;
	}).map(function (article) {
		article.arrange.comment = num * num;
		num--;
	});
	num = articles.length;
	articles.sort(function (art1, art2) {
		return art2.commentRate - art1.commentRate;
	}).map(function (article) {
		article.arrange.commentRate = num * num;
		num--;
	});
	articles.map(function (article) {
		var arrange = article.arrange;
		article.recommendation = arrange.likeRate * ALR + arrange.like * ALK + arrange.commentRate * ACR + arrange.comment * ACM;
	});

	authors.map(function (author) {
		var info = authorInfo[author];
		var articles = info.articles;
		info.arrange = {};
		info.word = 0;
		info.read = 0;
		info.like = 0;
		info.comment = 0;
		info.collect = 0;
		articles.map(function (article) {
			info.word += article.word;
			info.read += article.read;
			info.like += article.like;
			info.comment += article.comment;
		});
		info.likeRate = getWilsonIndex(info.read, info.like) * 100;
		info.commentRate = getWilsonIndex(info.read, info.comment) * 100;
		info.likePerKWord = getWilsonIndex(info.word, info.like) * 1000;
		info.commentPerKWord = getWilsonIndex(info.word, info.comment) * 1000;
	});

	num = authors.length;
	authors.sort(function (info1, info2) {
		info1 = authorInfo[info1];
		info2 = authorInfo[info2];
		return info2.like - info1.like;
	}).map(function (info) {
		authorInfo[info].arrange.like = num * num;
		num--;
	});
	num = authors.length;
	authors.sort(function (info1, info2) {
		info1 = authorInfo[info1];
		info2 = authorInfo[info2];
		return info2.likeRate - info1.likeRate;
	}).map(function (info) {
		authorInfo[info].arrange.likeRate = num * num;
		num--;
	});
	num = authors.length;
	authors.sort(function (info1, info2) {
		info1 = authorInfo[info1];
		info2 = authorInfo[info2];
		return info2.comment - info1.comment;
	}).map(function (info) {
		authorInfo[info].arrange.comment = num * num;
		num--;
	});
	num = authors.length;
	authors.sort(function (info1, info2) {
		info1 = authorInfo[info1];
		info2 = authorInfo[info2];
		return info2.commentRate - info1.commentRate;
	}).map(function (info) {
		authorInfo[info].arrange.commentRate = num * num;
		num--;
	});
	authors.map(function (info) {
		info = authorInfo[info];
		var arrange = info.arrange;
		info.recommendation = arrange.likeRate * ALR + arrange.like * ALK + arrange.commentRate * ACR + arrange.comment * ACM;
	});

	// Recommendations:
	results += "\n##上周最受欢迎：\n";

	// Recommendation Most
	arrangeArticle('recommendation', {pro: '', post: '', title: '推荐指数'}, '上周最受欢迎文章', {hideData: true});
	results += ">　　这是根据两份点赞榜与两份评论榜综合统计出的上周最受欢迎文章，大家鼓掌！\n　　在下文会具体介绍这些文章，大家不要着急哦～～\n";

	// Recommendation Most
	arrangeAuthor('recommendation', {pro: '', post: '', title: '推荐指数'}, '上周最受欢迎作者', {hideData: true});
	results += ">　　这是根据两份点赞榜与两份评论榜综合统计出的上周最受欢迎作者，大家鼓掌！\n　　在下文会着重介绍这几位作者哦～～\n";

	results += "\n----\n";

	results += '\n##文章榜单：\n';

	// Like Most
	arrangeArticle('like', {pro: '共获得', post: '个赞', title: '点赞数'}, '总点赞榜');
	// LR Most
	arrangeArticle('likeRate',
		{
			pro: '转化率为：',
			post: 'LPR',
			title: '点赞／阅读'
		},
		'均点赞榜',
		{
			showItem: false,
			calculate: round,
			extras: [{
				title: '',
				item: 'like',
				end: '／'
			}, {
				title: '',
				item: 'read',
				end: ''
			}]
		}
	);
	results += ">　　这两份分别是总点赞榜与均点赞榜。\n";
	// Comment Most
	arrangeArticle('comment', {pro: '共有', post: '条评论', title: '评论数'}, '总评论榜');
	// CR Most
	arrangeArticle('commentRate',
		{
			pro: '转化率为：',
			post: 'CPR',
			title: '评论／阅读'
		},
		'均评论榜',
		{
			showItem: false,
			calculate: round,
			extras: [{
				title: '',
				item: 'comment',
				end: '／'
			}, {
				title: '',
				item: 'read',
				end: ''
			}]
		}
	);
	results += ">　　这两份分别是总评论榜与均评论榜。\n";
	// Read Most
	arrangeArticle('read', {pro: '共有', post: '人次阅读', title: '阅读量'}, '阅读榜');
	results += ">　　传播就是王道！\n";
	// Word Most
	arrangeArticle('word', {pro: '共有', post: '字', title: '字数'}, '字数榜');
	results += ">　　个人一直相信，能坚持写出长文的，必然也是有一定质量保证的！\n";

	results += '\n----\n';

	// Author Analyze
	results += '\n##作者榜单：\n';

	// Like Most
	arrangeAuthor('like', {pro: '共获得', post: '个赞', title: '点赞数'}, '总点赞榜');
	// LR Most
	arrangeAuthor('likeRate',
		{
			pro: '转化率为：',
			post: 'LPR',
			title: '点赞／阅读'
		},
		'均点赞榜',
		{
			showItem: false,
			calculate: round,
			extras: [{
				title: '',
				item: 'like',
				end: '／'
			}, {
				title: '',
				item: 'read',
				end: ''
			}]
		}
	);
	// Comment Most
	arrangeAuthor('comment', {pro: '共引发', post: '条评论', title: '评论数'}, '总评论榜');
	// CR Most
	arrangeAuthor('commentRate',
		{
			pro: '转化率为：',
			post: 'CPR',
			title: '评论／阅读'
		},
		'均评论榜',
		{
			showItem: false,
			calculate: round,
			extras: [{
				title: '',
				item: 'comment',
				end: '／'
			}, {
				title: '',
				item: 'read',
				end: ''
			}]
		}
	);
	results += ">　　这四份榜单上的作者，每一位都可以独当一面哦！\n";
	// Read Most
	arrangeAuthor('read', {pro: '共有', post: '人次阅读', title: '阅读量'}, '阅读榜');
	results += ">　　传播即王道！大家向这些王者致敬！\n";
	// Article Most
	arrangeAuthor(['articles', 'length'], {pro: '共写了', post: '篇文章', title: '文章数'}, '总发文榜');
	// Word Most
	arrangeAuthor('word', {pro: '共写了', post: '字', title: '字数'}, '总码字榜');
	results += ">　　这两张榜单上的作者们都幸苦啦！\n";

	results += '\n----\n';

	if (SHOW_MENTIONED_AUTHORS) {
		results += '@' + mentions.join(' @') + '\n';
		results += '\n----\n';
	}

	return {
		report: results,
		author_info: authorInfo,
		mentions: mentions
	}
}

function analyzeArticles (articles) {
	var results, authorInfo;

	results = 0;
	articles.map(function (note) {
		note._index = results;
		note._select = 0;
		results++;
	});

	article_records = articles;

	results = createArticleReport(article_records);
	notes_result = results.report;
	authorInfo = results.author_info;
	md_result = notes_result;
	localStorage[getCollectionID() + '_result'] = md_result;

	show('<p>分析已完成</p>');
	tamarked_task = function (data) {
		html_result = data.output;
		pad.innerHTML = data.output;
		localStorage[getCollectionID() + '_output'] = html_result;
		openElement(pad);
		showHTML = true;
		if (!switcher.onClick) {
			switcher.onClick = switchEvent;
			switcher.addEventListener('click', switcher.onClick);
		}
		mention.appendChild(switcher);
	};
	start_time = new Date().getTime() - start_time;
	send('tamarked', md_result);

	analyzeTrend(articles, authorInfo);
	send('GetKeyWordReport');
	show('<p>分析耗时: ' + (start_time / 1000) + '秒</p>');
}

function sendToServoAndSave (articles) {
	send("AppendArticleRecords", articles);
}

function analyzeTrend (articles, authors) {
	return;
	console.log('Analyze Trend...');
	function retrieve (item) {
		return [item.word, item.read, item.like, item.comment];
	}
	var arts = articles.map(retrieve), auts = [];
	var items = Object.keys(authors), item;
	for (item in items) {
		auts.push(authors[items[item]]);
	}
	auts = auts.map(retrieve);
	console.log(arts);
	console.log(auts);
	arts = arts.map(function (art) {
		return art.join('\t');
	});
	auts = auts.map(function (aut) {
		return aut.join('\t');
	});
	console.log(arts.join('\n'));
	console.log(auts.join('\n'));
	show('<p>Waiting For Analyze Report</p>');
	start_analyze = new Date().getTime();
}

const STRUCTURE_LIMIT = 0.7;
const SHOW_KEYWORD_CLUSTER = false;
const SHOW_TOPIC_CLUSTER = true;
function getAnalyzeReport (data) {
	console.log('Get Analyze Report!!!!');
	start_analyze = (new Date().getTime()) - start_analyze;
	start_analyze /= 1000;
	show('Get KW-Report! TimeSpent: ' + start_analyze + 's');
	mention.appendChild(switcher);

	var temp = '';
	data.keywords.map(function (info) {
		temp += info.word + '\t' + info.occur + '\t' + info.power + '\t' + info.ratio + '\t' + info.avePower + '\t' + info.aveRatio + '\t' + info.index + '\n';
	});
	console.log(temp);

	analy_result = '\n#文章内容分析：\n'
	analy_result += '\n##最常见关键词：'
	analy_result += '\n\n| |关键词|出现次数|'
	// analy_result += '\n\n| |关键词|出现次数|影响因子|权重|频率|'
	analy_result += '\n|-|-|-|'
	var i = 0, limit = 500;
	data.keywords.some(function (info) {
		i++;
		// analy_result += '\n|' + i + '|' + info.word + '|' + info.occur + '|' + (Math.round(info.index * 100) / 100) + '|' + (Math.round(info.power * 100) / 100) + '|' + (Math.round(info.ratio * 100) / 100) + '|';
		analy_result += '\n|' + i + '|' + info.word + '|' + info.occur + '|';
		limit --;
		return limit <= 0;
	});
	analy_result += '\n\n----\n';

	console.log(data.topics);
	if (SHOW_KEYWORD_CLUSTER) {
		analy_result += '\n##最热关键词文章：\n';
		data.topics.map(function (topic) {
			if (topic[2] <= topic[0].length) return;
			analy_result += '\n###关键词：' + topic[1] + '　　热度：' + (Math.round(topic[2] * 100) / 100) + '\n';
			analy_result += '\n|作者|文章|热度|\n';
			analy_result += '|-|-|-|\n';
			topic[0].map(function (article) {
				analy_result += '|[' + article[2].author.name + '](' + HOST_URL + article[2].author.url + ')|[《' + article[2].article.title + '》](' + HOST_URL + '/p/' + article[2].article.slug + ')|' + (Math.round(article[1] * 100) / 100) + '|\n';
			});
			analy_result += '\n\n';
		});
		analy_result += '\n----\n';
	}

	console.log(data.clusters);
	if (SHOW_TOPIC_CLUSTER) {
		analy_result += '\n##最热话题文单：\n';
		data.clusters.map(function (cluster) {
			if (cluster[2] <= cluster[0].length) return;
			analy_result += '\n###话题：' + cluster[1].join('，') + '　　热度：' + (Math.round(cluster[2] * 100) / 100) + '\n';
			analy_result += '\n|作者|文章|相关度|热度|\n';
			analy_result += '|-|-|-|-|\n';
			cluster[0].map(function (point) {
				analy_result += '|[' + point.authorName + '](' + point.authorUrl + ')|[《' + point.title + '》](' + HOST_URL + '/p/' + point.slug + ')|' + (Math.round(point.relative * 100) / 100) + '|' + point.like + '|\n';
			});
			analy_result += '\n\n';
		});
		analy_result += '\n----\n';
	}

	md_result += analy_result;

	localStorage[getCollectionID() + '_result'] = md_result;
	send('tamarked', md_result);
}

function showResult () {
	var result = localStorage[getCollectionID() + '_result'];
	var output = localStorage[getCollectionID() + '_output'];
	show('<p>上次结果</p>');
	pad.innerHTML = output;
	openElement(pad);
	showHTML = true;
	if (!switcher.onClick) {
		switcher.onClick = switchEvent;
		switcher.addEventListener('click', switcher.onClick);
	}
	mention.appendChild(switcher);
}

function showArticleFilter () {
	if (!article_records) return;
	article_records.sort(function (noteA, noteB) {
		var index = noteB._select - noteA._select;
		if (index === 0) index = noteA._index - noteB._index;
		return index;
	});

	openElement(article_filter);
	article_filter.innerHTML = '<table style="width:95%;min-width:500px;"><thead><tr><th>作者</th><th>文章</th><th>操作</th></tr></thead><tbody></tbody></table>';
	var table = article_filter.querySelector('tbody');
	article_records.map(function (info) {
		insertLineForAF(info, table);
	});
	article_filter.innerHTML += '<div style="text-align:center;margin-top:50px;"><button target="SubmitArticleFilter">提交</button></div>';
}
function showAuthorFilter () {
	if (!article_records) return;
	var authors = {};
	article_records.map(function (note) {
		var slug = note.authorURL;
		if (authors[slug]) {
			authors[slug].article ++;
		}
		else {
			authors[slug] = {
				name: note.author,
				url: slug,
				article: 1
			};
		}
	});
	authors = Object.keys(authors).map(function (slug) {
		return authors[slug];
	}).sort(function (authorA, authorB) {
		return authorB.article - authorA.article
	});

	openElement(article_filter);
	article_filter.innerHTML = '<table style="width:95%;min-width:500px;"><thead><tr><th>作者</th><th>文章</th><th>操作</th></tr></thead><tbody></tbody></table>';
	var table = article_filter.querySelector('tbody');
	authors.map(function (info) {
		insertLineForBF(info, table);
	});
	article_filter.innerHTML += '<div style="text-align:center;margin-top:50px;"><button target="SubmitArticleFilter">提交</button></div>';
}
function insertLineForAF (info, table) {
	var record = newElement('tr');
	record.innerHTML = '<td><a href="http://www.jianshu.com/' + info.authorURL + '" target="_blank">' + info.author + '</a></td>';
	record.innerHTML += '<td><a href="http://www.jianshu.com/' + info.url + '" target="_blank">' + info.title + '</a></td>';
	record.innerHTML += '<td style="text-align:center;"><button target="RemoveArticle" name="' + info.slug + '">移除</button></td>';
	table.appendChild(record);
}
function insertLineForBF (info, table) {
	var record = newElement('tr');
	record.innerHTML = '<td><a href="http://www.jianshu.com/' + info.url + '" target="_blank">' + info.name + '</a></td>';
	record.innerHTML += '<td>' + info.article + '</td>';
	record.innerHTML += '<td style="text-align:center;"><button target="RemoveAuthor" name="' + info.url + '">移除</button></td>';
	table.appendChild(record);
}
function onArticleFilterEvent (event) {
	var host = event.toElement, task = host.getAttribute('target'), target = null, index, found;
	if (task === 'RemoveArticle') {
		target = host.getAttribute('name');
		index = -1;
		found = article_records.some(function (info) {
			index++;
			return info.slug === target;
		});
		if (found) {
			article_records.splice(index, 1);
		}
		host.parentElement.parentElement.parentElement.removeChild(host.parentElement.parentElement);
	}
	else if (task === 'RemoveAuthor') {
		target = host.getAttribute('name');
		article_records = article_records.filter(function (info) {
			return info.authorURL !== target;
		});
		host.parentElement.parentElement.parentElement.removeChild(host.parentElement.parentElement);
	}
	else if (task === 'SubmitArticleFilter') {
		closeElement(article_filter);
		target = createArticleReport(article_records);
		show('<p>分析已完成</p>');
		notes_result = target.report;
		index = target.author_info;

		md_result = notes_result + analy_result;
		localStorage[getCollectionID() + '_result'] = md_result;
		send('tamarked', md_result);

		analyzeTrend(article_records, index);
	}
}

var start_time = 0, start_analyze = 0;
var tamarked_task = null;

var pad, mention, switcher, notes_result, analy_result, md_result, html_result, showHTML = true, subpages = [], article_records, article_filter, keywords_filter;
function switchEvent () {
	if (showHTML) {
		pad.innerHTML = '<p>' + localStorage[getCollectionID() + '_result'].replace(/\n/g, '<br>') + '</p>';
	}
	else {
		pad.innerHTML = localStorage[getCollectionID() + '_output'];
	}
	showHTML = !showHTML;
}

function newElement (type, classes) {
	var element;
	if (type === 'text') {
		element = document.createTextNode(classes || '');
	}
	else {
		element = document.createElement(type);
		if (!!classes) {
			element.className = classes;
		}
	}
	return element;
}
function appendToPage (element) {
	subpages.push(element);
	document.body.appendChild(element);
}
function openElement (element) {
	element.style.display = 'block';
}
function closeElement (element) {
	element.style.display = 'none';
}

function stopPropagation (event) {
	event.stopPropagation();
	event.preventDefault();
	event.cancelBubble = true;
}

// document.addEventListener('DOMContentLoaded', function () {
// 	switcher = newElement('button');
// 	switcher.innerHTML = '切换Markdown/HTML';

// 	// 顶部提示框
// 	mention = newElement('div', '_extension_mention');
// 	mention.addEventListener('click', stopPropagation);
// 	appendToPage(mention);

// 	// 结果展示区
// 	pad = newElement('div', '_extension_pad');
// 	pad.addEventListener('click', stopPropagation);
// 	appendToPage(pad);

// 	// 文章列表筛选区
// 	article_filter = newElement('div', '_extension_pad');
// 	article_filter.addEventListener('click', stopPropagation);
// 	article_filter.addEventListener('click', onArticleFilterEvent);
// 	appendToPage(article_filter);

// 	document.body.addEventListener('click', function (e) {
// 		if (switcher.onClick) switcher.addEventListener('click', switcher.onClick);
// 		subpages.map(closeElement);
// 	});
// });