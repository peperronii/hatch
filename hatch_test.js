function hatchEvaluateExpression(src, data, context) {

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

	// TODO: make this accescable inside hatchFromTemplate
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

	function peekToken(t) {
		let _t = { ...t };
		return readToken(_t);
	}

	let t = { pos: 0, src: src, token: { type: null, value: null } };
	parse: for (;;) {
		// Open Parentheses
		token = readToken(t);
		while (token.value === '(') {
			ops.push('(');
			token = readToken(t);
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
				let nextToken = peekToken(t)
				if (nextToken.value === '[') {
					if (val.length === 0) {
						return err("Tried indexing id: " + id + " but it does not exist in the form data.");
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
		case 'EOF':
			break parse;
		default:
			return err("Expected an Operand but got: " + JSON.stringify(token));
		}

		// Close Brackets
		token = readToken(t);
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
			token = readToken(t);
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
