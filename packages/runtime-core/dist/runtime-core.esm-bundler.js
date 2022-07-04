// const Shared = {}
// export {
//     Shared
// }
const isObject = target => typeof target == 'object' && target !== null;
const extend = Object.assign;
const isArray = Array.isArray;
const isFunction = value => typeof value === 'function';
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

// createVNode 创建虚拟节点
// h函数也具有创建虚拟节点的功能
// h('div',{style:{color:red}},'children') h方法和createApp类似，h就是createVnode
function isVnode(vnode) {
    return vnode.__v_isVNode;
}
const createVNode = (type, props, children = null) => {
    // 可以根据type来区分是组件还是普通元素,因为h函数会传入字符串'div'，而createApp就会传入一个App组件，children对于组件来说就是一个插槽。
    // 给虚拟节点加一个类型
    // 用字符串还是对象标识是普通元素还是一个带状态的组件 0就表示啥也不是 1:4:0
    const shapeFlag = isString(type) ? 1 /* ELEMENT */ : isObject(type) ? 4 /* STATEFUL_COMPONENT */ : 0;
    const vnode = {
        __v_isVNode: true,
        type,
        props,
        children,
        el: null,
        key: props && props.key,
        shapeFlag,
        component: null // 存放组件对应的实例
    };
    // 处理儿子类型。因为儿子的情况比较多，可能没有儿子，也可能有一个数组的儿子，所以需要描述儿子的类型。儿子也有可能是文本数组插槽
    normalizeChildren(vnode, children);
    return vnode;
};
function normalizeChildren(vnode, children) {
    let type = 0;
    if (children == null) ;
    else if (isArray(children)) {
        type = 16 /* ARRAY_CHILDREN */;
    }
    else {
        type = 8 /* TEXT_CHILDREN */;
    }
    vnode.shapeFlag |= type; // 标识自己和儿子的类型
}
const Text = Symbol('Text');
function normalizeVNode(child) {
    if (isObject(child))
        return child;
    return createVNode(Text, null, String(child));
}

function createAppApi(render) {
    return function createApp(rootComponent, rootProps) {
        const app = {
            // 存储
            _props: rootProps,
            _component: rootComponent,
            _container: null,
            mount(container) {
                // let vnode = {}
                // render(vnode,container)
                // 1.根据组件创建虚拟节点
                // 2.将虚拟节点和容器获取到后调用render方法进行渲染
                // 虚拟节点
                const vnode = createVNode(rootComponent, rootProps);
                // 调用render函数
                render(vnode, container);
            }
        };
        return app;
    };
}

const PublicInstanceProxyHandlers = {
    get({ _: instance }, key) {
        // 取值时要访问 setupState props data
        const { setupState, props, data } = instance;
        if (key[0] == '$') {
            return; //不能访问 $ 开头的
        }
        if (hasOwn(setupState, key)) {
            return setupState[key];
        }
        else if (hasOwn(data, key)) {
            return data[key];
        }
        else if (hasOwn(props, key)) {
            return props[key];
        }
        else {
            return undefined;
        }
    },
    set({ _: instance }, key, value) {
        const { setupState, props, data } = instance;
        if (hasOwn(setupState, key)) {
            setupState[key] = value;
        }
        else if (hasOwn(props, key)) {
            props[key] = value;
        }
        else if (hasOwn(data, key)) {
            data[key] = value;
        }
        return true;
    }
};

function createComponentInstance(vnode) {
    // webComponent 规定组件要有属性和插槽
    const instance = {
        vnode,
        type: vnode.type,
        props: {},
        attrs: {},
        slots: {},
        ctx: {},
        setupState: {},
        isMounted: false,
        render: null,
        data: { a: 1 }
    };
    instance.ctx = { _: instance }; // instance.ctx._ 指向的也是实例，会代理
    return instance;
}
function setupComponent(instance) {
    const { props, children } = instance.vnode;
    // 根据props解析出props和attrs，将其放到instance上
    instance.props = props; // 判断props和attrs的区别，initProps()
    instance.children = children; // 插槽的解析 initSlot()
    // 需要先看下当前组件是不是有状态的组件，因为有可能是函数组件
    let isStateful = instance.vnode.shapeFlag & 4 /* STATEFUL_COMPONENT */;
    if (isStateful) { // 表示现在是一个带状态的组件
        // 调用 当前实例的setup方法，用setup的返回值填充setupState和对应的render
        setupStatefulComponent(instance);
    }
}
function setupStatefulComponent(instance) {
    // 1.代理 传递给render函数的参数 不管数据在stateupState、data、props上，统统代理到render（proxy）上，方便取值
    instance.proxy = new Proxy(instance.ctx, PublicInstanceProxyHandlers); // 为了统一变量，生产环境和开发环境功能不同
    // 2.获取组件的类型 拿到组件的setup方法
    // type就是创建时候得rootComponent，用户写的对象 App
    let Component = instance.type;
    let { setup } = Component;
    // debugger
    // --- 没有setup？没有render？---
    if (setup) {
        // setup的上下文是创造出来的一个新的对象
        let setupContext = createSetupContext(instance);
        const setupResult = setup(instance.props, setupContext); // instance 中 props attrs slots emit expose 会被提取出来，因为在开发的过程中会使用这些属性
        // 判断setup的返回值，有可能是一个函数，有可能是一个对象
        handleSetupResult(instance, setupResult); // setup里的render函数优先成为render函数
    }
    else {
        finishComponentSetup(instance); // 完成组件的启动
    }
    // Component.render(instance.proxy)
}
function handleSetupResult(instance, setupResult) {
    if (isFunction(setupResult)) {
        instance.render = setupResult;
    }
    else if (isObject(setupResult)) {
        instance.setupState = setupResult;
    }
    finishComponentSetup(instance);
}
function finishComponentSetup(instance) {
    // render要不在setup中（setup存在），要不在component（App）中
    let Component = instance.type;
    if (!instance.render) {
        // 对template 模板进行编译 产生render函数
        // instance.render=render
        if (!Component.render && Component.template) ;
        instance.render = Component.render;
    }
    // 对vue2.x进行兼容处理
    // applyOptions
}
function createSetupContext(instance) {
    return {
        attrs: instance.attrs,
        // props: instance.props,
        slots: instance.slots,
        emit: () => { },
        expose: () => { }
    };
}
// instance 表示的组件的状态 各种各样的状态，组件的相关信息
// context 就四个参数（生产环境），为了开发时使用
// proxy 主要为了取值方便 -> proxy.xx 代理

let queue = [];
function queueJob(job) {
    // debugger
    if (!queue.includes(job)) { // 去重，向栈里塞effect，
        queue.push(job);
        queueFlush(); // 塞一次执行一次，刷新队列
    }
}
let isFlushPending = false; // 记录是否在刷新中。
function queueFlush() {
    if (!isFlushPending) {
        isFlushPending = true; // 但只有第一次才会走到这
        Promise.resolve().then(flushJobs); // 异步，全部塞完之后顺序执行effect，并将栈清空
    }
}
function flushJobs() {
    isFlushPending = false;
    // 清空时 需要根据调用的顺序依次刷新，保证先刷新父元素再刷新子元素
    queue.sort((a, b) => a.id - b.id); // 顺序就是先父后子
    // console.log(queue);
    for (let i = 0; i < queue.length; i++) {
        const job = queue[i];
        job();
    }
    queue.length = 0;
}

// 贪心算法 + 二分查找
// 如果当前的比结果集中的最后一个大，就插到结果集的最后一个
// 如果比结果集的最后一个小，就插到结果集中第一个比它答的元素的位置，将其替换掉
// let arr = [1, 2, 3, 4, 0, 5]
// let arr = [2, 3, 1, 5, 6, 8, 7, 9, 4] // 最长递增子序列
// 值：     1 3 4 6 7 9
// 索引:    2 1 8 4 6 7
// 应为:值: 2 3 5 6 7 9
// 每次放入值的时候，都知道当前   最小的结尾（它前面那个值和索引） ，即使是替换值，就把它要替换的值的最小的结尾（前一个值的索引）告诉他
function getSequence(arr) {
    const len = arr.length;
    const result = [0]; // 索引  递增的序列用二分查找性能高
    let start;
    let end;
    let middle;
    const p = arr.slice(0); // 里面内容无所谓  和原来的数组相同  用来存放索引
    for (let i = 0; i < len; i++) {
        const arrI = arr[i];
        if (arrI !== 0) {
            let resultLastIndex = result[result.length - 1];
            // 取到索引对应的值      ------当前的值比结果集的最后一个数大-------
            if (arr[resultLastIndex] < arrI) {
                p[i] = resultLastIndex; // 标记当前前一个对应的索引
                result.push(i);
                continue;
            }
            // 二分查找 找到比当前值大的那一个     ------当前的值比结果集的最后一个数小-------
            start = 0;
            end = result.length - 1;
            while (start < end) { // 重合就说明找到了对应的值
                middle = ((start + end) / 2) | 0; // Math.floor
                if (arr[result[middle]] < arrI) {
                    start = middle + 1; // 移动边界
                }
                else {
                    end = middle; // 移动边界
                }
            }
            // 循环结束，start = end，为找到的正确的位置
            if (arrI < arr[result[start]]) { // 如果相同 或者比当前的还大就不换了
                if (start > 0) { // 只有后面的才记录 替换的是第一个，他前面没有，就不记录
                    p[i] = result[start - 1]; // 要将他替换的前一个记住
                }
                result[start] = i;
            }
        }
    }
    let len1 = result.length; // 总的个数
    let last = result[len1 - 1];
    while (len1-- > 0) { // 根据前驱节点一个个向前查找
        result[len1] = last;
        last = p[last];
    }
    return result;
}
// console.log(getSequence([5,3,4,0]));

function createRenderer(rendererOptions) {
    const { insert: hostInsert, remove: hostRemove, patchProp: hostPatchProp, createElement: hostCreateElement, createText: hostCreateText, setText: hostSetText, setElementText: hostSetElementText, nextSibling: hostNextSibling, } = rendererOptions;
    //#region -----------------------组件↓-----------------------------
    const setupRenderEffect = (instance, container) => {
        // 需要创建一个effect，在effect中调用render方法，这样render方法中拿到的数据会收集这个effect，属性更新的时候effect会重新执行。
        // debugger
        effect(function componentEffect() {
            // 每个组件都有一个effect，vue3是组件级更新，数据变化会重新执行对应组件的effect
            if (!instance.isMounted) {
                // 初次渲染
                let proxyToUse = instance.proxy; // 代理对象
                // $vnode   _vnode
                // vnode    subTree
                // 组件     组件的渲染内容
                let subTree = instance.subTree = instance.render.call(proxyToUse, proxyToUse); // 在render函数中用到了proxy的某个属性，当此属性已更新，就会重新执行
                // 用render的返回值h(xxx,xxx)继续渲染
                patch(null, subTree, container);
                instance.isMounted = true;
            }
            else {
                // 更新逻辑
                // console.log('更新');
                const prevTree = instance.subTree;
                let proxyToUse = instance.proxy;
                const nextTree = instance.render.call(proxyToUse, proxyToUse);
                // console.log(prevTree, nextTree);
                //组件级更新还有点问题
                patch(prevTree, nextTree, container); // 组件级更新，更新组件内部的内容元素element 属性更新更新组件
            }
        }, {
            scheduler: queueJob // 只有trigger的时候，才会条件触发scheduler
        });
    };
    const mountComponent = (initialVNode, container) => {
        // 组件的渲染流程 最核心的就是调用setup拿到返回值，获取render函数返回的结果进行渲染
        // 1.先有实例 根据虚拟节点创建一个实例挂载到虚拟节点上
        // 组件中所有的方法存放在component.ts中
        const instance = (initialVNode.component = createComponentInstance(initialVNode));
        // 2.需要的数据解析到实例上
        setupComponent(instance);
        // 3.创建一个effect，让render执行
        setupRenderEffect(instance, container);
    };
    const processComponent = (n1, n2, container) => {
        // 判断是初始化还是更新节点
        if (n1 == null) { // 组件没有上一次的虚拟节点
            mountComponent(n2, container);
        }
    };
    //#endregion ------------------------------组件↑------------------------
    //#region ------------------------------元素↓------------------------
    const mountChildren = (children, container) => {
        for (let i = 0; i < children.length; i++) {
            // 创建不同的虚拟节点进行多文本内容的处理  如果是元素就直接返回，走挂载元素
            let child = (children[i] = normalizeVNode(children[i])); // 有可能都是文本，那么就会被覆盖，处理方法就是将其转换为虚拟节点。
            // debugger
            // console.log(child);
            // 一定要改children[i],不然无法关联
            patch(null, child, container);
        }
    };
    const mountElement = (vnode, container, anchor = null) => {
        // 递归渲染
        const { props, shapeFlag, type, children } = vnode;
        let el = (vnode.el = hostCreateElement(type));
        if (props) {
            for (const key in props) {
                hostPatchProp(el, key, null, props[key]);
            }
        }
        // 处理儿子
        if (shapeFlag & 8 /* TEXT_CHILDREN */) {
            hostSetElementText(el, children); // 文本直接放进去
        }
        else if (shapeFlag & 16 /* ARRAY_CHILDREN */) { // 多个儿子:['aaa','bbb']
            // console.log(children);
            // debugger
            mountChildren(children, el);
        }
        hostInsert(el, container, anchor);
    };
    const patchProps = (oldProps, newProps, el) => {
        if (oldProps !== newProps) {
            // 先把新的属性弄到老的属性上
            for (let key in newProps) {
                const prev = oldProps[key];
                const next = newProps[key];
                if (prev !== next) {
                    hostPatchProp(el, key, prev, next);
                }
            }
            // 再把新的没有的从老的上删除 比较老的中有但是新的中没有的key
            for (const key in oldProps) {
                if (!(key in newProps)) {
                    hostPatchProp(el, key, oldProps[key], null);
                }
            }
        }
    };
    const unmountChildren = (children) => {
        for (let i = 0; i < children.length; i++) {
            unmount(children[i]);
        }
    };
    const patchKeyedChildren = (c1, c2, el) => {
        // Vue3 对特殊情况进行优化
        let i = 0; // 默认从头开始对比
        let e1 = c1.length - 1;
        let e2 = c2.length - 1;
        // 尽可能减少比对的区域
        // 1.sync from start 从头开始一个个比，遇到不同的就停止 a b c d e // a b d e
        while (i <= e1 && i <= e2) {
            const n1 = c1[i];
            const n2 = c2[i];
            if (isSameVNodeType(n1, n2)) {
                // 深度遍历，遍历属性和孩子
                patch(n1, n2, el);
            }
            else {
                break;
            }
            i++;
        }
        // 2.sync from end 从后面开始比 a b c / d e b c
        while (i <= e1 && i <= e2) {
            const n1 = c1[e1];
            const n2 = c2[e2];
            if (isSameVNodeType(n1, n2)) {
                // 深度遍历，遍历属性和孩子
                patch(n1, n2, el);
            }
            else {
                break;
            }
            e1--;
            e2--;
        }
        // 3.common sequence + mount
        // 比较后 有一方已经完全对比完成了
        // 确定是否是挂载
        // 如果 完成后，最终i的值大于e1， 说明老的少新的多 挂载------------------
        if (i > e1) { //老的少 新的多   --------前提都是有一方已经比对完成了------------多的是从i到e2的部分
            if (i <= e2) { // 表示有新增的部分
                // 找参照物
                const nextPos = e2 + 1;
                // 判断是向前插入，还是向后插入
                const anchor = nextPos < c2.length ? c2[nextPos].el : null;
                // 找到参照物后，从头（尾）开始每个插到前面去
                while (i <= e2) {
                    patch(null, c2[i], el, anchor);
                    i++;
                }
            }
        }
        else if (i > e2) { // 老的多，新的少
            while (i <= e1) {
                unmount(c1[i]);
                i++;
            }
        }
        else {
            // 乱序比较，需要尽可能的复用
            // 用新的元素做成一个映射表去老的里找，一样的就复用，不一样的要不插入，要不删除
            let s1 = i;
            let s2 = i;
            // 数组做映射，用老的去新的映射里面查找的时候，会将老的里有的在映射表里做标记
            const toBePatched = e2 - s2 + 1;
            const newIndexToOldIndexMap = new Array(toBePatched).fill(0);
            // vue3 用的是新的做映射表  vue2用的是老的做映射表
            const keyToNewIndexMap = new Map();
            for (let i = s2; i <= e2; i++) {
                const childVNode = c2[i]; // child
                keyToNewIndexMap.set(childVNode.key, i);
            }
            // 去老的里面查找，看有没有复用的
            for (let i = s1; i <= e1; i++) {
                const oldVNode = c1[i];
                let newIndex = keyToNewIndexMap.get(oldVNode.key);
                if (newIndex === undefined) { // 老的里的不在新的里面
                    unmount(oldVNode);
                }
                else { // 新老的比对,比较完后位置有差异
                    // 新的和旧的关系，索引的关系
                    // 老的里有的会标记上，老的里没有，新的里有的，还是0
                    newIndexToOldIndexMap[newIndex - s2] = i + 1;
                    patch(oldVNode, c2[newIndex], el); // patch操作会复用元素 更新属性 比较孩子
                }
            }
            // 最后移动节点，将新增的节点插入
            let increasingNewIndexSequence = getSequence(newIndexToOldIndexMap);
            let j = increasingNewIndexSequence.length - 1; // 取出最后一个人的索引
            for (let i = toBePatched - 1; i >= 0; i--) {
                let currentIndex = i + s2; // 找到h（要新增的节点）的索引
                let child = c2[currentIndex]; // 找到h对应的节点
                let anchor = currentIndex + 1 < c2.length ? c2[currentIndex + 1].el : null;
                // 第一次插入h后。。
                if (newIndexToOldIndexMap[i] == 0) { // 如果是0，说明没有被patch过
                    patch(null, child, el, anchor);
                }
                else {
                    // [1,2,3,4,5,6]
                    // [1,6,2,3,4,5]
                    // 这样会把所有的节点都移动一遍  希望尽可能的少移动
                    // hostInsert(child.el,el,anchor) // 操作当前的d，以d下一个作为参照物插入（移动位置）
                    // 3 2 1 0
                    // [1,2]
                    if (i != increasingNewIndexSequence[j]) {
                        hostInsert(child.el, el, anchor); // 操作当前的d，以d下一个作为参照物插入（移动位置）
                    }
                    else {
                        j--; // 跳过不需要移动的元素
                    }
                }
            }
            // 最长递增子序列
        }
    };
    const patchChildren = (n1, n2, el) => {
        // console.log(n1,n2,el);
        const c1 = n1.children; // 新老儿子
        const c2 = n2.children;
        // console.log(c1);
        // 共有如下几种情况
        // 老的有儿子，新的没儿子   老的没儿子新的有儿子   新老都有儿子    新老都是文本
        const prevShapeFlag = n1.shapeFlag; // 分别标识儿子的状况
        const shapeFlag = n2.shapeFlag;
        // 现在是文本
        if (shapeFlag & 8 /* TEXT_CHILDREN */) {
            // 1.老的是数组，但是新的是文本
            if (prevShapeFlag & 16 /* ARRAY_CHILDREN */) {
                // debugger
                unmountChildren(c1); // 如果c1中包含组件会调用组件的销毁方法 c1???老节点的儿子。
            }
            // 2.两个都是文本
            if (c2 !== c1) {
                hostSetElementText(el, c2);
            }
        }
        else {
            // 现在是元素   上一次有可能是文本 或者数组
            // debugger
            if (prevShapeFlag & 16 /* ARRAY_CHILDREN */) {
                // 3.老的是数组，新的是数组
                if (shapeFlag & 16 /* ARRAY_CHILDREN */) { // 一个元素也会包装成数组 有可能是null？
                    // 当前是数组 之前是数组
                    // 两个数组的对比 -> diff算法--------
                    patchKeyedChildren(c1, c2, el);
                }
                else { // 4.老的是数组，新的不是数组
                    // 没有孩子 特殊情况 当前是null，删掉老的--------------------------------
                    unmountChildren(c1);
                }
            }
            else {
                // 上一次是文本
                // 5.上一次是文本
                if (prevShapeFlag & 8 /* TEXT_CHILDREN */) {
                    hostSetElementText(el, '');
                }
                //，现在是数组
                if (shapeFlag & 16 /* ARRAY_CHILDREN */) {
                    mountChildren(c2, el);
                }
            }
        }
    };
    const patchElement = (n1, n2, container) => {
        // 走到这里说明元素是相同节点
        // 复用元素节点
        let el = (n2.el = n1.el);
        // 更新属性，更新儿子
        const oldProps = n1.props || {};
        const newProps = n2.props || {};
        patchProps(oldProps, newProps, el);
        patchChildren(n1, n2, el);
    };
    const processElement = (n1, n2, container, anchor) => {
        if (n1 == null) {
            mountElement(n2, container, anchor);
        }
        else {
            // 元素更新
            patchElement(n1, n2);
        }
    };
    //#endregion ------------------------------元素↑------------------------
    // #region 文本
    const processText = (n1, n2, container) => {
        if (n1 == null) {
            // console.log(n1,n2);
            // 创建真实文本节点，需要文本内容，而n2只是一个为了不让两次覆盖掉的中间处理
            hostInsert((n2.el = hostCreateText(n2.children)), container); // 虚拟节点的children上存放的是文本内容 将其转换为文本元素，放在n2的el上
        }
    };
    // #endregion
    const isSameVNodeType = (n1, n2) => {
        return n1.type === n2.type && n1.key === n2.key;
    };
    const unmount = (n1) => {
        // debugger
        console.log(n1.el);
        hostRemove(n1.el);
    };
    // 执行核心
    const patch = (n1, n2, container, anchor = null) => {
        // 针对不同类型，做初始化操作
        const { shapeFlag, type } = n2;
        // 组件更新
        if (n1 && !isSameVNodeType(n1, n2)) { // 如果两个元素标签不一样，直接删除前一个生成新的替换
            // anchor是为了替换元素找位置时的锚定
            anchor = hostNextSibling(n1.el);
            // n1,n2不是一个类型，就把n1删掉，换成n2
            unmount(n1);
            n1 = null; // n1置null，n2不为null，n2走创建流程
        }
        switch (type) {
            case Text:
                processText(n1, n2, container);
                break;
            default:
                if (shapeFlag & 1 /* ELEMENT */) { // 元素
                    processElement(n1, n2, container, anchor);
                }
                else if (shapeFlag & 4 /* STATEFUL_COMPONENT */) { // 组件
                    processComponent(n1, n2, container);
                }
                break;
        }
    };
    // render方法的作用是渲染一个虚拟节点，将这个虚拟节点挂载到具体的dom元素上，与mount类似？
    const render = (vnode, container) => {
        // core的核心
        // 默认调用render，可能是初始化流程   
        // 先用App 和属性生成一个虚拟节点（组件），调用mounted，render执行，h执行生成又一个虚拟节点（元素）
        patch(null, vnode, container);
    };
    return {
        createApp: createAppApi(render)
    };
}

function h(type, propsOrChildren, children) {
    const l = arguments.length; // 孩子节点要么是字符串，要么是数组   针对的是createVnode（因为有可能写的时候是hcreateVnode的）
    if (l == 2) { // 类型 + 属性   类型 + 孩子
        // 如果propsOrChildren 是数组，就是孩子，直接作为第三个参数
        if (isObject(propsOrChildren) && !isArray(propsOrChildren)) {
            if (isVnode(propsOrChildren)) {
                return createVNode(type, null, [propsOrChildren]); // return h('div',h('span'))
            }
            return createVNode(type, propsOrChildren);
        }
        else {
            // 如果第二个参数不是对象，那一定是孩子
            return createVNode(type, null, propsOrChildren);
        }
    }
    else {
        if (l > 3) {
            children = Array.prototype.slice.call(arguments, 2);
        }
        else if (l === 3 && isVnode(children)) {
            children = [children];
        }
        return createVNode(type, propsOrChildren, children);
    }
}

export { computed, createRenderer, effect, h, reactive, readonly, ref, shallowReactive, shallowReadonly, shallowRef, toRef, toRefs };
//# sourceMappingURL=runtime-core.esm-bundler.js.map
