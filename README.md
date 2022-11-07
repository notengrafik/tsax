# tSax

An efficient StAX style streaming XML parser written in pure JavaScript.

## Usage

**sTax** is an event based pulling parser. It

```
```

For API documentation, see

## What it is

* A streaming XML parser
* StAX style
* No dependencies
* Usable in web workers
* Striving to be lightweight and fast for large documents. To achieve this, it
  by default tries not to allocate any strings or object unless requested,
  especially for attribute parsing and text unescaping.
* Well suited for parsing large files where a lot of the files's information is
  not of interest.
* Recognizing:
  * element tags (start, end and empty) and attributes
  * text nodes
  * comments
  * CDATA sections
  * processing instructions
  * doctype declarations, including contained markup declaration, which is
    however not parsed, but properly skipped.
* Typed using JSDoc annotations for checking with TypeScript.

## What it's not

* Validating or even checking if input XML is well-formed.  For the sake of
  speed and simplicity the general assumption is made that the XML *is*
  well-formed. If it's not, garbage in, garbage out!
* Loading entity declarations from DTDs or from the doctype declaration.
* Namespace aware. This would introduce a parsing overhead and therefore should
  only be introduced as an option.

## The name

**tSax** is a nod to Tobias Nickel's
[tXml](https://github.com/TobiasNickel/tXml/), which was the inspiration, and
of course it is an anagram of StAX and also refers to Sax.

## API

For the API, have a look at the [TypeScript definitions](tsax.d.ts).