import { hasChanged, isArray, isObject } from "@vue/shared"
import { reactive } from "."
import { track, trigger } from "./effect"
import { TrackOpTypes, TriggerOrTypes } from "./operators"

// 返回的是一个实例
export function ref(value) {
    // 将普通对象变成一个对象，可以是对象，但一般情况下对象直接使用reactive更合理
    return createRef(value)

}
// ref和reactive的区别，reactive内部采用proxy，ref中内部使用defineProperty

export function shallowRef(value) {
    return createRef(value, true)
}


const convert = val => isObject(val) ? reactive(val) : val
// beta版本之前的版本ref就是个对象，由于对象不方便扩展，改成了类
class RefImpl {
    public _value //表示声明了一个_value属性，并未赋值
    public readonly __v_isRef = true//产生的实例会被添加 __v_isRef 表示是一个ref属性用于脱ref
    constructor(public rawValue, public shallow) { // 参数前面增加修饰符，标识此属性放到了实例上，既声明又赋值
        // 如果是深度的，需要把里面的都变成响应式的
        this._value = shallow ? rawValue : convert(rawValue)
    }
    // 类的属性访问器 名字是value，就会在实例上加一个value属性（数据劫持属性的）
    // 属性访问器转换为es5就是Object.defineProperty
    get value() { //数据代理 取值取value，会代理到_value
        // (effect中)用到的时候收集依赖
        track(this, TrackOpTypes.GET, 'value')
        return this._value
    }
    set value(newValue) {
        if (hasChanged(this.rawValue, newValue)) {// 判断老值和新值是否有变化
            this.rawValue = newValue// 因为比较的是rawValue和newValue
            this._value = this.rawValue ? newValue : convert(newValue)
            trigger(this, TriggerOrTypes.SET, 'value', newValue)
        }
    }
}

// 源码基本使用高阶函数，做类似柯里化的功能
function createRef(rawValue, shallow = false) {
    return new RefImpl(rawValue, shallow)
}

class ObjectRefImpl {
    public __v_isRef = true
    constructor(public target, public key) { }
    get value() {//不做依赖收集，依靠源对象实现是否响应收集
        // 只是一个reactive的解构
        // 如果源对象是响应式的，就会触发更新
        return this.target[this.key]
    }
    set value(newValue) {
        this.target[this.key] = newValue
    }
}

// 将某一个key对应的值转化成ref
export function toRef(target, key) {
    // 可以把一个对象的值转换成ref类型
    return new ObjectRefImpl(target, key)
}


export function toRefs(object) {//object可能是一个数组或者对象
    const ret = isArray(object) ? new Array(object.length) : {}
    for (let key in object) {
        ret[key]=toRef(object,key)
    }
    return ret
}
