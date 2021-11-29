/* @flow */

import {
  warn,
  remove,
  isObject,
  parsePath,
  _Set as Set,
  handleError,
  invokeWithErrorHandling,
  noop
} from '../util/index'

import { traverse } from './traverse'
import { queueWatcher } from './scheduler'
import Dep, { pushTarget, popTarget } from './dep'

import type { SimpleSet } from '../util/index'

let uid = 0

/**
 * A watcher parses an expression, collects dependencies,
 * and fires callback when the expression value changes.
 * This is used for both the $watch() api and directives.
 */
export default class Watcher {
  vm: Component;
  expression: string;
  cb: Function;
  id: number;
  deep: boolean;
  user: boolean;
  lazy: boolean;
  sync: boolean;
  dirty: boolean;
  active: boolean;
  deps: Array<Dep>;
  newDeps: Array<Dep>;
  depIds: SimpleSet;
  newDepIds: SimpleSet;
  before: ?Function;
  getter: Function;
  value: any;

  constructor (
    vm: Component, // 组件的实例对象
    expOrFn: string | Function, // 要观察的表达式，为一个字符串或函数
    cb: Function,  // 当被观察的表达式发生变化时的回调函数
    options?: ?Object,  // 一些要传给当前观察者对象的选项
    isRenderWatcher?: boolean  // 判断该观察者是否是渲染函数的观察者
  ) {
    this.vm = vm
    if (isRenderWatcher) {
      vm._watcher = this
    }
    vm._watchers.push(this)
    // options
    if (options) {
      this.deep = !!options.deep // 用来告诉当前观察者实例对象是否是深度观测
      this.user = !!options.user // 用来表示当前观察者实例对象是开发者定义的还是内部定义的
      this.lazy = !!options.lazy 
      this.sync = !!options.sync // 用来告诉观察者当前数据变化是否同步求值，并执行回调
      this.before = options.before //可以理解为Watcher实例的钩子，当数据变化之后，触发更新之前，调用在创建渲染函数的观察者实例对象时传递的before选项
    } else {
      this.deep = this.user = this.lazy = this.sync = false
    }
    this.cb = cb  // 回调函数
    this.id = ++uid // 观察者实例对象的唯一标识
    this.active = true  // 观察者实例对象是否是激活状态
    this.dirty = this.lazy // 计算属性的观察者实例对象dirty才为真

    this.deps = []
    this.newDeps = []
    this.depIds = new Set()
    this.newDepIds = new Set()

    // 非生产环境使用的
    this.expression = process.env.NODE_ENV !== 'production'
      ? expOrFn.toString()
      : ''
    
    if (typeof expOrFn === 'function') {
      this.getter = expOrFn
    } else {
      this.getter = parsePath(expOrFn)
      if (!this.getter) {
        this.getter = noop
        process.env.NODE_ENV !== 'production' && warn(
          `Failed watching path: "${expOrFn}" ` +
          'Watcher only accepts simple dot-delimited paths. ' +
          'For full control, use a function instead.',
          vm
        )
      }
    }
    this.value = this.lazy
      ? undefined
      : this.get()
  }

  /**
   * Evaluate the getter, and re-collect dependencies.
   */
  get () {
    pushTarget(this)
    let value
    const vm = this.vm
    try {
      value = this.getter.call(vm, vm)
    } catch (e) {
      if (this.user) {
        handleError(e, vm, `getter for watcher "${this.expression}"`)
      } else {
        throw e
      }
    } finally {
      // "touch" every property so they are all tracked as
      // dependencies for deep watching
      if (this.deep) {
        traverse(value)
      }
      popTarget()
      this.cleanupDeps()
    }
    return value
  }

  /**
   * Add a dependency to this directive.
   */
  addDep (dep: Dep) {
    const id = dep.id
    // 避免收集重复依赖
    if (!this.newDepIds.has(id)) {
      this.newDepIds.add(id)
      this.newDeps.push(dep)
      if (!this.depIds.has(id)) {
        dep.addSub(this)
      }
    }
  }

  cleanupDeps () {
    let i = this.deps.length
    while (i--) {
      const dep = this.deps[i]
      if (!this.newDepIds.has(dep.id)) {
        dep.removeSub(this)
      }
    }
    let tmp = this.depIds
    this.depIds = this.newDepIds
    this.newDepIds = tmp
    this.newDepIds.clear()
    tmp = this.deps
    this.deps = this.newDeps
    this.newDeps = tmp
    this.newDeps.length = 0
  }

  update () {
    if (this.lazy) {
      this.dirty = true
    } else if (this.sync) {
      this.run()
    } else {
      queueWatcher(this)
    }
  }

  run () {
    if (this.active) {
      const value = this.get()
      if (
        value !== this.value ||
        isObject(value) ||
        this.deep
      ) {
        const oldValue = this.value
        this.value = value
        if (this.user) {
          const info = `callback for watcher "${this.expression}"`
          invokeWithErrorHandling(this.cb, this.vm, [value, oldValue], this.vm, info)
        } else {
          this.cb.call(this.vm, value, oldValue)
        }
      }
    }
  }

  /**
   * Evaluate the value of the watcher.
   * This only gets called for lazy watchers.
   */
  evaluate () {
    this.value = this.get()
    this.dirty = false
  }

  /**
   * Depend on all deps collected by this watcher.
   */
  depend () {
    let i = this.deps.length
    while (i--) {
      this.deps[i].depend()
    }
  }

  /**
   * 移除当前观察者对某个对象属性的观察
   */
  teardown() {
    // 如果当前watcher实例active为false，表示已经不处于激活状态，不需要任何处理
    if (this.active) {
      // 每个组件实例都有一个vm._isBeingDestroyed属性，标识当前组件实例是否已经被销毁true为已经销毁，false为没销毁
      if (!this.vm._isBeingDestroyed) {
        // 如果当前组件没有被销毁，则将当前watcher实例从vm.watchers中移除
        remove(this.vm._watchers, this)
      }
      // 当一个属性与一个观察者建立联系之后，属性的Dep实例会收集该观察者对象
      // 同时观察者对象也会将该Dep实例收集
      // 一个观察者可以同时观察多个属性
      // 这些属性的Dep实例对象都会被收集到该观察者实例对象的this.deps中
      // 所以解除属性与观察者之间关系的第二步就是将当前观察者实例对象从所有Dep实例对象中移除。即移除this.deps中的所有dep
      // 以下代码就是移除的过程
      let i = this.deps.length
      while (i--) {
        this.deps[i].removeSub(this)
      }
      // 最后将当前watcher实例置于未激活状态
      this.active = false
    }
  }
}
