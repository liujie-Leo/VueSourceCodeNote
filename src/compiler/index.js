/* @flow */

import { parse } from './parser/index'
import { optimize } from './optimizer'
import { generate } from './codegen/index'
import { createCompilerCreator } from './create-compiler'

// `createCompilerCreator` allows creating compilers that use alternative
// parser/optimizer/codegen, e.g the SSR optimizing compiler.
// Here we just export a default compiler using the default parts.
export const createCompiler = createCompilerCreator(
  function baseCompile(template: string, options: CompilerOptions): CompiledResult {
    // 调用parse函数将字符串模板解析成抽象语法书 
    const ast = parse(template.trim(), options)

    // 调用optimize函数优化ast
    if (options.optimize !== false) {
      optimize(ast, options)
    }

    // 调用generate函数将ast编译成渲染函数
    const code = generate(ast, options)
    return {
      ast,
      render: code.render,
      staticRenderFns: code.staticRenderFns
    }
  }
)


// AST element模板
const element = {
  type: 1,                                 // 节点类型  1：标签；2：含自变量表达式的文本节点；3：普通文本节点或注释节点；
  expression: "'abc'+_s(name)+'def'",      // 标签节点才有
  tokens:[                                 // 含自变量表达式的文本节点才有
    'abc', 
    {'@binding': '_s(name)'},
    'def'
  ],
  tag: 'div',                               // 标签名称；节点类型type为1时才有
  attrsList:[                               // 标签属性才有，存储原始html属性名和值
    {name:'v-for',value:'obj of list'},
    {name:'class',value:'box'}
  ],
  attrsMap:{                                 // 以键值对的形式存储html属性名和值    
    'v-for':'obj of list',
    'class':'box'
  },
  attrs:[                                     // attrs不同于attrsList attrsList仅用于解析阶段 attrs用于代码生成阶段、运行时
    {name:'v-for',value:'obj of list'},
    {name:'class',value:'box'}
  ],
  props: [                                    // props 数组中的属性则会直接通过 DOM 元素对象访问并添加
    {
      name: 'innerHTML',
      value:'"some text"'
    }
  ],
  pre: true,                                    // 真假代表标签是否使用了pre属性
  ns: 'svg',                                    // svg或math标签会有ns属性，值为对应的标签名
  forbidden: true,                              // 真假代表该节点是否在Vue模板语法中禁止使用 比如style标签、没有type属性的标签、type为text/javascript的标签
  parent: {},                                   // 父节点元素描述对象的引用
  children: [],                                 // 子节点元素描述对象的引用
  ifConditions: [                               // 如果一个标签使用v-if指令，则该标签的描述对象会拥有ifConfitions属性，为数组。如果一个标签使用v-else-if或v-else，则该标签不会被添加到父节点元素描述对象的children中，而是会被添加到相符带有v-if指令节点的元素描述对象的ifConditions数组中
    {
      exp: 'a',
      block:{type:1, tag:'div'}                 // 节点元素描述对象的ifConditions数组中也会包含节点自身的元素描述对象
    },
    {
      exp: 'b',
      block:{tyoe:1, tag:'div'}
    },
    {
      exp: '',
      block:{tyoe:1, tag:'div'}
    }
  ],
  if: 'a',
  elseif: 'b',
  else:true,
  slotName: '"header"',                          // <slot name="header"> 只有<slot>标签的元素描述对象才会拥有slotName属性，代表该插槽的名字
  slotTarget: '"header"',                        // <div slot="header"> 如果一个标签使用了slot，则说明该标签会被作为插槽位置，为了识别该标签将被插入位置，该标签的元素描述对象会拥有slotTarget属性，默认default
  slotScope: 'scopeData',                        // slot-scope特性来指定一个插槽内容是作用域插槽
  for: 'list',                                   // <div v-for="(obj,key,index) of list">
  alias: 'obj',
  iterator1: 'key',
  iterator2: 'index',
  once: true,                                     // 标签使用v-once指令，该标签的元素描述对象就会包含once，为一个布尔值
  key: 'unique',
  ref: 'form',
  refInFor: true,                                 // 如果使用了ref特性的标签同时使用了v-for，则为true
  component: 'currentView',                       // 如果标签使用is特性，则其元素描述对象将会拥有component属性
  inlineTemplate: true,                           // 是否内联模板
  hasBindings:true,                               // 当前节点是否拥有绑定，即如果使用了指令就为true
  events: {                                       // 如果标签使用了v-on或@绑定事件，则该标签元素描述对象中将包含events属性
    'click': {                                    // <div @click.stop="handleClick">
      value: 'handleClick',
      modifiers: {
        stop:true
      }
    }
  },
  directives: [                                    // 出现在directives中的指令只包含部分内置指令和全部自定义指令
    {                                              // <div v-custom-dir:arg.modif="val"></div>
      name: 'custom-dir',
      rawName: 'v-custom-dir:arg.modif',
      value: 'val',
      arg: 'arg',
      modifiers: {
        modif: true
      }
    }
  ],
  staticClass: '"a b c"',                            // 如果标签使用了静态class，则该标签的描述对象将拥有staticClass属性
  classBinding: '{active:true}',                     // 绑定的class
  staticStyle: '{"color":"red","background":"green"}',
  styleBinding: '{ backgroundColor: green }',
  isComment:true                                     // 是否为注释节点
}
