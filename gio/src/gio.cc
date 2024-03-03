/*
    Date: 2023-04-29
    Email: michael.vanderford@gmail.com
    This is a node module for using libgio File System utilities for NodeJS / Electron

*/

#include <stdlib.h>
#include <unistd.h>
#include <iostream>
#include <vector>
#include <string>
#include <array>
#include <sstream>

// Node includes
#include <nan.h>
#include <node.h>
#include <node_api.h>

// Glib includes
#include <gio/gio.h>
#include <glib-object.h>
#include <gdk-pixbuf/gdk-pixbuf.h>
#include <glib.h>

using namespace std;

namespace gio {

    using v8::FunctionCallbackInfo;
    using v8::Isolate;
    using v8::Local;
    using v8::Object;
    using v8::String;
    using v8::Value;

    // Sets the execute bit on a file
    NAN_METHOD(set_execute) {

        if (info.Length() < 1) {
            Nan::ThrowTypeError("Invalid arguments. Expected a string for the target directory.");
            return;
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

        // Get the GFileInfo for the file
        GFileInfo* file_info = g_file_query_info(src,
                                                 "*",
                                                 G_FILE_QUERY_INFO_NONE,
                                                 NULL,
                                                 NULL);

        if (file_info) {

            guint32 permissions;
            permissions = g_file_info_get_attribute_uint32(file_info,
                                                            G_FILE_ATTRIBUTE_UNIX_MODE);

            // Add the execute bit to the permissions
            permissions |= S_IXUSR | S_IXGRP | S_IXOTH;

            // Set the modified permissions back to the file
            g_file_set_attribute (src,
                                G_FILE_ATTRIBUTE_UNIX_MODE,
                                G_FILE_ATTRIBUTE_TYPE_UINT32,
                                &permissions,
                                G_FILE_QUERY_INFO_NONE,
                                NULL,
                                NULL);


            // Release the GFileInfo
            g_object_unref(file_info);
        }

        // Release the GFile
        g_object_unref(src);

    }

    // Clear execute bit
    NAN_METHOD(clear_execute) {

        if (info.Length() < 1) {
            Nan::ThrowTypeError("Invalid arguments. Expected a string for the target directory.");
            return;
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

        // Get the GFileInfo for the file
        GFileInfo* file_info = g_file_query_info(src,
                                                 "*",
                                                 G_FILE_QUERY_INFO_NONE,
                                                 NULL,
                                                 NULL);

        if (file_info) {

            guint32 permissions;
            permissions = g_file_info_get_attribute_uint32(file_info,
                                                            G_FILE_ATTRIBUTE_UNIX_MODE);

            // Add the execute bit to the permissions
            permissions &= ~(S_IXUSR | S_IXGRP | S_IXOTH);

            // Set the modified permissions back to the file
            g_file_set_attribute (src,
                                G_FILE_ATTRIBUTE_UNIX_MODE,
                                G_FILE_ATTRIBUTE_TYPE_UINT32,
                                &permissions,
                                G_FILE_QUERY_INFO_NONE,
                                NULL,
                                NULL);


            // Release the GFileInfo
            g_object_unref(file_info);
        }

        // Release the GFile
        g_object_unref(src);

    }

    NAN_METHOD(thumbnail) {

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

        GdkPixbuf *inputPixbuf = gdk_pixbuf_new_from_file(g_file_get_path(src), NULL);
        if (inputPixbuf == nullptr) {
            return;
        }
        int thumbnailWidth = 75;  // Adjust the width as per your requirements
        int thumbnailHeight = 75; // Adjust the height as per your requirements

        GdkPixbuf* oriented_pixbuf = gdk_pixbuf_apply_embedded_orientation(inputPixbuf);
        GdkPixbuf *thumbnailPixbuf = gdk_pixbuf_scale_simple(oriented_pixbuf,
                                                            thumbnailWidth,
                                                            thumbnailHeight,
                                                            GDK_INTERP_BILINEAR);

        if (thumbnailPixbuf == nullptr) {
            return;
        }

        GError* error = NULL;
        GdkPixbufFormat* fileType = gdk_pixbuf_get_file_info(g_file_get_path(src), NULL, NULL);
        if (fileType != NULL) {
            // const char *outputFile = dest; // Adjust the file extension as per your requirements
            gdk_pixbuf_save(thumbnailPixbuf,
                            g_file_get_path(dest),
                            gdk_pixbuf_format_get_name(fileType),
                            NULL,
                            NULL,
                            &error);

            // g_object_unref(thumbnailPixbuf);
        }

        g_object_unref(oriented_pixbuf);
        g_object_unref(thumbnailPixbuf);
        g_object_unref(inputPixbuf);
        g_object_unref(src);
        g_object_unref(dest);
    }

    NAN_METHOD(get_mounts) {

        v8::Local<v8::Array> resultArray = Nan::New<v8::Array>();

        GError *error = NULL;
        GList *mounts, *iter;
        GList *volumes;
        int c = 0;

        // Initialize GLib
        g_type_init();

        GVolumeMonitor* monitor = g_volume_monitor_get();

        // Get the list of mounts
        mounts = g_volume_monitor_get_mounts(monitor);
        volumes = g_volume_monitor_get_volumes(monitor);

        // Create a hashtable to store mount information
        GHashTable* mountHash = g_hash_table_new(g_str_hash, g_str_equal);

        // Iterate over the volumes
        for (iter = volumes; iter != NULL; iter = iter->next) {

            gchar *path = "";
            GVolume *volume = G_VOLUME(iter->data);
            const gchar *name = g_volume_get_name(volume);

            GMount* mount = g_volume_get_mount(volume);
            if (mount != NULL) {
                GFile *mount_path = g_mount_get_root(mount);
                if (mount_path != NULL) {
                    path = g_file_get_path(mount_path);
                    g_object_unref(mount_path);
                }
                g_object_unref(mount);
            }

            const char* root = "";
            GFile* activation_root = g_volume_get_activation_root(volume);
            if (activation_root != NULL) {
                root = g_file_get_uri(activation_root);
                g_object_unref(activation_root);
            }

            const char* uuid = g_volume_get_identifier(volume, G_VOLUME_IDENTIFIER_KIND_UUID);
            if (uuid == NULL) {
                uuid = g_strdup("");
            }

            v8::Local<v8::Object> deviceObj = Nan::New<v8::Object>();
            Nan::Set(deviceObj, Nan::New("name").ToLocalChecked(), Nan::New(name).ToLocalChecked());
            Nan::Set(deviceObj, Nan::New("path").ToLocalChecked(), Nan::New(path).ToLocalChecked());
            Nan::Set(deviceObj, Nan::New("uuid").ToLocalChecked(), Nan::New(uuid).ToLocalChecked());
            Nan::Set(deviceObj, Nan::New("root").ToLocalChecked(), Nan::New(root).ToLocalChecked());
            Nan::Set(resultArray, c, deviceObj);
            ++c;

            // Store volume name in hashtable
            g_hash_table_insert(mountHash, (gpointer)name, (gpointer)volume);

        }

        // Iterate over mounts
        for (iter = mounts; iter != NULL; iter = iter->next) {

            GMount* mount = G_MOUNT(iter->data);
            const char* name = "";
            const char* fs = "";
            const char* path = "";
            const char* uuid = "";
            const char* root = "";

            if (mount != NULL) {

                // GVolume* volume = g_mount_get_volume(mount);
                name = g_mount_get_name(mount);
                GVolume* volume = (GVolume*)g_hash_table_lookup(mountHash, name);
                GFile *mount_path = g_mount_get_root(mount);

                if (mount_path != NULL) {
                    path = g_file_get_uri(mount_path);
                }

                if (volume != NULL) {
                    GFile *activation_root = g_volume_get_activation_root(volume);
                    uuid = g_volume_get_identifier(volume, G_VOLUME_IDENTIFIER_KIND_UUID);

                    if (uuid == NULL) {
                        uuid = "";
                    }

                    if (activation_root != NULL) {
                        root = g_file_get_uri(activation_root);
                    }

                }

                // If uuid and root = "" then assume its a netowrk mount
                if (uuid == "" && root == "") {
                    v8::Local<v8::Object> deviceObj = Nan::New<v8::Object>();
                    Nan::Set(deviceObj, Nan::New("name").ToLocalChecked(), Nan::New(name).ToLocalChecked());
                    Nan::Set(deviceObj, Nan::New("path").ToLocalChecked(), Nan::New(path).ToLocalChecked());
                    Nan::Set(deviceObj, Nan::New("uuid").ToLocalChecked(), Nan::New(uuid).ToLocalChecked());
                    Nan::Set(deviceObj, Nan::New("root").ToLocalChecked(), Nan::New(root).ToLocalChecked());
                    Nan::Set(resultArray, c, deviceObj);

                    ++c;
                }

            }

        }

        // Free resources
        g_list_free_full(mounts, g_object_unref);
        g_list_free_full(volumes, g_object_unref);
        g_object_unref(monitor);

        info.GetReturnValue().Set(resultArray);

    }

    NAN_METHOD(umount) {

        if (info.Length() < 1) {
            Nan::ThrowTypeError("Invalid arguments. Expected a string for the target directory.");
            return;
        }

        v8::Local<v8::String> str_uuid = Nan::To<v8::String>(info[0]).ToLocalChecked();
        v8::Isolate* isolate = info.GetIsolate();

        v8::String::Utf8Value utf8_uuid(isolate, str_uuid);
        const char* uuid = *utf8_uuid;

        g_type_init();

        // Get the default GVolumeMonitor instance
        GVolumeMonitor* volume_monitor = g_volume_monitor_get();

        // Get the GMount instance for the specific drive you want to unmount
        GMount* mount = g_volume_monitor_get_mount_for_uuid(volume_monitor,
                                                            uuid);

        // Create a GMountOperation instance
        GMountOperation* mount_operation = g_mount_operation_new();

        // Unmount the drive
        GError* error = NULL;
        g_mount_unmount(mount,
                        G_MOUNT_UNMOUNT_NONE,
                        NULL,
                        NULL,
                        NULL);

        if (error != NULL) {
            g_print("Error unmounting: %s\n", error->message);
            g_error_free(error);
        }

        // Cleanup
        g_object_unref(mount_operation);
        g_object_unref(mount);
        g_object_unref(volume_monitor);

    }

    void directory_changed(GFileMonitor* monitor, GFile* file, GFile* other_file, GFileMonitorEvent event_type, gpointer user_data) {
        Nan::HandleScope scope;

        const char* eventName = nullptr;
        if (event_type == G_FILE_MONITOR_EVENT_CREATED) {
            eventName = "created";
        } else if (event_type == G_FILE_MONITOR_EVENT_DELETED) {
            eventName = "deleted";
        } else if (event_type == G_FILE_MONITOR_EVENT_RENAMED) {
            eventName = "renamed";
        } else {
            eventName = "unknown"; // Unknown event type, ignore
        }

        const char* filename = g_file_get_path(file);

        v8::Local<v8::Object> watcherObj = Nan::New<v8::Object>();
        Nan::Set(watcherObj, Nan::New("event").ToLocalChecked(), Nan::New(eventName).ToLocalChecked());
        Nan::Set(watcherObj, Nan::New("filename").ToLocalChecked(), Nan::New(filename).ToLocalChecked());


        Nan::Callback* callback = static_cast<Nan::Callback*>(user_data);
        Nan::TryCatch tryCatch;
        const unsigned argc = 1;
        v8::Local<v8::Value> argv[argc] = { watcherObj };
        callback->Call(argc, argv);
        if (tryCatch.HasCaught()) {
            Nan::FatalException(tryCatch);
        }

    }

    std::vector<std::string> watcher_dir;
    GFileMonitor* fileMonitor0 = NULL;
    NAN_METHOD(watcher) {

        Nan::HandleScope scope;

        if (info.Length() < 2 || !info[0]->IsString() || !info[1]->IsFunction()) {
            Nan::ThrowTypeError("Invalid arguments. Expected a directory path as a string and a watcher object.");
            return;
        }

        v8::Local<v8::String> sourceString = Nan::To<v8::String>(info[0]).ToLocalChecked();
        Nan::Utf8String utf8Str(sourceString);
        const char* cstring = *utf8Str;

        v8::Isolate* isolate = info.GetIsolate();
        v8::Local<v8::Context> context = isolate->GetCurrentContext();
        v8::String::Utf8Value sourceFile(context->GetIsolate(), sourceString);

        GFile* src = g_file_new_for_path(*sourceFile);
        const char *src_scheme = g_uri_parse_scheme(*sourceFile);

        if (src_scheme != NULL) {
            src = g_file_new_for_uri(*sourceFile);
        }

        Nan::Callback* callback = new Nan::Callback(info[1].As<v8::Function>());
        GFileMonitor* fileMonitor = g_file_monitor_directory(src,
                                                            G_FILE_MONITOR_NONE,
                                                            NULL,
                                                            NULL);

        if (fileMonitor0 != NULL) {
            g_file_monitor_cancel(fileMonitor0);
        }
        fileMonitor0 = fileMonitor;

        if (fileMonitor == NULL) {
            // Nan::ThrowError("Failed to create file monitor for the directory.");
            return;
        }

        gboolean connectResult = g_signal_connect(fileMonitor,
                                                "changed",
                                                G_CALLBACK(directory_changed),
                                                new Nan::Callback(info[1].As<v8::Function>()));

        if (connectResult == 0) {
            Nan::ThrowError("Failed to connect to the 'changed' signal.");
            g_object_unref(fileMonitor);
            return;
        }
        g_object_unref(src);
        info.GetReturnValue().SetUndefined();

    }

    // This handles mtp connections
    void on_mount_added(GVolumeMonitor* monitor, GMount* mount, gpointer user_data) {
        Nan::HandleScope scope;
        const gchar* mountName = g_mount_get_name(mount);
        v8::Local<v8::String> v8MountName = Nan::New<v8::String>(mountName).ToLocalChecked();
        Nan::Callback* callback = static_cast<Nan::Callback*>(user_data);
        Nan::TryCatch tryCatch;
        const unsigned argc = 1;
        v8::Local<v8::Value> argv[argc] = { v8MountName };
        callback->Call(argc, argv);
        if (tryCatch.HasCaught()) {
            Nan::FatalException(tryCatch); // Handle the exception if occurred
        }
    }

    void on_mount_removed(GVolumeMonitor* monitor, GMount* mount, gpointer user_data) {
        // Call your Nan module's function here
        Nan::HandleScope scope;
        Nan::Callback* callback = static_cast<Nan::Callback*>(user_data);
        const char* deviceName = g_mount_get_name(mount);
        v8::Local<v8::Value> argv[1] = { Nan::New(deviceName).ToLocalChecked() };
        callback->Call(1, argv);
    }

    void on_device_added(GVolumeMonitor* monitor, GDrive* drive, gpointer user_data) {
        Nan::HandleScope scope;
        const char* deviceName = g_drive_get_name(drive);
        v8::Local<v8::String> v8DeviceName = Nan::New(deviceName).ToLocalChecked();
        Nan::Callback* callback = static_cast<Nan::Callback*>(user_data);
        Nan::TryCatch tryCatch;
        const unsigned argc = 1;
        v8::Local<v8::Value> argv[argc] = { v8DeviceName };
        callback->Call(argc, argv);
        if (tryCatch.HasCaught()) {
            Nan::FatalException(tryCatch); // Handle the exception if occurred
        }
    }

    void on_device_removed(GVolumeMonitor* monitor, GDrive* drive, gpointer user_data) {
        // Call your Nan module's function here
        Nan::HandleScope scope;
        Nan::Callback* callback = static_cast<Nan::Callback*>(user_data);
        const char* deviceName = g_drive_get_name(drive);
        v8::Local<v8::Value> argv[1] = { Nan::New(deviceName).ToLocalChecked() };
        callback->Call(1, argv);
    }

    NAN_METHOD(monitor) {

        Nan::HandleScope scope;
        if (info.Length() < 1 || !info[0]->IsFunction()) {
            Nan::ThrowTypeError("Invalid arguments. Expected a function.");
            return;
        }

        Nan::Callback* callback = new Nan::Callback(info[0].As<v8::Function>());

        // Start monitoring for device changes
        GVolumeMonitor* volumeMonitor = g_volume_monitor_get();
        g_signal_connect(volumeMonitor,
                        "drive-connected",
                        G_CALLBACK(on_device_added),
                        callback);

        g_signal_connect(volumeMonitor,
                        "drive-disconnected",
                        G_CALLBACK(on_device_removed),
                        new Nan::Callback(info[0].As<v8::Function>()));

        g_signal_connect(volumeMonitor,
                        "mount-added",
                        G_CALLBACK(on_mount_added),
                        callback);

        g_signal_connect(volumeMonitor,
                        "mount-changed",
                        G_CALLBACK(on_mount_added),
                        callback);

        g_signal_connect(volumeMonitor,
                        "mount-removed",
                        G_CALLBACK(on_mount_removed),
                        new Nan::Callback(info[0].As<v8::Function>()));

        info.GetReturnValue().SetUndefined();
    }

    void on_theme_changed (GSettings *settings, gchar *key, gpointer user_data) {
        Nan::HandleScope scope;
        Nan::Callback* callback = static_cast<Nan::Callback*>(user_data);
        Nan::TryCatch tryCatch;
        const unsigned argc = 1;
        v8::Local<v8::Value> argv[argc] = { Nan::New("theme").ToLocalChecked() };
        callback->Call(argc, argv);
        if (tryCatch.HasCaught()) {
            Nan::FatalException(tryCatch); // Handle the exception if occurred
        }
    }

    NAN_METHOD(on_theme_change) {

        Nan::HandleScope scope;
        if (info.Length() < 1 || !info[0]->IsFunction()) {
            Nan::ThrowTypeError("Invalid arguments. Expected a function.");
            return;
        }

        Nan::Callback* callback = new Nan::Callback(info[0].As<v8::Function>());

        GSettings* settings = g_settings_new("org.gnome.desktop.interface");
        g_signal_connect(settings,
                        "changed",
                        G_CALLBACK(on_theme_changed),
                        callback);

        info.GetReturnValue().SetUndefined();
    }

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
        GFileInfo* file_info = g_file_query_info(src,
                                                "*",
                                                G_FILE_QUERY_INFO_NONE,
                                                NULL,
                                                &error);

        const char* mimetype = g_file_info_get_content_type(file_info);
        GList* appList = g_app_info_get_all_for_type(mimetype);

        v8::Local<v8::Array> result = Nan::New<v8::Array>();

        int i = 0;
        for (GList* iter = appList; iter != NULL; iter = iter->next) {

            GAppInfo* app = (GAppInfo*)iter->data;
            const char* app_name = g_app_info_get_name(app);
            const char* app_display_name = g_app_info_get_display_name(app);
            const char* app_exec = g_app_info_get_executable(app);
            const char* cmd = g_app_info_get_commandline(app);
            const char *app_id = g_app_info_get_id(app);

            v8::Local<v8::Object> file_obj = Nan::New<v8::Object>();
            Nan::Set(file_obj, Nan::New("name").ToLocalChecked(), Nan::New(app_name).ToLocalChecked());
            Nan::Set(file_obj, Nan::New("display").ToLocalChecked(), Nan::New(app_display_name).ToLocalChecked());
            Nan::Set(file_obj, Nan::New("exec").ToLocalChecked(), Nan::New(app_exec).ToLocalChecked());
            Nan::Set(file_obj, Nan::New("cmd").ToLocalChecked(), Nan::New(cmd).ToLocalChecked());
            Nan::Set(file_obj, Nan::New("mimetype").ToLocalChecked(), Nan::New(mimetype).ToLocalChecked());
            Nan::Set(file_obj, Nan::New("appid").ToLocalChecked(), Nan::New(app_id).ToLocalChecked());
            // Nan::Set(result, i, Nan::New(appName).ToLocalChecked());
            Nan::Set(result, i, file_obj);
            i++;
        }

        g_list_free(appList);
        g_object_unref(src);

        info.GetReturnValue().Set(result);
    }

    NAN_METHOD(du) {

        if (info.Length() < 1) {
            Nan::ThrowTypeError("Invalid arguments. Expected a string for the target directory.");
            return;
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

        GFileInfo* file_info = g_file_query_filesystem_info(src, "*", NULL, NULL);
        if (!file_info) {
            g_object_unref(file_info);
            g_object_unref(src);
            return;
        }

        gint64 totalSpace = g_file_info_get_attribute_uint64(file_info,
                                                            G_FILE_ATTRIBUTE_FILESYSTEM_SIZE);

        gint64 usedSpace = g_file_info_get_attribute_uint64(file_info,
                                                            G_FILE_ATTRIBUTE_FILESYSTEM_USED);

        gint64 freeSpace = g_file_info_get_attribute_uint64(file_info,
                                                            G_FILE_ATTRIBUTE_FILESYSTEM_FREE);

        g_object_unref(file_info);
        g_object_unref(src);

        v8::Local<v8::Object> result = Nan::New<v8::Object>();
        Nan::Set(result, Nan::New("total").ToLocalChecked(), Nan::New<v8::Number>(totalSpace));
        Nan::Set(result, Nan::New("used").ToLocalChecked(), Nan::New<v8::Number>(usedSpace));
        Nan::Set(result, Nan::New("free").ToLocalChecked(), Nan::New<v8::Number>(freeSpace));

        info.GetReturnValue().Set(result);

    }

    NAN_METHOD(get_file) {

        Nan::HandleScope scope;

        if (info.Length() < 1) {
            return Nan::ThrowError("Wrong number of arguments");
        }

        v8::Local<v8::String> sourceString = Nan::To<v8::String>(info[0]).ToLocalChecked();
        v8::Isolate* isolate = info.GetIsolate();

        Nan::Callback callback(info[1].As<v8::Function>());

        // Get the current context from the execution context
        v8::Local<v8::Context> context = isolate->GetCurrentContext();
        v8::String::Utf8Value sourceFile(context->GetIsolate(), sourceString);
        v8::Local<v8::Array> resultArray = Nan::New<v8::Array>();

        // if (!g_file_test(*sourceFile, G_FILE_TEST_IS_REGULAR) && !g_file_test(*sourceFile, G_FILE_TEST_IS_DIR)) {
        //     return Nan::ThrowError("Error: File does not exist.");
        // }

        GFile* src = g_file_new_for_path(*sourceFile);

        const char *src_scheme = g_uri_parse_scheme(*sourceFile);
        if (src_scheme != NULL) {
            src = g_file_new_for_uri(*sourceFile);
        }

        GError* error = NULL;
        GFileInfo* file_info = g_file_query_info(src,
                                                "*",
                                                G_FILE_QUERY_INFO_NONE,
                                                NULL,
                                                &error);

        if (!file_info) {
            return Nan::ThrowError("Error: Could not get file info.");
        }

        if (error != NULL) {
            g_object_unref(src);
            return Nan::ThrowError(error->message);
        }

        const char* filename = g_file_info_get_name(file_info);
        if (filename != nullptr) {

            const char* display_name = g_file_info_get_display_name(file_info);
            const char* href = g_file_get_path(src);
            gboolean is_hidden = g_file_info_get_is_hidden(file_info);
            gboolean is_directory = g_file_info_get_file_type(file_info) == G_FILE_TYPE_DIRECTORY;
            const char* mimetype = g_file_info_get_content_type(file_info);
            GFile* parent = g_file_get_parent(src);
            gboolean is_writeable = g_file_info_get_attribute_boolean(file_info, G_FILE_ATTRIBUTE_ACCESS_CAN_WRITE);
            gboolean is_readable = g_file_info_get_attribute_boolean(file_info, G_FILE_ATTRIBUTE_ACCESS_CAN_READ);

            v8::Local<v8::Object> fileObj = Nan::New<v8::Object>();
            Nan::Set(fileObj, Nan::New("name").ToLocalChecked(), Nan::New(filename).ToLocalChecked());
            Nan::Set(fileObj, Nan::New("display_name").ToLocalChecked(), Nan::New(display_name).ToLocalChecked());
            Nan::Set(fileObj, Nan::New("href").ToLocalChecked(), Nan::New(href).ToLocalChecked());
            Nan::Set(fileObj, Nan::New("is_dir").ToLocalChecked(), Nan::New<v8::Boolean>(is_directory));
            Nan::Set(fileObj, Nan::New("is_hidden").ToLocalChecked(), Nan::New<v8::Boolean>(is_hidden));
            Nan::Set(fileObj, Nan::New("is_writable").ToLocalChecked(), Nan::New<v8::Boolean>(is_writeable));
            Nan::Set(fileObj, Nan::New("is_readable").ToLocalChecked(), Nan::New<v8::Boolean>(is_readable));

            if (parent != nullptr) {
                const char* location = g_file_get_path(parent);
                if (location != nullptr) {
                    Nan::Set(fileObj, Nan::New("location").ToLocalChecked(), Nan::New(location).ToLocalChecked());
                }
            }

            const char* owner = g_file_info_get_attribute_as_string(file_info, G_FILE_ATTRIBUTE_OWNER_USER);
            if (!owner) {
                owner = "Unknown";
            }
            Nan::Set(fileObj, Nan::New("owner").ToLocalChecked(), Nan::New(owner).ToLocalChecked());

            const char* group = g_file_info_get_attribute_as_string(file_info, G_FILE_ATTRIBUTE_OWNER_GROUP);
            if (!group) {
                group = "Unknown";
            }
            Nan::Set(fileObj, Nan::New("group").ToLocalChecked(), Nan::New(group).ToLocalChecked());

            gint32 permissions;
            permissions = g_file_info_get_attribute_uint32 (file_info, G_FILE_ATTRIBUTE_UNIX_MODE);
            // permissions & (S_IRWXU | S_IRWXG | S_IRWXO);
            Nan::Set(fileObj, Nan::New("permissions").ToLocalChecked(), Nan::New<v8::Int32>(permissions));

            // Check if execution bit is set
            gboolean is_execute = g_file_info_get_attribute_boolean(file_info,
                                                                     G_FILE_ATTRIBUTE_ACCESS_CAN_EXECUTE);

            Nan::Set(fileObj, Nan::New("is_execute").ToLocalChecked(), Nan::New<v8::Boolean>(is_execute));

            // // Nan::Set(fileObj, Nan::New("is_writable").ToLocalChecked(), Nan::New<v8::Boolean>(is_writable));
            // // Nan::Set(fileObj, Nan::New("content_type").ToLocalChecked(), Nan::New(mimetype).ToLocalChecked());
            if (mimetype != nullptr) {
               Nan::Set(fileObj, Nan::New("content_type").ToLocalChecked(), Nan::New(mimetype).ToLocalChecked());
            } else {
                Nan::Set(fileObj, Nan::New("content_type").ToLocalChecked(), Nan::Null());
            }

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

            g_object_unref(file_info);
            g_object_unref(src);
            info.GetReturnValue().Set(fileObj);

        }

        // g_object_unref(src);

        // v8::Local<v8::Value> argv[] = { Nan::Null(), resultArray };
        // callback.Call(2, argv);

    }

    NAN_METHOD(ls) {

        Nan::HandleScope scope;

        if (info.Length() < 2 || !info[1]->IsFunction()) {
            return Nan::ThrowError("Wrong arguments. Expected callback function.");
        }

        Nan::Callback callback(info[1].As<v8::Function>());

        v8::Local<v8::String> sourceString = Nan::To<v8::String>(info[0]).ToLocalChecked();
        v8::Isolate* isolate = info.GetIsolate();

        // Get the current context from the execution context
        v8::Local<v8::Context> context = isolate->GetCurrentContext();
        v8::String::Utf8Value sourceFile(context->GetIsolate(), sourceString);
        v8::Local<v8::Array> resultArray = Nan::New<v8::Array>();

        // if (!g_file_test(*sourceFile, G_FILE_TEST_IS_DIR)) {
        //     return Nan::ThrowError("Error: Directory does not exist.");
        // }

        GFile* src = g_file_new_for_path(*sourceFile);

        const char *src_scheme = g_uri_parse_scheme(*sourceFile);
        if (src_scheme != NULL) {
            src = g_file_new_for_uri(*sourceFile);
        }

        GError* error = NULL;
        guint index = 0;
        GFileEnumerator* enumerator = g_file_enumerate_children(src,
                                                                "*",
                                                                G_FILE_QUERY_INFO_NONE,
                                                                NULL,
                                                                &error);

        if (enumerator == NULL) {
            // Error handling
            if (error != NULL) {
                return Nan::ThrowError(error->message);
            } else {
                return Nan::ThrowError("Unknown error occurred");
            }

            // Clean up resources
            g_object_unref(src);
            return; // Return an error code
        }

        if (error != NULL) {
            g_error_free(error);
            g_object_unref(src);
            return Nan::ThrowError(error->message);
        }

        GFileInfo* file_info = NULL;
        while ((file_info = g_file_enumerator_next_file(enumerator, NULL, &error)) != NULL) {

            const char* filename = g_file_info_get_name(file_info);
            const char* display_name = g_file_info_get_display_name(file_info);
            GFile* file = g_file_get_child(src, filename);
            const char* href = g_file_get_path(file);
            GFile* parent = g_file_get_parent(file);
            const char* location = g_file_get_path(parent);
            gboolean is_hidden = g_file_info_get_is_hidden(file_info);
            gboolean is_directory = g_file_info_get_file_type(file_info) == G_FILE_TYPE_DIRECTORY;
            const char* mimetype = g_file_info_get_content_type(file_info);
            gboolean is_symlink = g_file_info_get_is_symlink(file_info);
            gboolean  is_writeable = g_file_info_get_attribute_boolean(file_info, G_FILE_ATTRIBUTE_ACCESS_CAN_WRITE);
            gboolean is_readable = g_file_info_get_attribute_boolean(file_info, G_FILE_ATTRIBUTE_ACCESS_CAN_READ);

            v8::Local<v8::Object> fileObj = Nan::New<v8::Object>();
            Nan::Set(fileObj, Nan::New("name").ToLocalChecked(), Nan::New(filename).ToLocalChecked());
            Nan::Set(fileObj, Nan::New("display_name").ToLocalChecked(), Nan::New(display_name).ToLocalChecked());
            Nan::Set(fileObj, Nan::New("href").ToLocalChecked(), Nan::New(href).ToLocalChecked());
            Nan::Set(fileObj, Nan::New("location").ToLocalChecked(), Nan::New(location).ToLocalChecked());
            Nan::Set(fileObj, Nan::New("is_dir").ToLocalChecked(), Nan::New<v8::Boolean>(is_directory));
            Nan::Set(fileObj, Nan::New("is_hidden").ToLocalChecked(), Nan::New<v8::Boolean>(is_hidden));
            Nan::Set(fileObj, Nan::New("is_readable").ToLocalChecked(), Nan::New<v8::Boolean>(is_readable));
            Nan::Set(fileObj, Nan::New("is_writable").ToLocalChecked(), Nan::New<v8::Boolean>(is_writeable));
            Nan::Set(fileObj, Nan::New("is_symlink").ToLocalChecked(), Nan::New<v8::Boolean>(is_symlink));

            if (mimetype != nullptr) {
                Nan::Set(fileObj, Nan::New("content_type").ToLocalChecked(), Nan::New(mimetype).ToLocalChecked());
            }

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

            Nan::Set(resultArray, index++, fileObj);

            g_object_unref(file);
            g_object_unref(parent);
            g_object_unref(file_info);

        }

        if (error != NULL) {
            g_error_free(error);
            return Nan::ThrowError(error->message);
        }

        g_object_unref(enumerator);
        g_object_unref(src);

        v8::Local<v8::Value> argv[] = { Nan::Null(), resultArray };
        callback.Call(2, argv);

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


        GFile* src = g_file_new_for_path(*sourceFile);

        const char *src_scheme = g_uri_parse_scheme(*sourceFile);
        if (src_scheme != NULL) {
            src = g_file_new_for_uri(*sourceFile);
        }

        gboolean exists = FALSE;
        exists = g_file_query_exists (src, NULL);

        bool result = exists != FALSE;
        g_object_unref(src);

        // Create a new Boolean value in the current context
        v8::Local<v8::Boolean> resultValue = v8::Boolean::New(isolate, result);

        // Return the Boolean value
        info.GetReturnValue().Set(resultValue);

    }

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
        GFileEnumerator* enumerator = g_file_enumerate_children(src,
                                                                G_FILE_ATTRIBUTE_STANDARD_NAME,
                                                                G_FILE_QUERY_INFO_NONE,
                                                                NULL,
                                                                &error);

        if (error) {
            g_error_free(error);
            g_object_unref(src);
            return;
        }

        guint item_count = 0;
        GFileInfo* file_info;
        while (file_info = g_file_enumerator_next_file(enumerator, NULL, &error)) {

            if (error) {
                g_error_free(error);
                break;
            }

            if (file_info == NULL) {
                break;
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

        GFileInfo* file_info = g_file_query_info(src,
                                                G_FILE_ATTRIBUTE_STANDARD_ICON,
                                                G_FILE_QUERY_INFO_NONE,
                                                NULL,
                                                NULL);


        // if (file_info) {
        //     const gchar *icon_name = g_file_info_get_attribute_string(file_info, G_FILE_ATTRIBUTE_STANDARD_ICON);
        //     g_object_unref(file_info);

        //     // Print the filename of the icon
        //     printf("%s\n", icon_name);

        // }
        GIcon *icon = g_file_info_get_icon(file_info);
        gchar *icon_name = g_icon_to_string(icon);

        // // Print the filename of the icon
        printf("%s", icon_name);

        // // Cleanup
        // g_object_unref(icon);
        g_object_unref(src);

    }

    NAN_METHOD(is_dir) {

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

        gboolean is_directory = g_file_query_file_type(src, G_FILE_QUERY_INFO_NONE, NULL) == G_FILE_TYPE_DIRECTORY;

        bool result = is_directory != FALSE;

        // Create a new Boolean value in the current context
        v8::Local<v8::Boolean> resultValue = v8::Boolean::New(isolate, result);

        // Return the Boolean value
        info.GetReturnValue().Set(resultValue);

    }

    NAN_METHOD(cp) {

        Nan:: HandleScope scope;

        if (info.Length() < 2) {
            return Nan::ThrowError("Wrong number of arguments");
        }

        v8::Local<v8::String> sourceString = Nan::To<v8::String>(info[0]).ToLocalChecked();
        v8::Local<v8::String> destString = Nan::To<v8::String>(info[1]).ToLocalChecked();

        int overwrite_flag = Nan::To<int>(info[2]).FromJust();
        GFileCopyFlags flags = static_cast<GFileCopyFlags>(G_FILE_COPY_NOFOLLOW_SYMLINKS);
        if (overwrite_flag == 1) {
            flags = static_cast<GFileCopyFlags>(G_FILE_COPY_NOFOLLOW_SYMLINKS | G_FILE_COPY_OVERWRITE);
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

        gboolean is_directory = g_file_query_file_type(src, G_FILE_QUERY_INFO_NONE, NULL) == G_FILE_TYPE_DIRECTORY;
        if (is_directory) {

            GFileInfo* file_info = g_file_query_info(src,
                                                    "*",
                                                    G_FILE_QUERY_INFO_NONE,
                                                    NULL,
                                                    NULL);

            GFileType type = g_file_info_get_file_type(file_info);
            gboolean is_symlink = g_file_info_get_is_symlink(file_info);
            GError *error = NULL;
            // Create the destination directory if it doesn't exist
            g_file_make_directory_with_parents(dest, NULL, &error);

            if (error) {
                g_print("Error creating destination directory: %s\n", error->message);
                g_error_free(error);
            }


        } else {

            // Check if source is a symlink
            GFileInfo* file_info = g_file_query_info(src, "*", G_FILE_QUERY_INFO_NONE, NULL, NULL);
            GFileType type = g_file_info_get_file_type(file_info);

            if (type == G_FILE_TYPE_SYMBOLIC_LINK) {
                const char *symlink_target = g_file_info_get_symlink_target(file_info);
                if (symlink_target) {

                    GFile *destination_symlink = g_file_new_for_path(g_file_get_path(dest));
                    gboolean success = g_file_make_symbolic_link(destination_symlink,
                                                                symlink_target,
                                                                NULL,
                                                                NULL);

                    g_object_unref(destination_symlink);
                    g_object_unref(file_info);
                }
            } else {

                GError* error = nullptr;
                gboolean ret = g_file_copy(src,
                                        dest,
                                        flags,
                                        nullptr,
                                        nullptr,
                                        nullptr,
                                        &error);

                g_object_unref(src);
                g_object_unref(dest);

                if (ret == FALSE) {
                    return Nan::ThrowError(error->message);
                }

            }

        }


        info.GetReturnValue().Set(Nan::True());

    }

    void cpdir_recursive(GFile *source, GFile *destination) {
        GError *error = NULL;
        gboolean is_directory = g_file_query_file_type(source, G_FILE_QUERY_INFO_NONE, NULL) == G_FILE_TYPE_DIRECTORY;

        if (is_directory) {
            // Create the destination directory if it doesn't exist
            g_file_make_directory_with_parents(destination, NULL, &error);

            if (error) {
                g_print("Error creating destination directory: %s\n", error->message);
                g_error_free(error);
                // return;
            }

            GFileEnumerator *enumerator = g_file_enumerate_children(source, G_FILE_ATTRIBUTE_STANDARD_NAME, G_FILE_QUERY_INFO_NONE, NULL, &error);

            if (error) {
                g_print("Error enumerating source directory contents: %s\n", error->message);
                g_error_free(error);
                // return;
            }

            GFileInfo *info = NULL;

            while ((info = g_file_enumerator_next_file(enumerator, NULL, &error))) {
                const char *name = g_file_info_get_name(info);
                GFile *source_child = g_file_get_child(source, name);
                GFile *destination_child = g_file_get_child(destination, name);

                cpdir_recursive(source_child, destination_child);

                g_object_unref(source_child);
                g_object_unref(destination_child);
                g_object_unref(info);
            }

            g_file_enumerator_close(enumerator, NULL, NULL);
            g_object_unref(enumerator);
        } else {
            // Copy individual file
            gboolean success = g_file_copy(source, destination, G_FILE_COPY_ALL_METADATA, NULL, NULL, NULL, &error);

            if (!success) {
                g_print("Error copying file: %s\n", error->message);
                g_error_free(error);
            }
        }
    }

    NAN_METHOD(cpdir) {

        Nan:: HandleScope scope;

        if (info.Length() < 2) {
            return Nan::ThrowError("Wrong number of arguments");
        }

        v8::Local<v8::String> sourceString = Nan::To<v8::String>(info[0]).ToLocalChecked();
        v8::Local<v8::String> destString = Nan::To<v8::String>(info[1]).ToLocalChecked();

        int overwrite_flag = Nan::To<int>(info[2]).FromJust();
        GFileCopyFlags flags = static_cast<GFileCopyFlags>(G_FILE_COPY_NOFOLLOW_SYMLINKS);
        if (overwrite_flag == 1) {
            flags = static_cast<GFileCopyFlags>(G_FILE_COPY_NOFOLLOW_SYMLINKS | G_FILE_COPY_OVERWRITE);
        }

        v8::Isolate* isolate = info.GetIsolate();
        v8::String::Utf8Value sourceFile(isolate, sourceString);
        v8::String::Utf8Value destFile(isolate, destString);

        GFile* source = g_file_new_for_path(*sourceFile);
        GFile* destination = g_file_new_for_path(*destFile);

        const char *src_scheme = g_uri_parse_scheme(*sourceFile);
        const char *dest_scheme = g_uri_parse_scheme(*destFile);
        if (src_scheme != NULL) {
            source = g_file_new_for_uri(*sourceFile);
        }
        if (dest_scheme != NULL) {
            destination = g_file_new_for_uri(*destFile);
        }

        cpdir_recursive(source, destination);

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
        GFileInfo* fileInfo = g_file_query_info(src,
                                                G_FILE_ATTRIBUTE_ACCESS_CAN_WRITE,
                                                G_FILE_QUERY_INFO_NONE,
                                                NULL,
                                                NULL);

        // Check if the directory is writable
        gboolean isWritable = g_file_info_get_attribute_boolean(fileInfo,
                                                                G_FILE_ATTRIBUTE_ACCESS_CAN_WRITE);

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
        gboolean res;

        res = g_file_make_directory_with_parents(src, NULL, &error);
        g_object_unref(src);

        if (res == FALSE) {
            return Nan::ThrowError(error->message);
        }

    }

    NAN_METHOD(mv) {

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

    void connect_network_drive_callback(GObject *source_object, GAsyncResult *res, gpointer user_data) {

        Nan::HandleScope scope;

        GError *error = nullptr;
        GFile *location = G_FILE(source_object);
        gboolean mounted = g_file_mount_enclosing_volume_finish(location, res, &error);
        Nan::Callback* callback = static_cast<Nan::Callback*>(user_data);

        if (error) {

            v8::Local<v8::Object> errorObj = Nan::New<v8::Object>();
            Nan::Set(errorObj, Nan::New("message").ToLocalChecked(), Nan::New(error->message).ToLocalChecked());

            const unsigned argc = 1;
            v8::Local<v8::Value> argv[argc] = { errorObj };
            callback->Call(argc, argv);

            g_error_free(error);

        } else {

            const unsigned argc = 0;
            v8::Local<v8::Value> argv[argc] = { };
            callback->Call(argc, argv);

        }

    }

    NAN_METHOD(connect_network_drive) {

        Nan::HandleScope scope;

        if (info.Length() < 3) {
            return Nan::ThrowError("Wrong number of arguments");
        }

        v8::Local<v8::String> v8_hostname = Nan::To<v8::String>(info[0]).ToLocalChecked();
        v8::Local<v8::String> v8_username = Nan::To<v8::String>(info[1]).ToLocalChecked();
        v8::Local<v8::String> v8_password = Nan::To<v8::String>(info[2]).ToLocalChecked();
        v8::Local<v8::Int32> v8_ssh_key = Nan::To<v8::Int32>(info[3]).ToLocalChecked();

        v8::Isolate* isolate = info.GetIsolate();
        v8::String::Utf8Value utf8_hostname(isolate, v8_hostname);
        v8::String::Utf8Value utf8_username(isolate, v8_username);
        v8::String::Utf8Value utf8_password(isolate, v8_password);

        const char *hostname = *utf8_hostname;
        const char *username = *utf8_username;
        const char *password = *utf8_password;
        int ssh_key = Nan::To<int>(v8_ssh_key).FromJust();

        GError *error = NULL;
        GFile *location = NULL;
        GAsyncResult *result = NULL;
        GAsyncReadyCallback callback = NULL;

        // Set up SSH key authentication
        GMountOperation *mount_operation = g_mount_operation_new();

        int is_sftp = strncmp(hostname, "sftp://", 7);

        // Prioritize SSH key if provided
        if (is_sftp == 0 && ssh_key) {

            printf("Using SSH key\n");

            location = g_file_new_for_uri(hostname);
            g_file_mount_enclosing_volume(location,
                                        G_MOUNT_MOUNT_NONE,
                                        mount_operation,
                                        NULL,
                                        GAsyncReadyCallback(connect_network_drive_callback),
                                        new Nan::Callback(info[info.Length() - 1].As<v8::Function>()));

        } else if (is_sftp == 0 && !ssh_key) {

            printf("Using username and password\n");

            location = g_file_new_for_uri(hostname);
            g_mount_operation_set_username(mount_operation, username);
            g_mount_operation_set_password(mount_operation, password);

            g_file_mount_enclosing_volume(location,
                                        G_MOUNT_MOUNT_NONE,
                                        mount_operation,
                                        NULL,
                                        GAsyncReadyCallback(connect_network_drive_callback),
                                        new Nan::Callback(info[info.Length() - 1].As<v8::Function>()));


        } else {

            // Use username and password authentication
            char *uri = g_strdup_printf("smb://%s:%s@%s/", username, password, hostname);
            location = g_file_new_for_uri(uri);
            g_free(uri);

        }

        // g_object_unref(location);
        g_object_unref(mount_operation);

        info.GetReturnValue().SetUndefined();

    }

    // Function to execute shell command and return result as a v8::Array
    NAN_METHOD(exec) {

        if (info.Length() < 2 || !info[0]->IsString() || !info[1]->IsFunction()) {
            return Nan::ThrowTypeError("Invalid arguments");
        }

        v8::Local<v8::Context> context = info.GetIsolate()->GetCurrentContext();
        Nan::Utf8String command(info[0]->ToString(context).ToLocalChecked());

        Nan::Callback* callback = new Nan::Callback(info[1].As<v8::Function>());

        std::array<char, 128> buffer;
        std::string result;
        std::shared_ptr<FILE> pipe(popen(*command, "r"), pclose);
        if (!pipe) {
            return Nan::ThrowError("popen() failed!");
        }
        while (!feof(pipe.get())) {
            if (fgets(buffer.data(), buffer.size(), pipe.get()) != nullptr) {
                result += buffer.data();
            }
        }

        v8::Local<v8::Array> resultArray = Nan::New<v8::Array>();
        size_t index = 0;
        size_t pos = 0;
        while (true) {
            size_t found = result.find("\n", pos);
            if (found == std::string::npos) {
                break;
            }
            resultArray->Set(context, index++, Nan::New<v8::String>(result.substr(pos, found - pos).c_str()).ToLocalChecked());
            pos = found + 1;
        }

        v8::Local<v8::Value> argv[] = { Nan::Null(), resultArray };
        callback->Call(2, argv);

    }

    // NAN_METHOD(extract) {
    //     if (info.Length() < 2) {
    //         return Nan::ThrowError("Wrong number of arguments");
    //     }
    //     v8::Local<v8::String> sourceString = Nan::To<v8::String>(info[0]).ToLocalChecked();
    //     v8::Local<v8::String> destString = Nan::To<v8::String>(info[1]).ToLocalChecked();
    //     v8::Isolate* isolate = info.GetIsolate();
    //     v8::String::Utf8Value sourceFile(isolate, sourceString);
    //     v8::String::Utf8Value destFile(isolate, destString);
    //     GFile* src = g_file_new_for_path(*sourceFile);
    //     GFile* dest = g_file_new_for_path(*destFile);
    //     const char *src_scheme = g_uri_parse_scheme(*sourceFile);
    //     const char *dest_scheme = g_uri_parse_scheme(*destFile);
    //     if (src_scheme != NULL) {
    //         src = g_file_new_for_uri(*sourceFile);
    //     }
    //     if (dest_scheme != NULL) {
    //         dest = g_file_new_for_uri(*destFile);
    //     }
    //     // GFile *inputFile, *outputFile;
    //     GInputStream *inputStream;
    //     GOutputStream *outputStream;
    //     // Initialize GIO
    //     g_type_init();
    //     // Open input file for reading
    //     inputStream = G_INPUT_STREAM(g_file_read(src, NULL, NULL));
    //     if (inputStream == NULL) {
    //         g_object_unref(src);
    //         g_object_unref(dest);
    //         g_error("Error opening input file");
    //     }
    //     // Open output file for writing
    //     outputStream = G_OUTPUT_STREAM(g_file_replace(dest, NULL, FALSE, G_FILE_CREATE_NONE, NULL, NULL));
    //     if (outputStream == NULL) {
    //         g_object_unref(src);
    //         g_object_unref(dest);
    //         g_object_unref(inputStream);
    //         g_error("Error opening output file");
    //     }
    //     // Create a decompression stream
    //     GZlibDecompressor *decompressor = g_zlib_decompressor_new(G_ZLIB_COMPRESSOR_FORMAT_GZIP);
    //     GFilterInputStream *filterInputStream = g_zlib_decompressor_new(g_object_ref(decompressor));
    //     // Set the input stream for the decompressor
    //     g_filter_input_stream_set_base_stream(filterInputStream, inputStream);
    //     // Set the output stream for the decompressor
    //     g_filter_output_stream_set_base_stream(G_FILTER_OUTPUT_STREAM(decompressor), outputStream);
    //     // Copy the decompressed data from input to output
    //     g_output_stream_splice(G_OUTPUT_STREAM(decompressor),
    //         G_INPUT_STREAM(filterInputStream),
    //         G_OUTPUT_STREAM_SPLICE_CLOSE_SOURCE,
    //         NULL,
    //         NULL);
    //         // | G_OUTPUT_STREAM_SPLICE_CLOSE_TARGET
    //     // Clean up resources
    //     g_object_unref(decompressor);
    //     g_object_unref(filterInputStream);
    //     g_object_unref(inputStream);
    //     g_object_unref(outputStream);
    //     g_object_unref(src);
    //     g_object_unref(dest);
    //     info.GetReturnValue().Set(Nan::True());
    // }

    NAN_MODULE_INIT(init) {
        Nan::Export(target, "on_theme_change", on_theme_change);
        Nan::Export(target, "is_dir", is_dir);
        Nan::Export(target, "get_icon", icon);
        Nan::Export(target, "set_execute", set_execute);
        Nan::Export(target, "clear_execute", clear_execute);
        Nan::Export(target, "cpdir", cpdir);
        Nan::Export(target, "thumbnail", thumbnail);
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
        Nan::Export(target, "monitor", monitor);
        Nan::Export(target, "watcher", watcher);
        Nan::Export(target, "get_mounts", get_mounts);
        Nan::Export(target, "connect_network_drive", connect_network_drive);
        Nan::Export(target, "exec", exec);
    }

    NAN_MODULE_WORKER_ENABLED(gio, init)
    NODE_MODULE(gio, init)

}

