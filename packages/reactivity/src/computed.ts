import { isFunction } from "@vue/shared"
import { effect } from "."
import { track, trigger } from "./effect"
import { TrackOpTypes, TriggerOrTypes } from "./operators"

// 就是原值改变，计算属性下次也要重新计算，所以在计算属性里面也要进行依赖收集，当原值改变时，会触发effect
// 那么就会走effect收集的scheduler，就会执行相应计算属性的trigger
class ComputedRefImpl {
    private _dirty = true // 默认取值时不要用缓存

    public _value
    public effect
    constructor(getter, public setter) { // ts默认不会挂载到this上
        this.effect = effect(getter, {
            lazy: true, // 默认不执行
            scheduler: () => {
                if (!this._dirty) {
                    this._dirty = true
                    trigger(this, TriggerOrTypes.SET, 'value')// 情景1// 修改值会触发原值的effect，然后原值的effect会触发所在的scheduler，就会触发自己的trigger
                }
            }
        })
    }

    get value() {// 计算属性中也需要收集依赖（2中不会）
        if (this._dirty) {// 取值的时候（maValue.value）才会执行effect
            // console.log('runner');

            this._value = this.effect()
            this._dirty = false// 变成false，再次取值的时候（myValue.value）不执行effect 缓存
        }

        track(this, TrackOpTypes.GET, 'value') // 情景1
        return this._value
    }
    set value(newValue) {
        this.setter(newValue) // myValue.value = xx(myValue = computed({get,set}))
    }
}

// vue3的computed原理与vue2不同
export function computed(getterOrOptions) {
    let getter
    let setter

    if (isFunction(getterOrOptions)) {
        getter = getterOrOptions
        setter = () => {
            console.warn('computed value must be readonly')
        }
    } else {
        getter = getterOrOptions.get
        setter = getterOrOptions.set
    }

    return new ComputedRefImpl(getter, setter)
}