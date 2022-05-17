/* @flow */

import Dep from './dep'
import VNode from '../vdom/vnode'
import { arrayMethods } from './array'
import {
  def,
  warn,
  hasOwn,
  hasProto,
  isObject,
  isPlainObject,
  isPrimitive,
  isUndef,
  isValidArrayIndex,
  isServerRendering
} from '../util/index'

const arrayKeys = Object.getOwnPropertyNames(arrayMethods)

// 是否观察的一个开关
export let shouldObserve: boolean = true
export function toggleObserving (value: boolean) {
  shouldObserve = value
}

export class Observer {
  value: any;
  dep: Dep;
  vmCount: number; 

  constructor (value: any) {
    this.value = value;
    this.dep = new Dep(); // dep为收集依赖框，这个框不属于某一个字段，而是属于某一个对象或数组的
    this.vmCount = 0;
    def(value, "__ob__", this); //之所以这里使用 def 函数定义 __ob__ 属性是因为这样可以定义不可枚举的属性，这样后面遍历数据对象的时候就能够防止遍历到 __ob__ 属性。
    if (Array.isArray(value)) {
      // hasPropto是一个布尔值，表示当前环境是否可以使用__propto__
      if (hasProto) {
        // 如果当前环境支持__proto__，则将__propto__指向代理原型
        protoAugment(value, arrayMethods);
      } else {
        // 如果当前环境不支持__proto__，则在实例中定义不可枚举的代理方法
        copyAugment(value, arrayMethods, arrayKeys);
      }
      // 上面的代码拦截了数组编译方法，但是如果我们通过编译方法修改数组时是会触发依赖（观察者）的
      // 但是如果在数组中嵌套了别的对象，数组中的深层对象这时不是响应式的
      // 执行下面这个方法的作用就是让其变成响应式
      this.observeArray(value);
    } else {
      this.walk(value);
    }
  }

  // 观察对象
  walk (obj: Object) {
    const keys = Object.keys(obj)
    for (let i = 0; i < keys.length; i++) {
      defineReactive(obj, keys[i])
    }
  }

  // 观察数组
  observeArray (items: Array<any>) {
    for (let i = 0, l = items.length; i < l; i++) {
      observe(items[i])
    }
  }
}

function protoAugment (target, src: Object) {
  target.__proto__ = src
}

function copyAugment (target: Object, src: Object, keys: Array<string>) {
  for (let i = 0, l = keys.length; i < l; i++) {
    const key = keys[i]
    def(target, key, src[key])
  }
}

export function observe (value: any, asRootData: ?boolean): Observer | void {
  if (!isObject(value) || value instanceof VNode) {
    return;
  }
  let ob: Observer | void;
  // 当一个数据对象被观测之后将会在该对象上定义 __ob__ 属性，如果这个数据对象中有__ob__属性，说明这个数据对象被观测过，这里的判断是避免重复观测一个数据对象
  if (hasOwn(value, "__ob__") && value.__ob__ instanceof Observer) {
    ob = value.__ob__;
  } else if (
    shouldObserve && //shouldObserve开关
    !isServerRendering() && //是否为服务端渲染
    (Array.isArray(value) || isPlainObject(value)) && //是否为数组或者纯对象
    Object.isExtensible(value) && // data是否可扩展，普通的对象默认就是可扩展的， Object.preventExtensions()、Object.freeze() 以及 Object.seal()都会让对象编程不可扩展
    !value._isVue //Vue 实例对象拥有 _isVue 属性，所以这个条件用来避免 Vue 实例对象被观测。
  ) {
    // 如果该对象没有被观测过
    ob = new Observer(value);
  }
  if (asRootData && ob) {
    ob.vmCount++;
  }
  return ob;
}

// defineReactive函数的核心是将数据对象的数据属性转换为访问器属性，即为对象数据的属性设置一对getter/seeter
export function defineReactive (
  obj: Object,
  key: string,
  val: any,
  customSetter?: ?Function,
  shallow?: boolean
) {
  // 定义依赖收集器，data中的每一个key都通过闭包引用着属于自己的那一个dep
  const dep = new Dep();

  // 判断这个obj[key]是否可配置
  const property = Object.getOwnPropertyDescriptor(obj, key);
  if (property && property.configurable === false) {
    return;
  }

  // 如果属性有setter/getter，将属性原有的 setter/getter 缓存，并在重新定义的 set 和 get 方法中调用缓存的函数，从而做到不影响属性的原有读写操作
  const getter = property && property.get;
  const setter = property && property.set;
  //  边界处理                传参长度只有两位，即只有obj和key，则将obj[key]赋值给val
  if ((!getter || setter) && arguments.length === 2) {
    val = obj[key];
  }
  //            !shallow深度监听，shallow默认为false，即vue默认深度监听
  let childOb = !shallow && observe(val);
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    // get 函数做了两件事：正确地返回属性值以及收集依赖
    get: function reactiveGetter() {
      const value = getter ? getter.call(obj) : val;
      // Dep.target 中保存的值就是要被收集的依赖(观察者)，我的理解是当数据变化时需要执行的函数
      if (Dep.target) {
        dep.depend(); // 这里闭包引用了上面的dep常量
        if (childOb) {
          // 既把依赖收集到当前key所闭包引用的dev，同时还将依赖收集到key._ob_.dep中
          childOb.dep.depend();

          // 如果当前key所引用的值是数组，则执行数组的响应式方法
          if (Array.isArray(value)) {
            dependArray(value);
          }
        }
      }
      return value;
    },
    // set 1、正确地为属性设置新值 2、能够触发相应的依赖。
    set: function reactiveSetter(newVal) {
      const value = getter ? getter.call(obj) : val;
      // 如果新值和旧值相比没有变化，或者新值和旧值都是NaN，则return
      if (newVal === value || (newVal !== newVal && value !== value)) {
        return;
      }
      // 非生产环境，如果有customSetter函数，则执行这个函数，该函数的作用是开发者再执行响应式处理时，用户进行set的时候触发的回调函数
      if (process.env.NODE_ENV !== "production" && customSetter) {
        customSetter();
      }
      // #7981: for accessor properties without setter
      if (getter && !setter) return;
      if (setter) {
        setter.call(obj, newVal);
      } else {
        val = newVal;
      }
      // 如果设置的新值为对象类型，则对其响应式处理
      // 并将新的观测对象重写childOb
      childOb = !shallow && observe(newVal);
      // 通知更新
      dep.notify();   // 这里闭包引用了上面的dep常量
    },
  });
}


export function set(target: Array<any> | Object, key: any, val: any): any {
  // 如果 set 函数的第一个参数是 undefined 或 null 或者是原始类型值，那么在非生产环境下会打印警告信息
  if (
    process.env.NODE_ENV !== "production" &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(
      `Cannot set reactive property on undefined, null, or primitive value: ${(target: any)}`
    );
  }
  // 如果target是一个数组，并且key是一个有效的索引
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.length = Math.max(target.length, key);  // 将数组长度设置为target.length和key中的较大者
    target.splice(key, 1, val);  //替换元素，将制定位置的元素替换为新元素，并且splice方法本身因为做了拦截，是能触发响应的
    return val;
  }
  // 对于对象，要保证key在target中，并且key不在Object构造函数中，这时说明这个key已经是响应式数据了。直接赋值即可
  if (key in target && !(key in Object.prototype)) {
    target[key] = val;
    return val;
  }
  // 如果set函数运行到这里，说明是在给对象添加全新的属性
  const ob = (target: any).__ob__;
  // 避免在Vue实例中添加响应式数据
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== "production" &&
      warn(
        "Avoid adding reactive properties to a Vue instance or its root $data " +
          "at runtime - declare it upfront in the data option."
      );
    return val;
  }
  // target也许本身就不是响应式数据，此时只需要简单赋值即可
  if (!ob) {
    target[key] = val;
    return val;
  }
  // 将新加的数据添加响应式
  defineReactive(ob.value, key, val);
  // 通知依赖（观察者）
  ob.dep.notify();
  return val;
}


export function del(target: Array<any> | Object, key: any) {
  // 检测 target 是否是 undefined 或 null 或者是原始类型值，如果是的话那么在非生产环境下会打印警告信息。
  if (
    process.env.NODE_ENV !== "production" &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(
      `Cannot delete reactive property on undefined, null, or primitive value: ${(target: any)}`
    );
  }
  // 如果是数组的话验证数组的索引是否有效
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.splice(key, 1);  //通过splice方法删除key对应的值，splice方法由于拦截过，所以会触发响应
    return;
  }
  const ob = (target: any).__ob__;
  // 不允许删除根数据对象中（data）中的属性，因为不能触发响应
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== "production" &&
      warn(
        "Avoid deleting properties on a Vue instance or its root $data " +
          "- just set it to null."
      );
    return;
  }
  // 如果要删除的key不在target中，直接返回
  if (!hasOwn(target, key)) {
    return;
  }
  // 否则直接删除
  delete target[key];
  if (!ob) {
    return;
  }
  // 通知更新
  ob.dep.notify();
}


function dependArray (value: Array<any>) {
  for (let e, i = 0, l = value.length; i < l; i++) {
    e = value[i]
    e && e.__ob__ && e.__ob__.dep.depend()
    if (Array.isArray(e)) {
      dependArray(e)
    }
  }
}
