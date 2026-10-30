# qq-channel · Demiurge A1b Windows 原生 ABI 验证

本仓库是 **QQNT A1b 独立 Node Worker 的实验 CI**，不是正式 QQ Channel，也不承担账号登录、机器人服务或消息收发。

## 本轮实验的具体目标

在 GitHub Actions 的 Windows x64 主机上，使用固定的官方 **Node.js 22.11.0**（源码、node.exe、node.lib 均核对 Node.js 官方 SHASUMS256），自研构建 `QQNT.dll` 宿主适配层，验证 `node::Environment::is_stopping()` 的**真实状态变化**：

1. 空 isolate 必须返回 true。
2. 正常运行的 Node Environment 必须返回 false。
3. 在一次性原生测试进程中调用 `node::Stop(environment, kDoNotTerminateIsolate)`，返回后必须立即为 true。
4. 整个独立子进程以实际结果退出；验证失败即构建失败，不标记 PASS。

测试使用的 `abi/QQNT-9.9.36-x64.def` 为从用户本机 **QQ 9.9.36-53644** 原版 `wrapper.node` 的 PE 导入表读取的 **99 项符号名称**，不含任何腾讯二进制。编译出来的兼容 DLL 只作为 CI 实验产物保留，当前没有使用 QQ 账号。

## 工程范围

- `src/environment-stopping.cc`：基于 Node 22.11.0 官方内部 `env-inl.h`，读取真实停止状态。
- `src/verify-stopping.cc`：实际调用 Node `Stop`，验证前后状态。
- `src/bootstrap.c`：测试期间预加载 DLL 的最小 N-API 入口。
- `ci/`：下载官方 Node 发布物、精确 SHA256 校验、MSVC 原生构建、停止状态验证及证据。
- `.github/workflows/a1b-windows-node22.yml`：独立 Windows-hosted Actions 流水线。

仓库只自动运行实验分支 `experiment/a1b-node22-stopping` 的 CI，不直接修改 Demiurge 的 `main`。构建和测试产物以 Actions artifact 保留；不要把它直接用于正式 QQ 长期在线运行。

## 验证边界

**CI PASS 只说明当前固定 Node 22 ABI 中的停止状态适配与 DLL 导出表成立。** 它不能替代 Demiurge Windows 主机上的真实 QQ Native Session 初始化、扫码、私聊收发、锁屏继续通信和进程正常清理测试。

实验参考 Node.js v22.11.0 官方源码、NapCat/Napuketto 的公开启动事实与 QQ Native Mirror 的技术分析；此仓库的源码和适配均自行编写，未包含 NapCat 限制性源码或第三方私有 Native Stub。
