/*
    2023-04-29
    michael.vanderford@gmail.com

    This is a node module for using libgio File System utilities for NodeJS / Electron


*/

#include <nan.h>
#include <gio/gio.h>
#include <glib.h>

// static gboolean cancel_callback(gpointer user_data)
// {
//     // Retrieve the GCancellable object from user_data
//     GCancellable *cancellable = (GCancellable *)user_data;
//     // Cancel the copy operation using the GCancellable
//     g_cancellable_cancel(cancellable);
//     // Return FALSE to indicate that the callback should be removed
//     return FALSE;
// }

// NAN_METHOD(get_info) {
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
//     GError *error = NULL;
//     GFileInfo *file_info = g_file_query_info(src,
//                                          "*",
//                                          G_FILE_QUERY_INFO_NONE,
//                                          NULL,
//                                          &error);
//     if (file_info == NULL) {
//         g_error_free(error);
//         g_object_unref(src);
//         return Nan::ThrowError("Error getting file info");
//     }
//     GVariantIter iter;
//     const gchar *attr_name;
//     GFileAttributeType attr_type;
//     while (g_file_info_get_attribute_data(file_info, &attr_name, &attr_type, NULL, NULL)) {
//     }
// }

NAN_METHOD(ls) {

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

    v8::Local<v8::Array> resultArray = Nan::New<v8::Array>();
    // v8::Local<v8::Object> resultObject = Nan::New<v8::Object>();
    guint index = 0;

    // GFile *directory;
    GFileEnumerator *enumerator;
    GFileInfo *info_dir;
    const gchar *filename;

    enumerator = g_file_enumerate_children(
                                        src,
                                        G_FILE_ATTRIBUTE_STANDARD_NAME,
                                        G_FILE_QUERY_INFO_NONE,
                                        NULL,
                                        NULL
                                    );

    while ((info_dir = g_file_enumerator_next_file(enumerator, NULL, NULL)) != NULL) {
        filename = g_file_info_get_name(info_dir);
        Nan::Set(resultArray, index++, Nan::New(filename).ToLocalChecked());
        // Nan::Set(resultObject, Nan::New<v8::String>(std::to_string(index)).ToLocalChecked(), Nan::New<v8::String>(filename).ToLocalChecked());
        g_object_unref(info_dir);
    }

    g_object_unref(enumerator);

    info.GetReturnValue().Set(resultArray);
    // info.GetReturnValue().Set(resultArray);

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
        G_FILE_COPY_NOFOLLOW_SYMLINKS,
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

void Initialize(v8::Local<v8::Object> exports) {
    Nan::SetMethod(exports, "ls", ls);
    Nan::SetMethod(exports, "mkdir", mkdir);
    Nan::SetMethod(exports, "cp", cp);
    Nan::SetMethod(exports, "cp_async", cp_async);
    Nan::SetMethod(exports, "mv", mv);
    Nan::SetMethod(exports, "rm", rm);
}

NODE_MODULE(gio, Initialize)