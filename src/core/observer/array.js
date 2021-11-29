/*
 * not type checking this file because flow doesn't play well with
 * dynamically accessing methods on Array prototype
 */

import { def } from '../util/index'

const arrayProto = Array.prototype
export const arrayMethods = Object.create(arrayProto)

const methodsToPatch = [
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse'
]

/**
 * Intercept mutating methods and emit events
 */
methodsToPatch.forEach(function (method) {
  const original = arrayProto[method]; // 缓存原本的方法
  def(arrayMethods, method, function mutator(...args) {
    const result = original.apply(this, args); // 执行这个原本的方法并拿到返回值 this为实例数组
    const ob = this.__ob__; // 拿到这个实例数组的__ob__属性，里面包含了所有的依赖dep
    let inserted; //这个变量用来保存那些被新添加进来的数组元素
    switch (method) {
      case "push":
      case "unshift":
        inserted = args;
        break;
      case "splice":
        inserted = args.slice(2);
        break;
    }
    if (inserted) ob.observeArray(inserted);
    // notify change
    ob.dep.notify(); // 当执行了变异方法时，数组肯定发生了改变，这时候将所有依赖执行
    return result;
  });
})
