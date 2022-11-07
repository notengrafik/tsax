export type EventType = "cdata" | "comment" | "doctype" | "endTag" | "eof" | "error" | "processingInstruction" | "singleTag" | "startTag" | "text";
export type Attributes = {
    [attributeName: string]: string;
};
export type TSax = {
    next: () => EventType;
    tagName: () => string | undefined;
    localName: () => string | undefined;
    prefix: () => string | undefined;
    piTarget: () => string | undefined;
    text: (raw?: boolean) => string | undefined;
    attributes: (raw?: boolean) => Attributes | undefined | "error";
    error: () => string | undefined;
};
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
export function tSax(S: string): {
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
    next: () => EventType;
    /**
     * @returns {string|undefined}  Tag name of the current event, preserving
     * original upper/lower case, including prefix. `undefined` if the current
     * event is not a start or end tag.
     */
    tagName: () => string | undefined;
    localName: () => string | undefined;
    prefix: () => string | undefined;
    /**
     * @returns {string|undefined} The processing instruction target, i.e. the
     * "tag name" of a processing instruction. `undefined` if the current event
     * is not a processing instruction.
     */
    piTarget: () => string | undefined;
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
    text: (raw?: boolean | undefined) => string | undefined;
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
    attributes: (raw?: boolean | undefined) => Attributes | undefined | "error";
    /**
     * @returns  Error message. `undefined` unless the current event is an error
     * event.
     */
    error: () => string | undefined;
};
