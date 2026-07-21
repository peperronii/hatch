function hatch(e, cfg) {	
	e.preventDefault();

	let form = e.target;
	let target = e.submitter.formaction || form.action;
	let data = new FormData(form);


	if (!!cfg.prep) {
		if (typeof cfg.prep === "function") {
			data = cfg.prep(data);
		} else {
			console.error("hatch: " + cfg.prep + " is not a function.");
			return false;
		}
	}

	let template = null;
	if (target.startsWith('#')) {
		hatchFromTemplate(target, data)
		return false;
	}

	let method = form.getAttribute("method") || "get";
}

hatch.readToken = function (t) {

	while (t.pos < t.src.length && t.src[t.pos].trim() === '') {
		t.pos += 1;
	}

	let c = t.src[t.pos];

	if (c === undefined) {
		t.token.type = 'EOF';
		t.token.value = null;
		return t.token;
	}

	if ('0' <= c && c <= '9') {
		let start = t.pos;
		t.pos += 1;
		while (t.pos < t.src.length && '0' <= t.src[t.pos] && t.src[t.pos] <= '9') {
			t.pos += 1;
		}

		t.token.type = 'number';
		t.token.value = src.slice(start, t.pos);
		return t.token;
	}

	if ('+-*/%^'.indexOf(c) > -1) {
		t.pos += 1;
		t.token.type = 'operator';
		t.token.value = c;
		return t.token;
	}

	if ('()[]'.indexOf(c) > -1) {
		t.pos += 1;
		t.token.type = 'group';
		t.token.value = c;
		return t.token;
	}

	if (('a' <= c && c <= 'z') || ('A' <= c && c <= 'Z') || c === '_') {
		let start = t.pos;
		t.pos += 1;
		while (t.pos < t.src.length &&
		       (('0' <= t.src[t.pos] && t.src[t.pos] <= '9') ||
		       ('a' <= t.src[t.pos] && t.src[t.pos] <= 'z') ||
		       ('A' <= t.src[t.pos] && t.src[t.pos] <= 'Z') ||
		       t.src[t.pos] === '_')) {
			t.pos += 1;
		}
		t.token.type = 'identifier';
		t.token.value = src.slice(start, t.pos);
		return t.token;
	}

	t.token.type = 'unknown';
	t.token.value = c;
	return t.token;
}

hatch.peekToken = function (t) {
	let _t = { ...t };
	return hatch.readToken(_t);
}

hatch.evaluateExpression = function (src, data, context) {

	let pos = 0, vals = [], ops = [];

	function err(msg) {
		return { error: "index: " + pos + " | " + msg };
	}

	function prec(ch) {
		return ({ '+':1, '-':1, '*':2, '/':2, '%':2, '^':3 })[ch] ?? -1;
	}

	function calc(op) {
		let b = vals.pop(), a = vals.pop();
		switch (op) {
		case '+':
			vals.push(a + b);
			return true;

		case '-':
			vals.push(a - b);
			return true;

		case '*':
			vals.push(a * b);
			return true;

		case '/':
			let r = a % b;
			vals.push((a - r) / b);
			return true;

		case '%':
			vals.push(a % b);
			return true;

		case '^':
			vals.push(a ** b);
			return true;
		}

		return false;
	}


	let t = { pos: 0, src: src, token: { type: null, value: null } };
	parse: for (;;) {
		// Open Parentheses
		token = hatch.readToken(t);
		while (token.value === '(') {
			ops.push('(');
			token = hatch.readToken(t);
		}

		// Operand
		switch (token.type) {
		case 'number':
			vals.push(parseInt(token.value, 10));
			break;
		case 'identifier':
			let id = token.value;
			let val = context[id];
			if (val) {
				for (const ch of val) {
					if (ch < '0' || '9' < ch) {
						return err("Context value: " + id + " contains non digits or decimals. string: " + val);
					}
				}
				vals.push(parseInt(val, 10));
			} else {
				val = data.getAll(id);
				let nextToken = hatch.peekToken(t)
				if (nextToken.value === '[') {
					if (val.length === 0) {
						return err("Tried indexing id: " + id + " but it does not exist in the form data.");
					}
					ops.push(id);
					ops.push('[');
					hatch.readToken(t);
					continue;
				} else {
					vals.push(val.length);
				}
			}
			break;
		case 'EOF':
			break parse;
		default:
			return err("Expected an Operand but got: " + JSON.stringify(token));
		}

		// Close Brackets
		token = hatch.readToken(t);
		while (token.type === 'group') {
			switch (token.value) {
			case ')':
				while (ops.length && prec(ops[ops.length-1]) !== -1) {
					calc(ops.pop());
				}
				if (!ops.length) {
					return err("No preceding '(' for ')'");
				}
				let op = ops.pop();
				if (op !== '(') {
					return err("Unexpected Operator preceding ')': " + op);
				}
				break;
			case ']':
				while (ops.length && prec(ops[ops.length-1]) !== -1) {
					calc(ops.pop());
				}

				if (!ops.length) {
					return err("No preceding '[' for ']'");
				}
				let currentOp = ops.pop();
				if (currentOp !== '[') {
					return err("Unexpected Operator preceding ']': " + currentOp);
				}

				let id = ops.pop();
				let arr = data.getAll(id);
				let idx = vals.pop();
				let val = arr[idx];
				if (val === undefined) {
					return err("Index out of range. id: " + id + " index: " + idx);
				}
				if (!(typeof val === "string" || val instanceof String)) {
					return err("type of " + id + "[" + idx + "] is not a string");
				}
				for (const ch of val) {
					if (ch < '0' || '9' < ch) return err(id + "[" + idx + "] contains non digits or decimals. string: " + val);
				}
				vals.push(parseInt(val, 10));
				break;
			default :
				return err("Expected an Operator but got: " + JSON.stringify(token));
			}
			token = hatch.readToken(t);
		}

		// Operator

		switch (token.type) {
		case 'operator':
			let op = token.value;
			if (prec(op) <= prec(ops[ops.length-1])) {
				calc(ops.pop())
			}
			ops.push(op);
			break;
		case 'EOF':
			break parse;
		default :
			return err("Expected an Operator but got: " + JSON.stringify(token));
		}
	}

	if (vals.length === 0) {
		return { error: "Empty expression" };
	}

	while (ops.length) {
		let op= ops.pop()
		if (!calc(op)) {
			return { error: "Unclosed '" + op + "'" };
		}
	}
	return vals[0];
}


hatch.fromTemplate = function (template, data) {
	function err(str) {
		console.error("hatchFromTemplate: " + str);
	}

	// shallow clone, process and attach a child to des
	function processChild(child, des, data, context) {
		const clone = des.appendChild(child.cloneNode(false));
		if (clone.nodeType !== Node.ELEMENT_NODE) {
			return null;
		}

		for (const attr of clone.getAttributeNames()) {
			if (attr.startsWith("hh:") {

				let expr = clone.getAttribute(attr);
				clone.removeAttribute;

				let name = attr.slice(3);
				if (name === '') {
					err("Empty attribute name for hh: on " + clone);
					continue;
				}

				let t = { pos: 0, src: expr, token: { type: null, value: null } }

				let token = hatch.readToken(t);
				if (token.type !== 'identifier') {
					err("Expected an Identifier but got: " + JSON.Stringify(token));
					continue;
				}

				let id = token.value;
				let attrVal = null;

				token = hatch.readToken(t);
				if (token.value === '[') {
					let close = expr.lastIndexOf(']');
					if (close === -1) {
						err("Unclosed '['");
						continue;
					}
					continue;
					// TODO: finish data pull logic
				} else if (token.type === 'EOF') {
					attrVal = context[id];
					if (attrVal === undefined) {
						err("Context: " + id + " is undefined");
						continue;
					}
					// TODO: finish context pull logic

				} else {
					err ("Unexpected token after " + id + " : " JSON.Stringify(token));
					continue
				}
			}
		}
		return clone;
	}

	// deep clone and process all children form src to des
	function processChildren(src, des, data, context) {
		for (const child of src.childNodes) {
			let forExpr = child.getAttribute("hh-for");
			if (forExpr) {
				let contextVals = [];
				let key = undefined;
				let expr = undefined;

				const i = forExpr.indexOf(':');
				// hh-for="expr" = no value added to context
				// hh-for=":expr" = empty string as key of context
				// hh-for="key:expr" = key as key of context
				if (i === -1) {
					key = null;
					expr = forExpr;
				} else {
					key = forExpr.slice(0, i).trim();
					expr = forExpr.slice(i + 1).trim();
				}

				const range = expr.indexOf("..");

				if (range === -1) {
					contextVals = data.getAll(expr);
				} else {
					let error = false;

					let start = hatch.evaluateExpression(str.slice(0, range).trim(), data, context);
					if (start.error) {
						err("Error when evaluating range start: " + start.error );
						error = true;
					} else {
						if (start < 0) {
							err("Evaluated range start is less than zero");
							error = true;
						}
					}

					let end = hatch.evaluateExpression(str.slice(range + 1).trim(), data, context);
					if (end.error) {
						err("Error when evaluating range end: " + end.error );
						error = true;
					} else {
						if (end < 0) {
							err("Evaluated range end is less than zero");
							error = true;
						}
					}

					if (!err) {
						if (start > end) {
							while (start >= end) {
								contextVals.push(start);
								start -= 1;
							}
						} else {
							while (start <= end) {
								contextVals.push(start);
								start += 1;
							}
						}
					}
				}

				const unloopedChild = child.cloneNode(false);
				unloopedChild.removeAttribute("hh-for");
				if (key ===  null) {
					for (const val of contextVals) {
						let clone = processChild(unloopedClone, des, data, context);
						processChildren(child, clone, data, context);
					}
				} else {
					for (const val of contextVals) {
						let newContext = { ...context };
						newContext[key] = val;

						let clone = processChild(unloopedClone, des, data, newContext);
						if (clone !== null) {
							processChildren(child, clone, data, newContext);
						}
					}
				}

			} else {

				let clone = processChild(child, des, data, context);
				if (clone !== null) {
					processChildren(child, clone, data, context);
				}

			}
		}
	}

	template = (typeof template === "string" || template instanceof String) ? document.querySelector(template) : template;

	if (!(template instanceof HTMLTemplateElement)) {
		console.error("hatchFromTemplate: Template target not found or not a <template>");
		return false;
	}

	let hatchMap = {};
	let src = template.content;
	let des = template.content.cloneNode(false);
	processChildren(src, des, data, {});
} 
