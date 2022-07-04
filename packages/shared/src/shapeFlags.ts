export const enum ShapeFlags {
    ELEMENT = 1, // 1
    FUNCTIONAL_COMPONENT = 1 << 1, // 2
    STATEFUL_COMPONENT = 1 << 2,// 4
    TEXT_CHILDREN = 1 << 3,// 8
    ARRAY_CHILDREN = 1 << 4,
    SLOTS_CHILDREN = 1 << 5,
    TELEPORT = 1 << 6,
    SUSPENSE = 1 << 7,
    COMPONENT_SHOULD_KEEP_ALIVE = 1 << 8,
    COMPONENT_KEPT_ALIVE = 1 << 9,
    COMPONENT = ShapeFlags.STATEFUL_COMPONENT | ShapeFlags.FUNCTIONAL_COMPONENT // 这两个类型都是COMPONENT这个类型  6// 状态组件和函数组件都是组件
    // 二进制转十进制：0b+二进制
    // 位运算表示类型 
    // 判断某个类型 如4&6 -> 4 -> true   4&8 -> 0 -> false 
}
// 位运算是前人总结出来的做权限判断和类型，位运算是最佳实践。
// 当判断某个东西是不是某个类型的时候，就可以让他与类型做&运算，如果为true，就是该类型