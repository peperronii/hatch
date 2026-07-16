function hatchEvaluateExpression(data, src) {

	let pos = 0, vals = [], ops = [], wasVal = false;

	function err(msg) { return { error: "index: " + pos + " | " + msg }; }
	function prec(ch) { return ({ '+':1, '-':1, '*':2, '/':2, '%':2, '^':3 })[ch] ?? -1; }
	function peek() { return pos < src.length ? src[pos] : undefined; }
	function skipWs() { while (pos < src.length && src[pos].trim() === '') pos++; }

	function calc(op) {
		let b = vals.pop(), a = vals.pop();
		switch (op) {
		case '+': vals.push(a + b); break;
		case '-': vals.push(a - b); break;
		case '*': vals.push(a * b); break;
		case '/': let r = a % b; vals.push((a - r) / b); break;
		case '%': vals.push(a % b); break;
		case '^': vals.push(a ** b); break;
		}
	}

	function readToken() {
		skipWs();
		let c = peek();

		if (c === undefined) return 'EOF';

		if (prec(c) > -1) {
			if (!wasVal) return err("Expected an Operand");
			wasVal = false;
			pos += 1;
			return c;
		}

		if ('()[]'.indexOf(c) > -1) {
			pos += 1;
			return c;
		}

		if (wasVal) return err("Expected an Operator");
		if (c >= '0' && c <= '9') {
			let num = '';
			while (pos < src.length && src[pos] >= '0' && src[pos] <= '9') {
				num = num + src[pos];
				pos += 1;
			}
			skipWs();
			let n = peek();
			if (n !== undefined && n.trim() !== '' && prec(n) === -1 && '()[]'.indexOf(n) === -1)
				return err("Potential number literal contains non digits or decimals. ch: " + n);
			vals.push(parseInt(num, 10));
			wasVal = true;
			return null;
		}

		let id = '';
		while (pos < src.length && src[pos].trim() !== '' && '()[]+-*/%^'.indexOf(src[pos]) === -1)
			id += src[pos++];
		skipWs();

		if (peek() === '[') {
			ops.push(id, '[');
			pos++;
			return null;
		}
		vals.push(data.getAll(id).length);
		wasVal = true
		return null;
	}

	skipWs();
	if (peek() === undefined) return { error: "Empty Expression" };

	for (;;) {
		let token = readToken();
		if (token && token.error) return token;
		if (token === 'EOF') break;
		if (token === null) {
			continue;
		}

		if (prec(token) > -1) {
			while (ops.length && prec(ops[ops.length-1]) >= prec(token)) calc(ops.pop());
			ops.push(token);
			continue;
		}

		if (token === '(') { ops.push(token); continue; }

		if (token === ')') {
			while (ops.length && prec(ops[ops.length-1]) !== -1) calc(ops.pop());
			if (!ops.length || ops.pop() !== '(') return err("No preceding '(' for ')'");
			continue;
		}

		if (token === ']') {
			while (ops.length && prec(ops[ops.length-1]) !== -1) calc(ops.pop());
			if (!ops.length || ops.pop() !== '[') return err("No preceding '[' for ']'");
			let id = ops.pop();
			if (id === undefined) return err("No preceding id for '[]' operation");
			let idx = vals.pop();
			let num = data.getAll(id)[idx];
			if (num === undefined) return err("Index out of range or invalid. array: " + id + " index: " + idx);
			if (typeof num !== "string") return err("type of " + id + "[" + idx + "] is not a string");
			for (const ch of num) {
				if (ch < "0" || ch > "9") return err(id + "[" + idx + "] contains non digits or decimals. ch: " + ch);
			}
			vals.push(parseInt(num, 10));
			continue;
		}

		if (token === '[') return err("No identifier preceding '['");
	}

	while (ops.length) calc(ops.pop());
	if (vals.length !== 1) return { error: "[ASSERT]: left over operands: " + vals };
	return vals[0];
}
