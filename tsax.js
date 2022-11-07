// @ts-check

const openBracketCC = "<".charCodeAt(0);
const closeBracketCC = ">".charCodeAt(0);
const minusCC = "-".charCodeAt(0);
const slashCC = "/".charCodeAt(0);
const exclamationCC = "!".charCodeAt(0);
const questionCC = "?".charCodeAt(0);
const openCornerBracketCC = "[".charCodeAt(0);
const letterDCC = "D".charCodeAt(0);
const letterxCC = "x".charCodeAt(0);
const spaceCC = " ".charCodeAt(0);
const nameEndChars = charCodeMap(" \t\n\r/>?[");
const quoteChars = charCodeMap(`"'`);
const attributeNameEndChars = charCodeMap("=>");

/**
 * @param {string} string  A string of all chars that should be mapped.
 */
function charCodeMap(string) {
  /** @type {Array.<true|undefined>} Maps char codes that end a name to `true`*/
  const charMap = [];
  for (const char of string.split("")) {
    charMap[char.charCodeAt(0)] = true;
  }
  return charMap;
}

/**
 * @typedef
 * {"cdata"|"comment"|"doctype"|"endTag"|"eof"|"error"|"processingInstruction"|"singleTag"|"startTag"|"text"}
 * EventType
 */

/** @typedef {{[attributeName: string]: string}} Attributes */

/**
 * @typedef {{
 *  next: () => EventType;
 *  tagName: () => string | undefined;
 *  localName: () => string | undefined;
 *  prefix: () => string | undefined;
 *  piTarget: () => string | undefined;
 *  text: (raw?: boolean) => string | undefined;
 *  attributes: (raw?: boolean) => Attributes | undefined | "error";
 *  error: () => string | undefined;
 *}}
 * TSax
 */

/**
* @param {string} S
*/
function tSax(S) {
  let pos = 0;
  let tagNameStart = -1;
  let tagNameEnd = -1;
  let tagEnd = -1;
  let textStart = -1;
  let textEnd = -1;
  let piTargetEnd = -1;
  let mightHaveAttributes = false;
  /** Set to `true` if we're in text nodes where we need to account for escaped
   * text, or in element tags where attributes might contain entity escapes.
   */
  let textIsEscaped = false;
  /** @type {string|undefined} */
  let error = undefined;

  /** @type {{[tagName: string]: string}} */
  const localNameCache = {};
  /** @type {{[tagName: string]: string}} */
  const prefixCache = {};
  /** @type {{[entity: string]: string}} */
  const entityCache = {
    lt: "<",
    gt: ">",
    amp: "&",
    quot: '"',
    apos: "'",
  };

  /**
   * Only to be used in the error case as the calculation is pretty expensive
   * for large files.
   * @param {number} errorPos
   * @returns string
   */
  function humanReadablePos(errorPos) {
    let lineNumber = 0;
    let pos = 0;
    let lineStartPos = 0;

    while (pos > 0 && pos < errorPos) {
      lineStartPos = pos;
      pos = S.indexOf("\n", pos);
      lineNumber += 1;
    }

    return `${lineNumber + 1}:${errorPos - lineStartPos + 1}`;
  }

  /**
   * @param {number} errorPos
   * @param {string} message
   * @returns {"error"}
   */
  function err(errorPos, message) {
    error = message + ` at ${humanReadablePos(errorPos)}`;
    return "error";
  }

  /**
   * @param {number} errorPos
   * @param {string} scanningFor
   * @returns {"error"}
   */
  function unexpectedEOF(errorPos, scanningFor) {
    return err(
      errorPos,
      "Unexpected end of file while scanning for " + scanningFor
    );
  }

  function parseDoctype() {
    // Skip the 10 characters of '<!DOCTYPE '
    tagNameStart = pos + 10;
    pos += 11;
    tagNameEnd = posOfFirst(nameEndChars);
    // We have to skip any '<!ELEMENT>', '<!ENTITY>', '<!ATTLIST>' or
    // '<!NOTATION>' declarations. We do this by counting opening and closing
    // '<' and '>' brackets. Initially, we have 1 open bracket from
    // '<!DOCTYPE ':
    let bracketCount = 1;
    // TODO: Register any entity declarations for entity resolution.

    do {
      switch (S[pos]) {
        case "<":
          if (S[pos + 1] === "?") {
            // Parsing a processing instruction inside this will mess with our
            // positions, so back them up and restore them
            const positionBackup = [tagNameStart, tagNameEnd];
            parseProcessingInstruction();
            [tagNameStart, tagNameEnd] = positionBackup;
          } else {
            bracketCount += 1;
          }
          break;
        case ">":
          bracketCount -= 1;
          break;
      }
      pos += 1;
    } while (bracketCount > 0 && pos < S.length);

    textStart = tagNameEnd;
    textEnd = pos - 1;
    return bracketCount === 0
      ? "doctype"
      : unexpectedEOF(textStart, "doctype end");
  }

  /**
   * @param {"cdata"|"comment"|"text"} type
   * @param {number} skip  Number of characters before actual text begins
   * @param {number} skipEnd  Number of characters to skip after the text end,
   * e.g. for comment 3 characters (length of '-->'), but 0 for text as the
   * trailing '<' already starts the next event.
   * @param {string} end  String that ends the text, e.g. '-->' for comment
   * @returns {"cdata"|"comment"|"error"|"processingInstruction"|"text"}
   */
  function parseText(type, skip, skipEnd, end) {
    textStart = pos + skip;
    textEnd = S.indexOf(end, textStart);
    pos = textEnd + skipEnd;
    return textEnd > 0 ? type : unexpectedEOF(textStart, end);
  }

  function parseEndTag() {
    tagNameStart = pos + 2;
    tagNameEnd = S.indexOf(">", pos);
    if (tagNameEnd < 0) {
      return unexpectedEOF(tagNameStart, "'>'");
    }
    pos = tagNameEnd + 1;
    // All other whitespace character codes are smaller than that of space (" ")
    while (S.charCodeAt(tagNameEnd - 1) <= spaceCC) {
      tagNameEnd -= 1;
    }
    return "endTag";
  }

  function parseStartTag() {
    tagNameStart = pos + 1;
    pos += 2;
    tagNameEnd = posOfFirst(nameEndChars);
    tagEnd = S.indexOf(">", tagNameEnd);
    if (tagEnd < 0) {
      return unexpectedEOF(tagNameStart, "'>'");
    }
    pos = tagEnd + 1;
    mightHaveAttributes = true;
    return S.charCodeAt(tagEnd - 1) === slashCC ? "singleTag" : "startTag";
  }

  function parseProcessingInstruction() {
    tagNameStart = pos + 2;
    pos += 3;
    piTargetEnd = posOfFirst(nameEndChars);
    tagEnd = S.indexOf("?>", piTargetEnd);
    if (tagEnd < 0) {
      return unexpectedEOF(tagNameStart, "'?>'");
    }
    textStart = piTargetEnd + 1;
    textEnd = tagEnd >= textStart ? tagEnd : textStart;
    pos = tagEnd + 2;
    return "processingInstruction";
  }

  /**
   *
   * @param {(true|undefined)[]} endChars  An array mapping end character codes
   * to `true`.
   * @returns {number}  The position of the first found
   */
  function posOfFirst(endChars) {
    while (!endChars[S.charCodeAt(pos)] && pos < S.length) {
      pos += 1;
    }
    return pos;
  }

  /**
   * Caches the local name of `tagName` and returns it
   * @param {string} tagName
   * @returns {string} the local name
   */
  function cacheLocalName(tagName) {
    const localName = tagName.split(":").pop() || "";
    localNameCache[tagName] = localName;
    return localName;
  }

  /**
   * Caches the prefix of `tagName` and returns it. If `tagName` has no prefix,
   * the empty string is returned.
   * @param {string} tagName
   * @returns {string} the local name
   */
  function cachePrefix(tagName) {
    const nameComponents = tagName.split(":");
    const prefix = nameComponents.length === 1 ? "" : nameComponents[0];
    prefixCache[tagName] = prefix;
    return prefix;
  }

  /**
   * @param {string} entity
   * @returns {string|undefined}  Unescaped entity. `undefined` if the entity
   * was malformed.
   */
  function cacheEntity(entity) {
    // We know we have a numeric entity, because the other entities that XML
    // knows are already in the cache by default.
    const isHex = entity.charCodeAt(1) === letterxCC;
    const charCode = isHex
      ? parseInt(entity.substring(2), 16)
      : parseInt(entity.substring(1), 10);
    if (isNaN(charCode)) {
      return undefined;
    }
    const char = String.fromCharCode(charCode);
    entityCache[entity] = char;
    return char;
  }

  /**
   * @param {string} rawText
   * @returns {string|undefined}  `undefined` is returned when there's a
   * problem with unescaping.  In that case, en error message is set.
   */
  function unescapeText(rawText) {
    let ampIndex = rawText ? rawText.indexOf("&") : -1;
    if (!rawText || ampIndex < 0) {
      return rawText;
    }

    let semicolonIndex = -1;
    let text = "";

    while (ampIndex >= 0) {
      text += rawText.substring(semicolonIndex + 1, ampIndex);
      semicolonIndex = rawText.indexOf(";", ampIndex + 2);
      if (semicolonIndex < 0) {
        err(textStart + ampIndex + 2, "Missing semicolon");
      }
      const entity = rawText.substring(ampIndex + 1, semicolonIndex);
      const resolved = entityCache[entity] || cacheEntity(entity);
      if (!resolved) {
        err(textStart + semicolonIndex, `Unresolveable entity "${entity}"`);
        return undefined;
      }
      text += resolved;

      ampIndex = rawText.indexOf("&", semicolonIndex + 1);
    }

    return text + rawText.substring(semicolonIndex + 1);
  }

  return {
    /**
     * This is the main method for interacting with tSax. It consumes the next
     * event from the XML string and returns the event type it found. Further
     * parsing of data belonging to this event is only done on request, using
     * methods `tagName()`, `attributes()`, `rawText()` and so on. This makes
     * processing very fast when one is only interested in accessing data of
     * some very specific events.
     *
     * @example <caption>Looking for the next occurrence of a `<foo>`
     * element</caption>
     * const tsax = tSax(xmlString);
     * while (true) {
     *   switch (tsax.next()) {
     *     case "element":
     *       break;
     *     case "eof":
     *     case "error":
     *       throw new Error("Did not find expected element <foo>");
     *     default:
     *       continue;
     *   }
     *   if (tsax.tagName() === "foo") {
     *     break;
     *   }
     * }
     * console.log(tsax.attributes());
     *
     *
     * @example <caption>Building a DOM tree</caption>
     * // Intialize with the root node
     * let currentElement = {children: []};
     * const elementStack = [];
     *
     * while (true) {
     *   switch (tsax.next()) {
     *     case "startTag":
     *       const element = {
     *         tagName: tsax.tagName(),
     *         attributes: tsax.attributes(),
     *         children: [],
     *       };
     *       currentElement.children.push(element);
     *       currentElement = element;
     *       elementStack.push(element);
     *       break;
     *     case "endTag":
     *       currentElement = elementStack.pop();
     *       if (!currentElement) {
     *         throw new Error("Too many closing tags");
     *       }
     *       break;
     *     case "text":
     *     case "cdata":
     *       currentElement.children.push(tsax.rawText());
     *       break;
     *     case "error":
     *       throw new Error(tsax.error());
     *     case "eof":
     *       if (elementStack.length !== 1) {
     *         throw new Error("Missing closing tags");
     *       }
     *       // The root node only has one child, the root element.
     *       return currentElement.children[0];
     *     }
     *   }
     * }
     *
     * @returns {EventType}  One of the following event types.  Depending on the
     * current event, specific methods of the TSax object are avilable to get
     * more information about the event.
     *
     * * `"cdata"`: A CDATA node. Available methods:
     *   * `rawText()`
     * * `"comment"`: A comment node. Available methods:
     *   * `rawText()`
     * * `"doctype"`: A doctype declaration. Available methods:
     *   * `rawText()`
     * * `"endTag"`: An closing tag. Available methods:
     *   * `localName()`
     *   * `prefix()`
     *   * `tagName()`
     * * `"eof"`: The end of the file was reached. No methods available.
     * * `"error"`: An error occurred during parsing. Available methods:
     *   * `error()`
     * * `"processingInstruction"`: A processing instruction. Available methods:
     *   * `rawText()`
     * * `"singleTag"`: A self closing tag. Available methods:
     *   * `attributes()`
     *   * `localName()`
     *   * `prefix()`
     *   * `tagName()`
     * * `"startTag"`: A start tag. The same methods as for `"singleTag"` are
     *   available.
     * * `"text"`:  A text node. Available methods:
     *   * `rawText()`
     */
    next: function next() {
      tagNameEnd = -1;
      textEnd = -1;
      piTargetEnd = -1;
      mightHaveAttributes = false;
      textIsEscaped = false;

      if (S.charCodeAt(pos) !== openBracketCC) {
        // When there is an error scanning for "<" (i.e. no "<" found), this is
        // not really an error for text nodes. We just reached the end of file.
        // The final closing tag may be followed by a text node with only
        // whitespace (which we don't check).
        textIsEscaped = true;
        return parseText("text", 0, 0, "<") === "error" ? "eof" : "text";
      }
      switch (S.charCodeAt(pos + 1)) {
        case slashCC:
          return parseEndTag();
        case questionCC:
          return parseProcessingInstruction();
        case exclamationCC:
          switch (S.charCodeAt(pos + 2)) {
            case minusCC:
              // Skip the 4 characters of '<!--
              return parseText("comment", 4, 3, "-->");
            case openCornerBracketCC:
              // Skip 9 characters of "<![CDATA["
              return parseText("cdata", 9, 3, "]]>");
            case letterDCC:
              return parseDoctype();
            default:
              return err(
                pos,
                `Unexpected character sequence ${S.substring(pos, pos + 3)}`
              );
          }
      }
      // Set the escaping flag because attributes are escaped
      textIsEscaped = true;
      return parseStartTag();
    },

    /**
     * @returns {string|undefined}  Tag name of the current event, preserving
     * original upper/lower case, including prefix. `undefined` if the current
     * event is not a start or end tag.
     */
    tagName: function () {
      return tagNameEnd > 0 ? S.substring(tagNameStart, tagNameEnd) : undefined;
    },

    localName: function () {
      const tagName = this.tagName();
      return tagName && (localNameCache[tagName] || cacheLocalName(tagName));
    },

    prefix: function () {
      const tagName = this.tagName();
      return tagName && (prefixCache[tagName] || cachePrefix(tagName));
    },

    /**
     * @returns {string|undefined} The processing instruction target, i.e. the
     * "tag name" of a processing instruction. `undefined` if the current event
     * is not a processing instruction.
     */
    piTarget: function () {
      return piTargetEnd > 0
        ? S.substring(tagNameStart, piTargetEnd)
        : undefined;
    },

    /***
     * Only available if the current event is `"cdata"`, `"comment"`,
     * `"doctype"`, `"processingInstruction"`, or `"text"`. Otherwise,
     * `undefined` is returned.
     * @param {boolean} [raw]  If `true`, will return XML text verbatim. If
     * falsy, entities will be resolved.
     * @returns {string|undefined}  If there was a problem resolving entities,
     * `undefined` is returned and an error message can be retrieved with
     * `error()`.
     */
    text: function (raw) {
      if (textEnd < 0) {
        return undefined;
      }
      const rawText = S.substring(textStart, textEnd);
      return raw || !textIsEscaped ? rawText : unescapeText(rawText);
    },

    /**
     * @param {boolean} [raw]  If `true`, will return attribute values varbatim.
     * If falsy, entities will be resolved.
     * @returns {Attributes | undefined | "error"} An object mapping attribute
     * names to attribute values.  Attribute names include prefixes.  Namespace
     * declarations are treated like regular attributes.
     *
     * Only available if the current event is `"singleTag"` or `"startTag"`,
     * otherwise returns `undefined`.
     *
     * If an error occurs during attribute parsing, returns `"error"`. To get
     * the error message, use the `error()` method.
     */
    attributes: function (raw) {
      if (!mightHaveAttributes) {
        return undefined;
      }

      /** @type {Attributes} */
      const attributes = {};

      if (tagEnd - tagNameEnd < 5) {
        // There's no space for any attributes, so return early. The shortest
        // XML attribute needs 5 characters, including leading space: ` x=""`
        return attributes;
      }

      // Rewind the cursor
      pos = tagNameEnd;

      while (true) {
        const attributeStart = pos + 1;

        if (
          S.charCodeAt(posOfFirst(attributeNameEndChars)) === closeBracketCC
        ) {
          pos += 1;
          return attributes;
        }

        // Found "=" at pos
        const attributeName = S.substring(attributeStart, pos).trim();
        const valueStart = posOfFirst(quoteChars) + 1;
        const quote = S[valueStart - 1];
        const valueEnd = S.indexOf(quote, valueStart);
        if (pos >= S.length) {
          return unexpectedEOF(attributeStart, "attribute delimiters");
        }
        const rawValue = S.substring(valueStart, valueEnd);
        if (raw) {
          attributes[attributeName] = rawValue;
        } else {
          const value = unescapeText(rawValue);
          if (value === undefined) {
            return undefined;
          }
          attributes[attributeName] = value;
        }

        pos = valueEnd + 1;
      }
    },

    /**
     * @returns  Error message. `undefined` unless the current event is an error
     * event.
     */
    error: function () {
      return error;
    },
  };
}

try {
  module.exports.tSax = tSax;
} catch (e) {}
