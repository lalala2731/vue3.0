// const Shared = {}
// export {
//     Shared
// }

export const isObject = target => typeof target == 'object' && target !== null
export const extend = Object.assign
export const isArray = Array.isArray
export const isFunction = value => typeof value === 'function'
export const isNumber = value => typeof value === 'number'
export const isString = value => typeof value === 'string'
export const isIntegerKey = key => parseInt(key) + '' === key
// export const isIntegerKey = key => {
//     console.log('sss');
//     return parseInt(key) + '' === key

// }
export const isSymbol = key => typeof key === 'symbol'
let hasOwnProperty = Object.prototype.hasOwnProperty
export const hasOwn = (target, key) => hasOwnProperty.call(target, key)

export const hasChanged = (OldValue, value) => OldValue !== value
export * from './shapeFlags'
