/* @flow */

import { baseOptions } from './options'
import { createCompiler } from 'compiler/index'

// compile函数生成的是字符串形式的代码
// compileToFunctions生成的才是真正可执行的代码
// compileToFunctions函数本身是使用 src/compiler/to-function.js 文件中的 createCompileToFunctionFn 函数根据 compile 生成的
const { compile, compileToFunctions } = createCompiler(baseOptions)

export { compile, compileToFunctions }
