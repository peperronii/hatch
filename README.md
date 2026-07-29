# hatch.js

> form + template = reactivity

hatch itself is actually just my idea of trying to create the simplest form of reactivity
using pure HTML and vanilla javascript.

hatch is:
- HTML safe templating system
- fetch wrapper
- form and template match maker

hatch can:
- render template element with form data
- fetch html from the server then render it in the same fashion as form + template
- do it in a declarative way

## The main idea

right now there's no universal way to render values onto a template
hatch solves that by introducing a templating system similar to tal

it is simple and logic-less
it uses form data as its input

by having this we can now glue the use of form and template together
this:

```html
<form onsubmit="return hatch(event)" action="#mytemplate" target="#myslot">
	<input name="message" value="hello world!"/>
</form>

<template id="mytemplate">
	<p hh:="message[0]"></p>
</template>

<div id="myslot"></div>
```

results in

```html
<form onsubmit="return hatch(event)" action="#mytemplate" target="#myslot">
	<input name="message" value="hello world!"/>
</form>

<template id="mytemplate">
	<p hh:="message[0]"></p>
</template>

<p>hello world!</p>
```

the way of calling hatch is subject to change, it might convert to
```html
<form hh-hatch action="#mytemplate" target="#myslot">
```
or with config
```html
<form hh-hatch="debounce = 200, timeout = 0"  action="#mytemplate" target="#myslot">
```
but right now it is what it is

if action does not start with '#'
it will send a fetch request instead
hatch will expect a response with HTML as body
(the HTML can be just Document Fragments)
and a header 'hh-data' that is a url encoded form data
it will use that data to render the HTML body using hatch's templating system
then swap it into the DOM in an out of band way
go take a look at

## templating system

hatch's templating system uses html attributes to mark where the value should go

`hh:="key[0]"` render the textContent to the value of key[0]
`hh:attribute="key[0]"` render the attribute's value to the value of key[0]
`hh-for="i:key"` iterate over the values of keys. inside this element and its children 'i' will now be the value of the iteration i.e. Context
inside hh-for you can use 'i' in the same way you use of 'key[0]' in the example above
if the value of 'i' is an integer you can also do 'anotherKey[i]' to index the data

you can also shadow the key
`hh-for="key:key"`
or using its shorthand
`hh-for=":key"`

I'm still on edge on whether or not to add reverse iteration for this form of loop.
I know it is convenient but I want to encourage the user to actually prepare the array BEFORE templating it.

`hh-for="i:0..key"` iterate over the range from 0 to the length of key, inclusive.
note that this example will result in array out of bound, the usual pattern would be
`hh-for="i:0..key-1"`
this also works descending
`hh-for="i:key-1..0"`

Note that using `key` of a form data inside an expression will always result in the length of the expression
but a Context's `key` will use its value and cannot be indexed, so becareful when shadowing

## Tests

test.html is generated via llm to assure that the use that I intended works as it is but I will rewrite it later to make it more comprehensive
and support more error cases.
test.html also acts as a usage guide, for now, so go take a look at it if you're curious

### Inspirations
This is very heavily inspired by a lot of HATEOAS lib including but not limited to
- htmx
- htmz
- nomini
- datastar
- µjs
