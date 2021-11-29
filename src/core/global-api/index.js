/* @flow */

import config from '../config'
import { initUse } from './use'
import { initMixin } from './mixin'
import { initExtend } from './extend'
import { initAssetRegisters } from './assets'
import { set, del } from '../observer/index'
import { ASSET_TYPES } from 'shared/constants'
import builtInComponents from '../components/index'
import { observe } from 'core/observer/index'

import {
  warn,
  extend,
  nextTick,
  mergeOptions,
  defineReactive
} from '../util/index'

export function initGlobalAPI (Vue: GlobalAPI) {
  // config
  const configDef = {};
  configDef.get = () => config;
  if (process.env.NODE_ENV !== "production") {
    configDef.set = () => {
      warn(
        "Do not replace the Vue.config object, set individual fields instead."
      );
    };
  }
  Object.defineProperty(Vue, "config", configDef);

  Vue.util = {
    warn,
    extend,
    mergeOptions,
    defineReactive,
  };

  Vue.set = set;
  Vue.delete = del;
  Vue.nextTick = nextTick;

  // Vue.observable = <T>(obj: T): T => {
  //   observe(obj)
  //   return obj
  // }

  Vue.observable = (obj) => {
    observe(obj);
    return obj;
  };

  Vue.options = Object.create(null);  // Vue.options

  ASSET_TYPES.forEach((type) => {
    Vue.options[type + "s"] = Object.create(null);
  });

  Vue.options._base = Vue;
  // 此时Vue.options变成
  /**
    {
      components: Object.create(null),
      directives: Object.create(null),
      filters: Object.create(null),
      _base: Vue
     }
  */

  extend(Vue.options.components, builtInComponents); // extend(A,B),将B的内容混合到A中
  // 此时Vue.options变成
  /**
    {
      components: { keepAlive },
      directives: Object.create(null),
      filters: Object.create(null),
      _base: Vue
     }
  */

  initUse(Vue);   // Vue.use
  initMixin(Vue);  // Vue.mixin
  initExtend(Vue);  // Vue.cid  Vue.extend
  initAssetRegisters(Vue); // Vue.component Vue.directive Vue.filter
}
