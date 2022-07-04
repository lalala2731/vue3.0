// rollup的配置

import path from 'path'
// json处理
import json from '@rollup/plugin-json'
import resolvePlugin from '@rollup/plugin-node-resolve'
import ts from 'rollup-plugin-typescript2'


// 根据环境变量中的target属性 获取对应模块中的package.json
const packagesDir = path.resolve(__dirname, 'packages')// 找到packages

// packageDir是打包的基准目录
const packageDir = path.resolve(packagesDir, process.env.TARGET) //找到要打包的某个包

// 永远针对的是某个模块
const resolve = p => path.resolve(packageDir, p)

// 每次rollup打包都会执行配置文件，拿到现在的这两个配置文件
const pkg = require(resolve('package.json'))
const name = path.basename(packageDir)// 路径最后的一个文件名（target也行）

// 对打包类型先做一个映射表，根据提供的formats来格式化需要打包的内容
const outputConfig = {
    'esm-bundler': {
        file: resolve(`dist/${name}.esm-bundler.js`),
        format: 'es'
    },
    'cjs': {
        file: resolve(`dist/${name}.cjs.js`),
        format: 'cjs'
    },
    'global': {
        file: resolve(`dist/${name}.global.js`),
        format: 'iife'//立即执行函数
    }
}

function createConfig(format, output) {
    output.name = options.name
    // 自定义是否开启sourcemap
    output.sourcemap = true

    // 生成rollup配置
    return {
        input: resolve(`src/index.ts`),
        output,
        plugins: [
            json(),// 这个的插件顺序是从上到下依次执行的
            ts({
                tsconfig: path.resolve(__dirname, 'tsconfig.json')
            }),// 解析ts需要tsconfig.json,使用npx tsc --init初始化此文件,
            // 然后修改target和module为exnext
            resolvePlugin()
        ]
    }
}


const options = pkg.buildOptions// 在各自的包的package.json中自定义配置的
// rollup 需要最终导出配置
export default options.formats.map(format => createConfig(format, outputConfig[format]))
