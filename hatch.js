function hatch(e, cfg) {	

	function err(str) {
		console.error("hatch | " + str);
	}

	function warn(str) {
		console.warn("hatch | " + str);
	}

	e.preventDefault();

	let form = e.target;
	if (!(form instanceof HTMLFormElement)) {
		err("event target is not a form element: " + form);
		return;
	}
	// TODO: add an option to either reportValidity or checkValidity
	if (!form.reportValidity()) {
		warn("form validation failed" + form);
		return;
	}

	let action = e.submitter?.formaction || form.action || '';
	let target = e.submitter?.formtarget || form.target || '';

	let data = new FormData(form);
	if (cfg.prep) {
		if (typeof cfg.prep === "function") {
			data = cfg.prep(data);
		} else {
			err(cfg.prep + " is not a function.");
			return;
		}
	}

	let html = undefined
	if (!action.startsWith('#')) {
		let method = form.getAttribute("method") || "get";
		// FOR AGENT: move the backup hatch logic here!
		return;
	} else {
		html = document.querySelector(action);
	}

	let hatched = hatch.html(html, data);

}




hatch.html = function (html, data, context = {}) {

	function err(str) {
		console.error("hatch.html | " + str);
	}

	function readToken(t) {

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
			t.token.value = t.src.slice(start, t.pos);
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
			t.token.value = t.src.slice(start, t.pos);
			return t.token;
		}

		t.token.type = 'unknown';
		t.token.value = c;
		return t.token;
	}

	function peekToken (t) {
		let _t = { ...t };
		return readToken(_t);
	}

	function evaluateExpression(src) {

		let vals = [], ops = [];

		function err(t, msg) {
			return { error: "index: " + t.pos + " | " + msg };
		}

		function prec(ch) {
			return ({ '+':1, '-':1, '*':2, '/':2, '%':2, '^':3 })[ch] ?? -1;
		}

		function calc(op) {
			let b = vals.pop(), a = vals.pop();
			switch (op) {
				case '+': {
					vals.push(a + b);
					return true;
				}

				case '-': {
					vals.push(a - b);
					return true;
				}

				case '*': {
					vals.push(a * b);
					return true;
				}

				case '/': {
					let r = a % b;
					vals.push((a - r) / b);
					return true;
				}

				case '%': {
					vals.push(a % b);
					return true;
				}

				case '^': {
					vals.push(a ** b);
					return true;
				}
			}

			return false;
		}


		let t = { pos: 0, src: src, token: { type: null, value: null } };
		parse: for (;;) {
			// Open Parentheses
			let token = readToken(t);
			while (token.value === '(') {
				ops.push('(');
				token = readToken(t);
			}

			// Operand
			switch (token.type) {
				case 'number': {
					vals.push(parseInt(token.value, 10));
					break;
				}

				case 'identifier': {
					let id = token.value;
					let val = context[id];
					if (val) {
						for (const ch of val) {
							if (ch < '0' || '9' < ch) {
								return err(t, "Context value: " + id + " contains non digits or decimals. string: " + val);
							}
						}
						vals.push(parseInt(val, 10));
					} else {
						val = data.getAll(id);
						let nextToken = peekToken(t)
						if (nextToken.value === '[') {
							if (val.length === 0) {
								return err(t, "Tried indexing id: " + id + " but it does not exist in the form data.");
							}
							ops.push(id);
							ops.push('[');
							readToken(t);
							continue;
						} else {
							vals.push(val.length);
						}
					}
					break;
				}

				case 'EOF': { 
					break parse;
				}

				default: {
					return err(t, "Expected an Operand but got: " + JSON.stringify(token));
				}
			}

			// Close Brackets
			token = readToken(t);
			while (token.type === 'group') {
				switch (token.value) {
					case ')': {
						while (ops.length && prec(ops[ops.length-1]) !== -1) {
							calc(ops.pop());
						}
						if (!ops.length) {
							return err(t, "No preceding '(' for ')'");
						}
						let op = ops.pop();
						if (op !== '(') {
							return err(t, "Unexpected Operator preceding ')': " + op);
						}
						break;
					}

					case ']': {
						while (ops.length && prec(ops[ops.length-1]) !== -1) {
							calc(ops.pop());
						}

						if (!ops.length) {
							return err(t, "No preceding '[' for ']'");
						}
						let currentOp = ops.pop();
						if (currentOp !== '[') {
							return err(t, "Unexpected Operator preceding ']': " + currentOp);
						}

						let id = ops.pop();
						let arr = data.getAll(id);
						let idx = vals.pop();
						let val = arr[idx];
						if (val === undefined) {
							return err(t, "Index out of range. id: " + id + " index: " + idx);
						}
						if (!(typeof val === "string" || val instanceof String)) {
							return err(t, "type of " + id + "[" + idx + "] is not a string");
						}
						for (const ch of val) {
							if (ch < '0' || '9' < ch) return err(t, id + "[" + idx + "] contains non digits or decimals. string: " + val);
						}
						vals.push(parseInt(val, 10));
						break;
					}

					default : {
						return err(t, "Expected an Operator but got: " + JSON.stringify(token));
					}
				}
				token = readToken(t);
			}

			// Operator

			switch (token.type) {
				case 'operator': {
					let op = token.value;
					if (prec(op) <= prec(ops[ops.length-1])) {
						calc(ops.pop())
					}
					ops.push(op);
					break;
				}
				case 'EOF': {
					break parse;
				}
				default : {
					return err(t, "Expected an Operator but got: " + JSON.stringify(token));
				}
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

	function processChild(child) {

		function errAttr(attr, str) {
			err("When processing " + attr + " | " + str);
		}

		function warnAttr(attr, str) {
			console.warn("hatch.html |  " + "When processing " + attr + " | " + str);
		}

		let clone = child.cloneNode(false);

		// process each attribute
		for (const attr of clone.getAttributeNames()) {

			if (!attr.startsWith("hh:")) {
				continue;
			}

			let name = attr.slice(3);

			let expr = clone.getAttribute(attr);
			clone.removeAttribute(attr);

			let val = undefined;

			let t = { pos: 0, src: expr, token: { type: null, value: null } };

			let token = readToken(t);
			if (token.type !== 'identifier') {
				errAttr(attr,"Expected an Identifier but got: " + JSON.stringify(token));
				continue;
			}

			let id = token.value;

			token = readToken(t);
			if (token.value === '[') {
				let close = expr.lastIndexOf(']');
				if (close === -1) {
					errAttr(attr, "Unclosed '['");
					continue;
				}

				let trail = expr.slice(close + 1);
				let trailToken = readToken({ pos: 0, src: trail , token: { type: null, value: null } })
				if (trailToken.type !== 'EOF') {
					errAttr(attr, "Unexpected token after ']' : " + JSON.stringify(trailToken));
					continue;
				}

				let idxExpr = expr.slice(t.pos, close);
				let idx = evaluateExpression(idxExpr);
				if (idx.error) {
					errAttr(attr, "Error when evaluating index expression: " + idx.error);
					continue;
				}

				val = data.getAll(id);
				if (val.length === 0) {
					warnAttr(attr, "Form data: " + id + " does not exist");
					continue;
				}

				val = val[idx];
				if (val === undefined) {
					errAttr(attr, "Form data: " + id + " index out of range: " + idx);
					continue;
				}

			} else if (token.type === 'EOF') {

				val = context[id];
				if (val === undefined) {
					errAttr(attr, "Context: " + id + " is undefined");
					continue;
				}

			} else {
				errAttr(attr, "Unexpected token after " + id + " : " + JSON.stringify(token));
				continue;
			}

			if (name === '') {
				clone.textContent = val;
			} else {
				clone.setAttribute(name, val);
			}
		}

		return clone;
	}

	// deep clone and process all children form src to des
	function processChildren(src, des) {
		function processContext(val, key, unloopedChild, child) {
			let _val = context[key];

			context[key] = val;

			let clone = processChild(unloopedChild);
			des.appendChild(clone);
			processChildren(child, clone);

			context[key] = _val;
		}

		for (const child of src.childNodes) {
			if (child.nodeType !== Node.ELEMENT_NODE) {
				des.appendChild(child.cloneNode(true));
				continue;
			}

			let forExpr = child.getAttribute("hh-for");

			if (forExpr) {
				let contextVals = [];
				let key = undefined;
				let expr = undefined;

				let i = forExpr.indexOf(':');
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

				let range = expr.indexOf("..");

				if (range === -1) {
					contextVals = data.getAll(expr);
				} else {
					let hasErr = false;

					let start = evaluateExpression(expr.slice(0, range).trim());
					if (start.error) {
						err("Error when evaluating range start: " + start.error );
						hasErr = true;
					} else {
						if (start < 0) {
							err("Evaluated range start is less than zero");
							hasErr = true;
						}
					}

					let end = evaluateExpression(expr.slice(range + 2).trim());
					if (end.error) {
						err("Error when evaluating range end: " + end.error);
						hasErr = true;
					} else {
						if (end < 0) {
							err("Evaluated range end is less than zero");
							hasErr = true;
						}
					}

					if (!hasErr) {
						if (start > end) {
							while (start >= end) {
								contextVals.push(String(start));
								start -= 1;
							}
						} else {
							while (start <= end) {
								contextVals.push(String(start));
								start += 1;
							}
						}
					}
				}

				let unloopedChild = child.cloneNode(false);
				unloopedChild.removeAttribute("hh-for");

				let spacer = null;
				let prev = child.previousSibling;
				if (prev && prev.nodeType === Node.TEXT_NODE) {
					let text = prev.textContent;
					let idx = text.length;
					while (idx) {
						idx -= 1;
						if (text[idx] === '\n') {
							break;
						}
						if (text[idx].trim() !== '') {
							idx += 1;
							break;
						}
					}
					let ws = text.slice(idx);
					if (ws) {
						spacer = new Text(ws);
					}
				}

				// I know the flow is weird but putting if outside the loop is generally faster
				// I will profile it later
				let count = contextVals.length;
				if (key ===  null) {
					if (count) {
						count -= 1;
						unloopedChild = processChild(unloopedChild);
						let clone = des.appendChild(unloopedChild.cloneNode(false));
						processChildren(child, clone);
					}

					if (spacer) {
						while (count) {
							count -= 1;
							des.appendChild(spacer.cloneNode(true));
							let clone = des.appendChild(unloopedChild.cloneNode(false));
							processChildren(child, clone);
						}
					}
					else {
						while (count) {
							count -= 1;
							let clone = des.appendChild(unloopedChild.cloneNode(false));
							processChildren(child, clone);
						}
					}
				} else {
					if (count) {
						processContext(contextVals[contextVals.length - count], key, unloopedChild, child);
						count -= 1;
					}

					if (spacer) {
						while (count) {
							des.appendChild(spacer.cloneNode(true));
							processContext(contextVals[contextVals.length - count], key, unloopedChild, child);
							count -= 1;
						}
					}
					else {
						while (count) {
							processContext(contextVals[contextVals.length - count], key, unloopedChild, child);
							count -= 1;
						}
					}
				}

			} else {

				let clone = processChild(child);
				des.appendChild(clone);
				processChildren(child, clone);

			}
		}
	}


	if (html instanceof HTMLElement) {
		if (html instanceof HTMLTemplateElement) {
			html = html.content;
		}
	} else {
		err(html + " is not a HTML element")
		return null;
	}

	let hatched = undefined;
	if (data) {
		hatched = html.cloneNode(false);
		processChildren(html, hatched);
	} else {
		hatched = html.cloneNode(true);
	}
	return hatched;
}
