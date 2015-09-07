function query (selector, all) {
	if (!!all) return document.querySelectorAll(selector);
	else return document.querySelector(selector);
}
function addEvent (dom, event, handler) {
	dom.addEventListener(event, handler);
}
var newUI = function (tag, classes, style) {
	var ui = document.createElement(tag);

	if (!classes) return ui;

	if (!!classes) {
		if (typeof classes === 'string') ui.className = classes;
		else if (!!classes.map) classes.map(function (name) {ui.classList.add(name)});
		else {
			for (var key in classes) {
				ui.style[key] = classes[key];
			}
		}
	}

	if (!!style) {
		for (var key in style) {
			ui.style[key] = style[key];
		}
	}

	return ui;
};
var ajax = function (url, callbacks) {
	var xhr = new XMLHttpRequest();
	if (callbacks === false) {
		xhr.open('GET', url, false);
		xhr.send();
		return xhr.responseText;
	}
	else {
		callbacks = callbacks || {};
		xhr.onreadystatechange = function () {
			if (xhr.readyState === 4) {
				if (callbacks.ready) callbacks.ready();
				if (xhr.status === 200 && callbacks.success) callbacks.success(xhr.responseText);
				if (xhr.status !== 200 && callbacks.fail) callbacks.fail(xhr.status);
				if (callbacks.always) callbacks.always();
			}
		};
		xhr.open('GET', url, true);
		xhr.send();
	}
};

const INLINE_TAGS = ['a', 'abbr', 'address', 'area', 'audio', 'cite', 'code', 'del', 'details', 'dfn', 'command', 'button', 'datalist', 'em', 'font', 'i', 'img', 'input', 'ins', 'kbd', 'label', 'legend', 'link', 'mark', 'meter', 'nav', 'optgroup', 'q', 'small', 'big', 'select', 'source', 'span', 'strong', 'b', 'sub', 'sup', 'summary', 'time', 'var', 'strike'];
const SEPARATE_TAGS = ['br', 'hr'];

function getContentList (container) {
	var result = [], children = container.childNodes, t = children.length, i, node, tag, text = '', j, k, bra, ket;
	if (t > 0) {
		bra = !(children[0].tagName);
		ket = !(children[t - 1].tagName);
		if (bra) result.push('');
	}
	for (i = 0; i < t; i++) {
		node = children[i];
		tag = node.tagName;
		if (tag) {
			tag = tag.toLowerCase();
			node = getContent(node);
			k = node.length;
			if (SEPARATE_TAGS.indexOf(tag) >= 0) {
				result.push(text);
				text = '';
			}
			else if (INLINE_TAGS.indexOf(tag) >= 0) {
				if (k === 1) {
					text += node[0];
				}
				else if (k > 1) {
					text += node [0];
					result.push(text);
					k -= 1;
					for (j = 1; j < k; j++) {
						result.push(node[j])
					}
					text = node[k];
				}
			}
			else {
				for (j = 0; j < k; j++) {
					result.push(node[j]);
				}
			}
		}
		else {
			text += node.textContent;
		}
	}
	if (text.length > 0) result.push(text);
	if (ket) result.push('');
	return result;
}
function getContent (container) {
	var result = [];
	getContentList(container).map(function (content) {
		content.split('\n').map(function (line) {
			line = line.replace(/^[ 　]+/g, '').replace(/[ 　]+$/g, '');
			if (line.length > 0) {
				result.push(line);
			}
		});
	});
	return result;
}