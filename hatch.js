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

function hatchEvaluateExpression(data, context, src) {

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
			if (ch < "0" || ch > "9")  {
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

	function readToken() {
		skipWs();
		let c = peek();

		if (c === undefined) {
			return { EOF: true };
		}

		if (c >= '0' && c <= '9') {
			let num = '';
			while (pos < src.length && src[pos] >= '0' && src[pos] <= '9') {
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

		let id = '';
		while (pos < src.length && src[pos].trim() !== '' && '()[]+-*/%^'.indexOf(src[pos]) === -1) {
			id = id + src[pos];
			pos += 1;
		}
		return { identifier: id };
	}

	skipWs();
	if (peek() === undefined) { return { error: "Empty Expression" }; }

	let token = null;
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
	function cloneChildren(src, des, data, stack) {
		for (const child of src.childNodes) {
			let forExpr = child.getAttribute("hh-for");
			if (!!forExpr) {
				const i = forExpr.indexOf(':');
				const varibale = str.slice(0, index).trim();
				const expression = str.slice(index + 1).trim();
				const range = forExpr.indexOf('..');
				if (range === -1) {
					data.getAll(expression);
				} else {
					// handle range syntax
				}
				
			}
			const clone = des.appendChild(child.cloneNode(false));
			if (clone.nodeType !== Node.ELEMENT_NODE) {
				continue
			}

			for (const attr of clone.getAttributeNames()) {

			}
			cloneChildren(child, clone, data, stack);
		}
	}

	t = (typeof t === "string" || t instanceof String) ? document.querySelector(t) : t;

	if (!(t instanceof HTMLTemplateElement)) {
		console.error("hatchFromTemplate: " + t + " not found or not a <template>");
		return false;
	}

	let hatchMap = {};
	let src = t.content
	let des = t.content.cloneNode(false)
} 
