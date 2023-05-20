/*
    2023-04-29
    michael.vanderford@gmail.com

    This is a node module for using libgio File System utilities for NodeJS / Electron


*/

#include <nan.h>
#include <node.h>
#include <node_api.h>
#include <gio/gio.h>
#include <glib.h>

namespace gio {

using v8::FunctionCallbackInfo;
using v8::Isolate;
using v8::Local;
using v8::Object;
using v8::String;
using v8::Value;


// void on_device_added(GVolumeMonitor* monitor, GDrive* drive, gpointer user_data) {

//     Nan::HandleScope scope;

//     // Get the device name
//     const char* deviceName = g_drive_get_name(drive);

//     // Create a V8 string from the device name
//     v8::Local<v8::String> v8DeviceName = Nan::New(deviceName).ToLocalChecked();

//     Nan::Callback* callback = static_cast<Nan::Callback*>(user_data);

//     Nan::TryCatch tryCatch; // Create a TryCatch block to catch and handle exceptions

//     const unsigned argc = 1;
//     v8::Local<v8::Value> argv[argc] = { v8DeviceName };

//     callback->Call(argc, argv);

//     if (tryCatch.HasCaught()) {
//         Nan::FatalException(tryCatch); // Handle the exception if occurred
//     }

// }

// void monitor(const Nan::FunctionCallbackInfo<v8::Value>& info) {

//     Nan::HandleScope scope;

//     // Get the JavaScript callback function from the arguments
//     Nan::Callback* callback = new Nan::Callback(info[0].As<v8::Function>());

//     // Start monitoring for device changes
//     GVolumeMonitor* volumeMonitor = g_volume_monitor_get();
//     g_signal_connect(volumeMonitor, "drive-connected", G_CALLBACK(on_device_added), callback);

//     // Return undefined (no immediate return value)
//     info.GetReturnValue().SetUndefined();

// }

NAN_METHOD(ls) {

       Nan::HandleScope scope;

    if (info.Length() < 1) {
        return Nan::ThrowError("Wrong number of arguments");
    }

    v8::Local<v8::String> sourceString = Nan::To<v8::String>(info[0]).ToLocalChecked();
    v8::Isolate* isolate = info.GetIsolate();

    // Get the current context from the execution context
    v8::Local<v8::Context> context = isolate->GetCurrentContext();
    v8::String::Utf8Value sourceFile(context->GetIsolate(), sourceString);
    v8::Local<v8::Array> resultArray = Nan::New<v8::Array>();

    GFile* src = g_file_new_for_path(*sourceFile);

    const char *src_scheme = g_uri_parse_scheme(*sourceFile);
    if (src_scheme != NULL) {
        src = g_file_new_for_uri(*sourceFile);
    }

    GError* error = NULL;
    guint index = 0;
    GFileEnumerator* enumerator = g_file_enumerate_children(src, "*", G_FILE_QUERY_INFO_NOFOLLOW_SYMLINKS, NULL, &error);

    if (error != NULL) {
        fprintf(stderr, "Error: %s\n", error->message);
        g_error_free(error);
        g_object_unref(src);
        return;
    }

    GFileInfo* file_info = NULL;
    while ((file_info = g_file_enumerator_next_file(enumerator, NULL, &error)) != NULL) {

        const char* filename = g_file_info_get_name(file_info);
        GFile* file = g_file_get_child(src, filename);
        const char* href = g_file_get_path(file);
        gboolean is_hidden = g_file_info_get_is_hidden(file_info);
        gboolean is_directory = g_file_info_get_file_type(file_info) == G_FILE_TYPE_DIRECTORY;

        v8::Local<v8::Object> fileObj = Nan::New<v8::Object>();
        Nan::Set(fileObj, Nan::New("name").ToLocalChecked(), Nan::New(filename).ToLocalChecked());
        Nan::Set(fileObj, Nan::New("href").ToLocalChecked(), Nan::New(href).ToLocalChecked());
        Nan::Set(fileObj, Nan::New("is_dir").ToLocalChecked(), Nan::New<v8::Boolean>(is_directory));
        Nan::Set(fileObj, Nan::New("is_hidden").ToLocalChecked(), Nan::New<v8::Boolean>(is_hidden));

        // if (!is_directory) {
            gint64 size = g_file_info_get_size(file_info);
            Nan::Set(fileObj, Nan::New("size").ToLocalChecked(), Nan::New<v8::Number>(size));
        // }

        // GTimeVal mtime_val;
        GDateTime* mtime_dt = g_file_info_get_modification_date_time(file_info);
        if (mtime_dt != NULL) {
            gint64 mtime = g_date_time_to_unix(mtime_dt);
            Nan::Set(fileObj, Nan::New("mtime").ToLocalChecked(), Nan::New<v8::Number>(mtime));
            g_date_time_unref(mtime_dt);
        }

        // Get the access time (atime)
        GDateTime* atime_dt = g_file_info_get_access_date_time(file_info);
        if (atime_dt != NULL) {
            gint64 atime = g_date_time_to_unix(atime_dt);
            Nan::Set(fileObj, Nan::New("atime").ToLocalChecked(), Nan::New<v8::Number>(atime));
            g_date_time_unref(atime_dt);
        }

        // // Get the change time (ctime)
        GDateTime* ctime_dt = g_file_info_get_creation_date_time(file_info);
        if (ctime_dt != NULL) {
            gint64 ctime = g_date_time_to_unix(ctime_dt);
            Nan::Set(fileObj, Nan::New("ctime").ToLocalChecked(), Nan::New<v8::Number>(ctime));
            g_date_time_unref(ctime_dt);
        }

        // GIcon* icon = g_file_info_get_icon(file_info);
        // if (icon != NULL) {
        //     gchar* icon_name = g_icon_to_string(icon);
        //     Nan::Set(fileObj, Nan::New("icon").ToLocalChecked(), Nan::New(icon_name).ToLocalChecked());
        //     g_free(icon_name);
        //     g_object_unref(icon);
        // }

        // GIcon* icon = g_file_info_get_icon(file_info);
        // if (icon != NULL) {
        //     GFileIcon* file_icon = G_FILE_ICON(icon);
        //     if (file_icon != NULL) {
        //         GFile* icon_file = g_file_icon_get_file(file_icon);
        //         if (icon_file != NULL) {
        //             gchar* icon_path = g_file_get_path(icon_file);
        //             if (icon_path != NULL) {
        //                 Nan::Set(fileObj, Nan::New("icon").ToLocalChecked(), Nan::New(icon_path).ToLocalChecked());
        //                 g_free(icon_path);
        //             }
        //             g_object_unref(icon_file);
        //         }
        //     }
        //     g_object_unref(icon);
        // }

        Nan::Set(resultArray, index++, fileObj);

        // Nan::Set(resultArray, index++, Nan::New(filename).ToLocalChecked());
        // Nan::Set(resultArray, index++, Nan::New(is_hidden).ToLocalChecked());
        // Nan::Set(resultArray, index++, Nan::New(is_directory).ToLocalChecked());

        g_object_unref(file_info);
    }

    if (error != NULL) {
        fprintf(stderr, "Error: %s\n", error->message);
        g_error_free(error);
    }

    g_object_unref(enumerator);
    g_object_unref(src);

    info.GetReturnValue().Set(resultArray);

}

// NAN_METHOD(ls) {

//     Nan:: HandleScope scope;

//     if (info.Length() < 1) {
//         return Nan::ThrowError("Wrong number of arguments");
//     }

//     v8::Local<v8::String> sourceString = Nan::To<v8::String>(info[0]).ToLocalChecked();

//     v8::Isolate* isolate = info.GetIsolate();
//     v8::String::Utf8Value sourceFile(isolate, sourceString);

//     GFile* src = g_file_new_for_path(*sourceFile);

//     const char *src_scheme = g_uri_parse_scheme(*sourceFile);
//     if (src_scheme != NULL) {
//         src = g_file_new_for_uri(*sourceFile);
//     }

//     v8::Local<v8::Array> resultArray = Nan::New<v8::Array>();
//     // v8::Local<v8::Object> resultObject = Nan::New<v8::Object>();
//     guint index = 0;

//     // GFile *directory;
//     GFileEnumerator *enumerator;
//     GFileInfo *info_dir;
//     const gchar *filename;
//     const char* attributes;

//     enumerator = g_file_enumerate_children(
//                                         src,
//                                         "*",
//                                         G_FILE_QUERY_INFO_NONE,
//                                         NULL,
//                                         NULL
//                                     );

//     while ((info_dir = g_file_enumerator_next_file(enumerator, NULL, NULL)) != NULL) {
//         filename = g_file_info_get_name(info_dir);
//         Nan::Set(resultArray, index++, Nan::New(filename).ToLocalChecked());
//         // Nan::Set(resultObject, Nan::New<v8::String>(std::to_string(index)).ToLocalChecked(), Nan::New<v8::String>(filename).ToLocalChecked());
//         g_object_unref(info_dir);
//     }

//     g_object_unref(enumerator);

//     info.GetReturnValue().Set(resultArray);
//     // info.GetReturnValue().Set(resultArray);

// }



NAN_METHOD(exists) {

    Nan::HandleScope scope;

    if (info.Length() < 1) {
        return Nan::ThrowError("Wrong number of arguments");
    }

    v8::Local<v8::String> sourceString = Nan::To<v8::String>(info[0]).ToLocalChecked();

    v8::Isolate* isolate = info.GetIsolate();

    // Get the current context from the execution context
    v8::Local<v8::Context> context = isolate->GetCurrentContext();

    v8::String::Utf8Value sourceFile(context->GetIsolate(), sourceString);

    // v8::String::Utf8Value sourceFile(isolate, sourceString);

    GFile* src = g_file_new_for_path(*sourceFile);

    const char *src_scheme = g_uri_parse_scheme(*sourceFile);
    if (src_scheme != NULL) {
        src = g_file_new_for_uri(*sourceFile);
    }

    gboolean exists = FALSE;
    exists = g_file_query_exists (src, NULL);

    bool result = exists != FALSE;

    // Create a new Boolean value
    // v8::Local<v8::Boolean> resultValue = Nan::New<v8::Boolean>(result);

    // Create a new Boolean value in the current context
    v8::Local<v8::Boolean> resultValue = v8::Boolean::New(isolate, result);


    // Return the Boolean value
    info.GetReturnValue().Set(resultValue);

}

// NAN_METHOD(monitor) {

//     GVolumeMonitor* volume_monitor;

//     // Initialize the GIO library
//     g_type_init();

//     // Create the volume monitor
//     volume_monitor = g_volume_monitor_get();

//     // Connect signals for device added and removed events
//     g_signal_connect(volume_monitor, "drive-added", G_CALLBACK(on_device_added), NULL);
//     // g_signal_connect(volume_monitor, "drive-removed", G_CALLBACK(on_device_removed), NULL);

// }

NAN_METHOD(count) {

    Nan:: HandleScope scope;

    if (info.Length() < 1) {
        return Nan::ThrowError("Wrong number of arguments");
    }

    v8::Local<v8::String> sourceString = Nan::To<v8::String>(info[0]).ToLocalChecked();

    v8::Isolate* isolate = info.GetIsolate();
    v8::String::Utf8Value sourceFile(isolate, sourceString);

    GFile* src = g_file_new_for_path(*sourceFile);

    const char *src_scheme = g_uri_parse_scheme(*sourceFile);
    if (src_scheme != NULL) {
        src = g_file_new_for_uri(*sourceFile);
    }

    GError* error = NULL;
    GFileEnumerator* enumerator = g_file_enumerate_children(src, G_FILE_ATTRIBUTE_STANDARD_NAME, G_FILE_QUERY_INFO_NONE, NULL, &error);

    // if (error) {
    //     // fprintf(stderr, "Failed to enumerate directory: %s\n", error->message);
    //     g_error_free(error);
    //     g_object_unref(src);
    //     // return 1; // return
    // }

    guint item_count = 0;
    GFileInfo* file_info;
    while (file_info = g_file_enumerator_next_file(enumerator, NULL, &error)) {

        // GFileInfo* file_info = g_file_enumerator_next_file(enumerator, NULL, &error);

        if (error) {
            // fprintf(stderr, "Failed to get file info: %s\n", error->message);
            g_error_free(error);
            break;
        }

        if (file_info == NULL) {
            break;  // Reached the end of the directory
        }

        item_count++;

        g_object_unref(file_info);
    }

    g_file_enumerator_close(enumerator, NULL, NULL);
    g_object_unref(enumerator);
    g_object_unref(src);

    // Create a new Boolean value in the current context
    v8::Local<v8::Integer> resultValue = v8::Integer::New(isolate, item_count);

    // Return the Boolean value
    info.GetReturnValue().Set(resultValue);

}


NAN_METHOD(icon) {

    Nan:: HandleScope scope;

    if (info.Length() < 1) {
        return Nan::ThrowError("Wrong number of arguments");
    }

    v8::Local<v8::String> sourceString = Nan::To<v8::String>(info[0]).ToLocalChecked();

    v8::Isolate* isolate = info.GetIsolate();
    v8::String::Utf8Value sourceFile(isolate, sourceString);

    GFile* src = g_file_new_for_path(*sourceFile);

    const char *src_scheme = g_uri_parse_scheme(*sourceFile);
    if (src_scheme != NULL) {
        src = g_file_new_for_uri(*sourceFile);
    }

    GFileInfo* file_info = g_file_query_info(src, G_FILE_ATTRIBUTE_STANDARD_ICON, G_FILE_QUERY_INFO_NONE, NULL, NULL);

    GIcon *icon = g_file_info_get_icon(file_info);
    gchar *icon_name = g_icon_to_string(icon);

    // // Get the filename of the icon
    // const char* icon_name = g_icon_to_string(icon);

    // // Get the theme icon for the GIcon
    // GtkIconTheme* theme = gtk_icon_theme_get_default();
    // GdkPixbuf* pixbuf = gtk_icon_theme_load_icon(theme, icon_name, 16, 0, NULL);

    // // Print the filename of the icon
    printf("%s\n", icon_name);

    // // Cleanup
    g_object_unref(icon);
    g_object_unref(src);

}

NAN_METHOD(cp) {

    Nan:: HandleScope scope;

    if (info.Length() < 2) {
        return Nan::ThrowError("Wrong number of arguments");
    }

    v8::Local<v8::String> sourceString = Nan::To<v8::String>(info[0]).ToLocalChecked();
    v8::Local<v8::String> destString = Nan::To<v8::String>(info[1]).ToLocalChecked();

    int overwrite_flag = Nan::To<int>(info[2]).FromJust();
    GFileCopyFlags flags;
    if (overwrite_flag == 1) {
        flags = G_FILE_COPY_OVERWRITE;
    } else {
        flags = G_FILE_COPY_NONE;
    }

    v8::Isolate* isolate = info.GetIsolate();
    v8::String::Utf8Value sourceFile(isolate, sourceString);
    v8::String::Utf8Value destFile(isolate, destString);

    GFile* src = g_file_new_for_path(*sourceFile);
    GFile* dest = g_file_new_for_path(*destFile);

    const char *src_scheme = g_uri_parse_scheme(*sourceFile);
    const char *dest_scheme = g_uri_parse_scheme(*destFile);
    if (src_scheme != NULL) {
        src = g_file_new_for_uri(*sourceFile);
    }
    if (dest_scheme != NULL) {
        dest = g_file_new_for_uri(*destFile);
    }

    GError* error = nullptr;
    gboolean ret = g_file_copy(
        src,
        dest,
        flags,
        nullptr,
        nullptr,
        nullptr,
         &error
    );

    g_object_unref(src);
    g_object_unref(dest);

    if (ret == FALSE) {
        return Nan::ThrowError(error->message);
    }

    info.GetReturnValue().Set(Nan::True());

}

NAN_METHOD(cp_async) {

    Nan:: HandleScope scope;

    if (info.Length() < 2) {
        return Nan::ThrowError("Wrong number of arguments");
    }

    v8::Local<v8::String> sourceString = Nan::To<v8::String>(info[0]).ToLocalChecked();
    v8::Local<v8::String> destString = Nan::To<v8::String>(info[1]).ToLocalChecked();

    v8::Isolate* isolate = info.GetIsolate();
    v8::String::Utf8Value sourceFile(isolate, sourceString);
    v8::String::Utf8Value destFile(isolate, destString);

    GFile* src = g_file_new_for_path(*sourceFile);
    GFile* dest = g_file_new_for_path(*destFile);

    const char *src_scheme = g_uri_parse_scheme(*sourceFile);
    const char *dest_scheme = g_uri_parse_scheme(*destFile);
    if (src_scheme != NULL) {
        src = g_file_new_for_uri(*sourceFile);
    }
    if (dest_scheme != NULL) {
        dest = g_file_new_for_uri(*destFile);
    }

    g_file_copy_async(src, dest,
                      G_FILE_COPY_NONE,
                      G_PRIORITY_DEFAULT,
                      NULL,
                      NULL,
                      NULL,
                      NULL,
                      NULL);

    g_object_unref(src);
    g_object_unref(dest);

}

NAN_METHOD(cp_write) {
    Nan:: HandleScope scope;
}

NAN_METHOD(rm) {

    Nan:: HandleScope scope;

    if (info.Length() < 1) {
        return Nan::ThrowError("Wrong number of arguments");
    }

    v8::Local<v8::String> sourceString = Nan::To<v8::String>(info[0]).ToLocalChecked();

    v8::Isolate* isolate = info.GetIsolate();
    v8::String::Utf8Value sourceFile(isolate, sourceString);

    GFile* src = g_file_new_for_path(*sourceFile);

    const char *src_scheme = g_uri_parse_scheme(*sourceFile);
    if (src_scheme != NULL) {
        src = g_file_new_for_uri(*sourceFile);
    }

    GError* error = nullptr;
    gboolean res = g_file_delete(src, nullptr, &error);

    g_object_unref(src);

    if (res == FALSE) {
        return Nan::ThrowError(error->message);
    }

    info.GetReturnValue().Set(Nan::True());

}

NAN_METHOD(mkdir) {

    Nan:: HandleScope scope;

    if (info.Length() < 1) {
        return Nan::ThrowError("Wrong number of arguments");
    }

    v8::Local<v8::String> sourceString = Nan::To<v8::String>(info[0]).ToLocalChecked();

    v8::Isolate* isolate = info.GetIsolate();
    v8::String::Utf8Value sourceFile(isolate, sourceString);

    GFile* src = g_file_new_for_path(*sourceFile);

    const char *src_scheme = g_uri_parse_scheme(*sourceFile);
    if (src_scheme != NULL) {
        src = g_file_new_for_uri(*sourceFile);
    }

    GError* error = NULL;
    gboolean res = g_file_make_directory(src, NULL, &error);

    g_object_unref(src);

    if (res == FALSE) {
        return Nan::ThrowError(error->message);
    }

    info.GetReturnValue().Set(Nan::True());

}


NAN_METHOD(mv) {

    // gboolean
    // g_file_move (
    //   GFile* source,
    //   GFile* destination,
    //   GFileCopyFlags flags,
    //   GCancellable* cancellable,
    //   GFileProgressCallback progress_callback,
    //   gpointer progress_callback_data,
    //   GError** error
    // )

    if (info.Length() < 2) {
        return Nan::ThrowError("Wrong number of arguments");
    }

    v8::Local<v8::String> sourceString = Nan::To<v8::String>(info[0]).ToLocalChecked();
    v8::Local<v8::String> destString = Nan::To<v8::String>(info[1]).ToLocalChecked();

    v8::Isolate* isolate = info.GetIsolate();
    v8::String::Utf8Value sourceFile(isolate, sourceString);
    v8::String::Utf8Value destFile(isolate, destString);

    GFile* src = g_file_new_for_path(*sourceFile);
    GFile* dest = g_file_new_for_path(*destFile);

    const char *src_scheme = g_uri_parse_scheme(*sourceFile);
    const char *dest_scheme = g_uri_parse_scheme(*destFile);
    if (src_scheme != NULL) {
        src = g_file_new_for_uri(*sourceFile);
    }
    if (dest_scheme != NULL) {
        dest = g_file_new_for_uri(*destFile);
    }

    GError *error = NULL;
    gboolean res = g_file_move(
        src,
        dest,
        G_FILE_COPY_NONE,
        NULL,
        NULL,
        NULL,
        &error
    );

    g_object_unref(src);
    g_object_unref(dest);

    if (res == FALSE) {
        return Nan::ThrowError(error->message);
    }

    info.GetReturnValue().Set(Nan::True());

}

// void init(Local<Object> exports) {
//   NODE_SET_METHOD(exports, "ls", ls);
// }

// NODE_MODULE(gio, init)

// void Initialize(v8::Local<v8::Object> exports) {
//     Nan::SetMethod(exports, "ls", ls);
//     Nan::SetMethod(exports, "mkdir", mkdir);
//     Nan::SetMethod(exports, "cp", cp);
//     Nan::SetMethod(exports, "cp_async", cp_async);
//     Nan::SetMethod(exports, "mv", mv);
//     Nan::SetMethod(exports, "rm", rm);
//     // Nan::SetMethod(exports, "monitor", monitor);
//     Nan::SetMethod(exports, "exists", exists);
// }

    NAN_MODULE_INIT(init) {
        Nan::Export(target, "count", count);
        Nan::Export(target, "exists", exists);
        Nan::Export(target, "ls", ls);
        Nan::Export(target, "mkdir", mkdir);
        Nan::Export(target, "cp", cp);
        Nan::Export(target, "cp_async", cp_async);
        Nan::Export(target, "mv", mv);
        Nan::Export(target, "rm", rm);
    }
    // Nan::Set(target, Nan::New("ls").ToLocalChecked(),
    //        Nan::GetFunction(Nan::New<v8::FunctionTemplate>(ls)).ToLocalChecked());

    // Nan::Set(target, Nan::New("mkdir").ToLocalChecked(),
    //        Nan::GetFunction(Nan::New<v8::FunctionTemplate>(mkdir)).ToLocalChecked());

    // Nan::Set(target, Nan::New("cp").ToLocalChecked(),
    //        Nan::GetFunction(Nan::New<v8::FunctionTemplate>(cp)).ToLocalChecked());

    // Nan::Set(target, Nan::New("mv").ToLocalChecked(),
    //        Nan::GetFunction(Nan::New<v8::FunctionTemplate>(mv)).ToLocalChecked());

    // Nan::Set(target, Nan::New("rm").ToLocalChecked(),
    //        Nan::GetFunction(Nan::New<v8::FunctionTemplate>(rm)).ToLocalChecked());

    // Nan::Set(target, Nan::New("exists").ToLocalChecked(),
    //        Nan::GetFunction(Nan::New<v8::FunctionTemplate>(mkdir)).ToLocalChecked());



    NODE_MODULE(gio, init)
    // NODE_MODULE_CONTEXT_AWARE_BUILTIN(gio, Init)


}