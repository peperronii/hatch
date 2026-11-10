# hatch.js

hatch is:
- an HTML-safe templating system for FormData
- a fetch wrapper for forms
- a small helper for swapping rendered HTML into the DOM

hatch can:
- render a template or response HTML with FormData
- send form submissions with fetch
- use server-provided `hh-data` to render the response body
- swap rendered HTML into the DOM by element id

## The main idea

there is no universal way to render values onto a template in plain HTML.
hatch solves that by introducing a small, logic-less templating system that uses FormData as its input.

`hatch.html(html, data, context = {})` renders an `HTMLElement`, `HTMLTemplateElement`, or `DocumentFragment` and returns `[rendered, errors]`.

```html
<form id="message-form" onsubmit="return handleSubmit(event)">
	<input name="message" value="hello world!">
</form>

<template id="message-template">
	<p hh:="message[0]"></p>
</template>

<div id="message-slot"></div>
```

```js
function handleSubmit(e) {
	e.preventDefault()

	let form = e.target
	let [doc, errors] = hatch.html(
		document.getElementById('message-template'),
		new FormData(form),
		{}
	)

	if (errors.length !== 0) {
		console.error(errors)
	}

	hatch.swap(doc, 'message-slot')
	return false
}
```

results in:

```html
<p>hello world!</p>
```

`hatch.swap(doc, target)` expects a bare element id, not a selector.
Children with an `hh-id` attribute or `id` are swapped out of band.
The child that matches `target` is used for the final swap.

## fetch wrapper

hatch wraps form submission with fetch.

```html
<form onsubmit="return hatch(event, { timeout: 2000 })"
	action="/messages" method="POST" target="messages">
	<input name="message" value="hello world!">
</form>

<div id="messages"></div>
```

`hatch(event, cfg)`:
- prevents the default form submission
- reads `action`, `method`, and `target` from the submitter or form
- supports `GET`, `POST`, `PUT`, `PATCH`, and `DELETE`
- sends GET and DELETE data as a query string
- sends POST, PUT, and PATCH data as `application/x-www-form-urlencoded`
- aborts the previous in-flight request for the same form
- supports debounce and timeout
- calls `onFinish(target, form)` when the request settles

The response body is expected to be HTML, possibly just a DocumentFragment.

If the response has an `hh-data` header, hatch parses it as URL-encoded FormData and renders the response body with `hatch.html()` using that data.
If the header is absent, the response body is swapped directly.

```http
hh-data: message=hello+world%21
```

## configuration

```js
hatch.cfg = {
	debounce: 0,
	timeout: 0,

	onError: (error, target, form) => {
		if (error?.name === 'AbortError') {
			console.warn('hatch | ' + error.message)
			return
		}
		console.error('hatch | ' + error.message)
	},

	onValidation: (form) => form.reportValidity(),

	onFormData: (data) => data,

	onLoad: (target, form) => {},

	onFinish: (target, form) => {},
}
```

- `debounce`: delay before sending the request, in milliseconds
- `timeout`: abort the request after this many milliseconds; `0` disables timeout
- `onValidation`: return a truthy value to continue with the request
- `onFormData`: return the FormData used for the request
- `onLoad`: called before fetch
- `onFinish`: called after fetch succeeds or fails
- `onError`: called with `(error, target, form)`

## templating system

hatch's templating system uses HTML attributes to mark where values should go.

`hh:="key[0]"` renders the textContent as the value of `key[0]`.

`hh:attribute="key[0]"` renders the attribute value as the value of `key[0]`.

`hh-for="i:key"` iterates over the values of `key`.
Inside the element and its children, `i` becomes the value of the current iteration, also called the Context.

Inside `hh-for`, use `i` like `key[0]` in the examples above.
If the value of `i` is an integer, use `anotherKey[i]` to index the FormData.

You can shadow a FormData key with a Context key:

```html
hh-for="key:key"
```

or with the shorthand:

```html
hh-for=":key"
```

`hh-for="i:0..key"` iterates from `0` to the length of `key`, inclusive.
This example goes out of bounds; the usual pattern is:

```html
hh-for="i:0..key-1"
```

Ranges also work in descending order:

```html
hh-for="i:key-1..0"
```

Note that using a FormData `key` inside an expression results in the length of that key.
A Context `key` uses its value and cannot be indexed, so be careful when shadowing.

Any indexed token always reads its value from FormData and skips Context keys.
For example, `hh:="name[0]"` reads `name` from FormData even if a Context key named `name` exists.
Context is only used for a bare token such as `hh:="name"`, or inside the index expression itself such as `items[i]`.

Some examples to clarify

```url
?name=0&name=1&name=2
```

i = 2, 1, 0
```html
hh-for="i:name-1..0"
```

i = 1, 0
```html
hh-for="i:name[1]..0"
```

if name is inside a context (shadowed or looping variable)
i0 = 0
i1 = 1, 0
i2 = 2, 1, 0
```html
hh-for=":name"
hh-for="i:name..0"
```

if name is inside a context (shadowed or looping variable)
AND the name is indexed it will use the value of the FormData NOT the contexts
i0 = 1, 0
i1 = 1, 0
i2 = 1, 0
```html
hh-for=":name"
hh-for="i:name[1]..0"
```


## Tests

`test.html` contains two test suites:
- `hatch.html()` for the templating system
- `hatch()` for the fetch wrapper and DOM swapping

Open `test.html` in a browser to run both suites. Results are appended to the page.

### Inspirations
This is very heavily inspired by a lot of HATEOAS lib including but not limited to
- htmx
- htmz
- nomini
- datastar
- µjs
