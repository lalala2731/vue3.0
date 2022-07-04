
// import { Shared } from '@vue/shared'

// const Reactivity = {}
// export {
//     Reactivity
// }



// index.ts只负责集中导出，不实现功能

export {
    reactive,
    shallowReactive,
    readonly,
    shallowReadonly
} from './reactive'

export {
    effect
} from './effect'

export {
    ref,
    shallowRef,
    toRef,
    toRefs
} from './ref'
export {
    computed
} from './computed'
