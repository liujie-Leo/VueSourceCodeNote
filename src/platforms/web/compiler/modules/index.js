import klass from './class'
import style from './style'
import model from './model'

export default [
  klass,
  style,
  model
]

/*
[
  // klass
  {
    staticKeys: ['staticClass'],
    transformNode,
    genData
  },
  // style
  {
    staticKeys: ['staticStyle'],
    transformNode,
    genData
  },
  // model
  {
    preTransformNode
  }
]
*/