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
#include <iostream>

namespace gio {

    using v8::FunctionCallbackInfo;
    using v8::Isolate;
    using v8::Local;
    using v8::Object;
    using v8::String;
    using v8::Value;

    // guint64 ds(const char* dir) {

    //     GVolumeMonitor *monitor;
    //     GVolume *root_volume;
    //     GMount *root_mount;
    //     GFile *root_file;
    //     GFileInfo *file_info;
    //     guint64 available_space;

    //     // Initialize GIO
    //     g_type_init();

    //     // Create a volume monitor
    //     monitor = g_volume_monitor_get();

    //     // Get the root volume
    //     root_volume = g_volume_monitor_get_volumes(monitor);

    //     // Get the root mount
    //     root_mount = g_volume_get_mount(root_volume);

    //     // Get the root file
    //     root_file = g_mount_get_root(root_mount);

    //     // Get the file information
    //     file_info = g_file_query_info(root_file, "standard::allocatable", G_FILE_QUERY_INFO_NONE, NULL, NULL);

    //     // Get the available space
    //     g_file_info_get_attribute_uint64(file_info, "standard::allocatable", &available_space);

    //     // Print the available space in bytes
    //     // printf("Available Disk Space: %lu bytes\n", available_space);

    //     // Cleanup
    //     g_object_unref(file_info);
    //     g_object_unref(root_file);
    //     g_object_unref(root_mount);
    //     g_object_unref(root_volume);
    //     g_object_unref(monitor);

    //     return available_space;

    // }

    guint64 du(const char *dir) {

        GFile* src = g_file_new_for_path(dir);

        const char *src_scheme = g_uri_parse_scheme(dir);
        if (src_scheme != NULL) {
            src = g_file_new_for_uri(dir);
        }

        GFileInfo* folderInfo = g_file_query_info(src, G_FILE_ATTRIBUTE_STANDARD_SIZE,
                                                    G_FILE_QUERY_INFO_NONE, NULL, NULL);
        guint64 folderSize = g_file_info_get_size(folderInfo);

        GFileEnumerator* enumerator = g_file_enumerate_children(src, "standard::*", G_FILE_QUERY_INFO_NONE, NULL, NULL);
        GFileInfo* childInfo = NULL;

        while ((childInfo = g_file_enumerator_next_file(enumerator, NULL, NULL)) != NULL) {
            const char* childName = g_file_info_get_name(childInfo);
            char* childPath = g_build_filename(dir, childName, NULL);

            if (g_file_info_get_file_type(childInfo) == G_FILE_TYPE_DIRECTORY) {
            folderSize += du(childPath);
            } else {
            GFileInfo* fileInfo = g_file_query_info(g_file_new_for_path(childPath),
                                                    G_FILE_ATTRIBUTE_STANDARD_SIZE,
                                                    G_FILE_QUERY_INFO_NONE, NULL, NULL);
            folderSize += g_file_info_get_size(fileInfo);
            g_object_unref(fileInfo);
            }

            g_free(childPath);
            g_object_unref(childInfo);
        }

        g_object_unref(enumerator);
        g_object_unref(folderInfo);
        g_object_unref(src);

        return folderSize;

    }

    void on_device_added(GVolumeMonitor* monitor, GDrive* drive, gpointer user_data) {

        Nan::HandleScope scope;

        // Get the device name
        const char* deviceName = g_drive_get_name(drive);

        // Create a V8 string from the device name
        v8::Local<v8::String> v8DeviceName = Nan::New(deviceName).ToLocalChecked();
        Nan::Callback* callback = static_cast<Nan::Callback*>(user_data);

        Nan::TryCatch tryCatch; // Create a TryCatch block to catch and handle exceptions

        const unsigned argc = 1;

        v8::Local<v8::Value> argv[argc] = { v8DeviceName };
        callback->Call(argc, argv);
        if (tryCatch.HasCaught()) {
            Nan::FatalException(tryCatch); // Handle the exception if occurred
        }
    }

    // void on_device_added(GVolumeMonitor* monitor, GDrive* drive, gpointer user_data) {
    //     Nan::HandleScope scope;
    //     Nan::Callback* callback = static_cast<Nan::Callback*>(user_data);
    //     // Get drive information
    //     const char* driveName = g_drive_get_name(drive);
    //     //   const char* driveId = g_drive_get_identifier(drive);
    //     // Create an object to pass the drive information to the JavaScript callback
    //     v8::Local<v8::Object> driveInfo = Nan::New<v8::Object>();
    //     Nan::Set(driveInfo, Nan::New("name").ToLocalChecked(), Nan::New(driveName).ToLocalChecked());
    //     // Nan::Set(driveInfo, Nan::New("id").ToLocalChecked(), Nan::New(driveId).ToLocalChecked());
    //     // Call the JavaScript callback with the drive information
    //     v8::Local<v8::Value> argv[] = { driveInfo };
    //     Nan::AsyncResource resource("on_device_added");
    //     callback->Call(1, argv);
    // }

    NAN_METHOD(monitor) {

        Nan::HandleScope scope;

        if (info.Length() < 1 || !info[0]->IsFunction()) {
            Nan::ThrowTypeError("Invalid arguments. Expected a function.");
            return;
        }

        // Get the JavaScript callback function from the arguments
        Nan::Callback* callback = new Nan::Callback(info[0].As<v8::Function>());

        // Start monitoring for device changes
        GVolumeMonitor* volumeMonitor = g_volume_monitor_get();
        g_signal_connect(volumeMonitor, "drive-connected", G_CALLBACK(on_device_added), callback);

        // Return undefined (no immediate return value)
        info.GetReturnValue().SetUndefined();
    }

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

    NAN_METHOD(open_with) {

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
        GFileInfo* file_info = g_file_query_info(src, "*", G_FILE_QUERY_INFO_NONE, NULL, &error);
        const char* mimetype = g_file_info_get_content_type(file_info);

        GList* appList = g_app_info_get_all_for_type(mimetype);


        v8::Local<v8::Array> result = Nan::New<v8::Array>();

        int i = 0;
        for (GList* iter = appList; iter != NULL; iter = iter->next) {
            GAppInfo* app = (GAppInfo*)iter->data;
            const char* appName = g_app_info_get_name(app);

            Nan::Set(result, i, Nan::New(appName).ToLocalChecked());
            i++;
        }

        g_list_free(appList);
        // g_clear_object(&defaultApp);
        g_object_unref(src);

        info.GetReturnValue().Set(result);
    }

    /**
     * This does not seem to work with intellisense
    */
    NAN_METHOD(du) {

        // Check if the argument is a string
        if (info.Length() < 1) {
            return Nan::ThrowError("Wrong number of arguments");
        }

        // Convert the argument to a C++ string
        v8::Local<v8::String> sourceString = Nan::To<v8::String>(info[0]).ToLocalChecked();
        v8::Isolate* isolate = info.GetIsolate();

        // Get the current context from the execution context
        v8::Local<v8::Context> context = isolate->GetCurrentContext();
        v8::String::Utf8Value sourceFile(context->GetIsolate(), sourceString);

        // Calculate the folder size recursively
        guint64 folderSize = du(*sourceFile);

        // Return the result as a number
        info.GetReturnValue().Set(Nan::New<v8::Number>(static_cast<double>(folderSize)));

    }

    NAN_METHOD(get_file) {

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
        GFileInfo* file_info = g_file_query_info(src, "*", G_FILE_QUERY_INFO_NONE, NULL, &error);
        const char* filename = g_file_info_get_name(file_info);
        const char* href = g_file_get_path(src);
        gboolean is_hidden = g_file_info_get_is_hidden(file_info);
        gboolean is_directory = g_file_info_get_file_type(file_info) == G_FILE_TYPE_DIRECTORY;
        const char* mimetype = g_file_info_get_content_type(file_info);
        gboolean is_writable = g_file_info_get_attribute_boolean(file_info, G_FILE_ATTRIBUTE_ACCESS_CAN_WRITE);

        v8::Local<v8::Object> fileObj = Nan::New<v8::Object>();
        Nan::Set(fileObj, Nan::New("name").ToLocalChecked(), Nan::New(filename).ToLocalChecked());
        Nan::Set(fileObj, Nan::New("href").ToLocalChecked(), Nan::New(href).ToLocalChecked());
        Nan::Set(fileObj, Nan::New("is_dir").ToLocalChecked(), Nan::New<v8::Boolean>(is_directory));
        Nan::Set(fileObj, Nan::New("is_hidden").ToLocalChecked(), Nan::New<v8::Boolean>(is_hidden));
        Nan::Set(fileObj, Nan::New("is_writable").ToLocalChecked(), Nan::New<v8::Boolean>(is_writable));
        Nan::Set(fileObj, Nan::New("content_type").ToLocalChecked(), Nan::New(mimetype).ToLocalChecked());

        gint64 size = g_file_info_get_size(file_info);
        Nan::Set(fileObj, Nan::New("size").ToLocalChecked(), Nan::New<v8::Number>(size));


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

        // Nan::Set(resultArray, 0, fileObj);

        g_object_unref(file_info);

        g_object_unref(src);
        info.GetReturnValue().Set(fileObj);

    }

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

        if (enumerator == NULL) {
            GError *enum_err;
            enum_err = g_error_new_literal(G_FILE_ERROR, G_FILE_ERROR_FAILED, "Failed to get child file");
            return Nan::ThrowError(enum_err->message);
        }

        if (error != NULL) {
            g_error_free(error);
            g_object_unref(src);
            return Nan::ThrowError(error->message);
            return;
        }

        GFileInfo* file_info = NULL;
        while ((file_info = g_file_enumerator_next_file(enumerator, NULL, &error)) != NULL) {

            const char* filename = g_file_info_get_name(file_info);
            GFile* file = g_file_get_child(src, filename);
            const char* href = g_file_get_path(file);
            gboolean is_hidden = g_file_info_get_is_hidden(file_info);
            gboolean is_directory = g_file_info_get_file_type(file_info) == G_FILE_TYPE_DIRECTORY;
            const char* mimetype = g_file_info_get_content_type(file_info);
            gboolean  is_writeable = g_file_info_get_attribute_boolean(file_info, G_FILE_ATTRIBUTE_ACCESS_CAN_WRITE);

            v8::Local<v8::Object> fileObj = Nan::New<v8::Object>();
            Nan::Set(fileObj, Nan::New("name").ToLocalChecked(), Nan::New(filename).ToLocalChecked());
            Nan::Set(fileObj, Nan::New("href").ToLocalChecked(), Nan::New(href).ToLocalChecked());
            Nan::Set(fileObj, Nan::New("is_dir").ToLocalChecked(), Nan::New<v8::Boolean>(is_directory));
            Nan::Set(fileObj, Nan::New("is_hidden").ToLocalChecked(), Nan::New<v8::Boolean>(is_hidden));
            Nan::Set(fileObj, Nan::New("is_writable").ToLocalChecked(), Nan::New<v8::Boolean>(is_writeable));

            if (mimetype != nullptr) {
                Nan::Set(fileObj, Nan::New("content_type").ToLocalChecked(), Nan::New(mimetype).ToLocalChecked());
            }

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

            Nan::Set(resultArray, index++, fileObj);
            g_object_unref(file_info);

        }

        if (error != NULL) {
            g_error_free(error);
            return Nan::ThrowError(error->message);
        }

        g_object_unref(enumerator);
        g_object_unref(src);

        info.GetReturnValue().Set(resultArray);

    }

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

        if (error) {
            g_error_free(error);
            g_object_unref(src);
            return;
        }

        guint item_count = 0;
        GFileInfo* file_info;
        while (file_info = g_file_enumerator_next_file(enumerator, NULL, &error)) {

            // GFileInfo* file_info = g_file_enumerator_next_file(enumerator, NULL, &error);

            if (error) {
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

    NAN_METHOD(is_writable) {

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

        // Get the GFileInfo object for the directory
        GFileInfo* fileInfo = g_file_query_info(src, G_FILE_ATTRIBUTE_ACCESS_CAN_WRITE,
                                                G_FILE_QUERY_INFO_NONE, NULL, NULL);

        // Check if the directory is writable
        gboolean isWritable = g_file_info_get_attribute_boolean(fileInfo, G_FILE_ATTRIBUTE_ACCESS_CAN_WRITE);

        // Free the allocated resources
        g_object_unref(fileInfo);
        g_object_unref(src);

        // Return the result as a boolean value
        info.GetReturnValue().Set(Nan::New<v8::Boolean>(isWritable != FALSE));

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

    NAN_MODULE_INIT(init) {
        Nan::Export(target, "open_with", open_with);
        Nan::Export(target, "du", du);
        Nan::Export(target, "count", count);
        Nan::Export(target, "exists", exists);
        Nan::Export(target, "get_file", get_file);
        Nan::Export(target, "ls", ls);
        Nan::Export(target, "mkdir", mkdir);
        Nan::Export(target, "cp", cp);
        Nan::Export(target, "cp_async", cp_async);
        Nan::Export(target, "mv", mv);
        Nan::Export(target, "rm", rm);
        Nan::Export(target, "is_writable", is_writable);
        Nan::Set(target, Nan::New("monitor").ToLocalChecked(), Nan::GetFunction(Nan::New<v8::FunctionTemplate>(monitor)).ToLocalChecked());
    }

    // NAN_MODULE_WORKER_ENABLED(count, count)
    // NAN_MODULE_WORKER_ENABLED(ls, init)
    NAN_MODULE_WORKER_ENABLED(gio, init)
    NODE_MODULE(gio, init)

}

// NODE_MODULE_CONTEXT_AWARE_BUILTIN(gio, init)