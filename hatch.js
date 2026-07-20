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

function hatchEvaluateExpression(src, data, context) {

	let pos = 0, vals = [], ops = [];

	function err(msg) {
		return { error: "index: " + pos + " | " + msg };
	}

	function prec(ch) {
		return ({ '+':1, '-':1, '*':2, '/':2, '%':2, '^':3 })[ch] ?? -1;
	}

	function peek() {
		return pos < src.length ? src[pos] : undefined;
	}

	function skipWs() {
		while (pos < src.length && src[pos].trim() === '') {
			pos += 1;
		}
	}

	function isInt(str) {
		for (const ch of str) {
			if (ch < "0" || "9" < ch)  {
				return false
			}
		}
		return true;
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

	// TODO: make this accescable inside hatchFromTemplate
	function readToken() {
		skipWs();
		let c = peek();

		if (c === undefined) {
			return { EOF: true };
		}

		if ('0' <= c && c <= '9') {
			let num = '';
			while (pos < src.length && '0' <= src[pos] && src[pos] <= '9') {
				num = num + src[pos];
				pos += 1;
			}
			return { number: num } ;
		}

		if (prec(c) > -1) {
			pos += 1;
			return { operator: c };
		}

		if ('()[]'.indexOf(c) > -1) {
			pos += 1;
			return { group: c };
		}

		// TODO: clear up the logic for id
		if (('a' <= c && c <= 'z') || ('A' <= c && c <= 'Z') || c === '_') {
			let id = '';
			while (pos < src.length && ('0' <= src[pos] && src[pos] <= '9')) {
				id = id + src[pos];
				pos += 1;
			}
			return { identifier: id };
		}
		return { error : c }
	}

	skipWs();
	if (peek() === undefined) { return { error: "Empty Expression" }; }

	let token = undefined;
	for (;;) {
		// Open Parentheses
		token = readToken();
		while (token.group && token.group === '(') {
			ops.push('(');
			token = readToken();
		}

		// Operand
		if (token.number) {
			vals.push(parseInt(token.number, 10));
		} else if (token.identifier) {
			let id = token.identifier;
			let val = context[id];
			if (val) {
				if (!isInt(val)) {
					return err("Context value: " + id + " contains non digits or decimals. string: " + val);
				}
				vals.push(parseInt(val, 10));
			} else {
				val = data.getAll(id);
				if (peek() === '[') {
					if (val.length === 0) {
						return err("Tried indexing id: " + id + " but it does not exist in the form data.");
					}
					ops.push(id);
					ops.push('[');
					readToken();
					continue;
				} else {
					vals.push(val.length);
				}
				vals.push(val.length);
			}
		} else if (token.EOF) {
			break;
		} else {
			return err("Expected an Operand but got: " + token);
		}

		// Close Brackets
		token = readToken();
		while (token.group) {
			switch (token.group) {
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
					if (ch < "0" || ch > "9") return err(id + "[" + idx + "] contains non digits or decimals. string: " + val);
				}
				vals.push(parseInt(val, 10));
				break;
			default:
				return err("Expected an Operator but got: " + token);
			}
			token = readToken();
		}

		// Operator
		if (token.operator) {
			let op = token.operator;
			if (prec(op) <= prec(ops[ops.length-1])) {
				calc(ops.pop())
			}
			ops.push(op);
		} else if (token.EOF) {
			break;
		} else {
			return err("Expected an Operator but got: " + token);
		}
	}

	while (ops.length) {
		let op= ops.pop()
		if (!calc(op)) {
			return { error: "Unclosed '" + op + "'" };
		}
	}
	return vals[0];
}


function hatchFromTemplate(t, data) {
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
				let name = attr.slice(3);
				clone.removeAttribute;
				if (name === '') {
					err("Empty attribute name for hh: on " + clone);
					continue;
				}
				// TODO: handle data logic
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

					let start = hatchEvaluateExpression(str.slice(0, range).trim(), data, context);
					if (start.error) {
						err("Error when evaluating range start: " + start.error );
						error = true;
					} else {
						if (start < 0) {
							err("Evaluated range start is less than zero");
							error = true;
						}
					}

					let end = hatchEvaluateExpression(str.slice(range + 1).trim(), data, context);
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
					for (const val in contextVals) {
						let clone = processChild(unloopedClone, des, data, context);
						processChildren(child, clone, data, context);
					}
				} else {
					for (const val in contextVals) {
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

	t = (typeof t === "string" || t instanceof String) ? document.querySelector(t) : t;

	if (!(t instanceof HTMLTemplateElement)) {
		console.error("hatchFromTemplate: Template target not found or not a <template>");
		return false;
	}

	let hatchMap = {};
	let src = t.content
	let des = t.content.cloneNode(false)
} 
