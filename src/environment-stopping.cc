// Pinned Node v22.11.0 internal ABI adapter; never use with other runtimes.
// Use the official exported node::GetCurrentEnvironment() API instead of
// the inlined Environment::GetCurrent() to avoid linking Node's private
// ContextEmbedderTag static pointer. The stop flag is still read exactly.
#include "env-inl.h"
#include "node.h"
#if !defined(_WIN64) || !defined(_M_X64)
#error "Windows x64 MSVC required"
#endif
static_assert(NODE_MAJOR_VERSION == 22 && NODE_MINOR_VERSION == 11 &&
              NODE_PATCH_VERSION == 0, "Runtime version mismatch");
extern "C" __declspec(dllexport)
bool qq_a1b_real_environment_stopping(v8::Isolate* isolate) {
  if (isolate == nullptr || !isolate->InContext()) return true;
  v8::HandleScope scope(isolate);
  node::Environment* env =
      node::GetCurrentEnvironment(isolate->GetCurrentContext());
  return env == nullptr || env->is_stopping();
}
