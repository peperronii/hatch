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

function hatchEvaluateExpression(data, expression) {
	const TokenType = Object.freeze({
		OPERATOR: 1,
		NUM:      2,
		IDEN:     3,
		EOF:      4,
	});

	class Tokenizer {
		constructor(src) {
			this.src = src;
			this.idx = 0;
			this.char = this.src[this.idx];
		}

		read() {
			this.idx += 1;
			this.char = this.src[this.idx];
			return this.char;
		}

		// undefined = EOF
		scan() {
			const token = {};

			// skip whitespaces or stop at EOF 
			for (;;) {
				if (this.char === undefined ) {
					token.type = TokenType.EOF;
					return token;
				}
				if (this.char.trim() !== '') break;
				this.read();
			}

			if ('[(+-*/%^)]'.indexOf(this.char) > -1) {
				token.type = TokenType.OPERATOR;
				token.data = this.char;
				this.read()
				return token;
			}

			if (this.char >= '0' && this.char <= '9') {
				token.type = TokenType.NUM;
			} else {
				token.type = TokenType.IDEN;
			}
			token.data = '';
			for (;;) {
				if ( this.char === undefined ||
				     this.char.trim() === '' ||
				     '[(+-*/%^)]'.indexOf(this.char) > -1)  {
					break;
				}
				token.data = token.data + this.char;
				this.read();
			}
			return token;
		}

		peek() {
			let _idx = this.idx;
			let _char = this.char;
			let token = this.scan();
			this.idx = _idx;
			this.char = _char
			return token;
		}
	}

	let tokenizer = new Tokenizer(expression);

	let operands = [];
	let operators = [];

	function errorHelper(idx, msg) { return { error: "index: " + idx + " | " + msg }; }
	function compute(operands, operator) {
		switch (operator) {
		case '+':
			operands.push(operands.pop() + operands.pop());
			break;
		case '-':
			let sub = operands.pop()
			let min = operands.pop()
			operands.push(min - sub);
			break;
		case '*':
			operands.push(operands.pop() * operands.pop());
			break;
		case '/':
			let den = operands.pop();
			let num = operands.pop();
			let divrem = num % den;
			// floor division
			operands.push((num - divrem) / den);
			break;
		case '%':
			let mod = operands.pop();
			let div = operands.pop();
			let modrem = div % mod;
			operands.push(modrem);
			break;
		case '^':
			let expo = operands.pop();
			let base = operands.pop();
			operands.push(base ** expo);
			break;
		}
	}
	function getPrecedence(ch) {
		return ({ '+':1, '-':1, '*':2, '/':2, '%':2, '^':3 })[ch] ?? -1;
	}

	if (tokenizer.peek().type === TokenType.EOF) return { error: "Empty Expression" }
	for (;;) {
		let token = tokenizer.scan();
		switch (token.type) {
		case TokenType.OPERATOR:
			let precedence = getPrecedence(token.data);
			if (precedence > -1) {
				let operator = operators.at(-1);
				if (getPrecedence(operator) >= precedence) {
					operators.pop();
					compute(operands, operator)
				}
				operators.push(token.data);
			} else if (token.data === '(' || token.data === '[') {
				operators.push(token.data);
			} else if (token.data === ')') {
				for (;;) {
					let operator = operators.pop();
					if (getPrecedence(operator) !== -1) {
						compute(operands, operator);
						continue;
					} else if (operator === '(') {
						break;
					} else if (operator === undefined) {
						return errorHelper(tokenizer.idx, "No preceding '(' for ')'");
					}
					// Should not reach
					return errorHelper(tokenizer.idx, "[ASSERT]: undefined operator inside '()': " + operator);
				}
			} else if (token.data === ']') {
				for (;;) {
					let operator = operators.pop();
					if (getPrecedence(operator) !== -1) {
						compute(operands, operator);
						continue;
					} else if (operator === '[') {
						break;
					} else if (operator === undefined) {
						return errorHelper(tokenizer.idx, "No preceding 'id[' for ']'");
					}
					// Should not reach
					return errorHelper(tokenizer.idx, "[ASSERT]: undefined operator inside '[]': " + operator);
				}

				let id = operators.pop();
				if (id === undefined) {
					// Should not reach
					return errorHelper(tokenizer.idx, "[ASSERT]: no preceding id operator for '[]' operation");
				}
				let idx = operands.pop();
				let num = data.getAll(id)[idx];
				if (num === undefined) {
					return errorHelper(tokenizer.idx, "Index out of range or invalid. array: " + id + " index: " + idx);
				} else if (typeof num === "string" || num instanceof String) {
					for (const ch of num) {
						if (ch < "0" || ch > "9") {
							return errorHelper(tokenizer.idx, id + "[" + idx + "] contains non digits or decimals. ch: " + ch);
						}
					}
					operands.push(parseInt(num, 10));
				} else {
					return errorHelper(tokenizer.idx, "type of " + id + "[" + idx + "] is not a string" )
				}
			}
			continue;
		case TokenType.NUM:
			for (const ch of token.data) {
				if (ch < "0" || ch > "9") {
					return errorHelper(tokenizer.idx, "Potential number literal contains non digits or decimals. ch: " + ch);
				}
			}
			operands.push(parseInt(token.data, 10));
			continue;
		case TokenType.IDEN:
			let next_token = tokenizer.peek();
			if (next_token.type === TokenType.OPERATOR && next_token.data === '[') {
				operators.push(token.data);
			} else {
				operands.push(data.getAll(token.data).length);
			}
			continue;
		}
		if (token.type === TokenType.EOF) break;
		return errorHelper(tokenizer.idx, "[ASSERT]: unknown token.type")
	}
	let i = operators.length;
	while (i > 0) {
		i -= 1;
		compute(operands, operators.pop());
	}
	if (operators.length !== 0) {
		return { error : "[ASSERT]: left over operators: " + operators }
	}
	if (operands.length !== 1) {
		return { error : "[ASSERT]: left over operands: " + operands }
	}
	return operands[0];
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
