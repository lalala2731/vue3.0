// const Shared = {}
// export {
//     Shared
// }
const isObject = target => typeof target == 'object' && target !== null;
const extend = Object.assign;
const isArray = Array.isArray;
const isFunction = value => typeof value === 'function';
const isNumber = value => typeof value === 'number';
const isString = value => typeof value === 'string';
const isIntegerKey = key => parseInt(key) + '' === key;
// export const isIntegerKey = key => {
//     console.log('sss');
//     return parseInt(key) + '' === key
// }
const isSymbol = key => typeof key === 'symbol';
let hasOwnProperty = Object.prototype.hasOwnProperty;
const hasOwn = (target, key) => hasOwnProperty.call(target, key);
const hasChanged = (OldValue, value) => OldValue !== value;

export { extend, hasChanged, hasOwn, isArray, isFunction, isIntegerKey, isNumber, isObject, isString, isSymbol };
//# sourceMappingURL=shared.esm-bundler.js.map
