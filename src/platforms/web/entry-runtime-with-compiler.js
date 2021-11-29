/* @flow */

import config from 'core/config'
import { warn, cached } from 'core/util/index'
import { mark, measure } from 'core/util/perf'

import Vue from './runtime/index'
import { query } from './util/index'
import { compileToFunctions } from './compiler/index'
import { shouldDecodeNewlines, shouldDecodeNewlinesForHref } from './util/compat'

const idToTemplate = cached(id => {
  const el = query(id)
  return el && el.innerHTML
})

// 先缓存Vue构造函数中的$mount
const mount = Vue.prototype.$mount
// 再重写Vue构造函数中的$mount
Vue.prototype.$mount = function (
  el?: string | Element,
  hydrating?: boolean
): Component {
  el = el && query(el)

  // el不允许是body或者html标签，因为挂载点的本意是组件挂载的占位
  // 它将会被组件自身的模板替换掉，而body和html是不能被替换掉的
  if (el === document.body || el === document.documentElement) {
    process.env.NODE_ENV !== 'production' && warn(
      `Do not mount Vue to <html> or <body> - mount to normal elements instead.`
    )
    return this
  }

  const options = this.$options
  // 如果render函数不存在，则使用template或el选项构建render函数
  if (!options.render) {
    let template = options.template;
    // template选项存在
    if (template) {
      // template为字符串
      if (typeof template === "string") {
        // 如果第一个字符是'#'，则会把该字符串作为id，去获取对应的元素，并把该元素的innerHTML作为模板
        if (template.charAt(0) === "#") {
          template = idToTemplate(template);
          if (process.env.NODE_ENV !== "production" && !template) {
            warn(
              `Template element not found or is empty: ${options.template}`,
              this
            );
          }
        }
        // template为元素节点，则使用该元素节点的innerHTML作为模板
      } else if (template.nodeType) {
        template = template.innerHTML;
      } else {
        // template既不是字符串，也不是元素节点，则在非生产环境下会提示开发者template参数无效
        if (process.env.NODE_ENV !== "production") {
          warn("invalid template option:" + template, this);
        }
        return this;
      }
    } else if (el) {
      // template选项不存在，使用el元素的outerHTML作为模板内容
      template = getOuterHTML(el);
    }

    // 处理完上面的语句后，template可能是一个空字符串，这里需要判断
    if (template) {
      // 统计编译器性能的标签
      if (process.env.NODE_ENV !== "production" && config.performance && mark) {
        mark("compile");
      }

      // compileToFunctions 将template编译成渲染函数render
      const { render, staticRenderFns } = compileToFunctions(
        template,
        {
          outputSourceRange: process.env.NODE_ENV !== "production",
          shouldDecodeNewlines, // 浏览器怪癖兼容
          shouldDecodeNewlinesForHref, // 浏览器怪癖兼容
          delimiters: options.delimiters,  // 将delimiters和comments透传
          comments: options.comments,
        },
        this
      );
      //将render和staticRenderFns添加到$options中，其中options是$options的引用 
      options.render = render;
      options.staticRenderFns = staticRenderFns;

      // 统计编译器性能的标签
      if (process.env.NODE_ENV !== "production" && config.performance && mark) {
        mark("compile end");
        measure(`vue ${this._name} compile`, "compile", "compile end");
      }
    }
  }
  return mount.call(this, el, hydrating)
}

/**
 * Get outerHTML of elements, taking care
 * of SVG elements in IE as well.
 */
function getOuterHTML (el: Element): string {
  if (el.outerHTML) {
    return el.outerHTML
  } else {
    const container = document.createElement('div')
    container.appendChild(el.cloneNode(true))
    return container.innerHTML
  }
}

Vue.compile = compileToFunctions

export default Vue
