function hatch(src, url, des = src, opts = {}) {
	let resolve = (e) => {
		if (typeof e === 'string' || e instanceof String) e = document.querySelector(e);
		return e;
	};

	src = resolve(src);
	des = resolve(des);

	let {
		debounce: d = 0,
		timeout: t = 2000,
		method: m = 'GET',
		controls: c = src || {},
		onerror = (err) => {
			if (err.name === 'AbortError') {
				console.warn('hatch: ' + err);
			} else {
				console.error('hatch: ' + err);
			}
		},
		onload = () => { des.classList.add('loader'); },
		onfinish = () => {}
	} = opts;

	if (!des) {
		onerror(new DOMException('destination not found', 'NotFoundError'));
		return false;
	}

	let b = '';
	if (src instanceof HTMLFormElement) {
		if (!src.reportValidity()) return false;
		b = new URLSearchParams(new FormData(src));
	} else if (src) {
		b = new URLSearchParams({ [src.name]: src.value });
	}

	if (c._hatchDebounce) clearTimeout(c._hatchDebounce);
	if (c._hatchTimeout) clearTimeout(c._hatchTimeout);
	if (c._hatchAbort) c._hatchAbort.abort();

	onload();
	c._hatchAbort = new AbortController();
	if (t) {
		c._hatchTimeout = setTimeout(() => c._hatchAbort.abort('TimeoutError'), t);
	}

	m = m.toUpperCase();
	let init = { signal: c._hatchAbort.signal, method: m };
	if (m === 'GET') {
		url = url + '?' + b;
	} else {
		init.body = b;
		init.headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
	}

	c._hatchDebounce = setTimeout(() => {
		fetch(url, init)
			.then((r) => r.text())
			.then((html) => {
				let doc = new DOMParser().parseFromString(html, 'text/html');
				for (let e of [...doc.body.children]) {
					if (!e.id) continue;
					if (e.id === des.id) continue;
					document.getElementById(e.id)?.replaceWith(e);
				}
				des.replaceWith(...doc.body.children);
			})
			.then(onfinish)
			.catch(onerror);
	}, d);
	return false;
}
