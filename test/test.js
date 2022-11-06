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
    expect(actualEvent).to.equal(expectedEvent);
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
    default:
      actualValue = tsax.rawText();
  }

  if (expectedEvent === "processingInstruction") {
    expect(tsax.rawText()).to.equal(expectedProperties);
  } else {
    expect(actualAttributes).to.deep.equal(expectedProperties);
  }

  if (typeof expectedValue === "function") {
    expect(expectedValue(actualValue)).to.equal(true);
  } else {
    expect(actualValue).to.equal(expectedValue);
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

  describe("text parrsing", function() {
    it("parses text", function() {
      assertNextState("foo<", "text", "foo");
    });

    it("parses CDATA", function() {
      assertNextState("<![CDATA[foo]]>", "cdata", "foo");
      assertNextState("<![CDATA[]]>", "cdata", "");
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
      assertNextState("<!DOCTYPE html>", "doctype", "html");
      const musicXmlDoctype = 'score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd"';
      assertNextState(`<!DOCTYPE ${musicXmlDoctype}>`, "doctype", musicXmlDoctype);
    });

    it("parses doctype with ELEMENT, ATTLIST and ENTITY children", function() {
      const doctype = `doc [
        <!ELEMENT doc (e)>
        <!ELEMENT e (#PCDATA)>
        <!ATTLIST e
          a1 CDATA 'a1 default'
          a2 NMTOKENS 'a2 default'
        >
        <!ENTITY x SYSTEM '013.ent'>
      ]`;
      assertNextState(`<!DOCTYPE ${doctype}>`, "doctype", doctype);
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
  });
});