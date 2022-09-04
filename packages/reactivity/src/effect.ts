
// effect是一个函数
//effect用法：effect(()=>{
// console.log('ok');
// }) 

import { isArray, isIntegerKey } from "@vue/shared"
import { TriggerOrTypes } from "./operators"

export function effect(fn, options: any = {}) {
    // 需要让此effect变成响应的effect，可以做到数据变化重新执行

    const effect = createReactiveEffect(fn, options)


    if (!options.lazy) {// 默认的effect会先执行
        effect()// 响应式的effect默认会先执行一次
    }


    return effect
}

let uid = 0
let activeEffect // 存储当前的effect，为了让track里能拿到当前的effect
const effectStack = []

function createReactiveEffect(fn, options) {
    const effect = function reactiveEffect() {
        // 保证effect没有加入到effectStack中，防止死循环
        if (!effectStack.includes(effect)) {

            // 清理
            try {
                effectStack.push(effect) // 入栈
                activeEffect = effect
                return fn()// 函数执行时会取值 执行get方法 --有返回值--
            } finally {// 不需要处理异常
                effectStack.pop()// 方法执行完就出栈
                activeEffect = effectStack[effectStack.length - 1]// 正确的依赖
            }
        }

    }

    effect.id = uid++// 制作一个effect标识，用于区分effect，后续组件更新需要
    effect._isEffect = true// 用于标识这个是 响应式effect
    effect.raw = fn// 保留effect对应的原函数
    effect.options = options// 在effect上保存用户的属性

    return effect
}

// 让某个对象中的属性 收集当前它对应的effect函数
const targetMap = new WeakMap()
export function track(target, type, key) {// type:TrackOpTypes.GET --> 0
    // activeEffect//当前对应的effect
    // console.log(target,key);
    if (activeEffect === undefined) { // 如果这个没有activeEffect，说明不是effect里的
        // 比如effect页面用到了state.arr,后面改了arr的length，默认就会收集到length，但是effect里是没有用到的
        // 只是为了实现所需要的。详情见文档里的依赖收集
        // console.log('meiyou',target,key);
        return
    }

    // 让对象中的属性和它的effect函数对应起来 一个属性可能有多个effect函数,所以用集合set

    // 哪个对象的哪个属性对应的effect
    // WeakMap key:{name:jack,age:18} value:(map) {name => set,,age => set}
    let depsMap = targetMap.get(target)// map
    if (!depsMap) {
        targetMap.set(target, (depsMap = new Map()))
    }
    let dep = depsMap.get(key)// set
    if (!dep) {
        depsMap.set(key, (dep = new Set()))
    }
    if (!dep.has(activeEffect)) {// 往里面加effect函数
        dep.add(activeEffect)
    }
    // console.log(target,key,targetMap);



}
// 找属性对应的effect，让其执行（只考虑了数组和对象，还有Map和Set）
export function trigger(target, type, key?, newValue?, oldValue?) {// ?表示可有可无
    // console.log(target, type, key, newValue, oldValue);

    // 如果这个属性没有收集过effect，那不需要做任何操作
    // 因为如果没有effect，说明在页面的effect函数中没有用到过这个属性
    const depsMap = targetMap.get(target)
    if (!depsMap) {
        return
    }

    const add = effectsToAdd => {
        if (effectsToAdd) {
            // 一个个加到effect数组中去 arr[2]和arr.length都是arr的effect函数
            effectsToAdd.forEach(effect => effects.add(effect))
        }
    }

    // 将所有的要执行的effect全部存到一个新的集合中，最终一起执行
    const effects = new Set()// 去重,为的是页面同时使用比如arr[2]和arr.length的时候，这时他俩的effect函数是同一个，
    // 或者state.name 和state.age。
    // 其实不管是谁对应啥effect，一种effect只需要触发一次，但是一个effect里会有很多的属性收集它，所以需要set去重
    // 应该只触发一次
    // 其实，像页面更改的时候也需要去重（节流？）

    // 1.看修改的是不是数组的长度，因为改长度影响比较大
    // 比如用到了arr[3]，但是后面又将arr.length=1
    if (key === 'length' && isArray(target)) {

        // 如果对应的长度有依赖需要更新
        depsMap.forEach((dep, key) => {

            // 走到这说明effect函数中已经用到arr.length了，所以必有key为'length'的effect
            // 比如用的是arr[2],后面修改为arr.length=1 2 > 1 
            // 第一个条件的修改可能是扩大数组也可能是缩减数组
            if (key === 'length' || key > newValue) { // 如果更改的长度小于收集的索引，则修改的索引也要触发effect重新执行
                add(dep)
            }


            // // 最后让effects中的effect都执行
            // effects.forEach((effect: any) => effect())
        })
    } else {

        // 可能是对象(或者是改数组的某个索引的值)
        if (key !== undefined) {// 这里一定是修改(页面用到才会收集依赖,而在set方法中已经set过了)

            add(depsMap.get(key))// 如果是新增，就是空的丢进去，因为页面没有用到，不需要再触发
            // 如果页面用到了arr，但是后面如果修改了arr的某一项（未改变数组长度），也会走这里
            // 因为track的时候会收集每一项
        }
        // 如果修改数组中的某一个索引 比如effect中用到的是arr，但是更改的是arr[100]=1,
        // 相当于改变了数组的长度
        switch (type) { //如果添加了一个索引，就触发长度的更新(比如effect中放的是arr，但是后面改arr[100]=1)
            case TriggerOrTypes.ADD:
                if (isArray(target) && isIntegerKey(key)) {
                    add(depsMap.get('length'))// 因为页面effect即使是arr,也会记录arr.length的effect，所以就吧'length'丢进去触发
                    // console.log(target,key,type,newValue,oldValue);

                }
        }
    }

    // 最后让effects中的effect都执行
    effects.forEach((effect: any) => {
        if (effect.options.scheduler) {
            effect.options.scheduler(effect)
        } else {
            effect()
        }
    })
}

/**
 全局变量隐患：////执行顺序effect1执行，effect函数进栈，fn1函数执行，
                // 新的effect2执行，进栈，fn2执行，effect2出栈，现effect为effect1，继续执行
情况一：
 effect(()=>{
    state.name --> effect1
    effect(()=>{
        state.age -->effect2
    })
    state.address -->此时为effect2
    解决方法：设计一个栈结构，方法执行完就出栈，取栈的最后一个
    保证收集的是正确的effect
 })

情况二：
 effect(()=>{
    state.xx ++ // 出现死循环 effect先执行一次读取到state.xx,收集依赖，state.xx ++,set函数触发依赖，effect再执行，
                // fn执行，再读状态，收集依赖，状态再次改变 --->死循环 (无限的调用自己，解决：当前执行的effect与trigger触发执行的effect不相同才执行)
 })

 */