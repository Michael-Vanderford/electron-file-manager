#include <nan.h>


NAN_MODULE_INIT(Init) {
  // Register your objects and functions here.

    NAN_METHOD('ls') {

    }


}

NAN_MODULE_WORKER_ENABLED(ls, Init)