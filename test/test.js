// @ts-check

const {tSax} = require("../tsax");
const {expect} = require("chai");

/**
 * @param {import("../tsax").TSax|string} tsax
 * @param {import("../tsax").EventType} expectedEvent
 * @param {string|((value: string|undefined) => boolean)} [expectedValue]
 * tagName or string value, depending on the event type. If a function is
 * supplied and if the actual value is passed to it, it must return `true` when
 * the value is as expected and `false` otherwise.
 * @param {import("../tsax").Attributes|undefined|string} [expectedProperties]
 */
function assertNextState(tsax, expectedEvent, expectedValue, expectedProperties) {
  if (typeof tsax === "string") {
    tsax = tSax(tsax);
  }
  const actualEvent = tsax.next();
  try {
    expect(actualEvent).to.equal(expectedEvent, "event type");
  } catch (e) {
    throw actualEvent === "error" ? new Error(tsax.error()) : e
  }
  const actualAttributes = tsax.attributes();

  let actualValue = undefined;

  switch (expectedEvent) {
    case "endTag":
    case "singleTag":
    case "startTag":
      actualValue = tsax.tagName();
      if (actualAttributes === "error" && expectedProperties !== "error") {
        throw new Error(tsax.error());
      }
      break;
    case "error":
    case "eof":
      break;
    case "processingInstruction":
      actualValue = tsax.piTarget();
      break;
    case "doctype":
      actualValue = tsax.tagName();
      break;
    default:
      actualValue = tsax.rawText();
  }

  switch (expectedEvent) {
    case "processingInstruction":
    case "doctype":
      expect(tsax.rawText()).to.equal(expectedProperties, "doctype/processing instruction raw text");
      break;
    default:
      expect(actualAttributes).to.deep.equal(expectedProperties, "attributes");
  }

  if (typeof expectedValue === "function") {
    expect(expectedValue(actualValue)).to.equal(true, "text content of text/cdata, or tag name");
  } else {
    expect(actualValue).to.equal(expectedValue, "text content of text/cdata, or tag name");
  }

  return {
    escapedText: (expectedText) => expect(/** @type import("../tsax").TSax */ (tsax).escapedText()).to.equal(expectedText),
  }
}

/**
 * @param {string|undefined} s
 * @returns boolean
 */
function whitespace(s) {
  return s?.trim() === ""
}


describe("TSax", function() {
  it("parses comments", function() {
    assertNextState("<!--foo-->", "comment", "foo");
    assertNextState("<!--foo", "error");
    assertNextState("<!--bar--->", "comment", "bar-");
  });

  describe("tag parsing", function() {
    it("parses start tags and self closing tags", function() {
      assertNextState("<foo>", "startTag", "foo", {});
      assertNextState("<a>", "startTag", "a", {});
      assertNextState("<foo.bar>", "startTag", "foo.bar", {});
      assertNextState("<foo-bar>", "startTag", "foo-bar", {});
      assertNextState("<a/>", "singleTag", "a", {});
      assertNextState("<foo/>", "singleTag", "foo", {});
      assertNextState("<foo />", "singleTag", "foo", {});
      assertNextState("<foo\n/>", "singleTag", "foo", {});
      assertNextState("<bar foo='baz'/>", "singleTag", "bar", {foo: "baz"});
      assertNextState('<bar foo = "baz" />', "singleTag", "bar", {foo: "baz"});
      assertNextState("<foo xml:id='bar'/>", "singleTag", "foo", {"xml:id": "bar"});
      assertNextState("<foo xmlns:n='N:S' n:m='bar'/>", "singleTag", "foo", {"xmlns:n": "N:S", "n:m": "bar"});
      assertNextState("<n:foo xmlns:n='N:S' >", "startTag", "n:foo", {"xmlns:n": "N:S"});
      assertNextState("<foo xmlns='N:S'>", "startTag", "foo", {xmlns: "N:S"});
      assertNextState("<üä>", "startTag", "üä", {});
      assertNextState("<fooBar>", "startTag", "fooBar", {});
      assertNextState("<bar foo  =  'baz' />", "singleTag", "bar", {foo: "baz"});
      assertNextState("<bar foo\n=\n'baz' />", "singleTag", "bar", {foo: "baz"});
    });

    it("parses end tags", function() {
      assertNextState("</foo>", "endTag", "foo");
      assertNextState("</bar >", "endTag", "bar");
    });

    it("reports missing closing brackets", function() {
      assertNextState("<foo<", "error", undefined);
      assertNextState("<foo", "error", undefined);
      assertNextState("<foo /abc", "error", undefined);
      assertNextState("</bar ", "error", undefined);
    });
  });

  describe("text parsing", function() {
    it("parses text", function() {
      assertNextState("foo<", "text", "foo");
    });

    it("parses CDATA", function() {
      assertNextState("<![CDATA[foo]]>", "cdata", "foo");
      assertNextState("<![CDATA[]]>", "cdata", "");
    });

    it("ignores text after final element", function() {
      const tsax = tSax("<a/> ");
      assertNextState(tsax, "singleTag", "a", {});
      assertNextState(tsax, "eof");
    });

    it("resolves entities", function() {
      assertNextState("&amp;123<", "text", "&amp;123").escapedText("&123");
      assertNextState("abc&gt;<;", "text", "abc&gt;").escapedText("abc>");
      assertNextState("&#x20;<", "text", "&#x20;").escapedText(" ");
      assertNextState("&#32;<", "text", "&#32;").escapedText(" ");
    });
  });

  describe("processing instructions", function() {
    it("parses processing instructions", function() {
      assertNextState("<?xml version='1.0' encoding='UTF-8'?>", "processingInstruction", "xml", "version='1.0' encoding='UTF-8'");
      assertNextState("<?foo?>", "processingInstruction", "foo", "");
      assertNextState("<?foo ?>", "processingInstruction", "foo", "");
      assertNextState("<?foo  a?>", "processingInstruction", "foo", " a");
      assertNextState("<?foo b ?>", "processingInstruction", "foo", "b ");
      assertNextState("<?foo ?<?>", "processingInstruction", "foo", "?<");
      assertNextState("<?foo >??>", "processingInstruction", "foo", ">?");
    });
  });

  describe("doctype", function() {
    it("parses doctype", function() {
      assertNextState("<!DOCTYPE html>", "doctype", "html", "");
      const musicXmlDoctype = ' PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd"';
      assertNextState(`<!DOCTYPE score-partwise${musicXmlDoctype}>`, "doctype", "score-partwise", musicXmlDoctype);
    });

    it("parses doctype with ELEMENT, ATTLIST and ENTITY children", function() {
      const doctype = ` [
        <!ELEMENT doc (e)>
        <!ELEMENT e (#PCDATA)>
        <!ATTLIST e
          a1 CDATA 'a1 default'
          a2 NMTOKENS 'a2 default'
        >
        <!ENTITY x SYSTEM '013.ent'>
      ]`;
      assertNextState(`<!DOCTYPE doc${doctype}>`, "doctype", "doc", doctype);
    });

    it("ignores processing instructions inside doctype", function() {
      const tsax = tSax("<!DOCTYPE foo:bar[<?baz >>><<<<?>]>");
      assertNextState(tsax, "doctype", "foo:bar", "[<?baz >>><<<<?>]");
      expect(tsax.prefix()).to.equal("foo");
      expect(tsax.localName()).to.equal("bar");
      assertNextState(tsax, "eof");
    });
  });

  describe("complex documents", function() {
    it("parses text inside tags", function() {
      const tsax = tSax(`<a>b</a>`);
      assertNextState(tsax, "startTag", "a", {});
      assertNextState(tsax, "text", "b");
      assertNextState(tsax, "endTag", "a");
      assertNextState(tsax, "eof");
    });

    it("parses text after cdata", function() {
      const tsax = tSax("<a><![CDATA[b]]>c</a>");
      assertNextState(tsax, "startTag", "a", {});
      assertNextState(tsax, "cdata", "b");
      assertNextState(tsax, "text", "c");
      assertNextState(tsax, "endTag", "a");
    });

    it("parses cdata after text", function() {
      const tsax = tSax("<a>b<![CDATA[c]]></a>");
      assertNextState(tsax, "startTag", "a", {});
      assertNextState(tsax, "text", "b");
      assertNextState(tsax, "cdata", "c");
      assertNextState(tsax, "endTag", "a");
    });

    it("parses <respStmt> example", function() {
      const tsax = tSax(`<respStmt xml:id="m-11" xmlns="http://www.music-encoding.org/ns/mei">
        <persName xml:id="m-12">Max Mustermann</persName>
      </respStmt>`);
      assertNextState(tsax, "startTag", "respStmt", {"xml:id": "m-11", "xmlns": "http://www.music-encoding.org/ns/mei"});
      assertNextState(tsax, "text", whitespace);
      assertNextState(tsax, "startTag", "persName", {"xml:id": "m-12"});
      assertNextState(tsax, "text", "Max Mustermann");
      assertNextState(tsax, "endTag", "persName");
      assertNextState(tsax, "text", whitespace);
      assertNextState(tsax, "endTag", "respStmt");
      assertNextState(tsax, "eof");
    });

    it("parses self closing elements in context", function() {
      const tsax = tSax("<a><b/></a>");
      assertNextState(tsax, "startTag", "a", {});
      assertNextState(tsax, "singleTag", "b", {});
      assertNextState(tsax, "endTag", "a");
    });

    it("parses comments in context", function() {
      const tsax = tSax("<outer><!--<inner>commented out</inner>--></outer>");
      assertNextState(tsax, "startTag", "outer", {});
      assertNextState(tsax, "comment", "<inner>commented out</inner>");
      assertNextState(tsax, "endTag", "outer");
    });

    it("parses xml declaration and doctype in context", function() {
      const tsax = tSax('<?xml version="1.0"?><!DOCTYPE foo><bar/>');
      assertNextState(tsax, "processingInstruction", "xml", 'version="1.0"');
      assertNextState(tsax, "doctype", "foo", "");
      assertNextState(tsax, "singleTag", "bar", {});
    });
  });
});