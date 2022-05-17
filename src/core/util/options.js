/* @flow */

import config from '../config'
import { warn } from './debug'
import { set } from '../observer/index'
import { unicodeRegExp } from './lang'
import { nativeWatch, hasSymbol } from './env'

import {
  ASSET_TYPES,
  LIFECYCLE_HOOKS
} from 'shared/constants'

import {
  extend,
  hasOwn,
  camelize,
  toRawType,
  capitalize,
  isBuiltInTag,
  isPlainObject
} from 'shared/util'

const strats = config.optionMergeStrategies




// strats中添加 el 和 propsData 的策略函数
if (process.env.NODE_ENV !== 'production') {
  strats.el = strats.propsData = function (parent, child, vm, key) {
    // 如果不是vue实例，则警告
    if (!vm) {
      warn(
        `option "${key}" can only be used during instance ` +
        'creation with the `new` keyword.'
      )
    }
    // return 默认策略 逻辑很简单，child不是undefined就用child里的属性，否则用parent里的属性
    return defaultStrat(parent, child)
  }
}





// mergeDataOrFn中调用的函数，作用是合并
function mergeData (to: Object, from: ?Object): Object {
  if (!from) return to;
  let key, toVal, fromVal;

  const keys = hasSymbol ? Reflect.ownKeys(from) : Object.keys(from);

  // 将from（parentVal）对象中的值混合到to（childVal）对象中
  // 如果 from 对象中的 key 不在 to 对象中，则使用 set 函数为 to 对象设置 key 及相应的值。
  // 如果 from 对象中的 key 在 to 对象中，且这两个属性的值都是纯对象则递归地调用 mergeData 函数进行深度合并。
  for (let i = 0; i < keys.length; i++) {
    key = keys[i];
    // in case the object is already observed...
    if (key === "__ob__") continue;
    toVal = to[key];
    fromVal = from[key];
    if (!hasOwn(to, key)) {
      set(to, key, fromVal);
    } else if (
      toVal !== fromVal &&
      isPlainObject(toVal) &&
      isPlainObject(fromVal)
    ) {
      mergeData(toVal, fromVal);
    }
  }
  return to;
}

// mergeDataOrFn永远返回一个函数，即data选项最终会被处理成一个函数
export function mergeDataOrFn (
  parentVal: any,
  childVal: any,
  vm?: Component
): ?Function {
  // 没有vm，说明是在Vue.extend中调用的mergeOptions方法
  if (!vm) {
    // 没有子选项，返回父选项
    if (!childVal) {
      return parentVal
    }
    // 没有父选项，返回子选项
    if (!parentVal) {
      return childVal
    }
    // 父子选项都有，返回一个合并函数。注意，这个合并函数此时并没有被执行
    return function mergedDataFn () {
      return mergeData(
        typeof childVal === 'function' ? childVal.call(this, this) : childVal,
        typeof parentVal === 'function' ? parentVal.call(this, this) : parentVal
      )
    }
  } else {
    // 有vm，说明是new Vue时调用的mergeOptions方法，返回一个合并函数。注意，这个合并函数此时并没有被执行
    return function mergedInstanceDataFn() {
      //                                                       第一个vm指定了childVal的作用于，第二个vm是执行childVal的实参
      const instanceData = typeof childVal === 'function'? childVal.call(vm, vm): childVal
      const defaultData = typeof parentVal === 'function'? parentVal.call(vm, vm): parentVal
      if (instanceData) {
        return mergeData(instanceData, defaultData)
      } else {
        return defaultData
      }
    }
  }
}

// strats中添加 data 的策略函数
strats.data = function (
  parentVal: any,
  childVal: any,
  vm?: Component
): ?Function {
  // 没有vm，说明是在Vue.extend中调用的mergeOptions
  if (!vm) {
    if (childVal && typeof childVal !== 'function') {
      process.env.NODE_ENV !== 'production' && warn(
        'The "data" option should be a function ' +
        'that returns a per-instance value in component ' +
        'definitions.',
        vm
      )

      return parentVal
    }
    return mergeDataOrFn(parentVal, childVal)
  }
  // 有vm，说明是new Vue时调用的mergeOptions
  return mergeDataOrFn(parentVal, childVal, vm)
}




// 合并生命周期钩子的函数
function mergeHook (parentVal,childVal){
  const res = childVal
    ? parentVal
      ? parentVal.concat(childVal)
      : Array.isArray(childVal)
        ? childVal
        : [childVal]
    : parentVal
  return res
    ? dedupeHooks(res)
    : res
}

function dedupeHooks (hooks) {
  const res = []
  for (let i = 0; i < hooks.length; i++) {
    if (res.indexOf(hooks[i]) === -1) {
      res.push(hooks[i])
    }
  }
  return res
}

// 遍历所有的生命周期，然后将生命周期设置为mergeHook函数，所有生命周期钩子的策略函数都是mergeHook
LIFECYCLE_HOOKS.forEach(hook => {
  strats[hook] = mergeHook
})





// 资源（assets）选项的合并策略，在Vue中，directive、filters及components被认为是资源
function mergeAssets (
  parentVal: ?Object,
  childVal: ?Object,
  vm?: Component,
  key: string
): Object {
  const res = Object.create(parentVal || null)
  if (childVal) {
    // 非生产环境监测childVal是否为纯对象，即components/filter/directive要是纯对象
    process.env.NODE_ENV !== 'production' && assertObjectType(key, childVal, vm)
    return extend(res, childVal)
  } else {
    return res
  }
}
// 遍历所有的资源，然后将资源设置为mergeAssets函数，所有的资源都是mergeAssets函数
ASSET_TYPES.forEach(function (type) {
  strats[type + 's'] = mergeAssets
})




// watch选项的合并策略
strats.watch = function (
  parentVal: ?Object,
  childVal: ?Object,
  vm?: Component,
  key: string
): ?Object {
  // 如果parentVal（watch）是浏览器对象自带的watch，说明用户并没有提供Vue的watch选项，则置为undefined
  if (parentVal === nativeWatch) parentVal = undefined
  // 如果childVal（watch）是浏览器自带的watch，也说明用户没有提供Vue的watch选项，则置为undifined
  if (childVal === nativeWatch) childVal = undefined
  // 如果子组件没有childVal即没有watch，则返回父组件的watch
  if (!childVal) return Object.create(parentVal || null)
  // 类型检查是否为纯对象
  if (process.env.NODE_ENV !== 'production') {
    assertObjectType(key, childVal, vm)
  }
  // 如果父组件没有watch，则返回子组件的watch
  if (!parentVal) return childVal

  // parentVal和childVal都存在的情况，做合并处理
  const ret = {}
  extend(ret, parentVal)
  for (const key in childVal) {
    let parent = ret[key]
    const child = childVal[key]
    // 如果parent存在，就将其转为数组
    if (parent && !Array.isArray(parent)) {
      parent = [parent]
    }
    ret[key] = parent
      ? parent.concat(child)
      : Array.isArray(child) ? child : [child]
  }
  return ret
}




// 在strats中添加 props methods inject computed 合并策略，所有的这些策略都是一个函数
strats.props =
strats.methods =
strats.inject =
strats.computed = function (
  parentVal: ?Object,
  childVal: ?Object,
  vm?: Component,
  key: string
): ?Object {
  // 非生产环境 检查类型是否为纯对象
  if (childVal && process.env.NODE_ENV !== 'production') {
    assertObjectType(key, childVal, vm)
  }
  if (!parentVal) return childVal
  const ret = Object.create(null)
  extend(ret, parentVal)
  if (childVal) extend(ret, childVal)
  return ret
}
strats.provide = mergeDataOrFn




// 默认合并策略
const defaultStrat = function (parentVal: any, childVal: any): any {
  return childVal === undefined
    ? parentVal
    : childVal
}

// 验证组件名是否合规
function checkComponents (options: Object) {
  for (const key in options.components) {
    validateComponentName(key)
  }
}

export function validateComponentName (name: string) {
  if (
    !new RegExp(`^[a-zA-Z][\\-\\.0-9_${unicodeRegExp.source}]*$`).test(name)
  ) {
    warn(
      'Invalid component name: "' +
        name +
        '". Component names ' +
        "should conform to valid custom element name in html5 specification."
    );
  }
  // isBuiltInTag验证是否是内置标签,eg:<component>/<slot>
  // isReservedTag验证是否是保留标签
  if (isBuiltInTag(name) || config.isReservedTag(name)) {
    warn(
      "Do not use built-in or reserved HTML elements as component " +
        "id: " +
        name
    );
  }
}

// 规范化prosp
function normalizeProps (options: Object, vm: ?Component) {
  const props = options.props
  if (!props) return
  const res = {}
  let i, val, name
  if (Array.isArray(props)) {
    i = props.length
    while (i--) {
      val = props[i]
      if (typeof val === 'string') {
        name = camelize(val)
        res[name] = { type: null }
      } else if (process.env.NODE_ENV !== 'production') {
        warn('props must be strings when using array syntax.')
      }
    }
  } else if (isPlainObject(props)) {
    for (const key in props) {
      val = props[key]
      name = camelize(key)
      res[name] = isPlainObject(val)
        ? val
        : { type: val }
    }
  } else if (process.env.NODE_ENV !== 'production') {
    warn(
      `Invalid value for option "props": expected an Array or an Object, ` +
      `but got ${toRawType(props)}.`,
      vm
    )
  }
  options.props = res
}

// 规范化inject
function normalizeInject (options: Object, vm: ?Component) {
  const inject = options.inject
  if (!inject) return
  const normalized = options.inject = {}
  if (Array.isArray(inject)) {
    for (let i = 0; i < inject.length; i++) {
      normalized[inject[i]] = { from: inject[i] }
    }
  } else if (isPlainObject(inject)) {
    for (const key in inject) {
      const val = inject[key]
      normalized[key] = isPlainObject(val)
        ? extend({ from: key }, val)
        : { from: val }
    }
  } else if (process.env.NODE_ENV !== 'production') {
    warn(
      `Invalid value for option "inject": expected an Array or an Object, ` +
      `but got ${toRawType(inject)}.`,
      vm
    )
  }
}

// 规范化directives
function normalizeDirectives (options: Object) {
  const dirs = options.directives
  if (dirs) {
    for (const key in dirs) {
      const def = dirs[key]
      if (typeof def === 'function') {
        dirs[key] = { bind: def, update: def }
      }
    }
  }
}

// 判断是否为纯对象
function assertObjectType (name: string, value: any, vm: ?Component) {
  if (!isPlainObject(value)) {
    warn(
      `Invalid value for option "${name}": expected an Object, ` +
      `but got ${toRawType(value)}.`,
      vm
    )
  }
}

export function mergeOptions (
  parent: Object,
  child: Object,
  vm?: Component
): Object {
  if (process.env.NODE_ENV !== "production") {
    // 非生产环境下，验证组件名是否合规
    checkComponents(child);
  }

  if (typeof child === "function") {
    child = child.options;
  }

  // 参数的规范化
  normalizeProps(child, vm); // 规范化props
  normalizeInject(child, vm); //规范化inject
  normalizeDirectives(child); //规范化directive

  // 处理extends和mixin选项
  if (!child._base) {
    if (child.extends) {
      parent = mergeOptions(parent, child.extends, vm);
    }
    if (child.mixins) {
      for (let i = 0, l = child.mixins.length; i < l; i++) {
        parent = mergeOptions(parent, child.mixins[i], vm);
      }
    }
  }

  // 真正的合并操作
  const options = {};
  let key;
  // 合并parent
  for (key in parent) {
    mergeField(key);
  }
  // 合并child
  for (key in child) {
    // 只有key不在parent中才会执行，因为如果key在parent中，在上面的for循环中已经合并过了。
    if (!hasOwn(parent, key)) {
      mergeField(key);
    }
  }
  function mergeField(key) {
    // 获取当前key对应的合并策略函数
    const strat = strats[key] || defaultStrat;
    // 将当前key策略函数的返回结果赋值给options
    options[key] = strat(parent[key], child[key], vm, key);
  }
  return options;
}

export function resolveAsset (
  options: Object,
  type: string,
  id: string,
  warnMissing?: boolean
): any {
  /* istanbul ignore if */
  if (typeof id !== 'string') {
    return
  }
  const assets = options[type]
  // check local registration variations first
  if (hasOwn(assets, id)) return assets[id]
  const camelizedId = camelize(id)
  if (hasOwn(assets, camelizedId)) return assets[camelizedId]
  const PascalCaseId = capitalize(camelizedId)
  if (hasOwn(assets, PascalCaseId)) return assets[PascalCaseId]
  // fallback to prototype chain
  const res = assets[id] || assets[camelizedId] || assets[PascalCaseId]
  if (process.env.NODE_ENV !== 'production' && warnMissing && !res) {
    warn(
      'Failed to resolve ' + type.slice(0, -1) + ': ' + id,
      options
    )
  }
  return res
}
