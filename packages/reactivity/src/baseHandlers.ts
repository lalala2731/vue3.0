
// 用于实现 new Proxy(target,handler)

import { extend, hasChanged, hasOwn, isArray, isIntegerKey, isObject, isSymbol } from "@vue/shared"
import { reactive, readonly } from "."
import { track, trigger } from "./effect"
import { TrackOpTypes, TriggerOrTypes } from "./operators"

// 考虑是不是仅读的 仅读的属性set时会报错
// 考虑是不是深度的

// 拦截获取功能
function createGetter(isReadyonly = false, shallow = false) {
    return function get(target, key, receiver) { //receiver:代理对象，谁调用Proxy就是谁 let proxy=new Proxy()
        // console.log(target,key);
        
        // Proxy + reflect 反射
        // 后续Object上的方法会被迁移到Reflect上 如：Reflect.getProptypeof()
        // 以前target[key] = value 方式设置值可能会失败，并不会报错，也没有返回值标识
        // Reflect方法具备返回值
        // Reflect 使用可以不使用proxy es6语法

        const res = Reflect.get(target, key, receiver)//等价于target[key]// 防止继承于原型链effect被触发两次

        if(isSymbol(key)) return res

        if (!isReadyonly) {
            // 收集依赖，等数据变化后更新对应的视图
            
            track(target, TrackOpTypes.GET, key)
        }
        if (shallow) {// 如果是浅的，就直接取出来返回
            return res
        }
        if (isObject(res)) {// 如果是对象，根据是否只读，返回包装后的值
            // vue2一开始就递归，vue3是取值时会进行代理
            // vue3的代理模式称为懒代理

            return isReadyonly ? readonly(res) : reactive(res)
        }


        return res

    }
}

// 拦截设置功能
function createSetter(shallow = false) {
    return function set(target, key, value, receiver) {
        
        const oldValue = target[key] //获取老的值
        // 1.新增2.修改3.修改，但是老值与新值相同
        
        // 判断有没有这个属性
        // 即使是push方法，也会修改索引，也会有数字key，也可以判断
        // debugger
        let hadKey = isArray(target) && isIntegerKey(key) ? Number(key) < target.length : hasOwn(target, key)
        
        const result = Reflect.set(target, key, value, receiver) //等价于target[key]=value
        // 当数据更新时，通知对应属性的effect重新执行
        // 我们要区分的是新增的还是修改的 vue2中无法监控更改索引，无法监控数组的长度变化
        // 需要hack的方法 特殊处理
        if (!hadKey) {
            // 新增
            
            trigger(target, TriggerOrTypes.ADD, key, value) // trigger函数就是让相应的的effect函数执行
        } else if (hasChanged(oldValue, value)) {
            // 修改
            trigger(target, TriggerOrTypes.SET, key, value, oldValue)
        }

        return result
    }
}

// 与之前一样，使用一个函数 传入不同的参数实现处理不同的逻辑
const get = createGetter()
const shallowGet = createGetter(false, true)
const readonlyGet = createGetter(true)
const shallowReadonlyGet = createGetter(true, true)

const set = createSetter()
const shallowSet = createSetter(true)

export const mutableHandlers = {
    get,
    set
}
export const shallowReactiveHandlers = {
    get: shallowGet,
    set: shallowSet
}

// readonly和 shallowReadonly都用得到，抽离出来
let readonlyObj = {
    set: (target, key) => {
        console.warn(`set on key: ${key} failed,${target} is readonly`)
    }
}

export const readonlyHandlers = extend({
    get: readonlyGet
}, readonlyObj)
export const shallowReadonlyHandlers = extend({
    get: shallowReadonlyGet
}, readonlyObj)