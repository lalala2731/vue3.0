// const Shared = {}
// export {
//     Shared
// }
const isObject = target => typeof target == 'object' && target !== null;
const extend = Object.assign;
const isArray = Array.isArray;
const isFunction = value => typeof value === 'function';
const isIntegerKey = key => parseInt(key) + '' === key;
// export const isIntegerKey = key => {
//     console.log('sss');
//     return parseInt(key) + '' === key
// }
const isSymbol = key => typeof key === 'symbol';
let hasOwnProperty = Object.prototype.hasOwnProperty;
const hasOwn = (target, key) => hasOwnProperty.call(target, key);
const hasChanged = (OldValue, value) => OldValue !== value;

// effect是一个函数
function effect(fn, options = {}) {
    // 需要让此effect变成响应的effect，可以做到数据变化重新执行
    const effect = createReactiveEffect(fn, options);
    if (!options.lazy) { // 默认的effect会先执行
        effect(); // 响应式的effect默认会先执行一次
    }
    return effect;
}
let uid = 0;
let activeEffect; // 存储当前的effect，为了让track里能拿到当前的effect
const effectStack = [];
function createReactiveEffect(fn, options) {
    const effect = function reactiveEffect() {
        // 保证effect没有加入到effectStack中，防止死循环
        if (!effectStack.includes(effect)) {
            // 清理
            try {
                effectStack.push(effect); // 入栈
                activeEffect = effect;
                return fn(); // 函数执行时会取值 执行get方法 --有返回值--
            }
            finally { // 不需要处理异常
                effectStack.pop(); // 方法执行完就出栈
                activeEffect = effectStack[effectStack.length - 1]; // 正确的依赖
            }
        }
    };
    effect.id = uid++; // 制作一个effect标识，用于区分effect，后续组件更新需要
    effect._isEffect = true; // 用于标识这个是 响应式effect
    effect.raw = fn; // 保留effect对应的原函数
    effect.options = options; // 在effect上保存用户的属性
    return effect;
}
// 让某个对象中的属性 收集当前它对应的effect函数
const targetMap = new WeakMap();
function track(target, type, key) {
    // activeEffect//当前对应的effect
    // console.log(target,key);
    if (activeEffect === undefined) { // 如果这个没有activeEffect，说明不是effect里的
        // 比如effect页面用到了state.arr,后面改了arr的length，默认就会收集到length，但是effect里是没有用到的
        // 只是为了实现所需要的。详情见文档里的依赖收集
        // console.log('meiyou',target,key);
        return;
    }
    // 让对象中的属性和它的effect函数对应起来 一个属性可能有多个effect函数,所以用集合set
    // 哪个对象的哪个属性对应的effect
    // WeakMap key:{name:jack,age:18} value:(map) {name => set,,age => set}
    let depsMap = targetMap.get(target); // map
    if (!depsMap) {
        targetMap.set(target, (depsMap = new Map()));
    }
    let dep = depsMap.get(key); // set
    if (!dep) {
        depsMap.set(key, (dep = new Set()));
    }
    if (!dep.has(activeEffect)) { // 往里面加effect函数
        dep.add(activeEffect);
    }
    // console.log(target,key,targetMap);
}
// 找属性对应的effect，让其执行（只考虑了数组和对象，还有Map和Set）
function trigger(target, type, key, newValue, oldValue) {
    // console.log(target, type, key, newValue, oldValue);
    // 如果这个属性没有收集过effect，那不需要做任何操作
    // 因为如果没有effect，说明在页面的effect函数中没有用到过这个属性
    const depsMap = targetMap.get(target);
    if (!depsMap) {
        return;
    }
    const add = effectsToAdd => {
        if (effectsToAdd) {
            // 一个个加到effect数组中去 arr[2]和arr.length都是arr的effect函数
            effectsToAdd.forEach(effect => effects.add(effect));
        }
    };
    // 将所有的要执行的effect全部存到一个新的集合中，最终一起执行
    const effects = new Set(); // 去重,为的是页面同时使用比如arr[2]和arr.length的时候，这时他俩的effect函数是同一个，
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
                add(dep);
            }
            // // 最后让effects中的effect都执行
            // effects.forEach((effect: any) => effect())
        });
    }
    else {
        // 可能是对象(或者是改数组的某个索引的值)
        if (key !== undefined) { // 这里一定是修改(页面用到才会收集依赖,而在set方法中已经set过了)
            add(depsMap.get(key)); // 如果是新增，就是空的丢进去，因为页面没有用到，不需要再触发
            // 如果页面用到了arr，但是后面如果修改了arr的某一项（未改变数组长度），也会走这里
            // 因为track的时候会收集每一项
        }
        // 如果修改数组中的某一个索引 比如effect中用到的是arr，但是更改的是arr[100]=1,
        // 相当于改变了数组的长度
        switch (type) { //如果添加了一个索引，就触发长度的更新(比如effect中放的是arr，但是后面改arr[100]=1)
            case 0 /* ADD */:
                if (isArray(target) && isIntegerKey(key)) {
                    add(depsMap.get('length')); // 因为页面effect即使是arr,也会记录arr.length的effect，所以就吧'length'丢进去触发
                    // console.log(target,key,type,newValue,oldValue);
                }
        }
    }
    // 最后让effects中的effect都执行
    effects.forEach((effect) => {
        if (effect.options.scheduler) {
            effect.options.scheduler(effect);
        }
        else {
            effect();
        }
    });
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
                // fn执行，再读状态，收集依赖，状态再次改变 --->死循环
 })

 */

// 用于实现 new Proxy(target,handler)
// 考虑是不是仅读的 仅读的属性set时会报错
// 考虑是不是深度的
// 拦截获取功能
function createGetter(isReadyonly = false, shallow = false) {
    return function get(target, key, receiver) {
        // console.log(target,key);
        // Proxy + reflect 反射
        // 后续Object上的方法会被迁移到Reflect上 如：Reflect.getProptypeof()
        // 以前target[key] = value 方式设置值可能会失败，并不会报错，也没有返回值标识
        // Reflect方法具备返回值
        // Reflect 使用可以不使用proxy es6语法
        const res = Reflect.get(target, key, receiver); //等价于target[key]
        if (isSymbol(key))
            return res;
        if (!isReadyonly) {
            // 收集依赖，等数据变化后更新对应的视图
            track(target, 0 /* GET */, key);
        }
        if (shallow) { // 如果是浅的，就直接取出来返回
            return res;
        }
        if (isObject(res)) { // 如果是对象，根据是否只读，返回包装后的值
            // vue2一开始就递归，vue3是取值时会进行代理
            // vue3的代理模式称为懒代理
            return isReadyonly ? readonly(res) : reactive(res);
        }
        return res;
    };
}
// 拦截设置功能
function createSetter(shallow = false) {
    return function set(target, key, value, receiver) {
        const oldValue = target[key]; //获取老的值
        // 1.新增2.修改3.修改，但是老值与新值相同
        // 判断有没有这个属性
        // 即使是push方法，也会修改索引，也会有数字key，也可以判断
        // debugger
        let hadKey = isArray(target) && isIntegerKey(key) ? Number(key) < target.length : hasOwn(target, key);
        const result = Reflect.set(target, key, value, receiver); //等价于target[key]=value
        // 当数据更新时，通知对应属性的effect重新执行
        // 我们要区分的是新增的还是修改的 vue2中无法监控更改索引，无法监控数组的长度变化
        // 需要hack的方法 特殊处理
        if (!hadKey) {
            // 新增
            trigger(target, 0 /* ADD */, key, value); // trigger函数就是让相应的的effect函数执行
        }
        else if (hasChanged(oldValue, value)) {
            // 修改
            trigger(target, 1 /* SET */, key, value);
        }
        return result;
    };
}
// 与之前一样，使用一个函数 传入不同的参数实现处理不同的逻辑
const get = createGetter();
const shallowGet = createGetter(false, true);
const readonlyGet = createGetter(true);
const shallowReadonlyGet = createGetter(true, true);
const set = createSetter();
const shallowSet = createSetter(true);
const mutableHandlers = {
    get,
    set
};
const shallowReactiveHandlers = {
    get: shallowGet,
    set: shallowSet
};
// readonly和 shallowReadonly都用得到，抽离出来
let readonlyObj = {
    set: (target, key) => {
        console.warn(`set on key: ${key} failed,${target} is readonly`);
    }
};
const readonlyHandlers = extend({
    get: readonlyGet
}, readonlyObj);
const shallowReadonlyHandlers = extend({
    get: shallowReadonlyGet
}, readonlyObj);

// reactive.ts只处理响应式，其余的放到各自的功能文件中处理
// const mutableHandlers={}
// const shallowReactiveHandlers={}
// const readonlyHandlers={}
// const shallowReadonlyHandlers={}
function reactive(target) {
    return createReactiveObject(target, false, mutableHandlers);
}
function shallowReactive(target) {
    return createReactiveObject(target, false, shallowReactiveHandlers);
}
function readonly(target) {
    return createReactiveObject(target, true, readonlyHandlers);
}
function shallowReadonly(target) {
    return createReactiveObject(target, true, shallowReadonlyHandlers);
}
// 四个方法的区别仅为 是不是深度 是不是仅读 
// 想通过一个方法通过传入不同的参数处理不同的逻辑 柯里化
// 最核心的是 拦截数据的获取和修改（get set） 与new Proxy相似
// 建立映射表 存储已经被代理过的对象
const reactiveMap = new WeakMap(); //会自动垃圾回收，不会造成内存泄漏 存储的key只能是对象
const readonlyMap = new WeakMap();
function createReactiveObject(target, isReadonly, baseHandlers) {
    // 如果目标不是对象，没法拦截了，reactive只能拦截对象类型
    if (!isObject(target)) {
        return target;
    }
    // 如果某个对象已经被代理过了，就不要再代理了，所以做了一个映射表
    // 可能一个对象既被深度代理 又被仅读代理
    const proxyMap = isReadonly ? readonlyMap : reactiveMap;
    const existProxy = proxyMap.get(target);
    if (existProxy) {
        return existProxy; // 如果已经被代理了，直接返回即可
    }
    const proxy = new Proxy(target, baseHandlers);
    proxyMap.set(target, proxy); //将要代理的对象和对应代理结果缓存起来
    return proxy;
}
// 如果let p=new Proxy()
// let p1=new Proxy(p)// 应该在设置值的时候做校验或者避免写出这种代码

// 返回的是一个实例
function ref(value) {
    // 将普通对象变成一个对象，可以是对象，但一般情况下对象直接使用reactive更合理
    return createRef(value);
}
// ref和reactive的区别，reactive内部采用proxy，ref中内部使用defineProperty
function shallowRef(value) {
    return createRef(value, true);
}
const convert = val => isObject(val) ? reactive(val) : val;
// beta版本之前的版本ref就是个对象，由于对象不方便扩展，改成了类
class RefImpl {
    rawValue;
    shallow;
    _value; //表示声明了一个_value属性，并未赋值
    __v_isRef = true; //产生的实例会被添加 __v_isRef 表示是一个ref属性
    constructor(rawValue, shallow) {
        this.rawValue = rawValue;
        this.shallow = shallow;
        // 如果是深度的，需要把里面的都变成响应式的
        this._value = shallow ? rawValue : convert(rawValue);
    }
    // 类的属性访问器 名字是value，就会在实例上加一个value属性（数据劫持属性的）
    // 属性访问器转换为es5就是Object.defineProperty
    get value() {
        // (effect中)用到的时候收集依赖
        track(this, 0 /* GET */, 'value');
        return this._value;
    }
    set value(newValue) {
        if (hasChanged(this.rawValue, newValue)) { // 判断老值和新值是否有变化
            this.rawValue = newValue; // 因为比较的是rawValue和newValue
            this._value = this.rawValue ? newValue : convert(newValue);
            trigger(this, 1 /* SET */, 'value', newValue);
        }
    }
}
// 源码基本使用高阶函数，做类似柯里化的功能
function createRef(rawValue, shallow = false) {
    return new RefImpl(rawValue, shallow);
}
class ObjectRefImpl {
    target;
    key;
    __v_isRef = true;
    constructor(target, key) {
        this.target = target;
        this.key = key;
    }
    get value() {
        // 只是一个reactive的解构
        // 如果源对象是响应式的，就会触发更新
        return this.target[this.key];
    }
    set value(newValue) {
        this.target[this.key] = newValue;
    }
}
// 将某一个key对应的值转化成ref
function toRef(target, key) {
    // 可以把一个对象的值转换成ref类型
    return new ObjectRefImpl(target, key);
}
function toRefs(object) {
    const ret = isArray(object) ? new Array(object.length) : {};
    for (let key in object) {
        ret[key] = toRef(object, key);
    }
    return ret;
}

// 就是原值改变，计算属性下次也要重新计算，所以在计算属性里面也要进行依赖收集，当原值改变时，会触发effect
// 那么就会走effect收集的scheduler，就会执行相应计算属性的trigger
class ComputedRefImpl {
    setter;
    _dirty = true; // 默认取值时不要用缓存
    _value;
    effect;
    constructor(getter, setter) {
        this.setter = setter;
        this.effect = effect(getter, {
            lazy: true,
            scheduler: () => {
                if (!this._dirty) {
                    this._dirty = true;
                    trigger(this, 1 /* SET */, 'value'); // 情景1// 修改值会触发原值的effect，然后原值的effect会触发所在的scheduler，就会触发自己的trigger
                }
            }
        });
    }
    get value() {
        if (this._dirty) { // 取值的时候（maValue.value）才会执行effect
            // console.log('runner');
            this._value = this.effect();
            this._dirty = false; // 变成false，再次取值的时候（myValue.value）不执行effect 缓存
        }
        track(this, 0 /* GET */, 'value'); // 情景1
        return this._value;
    }
    set value(newValue) {
        this.setter(newValue); // myValue.value = xx(myValue = computed({get,set}))
    }
}
// vue3的computed原理与vue2不同
function computed(getterOrOptions) {
    let getter;
    let setter;
    if (isFunction(getterOrOptions)) {
        getter = getterOrOptions;
        setter = () => {
            console.warn('computed value must be readonly');
        };
    }
    else {
        getter = getterOrOptions.get;
        setter = getterOrOptions.set;
    }
    return new ComputedRefImpl(getter, setter);
}

export { computed, effect, reactive, readonly, ref, shallowReactive, shallowReadonly, shallowRef, toRef, toRefs };
//# sourceMappingURL=reactivity.esm-bundler.js.map
