// Minimal self-owned DLL preload N-API entry: no QQ, login or network logic.
#include <stddef.h>
#ifdef _WIN32
__declspec(dllexport)
#endif
void *napi_register_module_v1(void *env, void *exports) {
  (void)env;
  return exports;
}
