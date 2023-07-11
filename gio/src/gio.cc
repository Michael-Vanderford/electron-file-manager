/*
    2023-04-29
    michael.vanderford@gmail.com

    This is a node module for using libgio File System utilities for NodeJS / Electron


*/

#include <stdlib.h>
#include <nan.h>
#include <node.h>
#include <node_api.h>
#include <gio/gio.h>
#include <gdk-pixbuf/gdk-pixbuf.h>
#include <glib.h>
#include <iostream>
#include <vector>
#include <string>

using namespace std;

namespace gio {

    using v8::FunctionCallbackInfo;
    using v8::Isolate;
    using v8::Local;
    using v8::Object;
    using v8::String;
    using v8::Value;

    // void copy_file_to_clipboard(const char* file_path) {
    //     GFile* file = g_file_new_for_path(file_path);
    //     // Copy the file to the clipboard
    //     gboolean success = g_file_copy(file, "clipboard://");
    //     if (success) {
    //         // Get the default clipboard
    //         GtkClipboard* clipboard = gtk_clipboard_get_default(gdk_display_get_default());
    //         // Set the clipboard contents with the copied file
    //         gtk_clipboard_set_with_data(clipboard, NULL, NULL, NULL);
    //     }
    //     // Cleanup
    //     g_object_unref(file);
    // }
    // NAN_METHOD(findFilesAsync) {
    //     if (info.Length() < 3 || !info[0]->IsString() || !info[1]->IsString() || !info[2]->IsFunction()) {
    //         return Nan::ThrowTypeError("Invalid arguments. Expected: findFilesAsync(directory, pattern, callback)");
    //     }
    //     v8::Local<v8::String> directoryArg = info[0].As<v8::String>();
    //     v8::Local<v8::String> patternArg = info[1].As<v8::String>();
    //     v8::Local<v8::Function> callback = info[2].As<v8::Function>();
    //     Nan::Utf8String directory(directoryArg);
    //     Nan::Utf8String pattern(patternArg);
    //     GFile* folder = g_file_new_for_path(*directory);
    //     // GFileEnumerator* enumerator = g_file_enumerate_children(folder, G_FILE_ATTRIBUTE_STANDARD_NAME "," G_FILE_ATTRIBUTE_STANDARD_IS_REGULAR, G_FILE_QUERY_INFO_NONE, NULL, NULL);
    //     GFileEnumerator* enumerator = g_file_enumerate_children(folder, "standard::*", G_FILE_QUERY_INFO_NONE, NULL, NULL);
    //     GFileInfo* file_info;
    //     while ((file_info = g_file_enumerator_next_file(enumerator, NULL, NULL)) != NULL) {
    //         const char* filename = g_file_info_get_name(file_info);
    //         // gboolean is_regular = g_file_info_get_is_regular(file_info);
    //         // if (g_pattern_match_simple(*pattern, filename) && is_regular) {
    //         if (g_pattern_match_simple(*pattern, filename)) {
    //             gchar* file_path = g_file_get_path(g_file_enumerator_get_child(enumerator, filename));
    //             v8::Local<v8::Value> argv[1] = { Nan::New(file_path).ToLocalChecked() };
    //             Nan::Call(callback, Nan::GetCurrentContext()->Global(), 1, argv);
    //             g_free(file_path);
    //         }
    //         g_object_unref(file_info);
    //     }
    //     g_file_enumerator_close(enumerator, NULL, NULL);
    //     g_object_unref(enumerator);
    //     g_object_unref(folder);
    // }

    // NAN_METHOD(search) {
    //     Nan::HandleScope scope;
    //     if (info.Length() < 3 || !info[2]->IsFunction()) {
    //         return Nan::ThrowError("Wrong arguments. Expected callback function.");
    //     }
    //     Nan::Callback callback(info[2].As<v8::Function>());
    //     v8::Local<v8::String> searchString = Nan::To<v8::String>(info[0]).ToLocalChecked();
    //     v8::Local<v8::String> searchPath = Nan::To<v8::String>(info[1]).ToLocalChecked();
    //     Nan::Utf8String searchStringUtf8(searchString);
    //     const gchar* searchStringC = g_strdup(*searchStringUtf8);
    //      Nan::Utf8String searchPathUtf8(searchPath);
    //     const gchar* searchPathC = g_strdup(*searchPathUtf8);
    //     GMainLoop *loop = g_main_loop_new(NULL, FALSE);
    //     // Perform the search asynchronously
    //     GError *error = NULL;
    //     // TrackerSparqlConnection *connection = tracker_sparql_connection_new(TRACKER_SPARQL_CONNECTION_FLAGS_NONE, NULL, NULL, NULL, &error);
    //     TrackerSparqlConnection *connection = tracker_sparql_connection_bus_new ("org.freedesktop.Tracker3.Miner.Files", NULL, NULL, &error);
    //     if (error != NULL) {
    //         g_error("Error connecting to Tracker: %s", error->message);
    //         g_error_free(error);
    //         return;
    //     }
    //     gchar *query_string = g_strdup_printf("SELECT ?path WHERE { ?path a nfo:FileDataObject . FILTER(regex(?path, '%s', 'i') && regex(?path, '^%s.*', 'i')) }", *searchStringC, *searchPathC);
    //     TrackerSparqlCursor *cursor = tracker_sparql_connection_query(connection, query_string, NULL, &error);
    //     // g_free(query_string);
    //     if (error != NULL) {
    //         // g_error("Error executing query: %s", error->message);
    //         g_error("Error executing query: %s", query_string);
    //         g_error_free(error);
    //         g_free(query_string);
    //         return;
    //     }
    //     g_free(query_string);
    //     // Create a result array to store the search results
    //     v8::Local<v8::Array> resultArray = Nan::New<v8::Array>();
    //     guint index = 0;
    //     // Start iterating over the search results
    //     while (tracker_sparql_cursor_next(cursor, NULL, &error)) {
    //         const gchar *path = tracker_sparql_cursor_get_string(cursor, 0, NULL);
    //         v8::Local<v8::String> result = Nan::New<v8::String>(path).ToLocalChecked();
    //         Nan::Set(resultArray, index++, result);
    //     }
    //     // Clean up resources
    //     g_object_unref(cursor);
    //     g_object_unref(connection);
    //     // Call the callback function with the search results
    //     const int argc = 1;
    //     v8::Local<v8::Value> argv[argc] = { resultArray };
    //     Nan::Call(callback, Nan::GetCurrentContext()->Global(), argc, argv);
    //     // Clean up the GMainLoop
    //     g_main_loop_quit(loop);
    //     g_main_loop_unref(loop);
    // }


    // NAN_METHOD(get_thumbnail) {

    //     Nan::HandleScope scope;
    //     if (info.Length() < 1) {
    //         return Nan::ThrowError("Wrong number of arguments");
    //     }
    //     v8::Local<v8::String> sourceString = Nan::To<v8::String>(info[0]).ToLocalChecked();
    //     v8::Isolate* isolate = info.GetIsolate();
    //     // Get the current context from the execution context
    //     v8::Local<v8::Context> context = isolate->GetCurrentContext();
    //     v8::String::Utf8Value sourceFile(context->GetIsolate(), sourceString);
    //     v8::Local<v8::Array> resultArray = Nan::New<v8::Array>();
    //     GFile* src = g_file_new_for_path(*sourceFile);
    //     const char *src_scheme = g_uri_parse_scheme(*sourceFile);
    //     if (src_scheme != NULL) {
    //         src = g_file_new_for_uri(*sourceFile);
    //     }
    //     v8::Local<v8::Array> result = Nan::New<v8::Array>();
    //     GFileInfo* file_info = g_file_query_info(src, G_FILE_ATTRIBUTE_STANDARD_DISPLAY_NAME "," G_FILE_ATTRIBUTE_THUMBNAIL_PATH, G_FILE_QUERY_INFO_NONE, NULL, NULL);
    //     gint thumbnail_size = 100;
    //     GFileInfo* file_info = g_file_query_info(src, "*", G_FILE_QUERY_INFO_NONE, NULL, NULL);
    //     const gchar* display_name = g_file_info_get_display_name(file_info);
    //     gchar* thumbnail_path = g_file_info_get_attribute_string(file_info, G_FILE_ATTRIBUTE_THUMBNAIL_PATH);
    //     GdkPixbuf* thumbnail = NULL;
    //     if (thumbnail_path != NULL) {
    //         GFile* thumbnail_file = g_file_new_for_uri(thumbnail_path);
    //         gchar* thumbnail_uri = g_file_get_uri(thumbnail_file);
    //         GError* error = NULL;
    //         thumbnail = gdk_pixbuf_new_from_file_at_size(thumbnail_uri, thumbnail_size, thumbnail_size, &error);
    //         v8::Local<v8::Object> file_obj = Nan::New<v8::Object>();
    //         Nan::Set(file_obj, Nan::New("name").ToLocalChecked(), Nan::New(display_name).ToLocalChecked());
    //         Nan::Set(file_obj, Nan::New("path").ToLocalChecked(), Nan::New(thumbnail_path).ToLocalChecked());
    //         if (error != NULL) {
    //             g_print("Error loading thumbnail: %s\n", error->message);
    //             g_error_free(error);
    //         }
    //         g_free(thumbnail_uri);
    //         g_object_unref(thumbnail_file);
    //     }
    //     g_free(thumbnail_path);
    //     g_object_unref(file_info);
    //     g_object_unref(src);
    //     info.GetReturnValue().Set(result);
    //     // return thumbnail;
    // }

    // NAN_METHOD(thumbnail) {

    //     Nan::HandleScope scope;
    //     if (info.Length() < 1) {
    //         return Nan::ThrowError("Wrong number of arguments");
    //     }
    //     v8::Local<v8::String> sourceString = Nan::To<v8::String>(info[0]).ToLocalChecked();
    //     v8::Isolate* isolate = info.GetIsolate();
    //     // Get the current context from the execution context
    //     v8::Local<v8::Context> context = isolate->GetCurrentContext();
    //     v8::String::Utf8Value sourceFile(context->GetIsolate(), sourceString);
    //     v8::Local<v8::Array> resultArray = Nan::New<v8::Array>();
    //     GFile* src = g_file_new_for_path(*sourceFile);
    //     const char *src_scheme = g_uri_parse_scheme(*sourceFile);
    //     if (src_scheme != NULL) {
    //         src = g_file_new_for_uri(*sourceFile);
    //     }
    //     gchar *file_path = g_file_get_path(src);
    //     const gint thumbnail_width = 128;
    //     const gint thumbnail_height = 128;
    //     // Load the image file
    //     GError *error = NULL;
    //     GdkPixbuf *pixbuf = gdk_pixbuf_new_from_file(file_path, &error);
    //     if (error != NULL) {
    //         // g_print("Failed to load image: %s\n", error->message);
    //         g_error_free(error);
    //         return;
    //     }
    //     // Scale the image to thumbnail size
    //     GdkPixbuf *thumbnail_pixbuf = gdk_pixbuf_scale_simple(pixbuf, thumbnail_width, thumbnail_height, GDK_INTERP_BILINEAR);
    //     if (thumbnail_pixbuf != nullptr) {
    //         // Create the thumbnail filename based on the image file's hash
    //         // gchar *file_hash = g_compute_checksum_for_string(G_CHECKSUM_MD5, file_path, -1);
    //         GChecksum *checksum = g_checksum_new(G_CHECKSUM_MD5);
    //         g_checksum_update(checksum, (const guchar*)file_path, -1);
    //         const gchar *file_hash = g_checksum_get_string(checksum);
    //         gchar *thumbnail_filename = g_strdup_printf("%s.png", file_hash);
    //         //////////////
    //         gchar *uri, *filename, *path;
    //         // GChecksum *checksum;
    //         guint8 digest[16];
    //         gsize digest_len = sizeof (digest);
    //         gint success;
    //         // uri = nemo_file_get_uri (file);
    //         // checksum = g_checksum_new (G_CHECKSUM_MD5);
    //         g_checksum_update (checksum, (const guchar *) uri, strlen (uri));
    //         g_checksum_get_digest (checksum, digest, &digest_len);
    //         g_assert (digest_len == 16);
    //         filename = g_strconcat (g_checksum_get_string (checksum), ".png", NULL);
    //         g_checksum_free (checksum);
    //         //////////////////////
    //         // Create the thumbnails directory if it doesn't exist
    //         gchar *thumbnails_directory = g_build_filename(g_get_home_dir(), ".cache", "thumbnails", "large", NULL);
    //         g_mkdir_with_parents(thumbnails_directory, 0755);
    //         // Save the thumbnail image to the cache/thumbnails directory
    //         gchar *thumbnail_path = g_build_filename(thumbnails_directory, thumbnail_filename, NULL);
    //         if (g_file_test(thumbnail_path, G_FILE_TEST_EXISTS)) {
    //             // g_print("Thumbnail already exists: %s\n", thumbnail_path);
    //             // g_free(file_hash);
    //             g_free(thumbnail_filename);
    //             g_free(thumbnail_path);
    //             g_checksum_free(checksum);
    //             g_object_unref(thumbnail_pixbuf);
    //             g_object_unref(pixbuf);
    //             return;
    //         }
    //         gboolean is_saved = gdk_pixbuf_save(thumbnail_pixbuf, thumbnail_path, "png", NULL, NULL);
    //         // Clean up resources
    //         // g_free(file_hash);
    //         g_free(thumbnail_filename);
    //         g_free(thumbnail_path);
    //     }
    //     g_object_unref(thumbnail_pixbuf);
    //     g_object_unref(pixbuf);
    // }

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
            // g_print("Error loading input image\n");
            // Handle the error appropriately (e.g., return, cleanup, etc.)
            return;
        }
        int thumbnailWidth = 75;  // Adjust the width as per your requirements
        int thumbnailHeight = 75; // Adjust the height as per your requirements

        GdkPixbuf* oriented_pixbuf = gdk_pixbuf_apply_embedded_orientation(inputPixbuf);
        GdkPixbuf *thumbnailPixbuf = gdk_pixbuf_scale_simple(oriented_pixbuf, thumbnailWidth, thumbnailHeight, GDK_INTERP_BILINEAR);
        if (thumbnailPixbuf == nullptr) {
            // g_print("Error creating thumbnail\n");
            // Handle the error appropriately (e.g., return, cleanup, etc.)
            return;
        }
        GError* error = NULL;
        GdkPixbufFormat* fileType = gdk_pixbuf_get_file_info(g_file_get_path(src), NULL, NULL);
        if (fileType != NULL) {
            // const char *outputFile = dest; // Adjust the file extension as per your requirements
            gdk_pixbuf_save(thumbnailPixbuf, g_file_get_path(dest), gdk_pixbuf_format_get_name(fileType), NULL, NULL, &error);
        }
        g_object_unref(oriented_pixbuf);
        g_object_unref(thumbnailPixbuf);
        g_object_unref(inputPixbuf);
        g_object_unref(src);
        g_object_unref(dest);
    }

    // Return Disk Space
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

    NAN_METHOD(get_mounts) {

        v8::Local<v8::Array> resultArray = Nan::New<v8::Array>();

        GError *error = NULL;
        GList *mounts, *iter;
        GList *volumes;


        // Initialize GLib
        g_type_init();

        GVolumeMonitor* monitor = g_volume_monitor_get();

        // Get the list of mounts
        mounts = g_volume_monitor_get_mounts(monitor);
        volumes = g_volume_monitor_get_volumes(monitor);

        int c = 0;

        // Iterate over the mounts
        for (iter = mounts; iter != NULL; iter = iter->next) {

            GMount *mount = G_MOUNT(iter->data);
            const gchar *name = g_mount_get_name(mount);

            GFile *mount_path = NULL;
            mount_path = g_mount_get_default_location(mount);
            gchar *path = g_file_get_path(mount_path);
            if (path == NULL) {
                path = g_strdup("");
            }

            v8::Local<v8::Object> deviceObj = Nan::New<v8::Object>();
            Nan::Set(deviceObj, Nan::New("name").ToLocalChecked(), Nan::New(name).ToLocalChecked());
            Nan::Set(deviceObj, Nan::New("path").ToLocalChecked(), Nan::New(path).ToLocalChecked());
            Nan::Set(resultArray, c, deviceObj);
            ++c;

        }

        // // Iterate over the mounts
        // for (iter = volumes; iter != NULL; iter = iter->next) {
        //     GVolume *volume = G_VOLUME(iter->data);
        //     const gchar *name = g_volume_get_name(volume);
        //     const gchar *uuid = g_volume_get_uuid(volume);
        //     const gchar *type = g_volume_get_identifier(volume, G_VOLUME_IDENTIFIER_KIND_CLASS);
        //     GMount *mount = g_volume_get_mount(volume);
        //     GFile *mount_path = NULL;
        //     // if (mount != NULL) {
        //     mount_path = g_mount_get_default_location(mount);
        //     gchar *path = g_file_get_path(mount_path);
        //     if (path == NULL) {
        //         path = g_strdup("");
        //     }
        //     v8::Local<v8::Object> deviceObj = Nan::New<v8::Object>();
        //     Nan::Set(deviceObj, Nan::New("name").ToLocalChecked(), Nan::New(name).ToLocalChecked());
        //     Nan::Set(deviceObj, Nan::New("path").ToLocalChecked(), Nan::New(path).ToLocalChecked());
        //     Nan::Set(deviceObj, Nan::New("type").ToLocalChecked(), Nan::New(type).ToLocalChecked());
        //     Nan::Set(deviceObj, Nan::New("uuid").ToLocalChecked(), Nan::New(uuid).ToLocalChecked());
        //     Nan::Set(resultArray, c, deviceObj);
        //     ++c;
        // }

        // Free resources
        g_list_free_full(mounts, g_object_unref);
        g_list_free_full(volumes, g_object_unref);
        g_object_unref(monitor);

        info.GetReturnValue().Set(resultArray);

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
    NAN_METHOD(watcher) {

        Nan::HandleScope scope;

        int watch = 0;

        if (info.Length() < 2 || !info[0]->IsString() || !info[1]->IsFunction()) {
            Nan::ThrowTypeError("Invalid arguments. Expected a directory path as a string and a watcher object.");
            return;
        }

        v8::Local<v8::String> sourceString = Nan::To<v8::String>(info[0]).ToLocalChecked();

        Nan::Utf8String utf8Str(sourceString);
        const char* cstring = *utf8Str;

        if (watcher_dir.size() > 0) {
            for (int i = 0; i < watcher_dir.size(); i++) {
                if (watcher_dir[i] == cstring) {
                    // Already being watched
                    return;
                } else {
                    watcher_dir.push_back(cstring);
                    watch = 0;
                }
            }
        } else {
            watcher_dir.push_back(cstring);
            watch = 1;
        }

        if (watch) {

            v8::Isolate* isolate = info.GetIsolate();
            v8::Local<v8::Context> context = isolate->GetCurrentContext();
            v8::String::Utf8Value sourceFile(context->GetIsolate(), sourceString);

            GFile* src = g_file_new_for_path(*sourceFile);
            const char *src_scheme = g_uri_parse_scheme(*sourceFile);

            if (src_scheme != NULL) {
                src = g_file_new_for_uri(*sourceFile);
            }

            Nan::Callback* callback = new Nan::Callback(info[1].As<v8::Function>());
            GFileMonitor* fileMonitor = g_file_monitor_directory(src, G_FILE_MONITOR_NONE, NULL, NULL);

            if (fileMonitor == NULL) {
                Nan::ThrowError("Failed to create file monitor for the directory.");
                return;
            }

            // gboolean connectResult = g_signal_connect(fileMonitor, "changed", G_CALLBACK(directory_changed), static_cast<gpointer>(*watcherObj));
            gboolean connectResult = g_signal_connect(fileMonitor, "changed", G_CALLBACK(directory_changed), new Nan::Callback(info[1].As<v8::Function>()));

            if (connectResult == 0) {
                Nan::ThrowError("Failed to connect to the 'changed' signal.");
                g_object_unref(fileMonitor);
                return;
            }

            info.GetReturnValue().SetUndefined();

        }
    }

    void on_mount_added(GVolumeMonitor* monitor, GMount* mount, gpointer user_data) {
        Nan::HandleScope scope;
        // Get the device name
        const char* mountName = g_mount_get_name(mount);
        // Create a V8 string from the device name
        v8::Local<v8::String> v8MountName = Nan::New(mountName).ToLocalChecked();
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
        // Get the device name
        const char* deviceName = g_drive_get_name(drive);
        // Create a V8 string from the device name
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

        // Get the JavaScript callback function from the arguments
        Nan::Callback* callback = new Nan::Callback(info[0].As<v8::Function>());

        // Start monitoring for device changes
        GVolumeMonitor* volumeMonitor = g_volume_monitor_get();
        g_signal_connect(volumeMonitor, "drive-connected", G_CALLBACK(on_device_added), callback);
        g_signal_connect(volumeMonitor, "drive-disconnected", G_CALLBACK(on_device_removed), new Nan::Callback(info[0].As<v8::Function>()));

        g_signal_connect(volumeMonitor, "mount-added", G_CALLBACK(on_mount_added), callback);
        g_signal_connect(volumeMonitor, "mount-removed", G_CALLBACK(on_mount_removed), new Nan::Callback(info[0].As<v8::Function>()));

        // Return undefined (no immediate return value)
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
        GFileInfo* file_info = g_file_query_info(src, "*", G_FILE_QUERY_INFO_NONE, NULL, &error);
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
            // const char* app_desc = g_app_info_get_description(app);

            v8::Local<v8::Object> file_obj = Nan::New<v8::Object>();
            Nan::Set(file_obj, Nan::New("name").ToLocalChecked(), Nan::New(app_name).ToLocalChecked());
            Nan::Set(file_obj, Nan::New("display").ToLocalChecked(), Nan::New(app_display_name).ToLocalChecked());
            Nan::Set(file_obj, Nan::New("exec").ToLocalChecked(), Nan::New(app_exec).ToLocalChecked());
            Nan::Set(file_obj, Nan::New("cmd").ToLocalChecked(), Nan::New(cmd).ToLocalChecked());
            Nan::Set(file_obj, Nan::New("mimetype").ToLocalChecked(), Nan::New(mimetype).ToLocalChecked());
            // Nan::Set(file_obj, Nan::New("description").ToLocalChecked(), Nan::New(app_desc).ToLocalChecked());
            // Nan::Set(result, i, Nan::New(appName).ToLocalChecked());
            Nan::Set(result, i, file_obj);
            i++;
        }

        g_list_free(appList);
        g_object_unref(src);

        info.GetReturnValue().Set(result);
    }

    /**
     * This does not seem to work with intellisense
    */
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

        GFileInfo* fileInfo = g_file_query_info(src, G_FILE_ATTRIBUTE_FILESYSTEM_SIZE "," G_FILE_ATTRIBUTE_FILESYSTEM_FREE, G_FILE_QUERY_INFO_NONE, NULL, NULL);

        gint64 totalSpace = g_file_info_get_attribute_uint64(fileInfo, G_FILE_ATTRIBUTE_FILESYSTEM_SIZE);
        gint64 freeSpace = g_file_info_get_attribute_uint64(fileInfo, G_FILE_ATTRIBUTE_FILESYSTEM_FREE);

        g_object_unref(fileInfo);
        g_object_unref(src);

        v8::Local<v8::Object> result = Nan::New<v8::Object>();
        Nan::Set(result, Nan::New("totalSpace").ToLocalChecked(), Nan::New<v8::Number>(totalSpace));
        Nan::Set(result, Nan::New("freeSpace").ToLocalChecked(), Nan::New<v8::Number>(freeSpace));

        info.GetReturnValue().Set(result);

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

        if (error != NULL) {
            g_object_unref(src);
            return Nan::ThrowError(error->message);
        }

        const char* filename = g_file_info_get_name(file_info);
        if (filename != nullptr) {

            const char* href = g_file_get_path(src);
            gboolean is_hidden = g_file_info_get_is_hidden(file_info);
            gboolean is_directory = g_file_info_get_file_type(file_info) == G_FILE_TYPE_DIRECTORY;
            const char* mimetype = g_file_info_get_content_type(file_info);
            // gboolean is_writable = g_file_info_get_attribute_boolean(file_info, G_FILE_ATTRIBUTE_ACCESS_CAN_WRITE);

            v8::Local<v8::Object> fileObj = Nan::New<v8::Object>();
            Nan::Set(fileObj, Nan::New("name").ToLocalChecked(), Nan::New(filename).ToLocalChecked());
            Nan::Set(fileObj, Nan::New("href").ToLocalChecked(), Nan::New(href).ToLocalChecked());
            Nan::Set(fileObj, Nan::New("is_dir").ToLocalChecked(), Nan::New<v8::Boolean>(is_directory));
            Nan::Set(fileObj, Nan::New("is_hidden").ToLocalChecked(), Nan::New<v8::Boolean>(is_hidden));
            // Nan::Set(fileObj, Nan::New("is_writable").ToLocalChecked(), Nan::New<v8::Boolean>(is_writable));
            // Nan::Set(fileObj, Nan::New("content_type").ToLocalChecked(), Nan::New(mimetype).ToLocalChecked());
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

            const char* thumbnail_path = g_file_info_get_attribute_byte_string(file_info, G_FILE_ATTRIBUTE_THUMBNAIL_PATH);
            if (thumbnail_path != nullptr) {
                Nan::Set(fileObj, Nan::New("thumbnail_path").ToLocalChecked(), Nan::New(thumbnail_path).ToLocalChecked());
            }

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
            flags = G_FILE_COPY_NOFOLLOW_SYMLINKS;
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
        // Nan::Export(target, "get_thumbnail", get_thumbnail);
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
        // Nan::Set(target, Nan::New("watcher").ToLocalChecked(), Nan::GetFunction(Nan::New<FunctionTemplate>(watcher)).ToLocalChecked());
        // Nan::Set(target, Nan::New("monitor").ToLocalChecked(), Nan::GetFunction(Nan::New<v8::FunctionTemplate>(monitor)).ToLocalChecked());
    }

    // NAN_MODULE_WORKER_ENABLED(count, count)
    // NAN_MODULE_WORKER_ENABLED(ls, init)
    NAN_MODULE_WORKER_ENABLED(gio, init)
    NODE_MODULE(gio, init)

}

// NODE_MODULE_CONTEXT_AWARE_BUILTIN(gio, init)

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