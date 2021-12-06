/**
 * Not type-checking this file because it's mostly vendor code.
 */

/*!
 * HTML Parser By John Resig (ejohn.org)
 * Modified by Juriy "kangax" Zaytsev
 * Original code by Erik Arvidsson (MPL-1.1 OR Apache-2.0 OR GPL-2.0-or-later)
 * http://erik.eae.net/simplehtmlparser/simplehtmlparser.js
 */

import { makeMap, no } from 'shared/util'
import { isNonPhrasingTag } from 'web/compiler/util'
import { unicodeRegExp } from 'core/util/lang'

// Regular Expressions for parsing tags and attributes
const attribute = /^\s*([^\s"'<>\/=]+)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/  // 匹配标签属性
const dynamicArgAttribute = /^\s*((?:v-[\w-]+:|@|:|#)\[[^=]+?\][^\s"'<>\/=]*)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/
const ncname = `[a-zA-Z_][\\-\\.0-9_a-zA-Z${unicodeRegExp.source}]*`  // 不包含前缀的XML标签名称
const qnameCapture = `((?:${ncname}\\:)?${ncname})`  // 合法的标签名称
const startTagOpen = new RegExp(`^<${qnameCapture}`) // 匹配开始标签的一部分，包括<及后面的标签名称
const startTagClose = /^\s*(\/?)>/  // 捕获开始标签结束部分的斜杠/
const endTag = new RegExp(`^<\\/${qnameCapture}[^>]*>`) //匹配结束标签
const doctype = /^<!DOCTYPE [^>]+>/i  // 匹配文档的DOCTYPE标签
const comment = /^<!\--/  // 匹配注释节点
const conditionalComment = /^<!\[/   // 匹配条件注释节点

// 是否是纯文本标签
export const isPlainTextElement = makeMap('script,style,textarea', true)
const reCache = {}

const decodingMap = {
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&amp;': '&',
  '&#10;': '\n',
  '&#9;': '\t',
  '&#39;': "'"
}
const encodedAttr = /&(?:lt|gt|quot|amp|#39);/g
const encodedAttrWithNewLines = /&(?:lt|gt|quot|amp|#39|#10|#9);/g

// #5992
const isIgnoreNewlineTag = makeMap('pre,textarea', true)
// 检测是否应该忽略元素内容的第一个换行符
const shouldIgnoreFirstNewline = (tag, html) => tag && isIgnoreNewlineTag(tag) && html[0] === '\n'

function decodeAttr (value, shouldDecodeNewlines) {
  const re = shouldDecodeNewlines ? encodedAttrWithNewLines : encodedAttr
  return value.replace(re, match => decodingMap[match])
}

// 词法分析
export function parseHTML(html, options) {
  // 定义一些常量和变量
  const stack = []
  const expectHTML = options.expectHTML
  const isUnaryTag = options.isUnaryTag || no  // 检测是否为一元标签
  const canBeLeftOpenTag = options.canBeLeftOpenTag || no // 检测一个标签是否是可以省略闭合标签的非一元标签
  let index = 0  // 标识着当前字符流的读入位置
  let last, lastTag   // last存储还未parse的html字符串 lastTag存储着位于stack栈顶的元素

  // 开启一个while循环，循环结束的条件是html为空，即html被parse完毕
  while (html) {
    last = html
    if (!lastTag || !isPlainTextElement(lastTag)) {
      // 确保即将parse的内容不是在纯文本标签里（script，style，textarea）
      let textEnd = html.indexOf('<')
      if (textEnd === 0) {
        // 有可能是注释节点 <!-- -->
        if (comment.test(html)) {
          const commentEnd = html.indexOf('-->')

          // 如果找到了 --> 说明确实是注释节点
          if (commentEnd >= 0) {
            if (options.shouldKeepComment) {
              options.comment(html.substring(4, commentEnd), index, index + commentEnd + 3)
            }
            advance(commentEnd + 3)
            continue
          }
        }

        // 有可能是条件注释节点 <![]>
        if (conditionalComment.test(html)) {
          const conditionalEnd = html.indexOf(']>')

          if (conditionalEnd >= 0) {
            advance(conditionalEnd + 2)
            continue
          }
        }

        // 有可能是Doctype:  <!DOCTYPE>
        const doctypeMatch = html.match(doctype)
        if (doctypeMatch) {
          advance(doctypeMatch[0].length)
          continue
        }

        // 有可能是End tag:  </div>
        const endTagMatch = html.match(endTag)
        if (endTagMatch) {
          const curIndex = index
          advance(endTagMatch[0].length)
          parseEndTag(endTagMatch[1], curIndex, index)
          continue
        }

        // Start tag: <div>
        const startTagMatch = parseStartTag()
        /**
         * eg.<div v-if="isSucceed" v-for="v in map"></div>
         * startTagMatch = {
            tagName: 'div',
            attrs: [
              [
                ' v-if="isSucceed"',
                'v-if',
                '=',
                'isSucceed',
                undefined,
                undefined
              ],
              [
                ' v-for="v in map"',
                'v-for',
                '=',
                'v in map',
                undefined,
                undefined
              ]
            ],
            start: index,
            unarySlash: undefined,
            end: index
          }
        */
        if (startTagMatch) {
          handleStartTag(startTagMatch)
          if (shouldIgnoreFirstNewline(startTagMatch.tagName, html)) {
            advance(1)
          }
          continue
        }
      }

      // 处理第一个字符是< 但没有成功匹配的标签
      // 或第一个字符不是< 的字符串
      let text, rest, next
      if (textEnd >= 0) {
        rest = html.slice(textEnd)
        while (
          !endTag.test(rest) &&
          !startTagOpen.test(rest) &&
          !comment.test(rest) &&
          !conditionalComment.test(rest)
        ) {
          next = rest.indexOf('<', 1)
          if (next < 0) break
          textEnd += next
          rest = html.slice(textEnd)
        }
        text = html.substring(0, textEnd)
      }

      if (textEnd < 0) {
        text = html
      }

      if (text) {
        advance(text.length)
      }

      if (options.chars && text) {
        options.chars(text, index - text.length, index)
      }
    } else {
      // 将parse的内容是在纯文本标签里（script，style，textarea）
      // 处理的是纯文本标签的内容，而不是纯文本标签
      // eg. <textarea>aaaaaa</textarea>bbbb
      let endTagLength = 0 // 闭合标签的字符长度
      const stackedTag = lastTag.toLowerCase()
      const reStackedTag = reCache[stackedTag] || (reCache[stackedTag] = new RegExp('([\\s\\S]*?)(</' + stackedTag + '[^>]*>)', 'i'))//正则：匹配纯文本标签的内容及结束标签
      const rest = html.replace(reStackedTag, function (all, text, endTag) {
        // all:整个匹配的字符串aaaaaa</textarea> 
        // text:第一个捕获组的值 aaaaaa
        // endTag:结束标签 </textarea>
        endTagLength = endTag.length
        if (!isPlainTextElement(stackedTag) && stackedTag !== 'noscript') {
          text = text
            .replace(/<!\--([\s\S]*?)-->/g, '$1') // #7298
            .replace(/<!\[CDATA\[([\s\S]*?)]]>/g, '$1')
        }
        // 忽略pre和textarea标签的内容中的第一个换行符
        if (shouldIgnoreFirstNewline(stackedTag, text)) {
          text = text.slice(1)
        }
        if (options.chars) {
          options.chars(text)
        }
        return ''
      })
      index += html.length - rest.length
      html = rest
      parseEndTag(stackedTag, index - endTagLength, index)
    }

    // 将整个字符串作为文本对待
    if (html === last) {
      options.chars && options.chars(html)
      if (process.env.NODE_ENV !== 'production' && !stack.length && options.warn) {
        options.warn(`Mal-formatted tag at end of template: "${html}"`, { start: index + html.length })
      }
      break
    }
  }

  // 调用parseEndTag函数
  parseEndTag()

  // advance函数 n为匹配到的字符串长度，该函数的作用是更新html字符串，剔除掉parse完毕的字符串
  function advance (n) {
    index += n
    html = html.substring(n)
  }

  // 用来parse开始标签
  function parseStartTag() {
    // eg.<div v-for="v in map"></div>
    const start = html.match(startTagOpen); // start = ['<div','div']
    if (start) {
      const match = {
        tagName: start[1],
        attrs: [],
        start: index,
      };
      advance(start[0].length);
      let end, attr;
      // 循环的条件：没有匹配到开始标签的结束部分&&匹配到了属性
      // 直到遇到开始标签的结束部分，停止循环
      while (
        !(end = html.match(startTagClose)) &&
        (attr = html.match(dynamicArgAttribute) || html.match(attribute))
      ) {
        /**
         * attr = [
         *  'v-for="v in map"',
         *  'v-for','=',
         *  'v in map',
         *  undefined,
         *  undefined
         * ]
         */
        attr.start = index;
        advance(attr[0].length);
        attr.end = index;
        match.attrs.push(attr);
      }
      // 即使匹配到了开始标签的开始部分，以及属性部分，但是没有匹配到开始标签的结束部分，则说明这不是一个开始标签
      // 只有end存在即匹配到了结束部分才能说明这是一个开始标签
      if (end) {
        /**
         * eg.<br />
         * end = ['/>','/']
         * eg. <div>
         * end = ['>',undefined]
        */
        match.unarySlash = end[1]; // 是否为一元标签
        advance(end[0].length);
        match.end = index;
        return match;
      }
    }
  }
  // parseStartTag的返回结果demo
  // eg. <div v-if="isSucceed" v-for="v in map"></div>
  // match = {
  //   tagName: "div",
  //   attrs: [
  //     [' v-if="isSucceed"', "v-if", "=", "isSucceed", undefined, undefined],
  //     [' v-for="v in map"', "v-for", "=", "v in map", undefined, undefined],
  //   ],
  //   start: index,
  //   unarySlash: undefined,
  //   end: index,
  // };

  // 用来处理parseStartTag结果
  function handleStartTag (match) {
    const tagName = match.tagName  // 开始标签的标签名
    const unarySlash = match.unarySlash // '/' 或 undefined，判断是否为一元标签

    if (expectHTML) {
      // 最近一次遇到的开始标签是p标签，并且当前正在解析的开始标签不是段落式内容
      if (lastTag === 'p' && isNonPhrasingTag(tagName)) {
        parseEndTag(lastTag) // 调用该函数闭合p标签  eg. <p><div>123</div> => <p></p><div>123</div>
      }
      // 当前正在解析的标签是一个可以省略结束标签的标签，并且与上次解析到的开始标签相同
      if (canBeLeftOpenTag(tagName) && lastTag === tagName) {
        parseEndTag(tagName)
      }
    }

    // 为真则代表是一元标签，否则为二元标签
    const unary = isUnaryTag(tagName) || !!unarySlash

    const l = match.attrs.length
    const attrs = new Array(l)  // 和match.attrs数组长度相等的数组

    // 这个for循环的作用是：格式化match.attrs数组，并将格式化后的数据存储到attrs中
    // 格式化后的数据只包含name和value两个字段，其中name是属性名，value是属性的值
    for (let i = 0; i < l; i++) {
      const args = match.attrs[i]
      const value = args[3] || args[4] || args[5] || ''
      const shouldDecodeNewlines = tagName === 'a' && args[1] === 'href'
        ? options.shouldDecodeNewlinesForHref
        : options.shouldDecodeNewlines
      attrs[i] = {
        name: args[1],
        value: decodeAttr(value, shouldDecodeNewlines) // decodeAttr的作用是对属性值中所包含的html实体进行解码
      }
      if (process.env.NODE_ENV !== 'production' && options.outputSourceRange) {
        attrs[i].start = args.start + args[0].match(/^\s*/).length
        attrs[i].end = args.end
      }
    }

    // 非一元标签，则入栈，并将lastTag的值设置为该标签名
    if (!unary) {
      stack.push({ tag: tagName, lowerCasedTag: tagName.toLowerCase(), attrs: attrs, start: match.start, end: match.end })
      lastTag = tagName
    }

    if (options.start) {
      options.start(tagName, attrs, unary, match.start, match.end)
    }
  }

  // parse结束标签
  // 作用：
  // 1.缺省结束标签时给用户提示；
  // 2.处理stack栈中剩余未被处理的标签；
  // 3.专门处理br与p的结束标签</br ></p >
  function parseEndTag (tagName, start, end) {
    let pos, // pos用来存储结束标签所对应的开始标签在stack栈中的位置，判断是否有元素缺少闭合标签
      lowerCasedTagName; // 存储tagName的小写版
    if (start == null) start = index;
    if (end == null) end = index;

    // 寻找当前解析的结束标签所对应的开始标签在stack栈中的位置
    if (tagName) {
      lowerCasedTagName = tagName.toLowerCase();
      for (pos = stack.length - 1; pos >= 0; pos--) {
        if (stack[pos].lowerCasedTag === lowerCasedTagName) {
          break;
        }
      }
    } else {
      pos = 0;
    }

    if (pos >= 0) {
      for (let i = stack.length - 1; i >= pos; i--) {
        if (
          process.env.NODE_ENV !== "production" &&
          (i > pos || !tagName) &&
          options.warn
        ) {
          options.warn(`tag <${stack[i].tag}> has no matching end tag.`, {
            start: stack[i].start,
            end: stack[i].end,
          });
        }
        // 调用options.end闭合标签，保证后续解析结果的正确性
        if (options.end) {
          options.end(stack[i].tag, start, end);
        }
      }

      stack.length = pos;
      lastTag = pos && stack[pos - 1].tag;
    } else if (lowerCasedTagName === "br") { // tagName没有在stack栈中找到对应的开始标签时，pos为-1，即有结束标签没开始标签 br p
      if (options.start) {
        options.start(tagName, [], true, start, end);
      }
    } else if (lowerCasedTagName === "p") {
      if (options.start) {
        options.start(tagName, [], false, start, end);
      }
      if (options.end) {
        options.end(tagName, start, end);
      }
    }
  }
}
