// @ts-check

const {tSax} = require("../tsax");
const {expect} = require("chai");

/**
 * @param {import("../tsax").TSax|string} tsax
 * @param {import("../tsax").EventType} expectedEvent
 * @param {string} [expectedValue]  tagName or string value, depending on the event type
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
  switch (expectedEvent) {
    case "endTag":
    case "singleTag":
    case "startTag":
      expect(tsax.tagName()).to.equal(expectedValue);
      if (actualAttributes === "error" && expectedProperties !== "error") {
        throw new Error(tsax.error());
      }
      break;
    case "error":
    case "eof":
      break;
    case "processingInstruction":
      expect(tsax.piTarget()).to.equal(expectedValue);
      expect(tsax.rawText()).to.equal(expectedProperties);
      return;
    default:
      expect(tsax.rawText()).to.equal(expectedValue);
  }
  expect(actualAttributes).to.deep.equal(expectedProperties);
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
});