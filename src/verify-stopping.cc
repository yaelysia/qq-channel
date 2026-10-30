// Disposable-process native proof. Calls node::Stop with the current Node
// Environment, then _Exit() without returning to the stopped JS runtime.
#define NOMINMAX
#include <windows.h>
#include <cstdio>
#include <cstdlib>
#include "node.h"
#include "node_api.h"
#include "v8.h"
#if !defined(_WIN64) || !defined(_M_X64)
#error "Windows x64 MSVC required"
#endif
using Predicate = bool (*)(v8::Isolate*);
static napi_value verify(napi_env napiEnv, napi_callback_info info) {
  (void)napiEnv;
  (void)info;
  HMODULE shim = GetModuleHandleW(L"QQNT.dll");
  if (!shim) {
    std::puts("{\"pass\":false,\"error\":\"shim not loaded\"}");
    std::fflush(stdout);
    std::_Exit(20);
  }
  const auto pred = reinterpret_cast<Predicate>(
      GetProcAddress(shim, "qq_a1b_real_environment_stopping"));
  if (!pred) {
    std::puts("{\"pass\":false,\"error\":\"predicate missing\"}");
    std::fflush(stdout);
    std::_Exit(21);
  }
  v8::Isolate* isolate = v8::Isolate::GetCurrent();
  if (!isolate || !isolate->InContext()) {
    std::puts("{\"pass\":false,\"error\":\"no isolate\"}");
    std::fflush(stdout);
    std::_Exit(22);
  }
  node::Environment* env =
      node::GetCurrentEnvironment(isolate->GetCurrentContext());
  if (!env) {
    std::puts("{\"pass\":false,\"error\":\"no environment\"}");
    std::fflush(stdout);
    std::_Exit(23);
  }
  const bool nullIsolate = pred(nullptr);
  const bool before = pred(isolate);
  const int stopRc =
      node::Stop(env, node::StopFlags::kDoNotTerminateIsolate);
  const bool after = pred(isolate);
  const bool pass = nullIsolate && !before && stopRc == 0 && after;
  std::printf(
      "{\"test\":\"Node22_is_stopping_transition\","
      "\"nullIsolate\":%s,\"before\":%s,\"stopRc\":%d,"
      "\"after\":%s,\"pass\":%s}\n",
      nullIsolate ? "true" : "false", before ? "true" : "false",
      stopRc, after ? "true" : "false", pass ? "true" : "false");
  std::fflush(stdout);
  std::_Exit(pass ? 0 : 24);
}
extern "C" __declspec(dllexport)
napi_value napi_register_module_v1(napi_env env, napi_value exports) {
  napi_value fn;
  if (napi_create_function(env, "verify", NAPI_AUTO_LENGTH, verify,
                           nullptr, &fn) != napi_ok) return nullptr;
  if (napi_set_named_property(env, exports, "verify", fn) != napi_ok)
    return nullptr;
  return exports;
}
