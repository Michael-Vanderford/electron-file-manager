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
#include <mutex>
#include <chrono>
#include <vector>

#include <archive.h>
#include <archive_entry.h>


// Node includes
#include <nan.h>
#include <node.h>
#include <node_api.h>

// Glib includes
#include <gio/gio.h>
#include <glib-object.h>
#include <gdk-pixbuf/gdk-pixbuf.h>
#include <glib.h>

#include <chrono>

// fuse
// #include <fuse.h>

using namespace std;

static const char* FILE_INFO_ATTRIBUTES =
    G_FILE_ATTRIBUTE_STANDARD_NAME ","
    G_FILE_ATTRIBUTE_STANDARD_DISPLAY_NAME ","
    G_FILE_ATTRIBUTE_STANDARD_TYPE ","
    G_FILE_ATTRIBUTE_STANDARD_IS_HIDDEN ","
    G_FILE_ATTRIBUTE_STANDARD_CONTENT_TYPE ","
    G_FILE_ATTRIBUTE_STANDARD_IS_SYMLINK ","
    G_FILE_ATTRIBUTE_STANDARD_SIZE ","
    G_FILE_ATTRIBUTE_ACCESS_CAN_WRITE ","
    G_FILE_ATTRIBUTE_ACCESS_CAN_READ ","
    G_FILE_ATTRIBUTE_FILESYSTEM_TYPE ","
    G_FILE_ATTRIBUTE_TIME_MODIFIED ","
    G_FILE_ATTRIBUTE_TIME_ACCESS ","
    G_FILE_ATTRIBUTE_TIME_CREATED;

class ListFilesWorker : public Nan::AsyncWorker {
public:
    ListFilesWorker(Nan::Callback *callback, const std::string &source)
        : Nan::AsyncWorker(callback), source(source) {}

    ~ListFilesWorker() {}

    void Execute() {
        GFile* src = g_file_new_for_path(source.c_str());
        const char *src_scheme = g_uri_parse_scheme(source.c_str());
        if (src_scheme != NULL) {
            src = g_file_new_for_uri(source.c_str());
        }

        GError* error = NULL;
        GFileEnumerator* enumerator = g_file_enumerate_children(src,
                                    FILE_INFO_ATTRIBUTES,
                                                                G_FILE_QUERY_INFO_NONE,
                                                                NULL,
                                                                &error);

        if (enumerator == NULL) {
            if (error != NULL) {
                SetErrorMessage(error->message);
                g_error_free(error);
                g_object_unref(src);
                return;
            } else {
                SetErrorMessage("Unknown error occurred");
                g_object_unref(src);
                return;
            }
        }

        GFileInfo* file_info = NULL;
        while ((file_info = g_file_enumerator_next_file(enumerator, NULL, &error)) != NULL) {
            FileResult fileResult;

            fileResult.name = g_file_info_get_name(file_info);
            fileResult.display_name = g_file_info_get_display_name(file_info);
            fileResult.href = g_file_get_path(g_file_get_child(src, fileResult.name.c_str()));
            fileResult.location = g_file_get_path(g_file_get_parent(g_file_get_child(src, fileResult.name.c_str())));
            fileResult.is_hidden = g_file_info_has_attribute(file_info, G_FILE_ATTRIBUTE_STANDARD_IS_HIDDEN)
                                  ? g_file_info_get_attribute_boolean(file_info, G_FILE_ATTRIBUTE_STANDARD_IS_HIDDEN)
                                  : FALSE;
            fileResult.is_directory = g_file_info_get_file_type(file_info) == G_FILE_TYPE_DIRECTORY;
            fileResult.mimetype = g_file_info_get_content_type(file_info);
            fileResult.is_symlink = g_file_info_has_attribute(file_info, G_FILE_ATTRIBUTE_STANDARD_IS_SYMLINK)
                                   ? g_file_info_get_attribute_boolean(file_info, G_FILE_ATTRIBUTE_STANDARD_IS_SYMLINK)
                                   : FALSE;
            fileResult.is_writeable = g_file_info_get_attribute_boolean(file_info, G_FILE_ATTRIBUTE_ACCESS_CAN_WRITE);
            fileResult.is_readable = g_file_info_get_attribute_boolean(file_info, G_FILE_ATTRIBUTE_ACCESS_CAN_READ);
            fileResult.filesystem = g_file_info_get_attribute_string(file_info, G_FILE_ATTRIBUTE_FILESYSTEM_TYPE)
                                    ? g_file_info_get_attribute_string(file_info, G_FILE_ATTRIBUTE_FILESYSTEM_TYPE)
                                    : "unknown";
            fileResult.size = g_file_info_get_size(file_info);

            GDateTime* mtime_dt = g_file_info_get_modification_date_time(file_info);
            if (mtime_dt != NULL) {
                fileResult.mtime = g_date_time_to_unix(mtime_dt);
                g_date_time_unref(mtime_dt);
            }

            GDateTime* atime_dt = g_file_info_get_access_date_time(file_info);
            if (atime_dt != NULL) {
                fileResult.atime = g_date_time_to_unix(atime_dt);
                g_date_time_unref(atime_dt);
            }

            GDateTime* ctime_dt = g_file_info_get_creation_date_time(file_info);
            if (ctime_dt != NULL) {
                fileResult.ctime = g_date_time_to_unix(ctime_dt);
                g_date_time_unref(ctime_dt);
            }

            results.push_back(fileResult);
            g_object_unref(file_info);
        }

        if (error != NULL) {
            SetErrorMessage(error->message);
            g_error_free(error);
        }

        g_object_unref(enumerator);
        g_object_unref(src);
    }

    void HandleOKCallback() {
        Nan::HandleScope scope;

        v8::Local<v8::Array> resultArray = Nan::New<v8::Array>(results.size());
        for (size_t i = 0; i < results.size(); i++) {
            v8::Local<v8::Object> fileObj = Nan::New<v8::Object>();
            Nan::Set(fileObj, Nan::New("name").ToLocalChecked(), Nan::New(results[i].name).ToLocalChecked());
            Nan::Set(fileObj, Nan::New("display_name").ToLocalChecked(), Nan::New(results[i].display_name).ToLocalChecked());
            Nan::Set(fileObj, Nan::New("href").ToLocalChecked(), Nan::New(results[i].href).ToLocalChecked());
            Nan::Set(fileObj, Nan::New("location").ToLocalChecked(), Nan::New(results[i].location).ToLocalChecked());
            Nan::Set(fileObj, Nan::New("is_dir").ToLocalChecked(), Nan::New<v8::Boolean>(results[i].is_directory));
            Nan::Set(fileObj, Nan::New("is_hidden").ToLocalChecked(), Nan::New<v8::Boolean>(results[i].is_hidden));
            Nan::Set(fileObj, Nan::New("is_readable").ToLocalChecked(), Nan::New<v8::Boolean>(results[i].is_readable));
            Nan::Set(fileObj, Nan::New("is_writable").ToLocalChecked(), Nan::New<v8::Boolean>(results[i].is_writeable));
            Nan::Set(fileObj, Nan::New("is_symlink").ToLocalChecked(), Nan::New<v8::Boolean>(results[i].is_symlink));
            Nan::Set(fileObj, Nan::New("filesystem").ToLocalChecked(), Nan::New(results[i].filesystem).ToLocalChecked());
            Nan::Set(fileObj, Nan::New("content_type").ToLocalChecked(), Nan::New(results[i].mimetype).ToLocalChecked());
            Nan::Set(fileObj, Nan::New("size").ToLocalChecked(), Nan::New<v8::Number>(results[i].size));
            Nan::Set(fileObj, Nan::New("mtime").ToLocalChecked(), Nan::New<v8::Number>(results[i].mtime));
            Nan::Set(fileObj, Nan::New("atime").ToLocalChecked(), Nan::New<v8::Number>(results[i].atime));
            Nan::Set(fileObj, Nan::New("ctime").ToLocalChecked(), Nan::New<v8::Number>(results[i].ctime));

            Nan::Set(resultArray, i, fileObj);
        }

        v8::Local<v8::Value> argv[] = { Nan::Null(), resultArray };
        callback->Call(2, argv);
    }

    void HandleErrorCallback() {
        Nan::HandleScope scope;

        v8::Local<v8::Value> argv[] = {
            Nan::New(this->ErrorMessage()).ToLocalChecked()
        };
        callback->Call(1, argv);
    }

private:
    struct FileResult {
        std::string name;
        std::string display_name;
        std::string href;
        std::string location;
        bool is_hidden;
        bool is_directory;
        std::string mimetype;
        bool is_symlink;
        bool is_writeable;
        bool is_readable;
        std::string filesystem;
        gint64 size;
        gint64 mtime;
        gint64 atime;
        gint64 ctime;
    };

    std::string source;
    std::vector<FileResult> results;
};

namespace gio {

    using v8::FunctionCallbackInfo;
    using v8::Isolate;
    using v8::Local;
    using v8::Object;
    using v8::String;
    using v8::Value;

    class gio {

        public:

        static NAN_METHOD(ls) {

            Nan::HandleScope scope;

            // start time
            // auto start = std::chrono::high_resolution_clock::now();

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
            GFileEnumerator* enumerator = g_file_enumerate_children(src,
                                                                    FILE_INFO_ATTRIBUTES,
                                                                    G_FILE_QUERY_INFO_NONE,
                                                                    NULL,
                                                                    &error);

            // auto t1 = std::chrono::high_resolution_clock::now();
            // auto t1_elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(t1 - start);
            // printf("Elapsed time 1: %ld milliseconds\n", t1_elapsed.count());

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

            // auto t2 = std::chrono::high_resolution_clock::now();
            // auto t2_elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(t2 - t1);
            // printf("Elapsed time 2: %ld milliseconds\n", t2_elapsed.count());

            GFileInfo* file_info = NULL;
            while ((file_info = g_file_enumerator_next_file(enumerator, NULL, &error)) != NULL) {

                const char* filename = g_file_info_get_name(file_info);
                const char* display_name = g_file_info_get_display_name(file_info);
                GFile* file = g_file_get_child(src, filename);
                const char* href = g_file_get_path(file);
                GFile* parent = g_file_get_parent(file);
                const char* location = g_file_get_path(parent);
                gboolean is_hidden = g_file_info_has_attribute(file_info, G_FILE_ATTRIBUTE_STANDARD_IS_HIDDEN)
                                     ? g_file_info_get_attribute_boolean(file_info, G_FILE_ATTRIBUTE_STANDARD_IS_HIDDEN)
                                     : FALSE;
                gboolean is_directory = g_file_info_get_file_type(file_info) == G_FILE_TYPE_DIRECTORY;
                const char* mimetype = g_file_info_get_content_type(file_info);
                gboolean is_symlink = g_file_info_has_attribute(file_info, G_FILE_ATTRIBUTE_STANDARD_IS_SYMLINK)
                                      ? g_file_info_get_attribute_boolean(file_info, G_FILE_ATTRIBUTE_STANDARD_IS_SYMLINK)
                                      : FALSE;
                gboolean  is_writeable = g_file_info_get_attribute_boolean(file_info, G_FILE_ATTRIBUTE_ACCESS_CAN_WRITE);
                gboolean is_readable = g_file_info_get_attribute_boolean(file_info, G_FILE_ATTRIBUTE_ACCESS_CAN_READ);
                const char* fs_type = g_file_info_get_attribute_string(file_info, G_FILE_ATTRIBUTE_FILESYSTEM_TYPE);
                std::string filesystem = fs_type ? fs_type : "unknown";

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
                Nan::Set(fileObj, Nan::New("filesystem").ToLocalChecked(), Nan::New(filesystem).ToLocalChecked());

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

            // auto t3 = std::chrono::high_resolution_clock::now();
            // auto t3_elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(t3 - t2);
            // printf("Elapsed time 3: %ld milliseconds\n", t3_elapsed.count());

            g_object_unref(enumerator);
            g_object_unref(src);

            // end time
            // auto end = std::chrono::high_resolution_clock::now();
            // std::chrono::duration<double> elapsed = end - start;
            // printf("total elapsed time: %f seconds\n", elapsed.count());

            v8::Local<v8::Value> argv[] = { Nan::Null(), resultArray };
            callback.Call(2, argv);

        }

        static NAN_METHOD(get_file) {

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
                                                    FILE_INFO_ATTRIBUTES,
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
                gboolean is_hidden = g_file_info_has_attribute(file_info, G_FILE_ATTRIBUTE_STANDARD_IS_HIDDEN)
                                     ? g_file_info_get_attribute_boolean(file_info, G_FILE_ATTRIBUTE_STANDARD_IS_HIDDEN)
                                     : FALSE;
                gboolean is_directory = g_file_info_get_file_type(file_info) == G_FILE_TYPE_DIRECTORY;
                const char* mimetype = g_file_info_get_content_type(file_info);
                GFile* parent = g_file_get_parent(src);
                gboolean is_writeable = g_file_info_get_attribute_boolean(file_info, G_FILE_ATTRIBUTE_ACCESS_CAN_WRITE);
                gboolean is_readable = g_file_info_get_attribute_boolean(file_info, G_FILE_ATTRIBUTE_ACCESS_CAN_READ);
                gboolean is_symlink = g_file_info_has_attribute(file_info, G_FILE_ATTRIBUTE_STANDARD_IS_SYMLINK)
                                      ? g_file_info_get_attribute_boolean(file_info, G_FILE_ATTRIBUTE_STANDARD_IS_SYMLINK)
                                      : FALSE;

                v8::Local<v8::Object> fileObj = Nan::New<v8::Object>();
                Nan::Set(fileObj, Nan::New("name").ToLocalChecked(), Nan::New(filename).ToLocalChecked());
                Nan::Set(fileObj, Nan::New("display_name").ToLocalChecked(), Nan::New(display_name).ToLocalChecked());
                Nan::Set(fileObj, Nan::New("href").ToLocalChecked(), Nan::New(href).ToLocalChecked());
                Nan::Set(fileObj, Nan::New("is_dir").ToLocalChecked(), Nan::New<v8::Boolean>(is_directory));
                Nan::Set(fileObj, Nan::New("is_hidden").ToLocalChecked(), Nan::New<v8::Boolean>(is_hidden));
                Nan::Set(fileObj, Nan::New("is_writable").ToLocalChecked(), Nan::New<v8::Boolean>(is_writeable));
                Nan::Set(fileObj, Nan::New("is_readable").ToLocalChecked(), Nan::New<v8::Boolean>(is_readable));
                Nan::Set(fileObj, Nan::New("is_symlink").ToLocalChecked(), Nan::New<v8::Boolean>(is_symlink));

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

        static NAN_METHOD(mkdir) {

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

        static NAN_METHOD(exec) {

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

        static NAN_METHOD(open) {

            Nan::HandleScope scope;

            if (info.Length() < 1) {
                return Nan::ThrowError("Wrong number of arguments");
            }

            v8::Local<v8::String> sourceString = Nan::To<v8::String>(info[0]).ToLocalChecked();
            v8::Isolate* isolate = info.GetIsolate();
            v8::Local<v8::Context> context = isolate->GetCurrentContext();
            v8::String::Utf8Value sourceFile(context->GetIsolate(), sourceString);

            GFile* src = g_file_new_for_path(*sourceFile);
            const char *src_scheme = g_uri_parse_scheme(*sourceFile);
            if (src_scheme != NULL) {
                src = g_file_new_for_uri(*sourceFile);
            }

            // print file name
            printf("%s\n", g_file_get_path(src));

            GError* error = NULL;
            GFileInfo* file_info = g_file_query_info(src,
                                                    "*",
                                                    G_FILE_QUERY_INFO_NONE,
                                                    NULL,
                                                    &error);

            const char *content_type = g_file_info_get_content_type(file_info);

            printf("Content type: %s\n", content_type);

            if (error != NULL) {
                g_error_free(error);
                g_object_unref(src);
                return Nan::ThrowError(error->message);
            }

            // create a glist for files
            GList *fileList = NULL;
            fileList = g_list_append(fileList, g_strdup(g_file_get_path(src)));

            GAppInfo *app_info = g_app_info_get_default_for_type(content_type, FALSE);
            if (!app_info) {
                g_list_free_full(fileList, g_free); // Free the list and its data
                g_object_unref(src);
                return Nan::ThrowError("No default application found for this file type");
            }

            gboolean res = g_app_info_launch(app_info, fileList, NULL, &error);
            g_object_unref(app_info); // Release the GAppInfo reference
            g_list_free_full(fileList, g_free); // Free the list and its data

            if (!res) {
                g_error_free(error);
                g_object_unref(src);
                return Nan::ThrowError(error->message);
            }

            g_object_unref(src);

        }

        // Sets the execute bit on a file
        static NAN_METHOD(set_execute) {

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
        static NAN_METHOD(clear_execute) {

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

        static NAN_METHOD(thumbnail) {

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

        static thread_local goffset bytes_copied;
        static thread_local goffset bytes_copied0;

        static void
        progress_callback(goffset current_num_bytes,
                        goffset total_bytes,
                        gpointer user_data) {

            Nan::HandleScope scope;
            if (user_data == NULL) {
                printf("User data is NULL\n");
                return;
            }

            bytes_copied = current_num_bytes - bytes_copied0;
            bytes_copied0 = current_num_bytes;
            v8::Local<v8::Object> dataObj = Nan::New<v8::Object>();
            Nan::Set(dataObj, Nan::New("current_num_bytes").ToLocalChecked(), Nan::New<v8::Number>(current_num_bytes));
            Nan::Set(dataObj, Nan::New("bytes_copied").ToLocalChecked(), Nan::New<v8::Number>(bytes_copied));
            Nan::Set(dataObj, Nan::New("total_bytes").ToLocalChecked(), Nan::New<v8::Number>(total_bytes));

            Nan::Callback* callback = static_cast<Nan::Callback*>(user_data);
            const unsigned argc = 2;
            v8::Local<v8::Value> argv[argc] = { Nan::Null(), dataObj };
            callback->Call(argc, argv);
        }

        static thread_local Nan::Persistent<v8::Object> persistentHandle;

        static
        NAN_METHOD(cp_async) {

            Nan::HandleScope scope;

            if (info.Length() < 3) {
                return Nan::ThrowError("Wrong number of arguments");
            }

            v8::Local<v8::String> sourceString = Nan::To<v8::String>(info[0]).ToLocalChecked();
            v8::Local<v8::String> destString = Nan::To<v8::String>(info[1]).ToLocalChecked();
            Nan::Callback* callback = new Nan::Callback(info[2].As<v8::Function>());

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

            GCancellable* cancellable = g_cancellable_new();

            v8::Local<v8::Object> obj = Nan::New<v8::Object>();
            Nan::Set(obj, Nan::New("cancellable").ToLocalChecked(), Nan::New<v8::External>(cancellable));
            persistentHandle.Reset(obj);

            GError* error = nullptr;
            gboolean result = g_file_copy(src,
                                        dest,
                                        G_FILE_COPY_ALL_METADATA,
                                        cancellable,
                                        (GFileProgressCallback) gio::progress_callback,
                                        callback,
                                        // new Nan::Callback(info[info.Length() - 1].As<v8::Function>()),
                                        &error);

            if (!result) {

                v8::Local<v8::Value> argv[] = {
                    Nan::New(error->message).ToLocalChecked()
                };
                callback->Call(1, argv);
                g_error_free(error);

            } else {

                v8::Local<v8::Object> dataObj = Nan::New<v8::Object>();
                Nan::Set(dataObj, Nan::New("current_num_bytes").ToLocalChecked(), Nan::New<v8::Number>(0));
                Nan::Set(dataObj, Nan::New("bytes_copied").ToLocalChecked(), Nan::New<v8::Number>(0));
                Nan::Set(dataObj, Nan::New("total_bytes").ToLocalChecked(), Nan::New<v8::Number>(0));

                v8::Local<v8::Value> argv[] = {
                    Nan::Null(),
                    dataObj
                };
                callback->Call(2, argv);
            }


            bytes_copied0 = 0;
            bytes_copied = 0;

            g_object_unref(src);
            g_object_unref(dest);

        }

        static NAN_METHOD(cp_cancel) {
            Nan::HandleScope scope;
            v8::Local<v8::Object> obj = Nan::New(persistentHandle);
            GCancellable* cancellable =
                static_cast<GCancellable*>(v8::Local<v8::External>::Cast(Nan::Get(obj,
                                            Nan::New("cancellable").ToLocalChecked()).ToLocalChecked())->Value());

            g_cancellable_cancel(cancellable);
        }

        static
        NAN_METHOD(cp_arr) {

            Nan::HandleScope scope;

            if (info.Length() < 2) {
                printf("Wrong number of arguments\n");
                return Nan::ThrowError("Wrong number of arguments");
            }

            v8::Local<v8::Array> copy_arr = v8::Local<v8::Array>::Cast(info[0]);

            v8::Isolate* isolate = info.GetIsolate();
            v8::Local<v8::Context> context = isolate->GetCurrentContext();

            GError* error = NULL;
            gboolean r = FALSE;

            for (unsigned int i = 0; i < copy_arr->Length(); i++) {

                v8::Local<v8::Value> element = copy_arr->Get(context, i).ToLocalChecked();
                v8::Local<v8::Object> obj = element.As<v8::Object>();

                // Get the 'source' property
                v8::Local<v8::String> sourceKey = v8::String::NewFromUtf8(isolate, "source").ToLocalChecked();
                v8::Local<v8::Value> sourceValue = obj->Get(context, sourceKey).ToLocalChecked();

                // Get the 'destination' property
                v8::Local<v8::String> destKey = v8::String::NewFromUtf8(isolate, "destination").ToLocalChecked();
                v8::Local<v8::Value> destValue = obj->Get(context, destKey).ToLocalChecked();

                // get is_dir property as boolean
                v8::Local<v8::String> isDirKey = v8::String::NewFromUtf8(isolate, "is_dir").ToLocalChecked();
                v8::Local<v8::Value> isDirValue = obj->Get(context, isDirKey).ToLocalChecked();
                gboolean is_directory = isDirValue->BooleanValue(isolate);

                // print string
                v8::String::Utf8Value sourceFile(isolate, sourceValue);
                v8::String::Utf8Value destFile(isolate, destValue);

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

                // // print file names
                // printf("Source: %s\n", g_file_get_path(src));
                // printf("Destination: %s\n", g_file_get_path(dest));

                GCancellable* cancellable = g_cancellable_new();
                Nan::Callback* callback = new Nan::Callback(info[1].As<v8::Function>());
                Nan::Set(obj, Nan::New("cancellable").ToLocalChecked(), Nan::New<v8::External>(cancellable));
                persistentHandle.Reset(obj);

                // // check if source is a directory
                // GFileInfo* file_info = g_file_query_info(src,
                //                                         "*",
                //                                         G_FILE_QUERY_INFO_NONE,
                //                                         NULL,
                //                                         &error);

                // if (file_info) {

                    // gboolean is_directory = g_file_info_get_file_type(file_info) == G_FILE_TYPE_DIRECTORY;
                    if (is_directory) {

                        r = g_file_make_directory_with_parents(dest, cancellable, &error);

                        if (!r) {

                            char err[100];
                            sprintf(err, "error creating directory: %s", g_file_get_path(dest));

                            v8::Local<v8::Value> argv[] = {
                                Nan::New(err).ToLocalChecked()
                            };
                            callback->Call(1, argv);
                        }

                        if (error) {
                            v8::Local<v8::Value> argv[] = {
                                Nan::New(error->message).ToLocalChecked()
                            };
                            callback->Call(1, argv);
                            g_error_free(error);
                        }

                    } else {
                        r = g_file_copy(src,
                                        dest,
                                        G_FILE_COPY_ALL_METADATA,
                                        cancellable,
                                        (GFileProgressCallback) gio::progress_callback,
                                        callback,
                                        &error);
                        if (r) {

                            v8::Local<v8::Object> dataObj = Nan::New<v8::Object>();
                            Nan::Set(dataObj, Nan::New("current_num_bytes").ToLocalChecked(), Nan::New<v8::Number>(0));
                            Nan::Set(dataObj, Nan::New("bytes_copied").ToLocalChecked(), Nan::New<v8::Number>(0));
                            Nan::Set(dataObj, Nan::New("total_bytes").ToLocalChecked(), Nan::New<v8::Number>(0));

                            v8::Local<v8::Value> argv[] = {
                                Nan::Null(),
                                dataObj
                            };
                            callback->Call(2, argv);

                        } else {

                            // char err[150];
                            // sprintf(err, "{\"filename\": \"%s\", \"err\": \"%s\"}", g_file_get_path(src), error->message);
                            v8::Local<v8::Value> argv[] = {
                                Nan::New(error->message).ToLocalChecked()
                            };
                            callback->Call(1, argv);

                        }

                    }


                    // g_object_unref(file_info);

                // }

                bytes_copied0 = 0;
                bytes_copied = 0;

                g_object_unref(src);
                g_object_unref(dest);

            }

            // if (error) {
            //     // Print the error message
            //     fprintf(stderr, "Error: %s\n", error->message);

            //     // Free the GError object
            //     g_error_free(error);
            // } else {
            //     printf("Operation succeeded.\n");
            // }

            // if (res == FALSE) {
            //     return Nan::ThrowError(error->message);
            // }

            info.GetReturnValue().Set(Nan::True());


        }

        static NAN_METHOD(mv) {

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
                (GFileProgressCallback) gio::progress_callback,
                new Nan::Callback(info[info.Length() - 1].As<v8::Function>()),
                &error
            );

            bytes_copied0 = 0;
            bytes_copied = 0;

            g_object_unref(src);
            g_object_unref(dest);

            if (res == FALSE) {
                return Nan::ThrowError(error->message);
            }

            info.GetReturnValue().Set(Nan::True());

        }

        static void connect_network_drive_callback(GObject *source_object, GAsyncResult *res, gpointer user_data) {

            Nan::HandleScope scope;

            GError *error = nullptr;
            GFile *location = G_FILE(source_object);
            gboolean mounted = g_file_mount_enclosing_volume_finish(location,
                                                                    res,
                                                                    &error);

            Nan::Callback* callback = static_cast<Nan::Callback*>(user_data);

            if (error) {

                printf("Error mounting network drive: %s\n", error->message);
                v8::Local<v8::Value> argv[] = {
                    Nan::New(error->message).ToLocalChecked()
                };
                callback->Call(1, argv);
                g_error_free(error);

            } else {

                const unsigned argc = 2;
                v8::Local<v8::Object> dataObj = Nan::New<v8::Object>();
                Nan::Set(dataObj, Nan::New("name").ToLocalChecked(), Nan::New("connected").ToLocalChecked());
                v8::Local<v8::Value> argv[argc] = { Nan::Null(), dataObj };
                callback->Call(argc, argv);

            }

            g_object_unref(location);

        }

        static NAN_METHOD(connect_network_drive) {

            Nan::HandleScope scope;

            if (info.Length() < 6 || !info[5]->IsFunction()) {
                return Nan::ThrowError("Wrong number of arguments. Expected hostname, username, password, use_ssh_key, type, callback.");
            }

            v8::Local<v8::String> v8_hostname = Nan::To<v8::String>(info[0]).ToLocalChecked();
            v8::Local<v8::String> v8_username = Nan::To<v8::String>(info[1]).ToLocalChecked();
            v8::Local<v8::String> v8_password = Nan::To<v8::String>(info[2]).ToLocalChecked();
            v8::Local<v8::Int32> v8_ssh_key = Nan::To<v8::Int32>(info[3]).ToLocalChecked();
            v8::Local<v8::String> v8_type = Nan::To<v8::String>(info[4]).ToLocalChecked();

            v8::Isolate* isolate = info.GetIsolate();
            v8::String::Utf8Value utf8_hostname(isolate, v8_hostname);
            v8::String::Utf8Value utf8_username(isolate, v8_username);
            v8::String::Utf8Value utf8_password(isolate, v8_password);
            v8::String::Utf8Value utf8_type(isolate, v8_type);

            const char *hostname = *utf8_hostname;
            const char *username = *utf8_username;
            const char *password = *utf8_password;
            int ssh_key = Nan::To<int>(v8_ssh_key).FromJust();
            const char *cmd_type = *utf8_type;

            printf("type: %s, ssh_key: %d \n", cmd_type, ssh_key);

            GFile *location = NULL;

            // Set up SSH key authentication
            GMountOperation *mount_operation = g_mount_operation_new();
            Nan::Callback* callback = new Nan::Callback(info[5].As<v8::Function>());

            int is_ssh = strncmp(cmd_type, "ssh", 3);
            int is_smb = strncmp(cmd_type, "smb", 3);
            // int is_sshfs = strncmp(hostname, "sshfs", 5);

            // Prioritize SSH key if provided
            if (is_ssh == 0 && ssh_key) {

                printf("Using SSH key\n");

                // construct location uri
                char *uri = g_strdup_printf("sftp://%s@%s/", username, hostname);



                location = g_file_new_for_uri(uri);
                g_file_mount_enclosing_volume(location,
                                            G_MOUNT_MOUNT_NONE,
                                            mount_operation,
                                            NULL,
                                            GAsyncReadyCallback(connect_network_drive_callback),
                                            callback);
                g_free(uri);

            } else if (is_smb == 0) {

                printf("Using SMB username/password\n");

                char *uri = g_strdup_printf("smb://%s/", hostname);
                location = g_file_new_for_uri(uri);

                g_mount_operation_set_username(mount_operation, username);
                g_mount_operation_set_password(mount_operation, password);
                g_mount_operation_set_password_save(mount_operation, G_PASSWORD_SAVE_NEVER);

                g_file_mount_enclosing_volume(location,
                                            G_MOUNT_MOUNT_NONE,
                                            mount_operation,
                                            NULL,
                                            GAsyncReadyCallback(connect_network_drive_callback),
                                            callback);
                g_free(uri);

            } else {
                v8::Local<v8::Value> argv[] = {
                    Nan::New("Unsupported network connection type.").ToLocalChecked()
                };
                callback->Call(1, argv);

            // } else if (is_sftp == 0 && !ssh_key) {

            //     printf("Using username and password\n");

            //     location = g_file_new_for_uri(hostname);
            //     g_mount_operation_set_username(mount_operation, username);
            //     g_mount_operation_set_password(mount_operation, password);

            //     g_file_mount_enclosing_volume(location,
            //                                 G_MOUNT_MOUNT_NONE,
            //                                 mount_operation,
            //                                 NULL,
            //                                 GAsyncReadyCallback(connect_network_drive_callback),
            //                                 new Nan::Callback(info[info.Length() - 1].As<v8::Function>()));


            // } else {

            //     // Use username and password authentication
            //     char *uri = g_strdup_printf("smb://%s:%s@%s/", username, password, hostname);
            //     location = g_file_new_for_uri(uri);
            //     g_free(uri);

            }

            // g_object_unref(location);
            g_object_unref(mount_operation);

            // info.GetReturnValue().SetUndefined();

        }

        private:

    };

    NAN_METHOD(ls) {
        if (info.Length() < 2 || !info[1]->IsFunction()) {
            return Nan::ThrowError("Wrong arguments. Expected callback function.");
        }

        printf("ls called\n");

        v8::Local<v8::String> sourceString = Nan::To<v8::String>(info[0]).ToLocalChecked();
        v8::String::Utf8Value sourceFile(info.GetIsolate(), sourceString);
        Nan::Callback *callback = new Nan::Callback(info[1].As<v8::Function>());

        Nan::AsyncQueueWorker(new ListFilesWorker(callback, std::string(*sourceFile)));
    }

    thread_local Nan::Persistent<v8::Object> gio::persistentHandle;
    thread_local goffset gio::bytes_copied = 0;
    thread_local goffset gio::bytes_copied0 = 0;

    NAN_METHOD(get_drives) {

        Nan::HandleScope scope;
        if (info.Length() < 1 || !info[0]->IsFunction()) {
            return Nan::ThrowError("Wrong arguments. Expected callback function.");
        }
        Nan::Callback callback(info[0].As<v8::Function>());
        v8::Local<v8::Array> resultArray = Nan::New<v8::Array>();

        GVolumeMonitor* monitor = g_volume_monitor_get();
        GList* iter;
        GList *network_mounts;
        GList* mounts; // = g_volume_monitor_get_mounts(monitor);
        GMount *mount, *volume_mount;
        GList* drives;
        GDrive* drive;
        GList* volumes;
        GVolume* volume;
        GFile *root, *volume_root;
        char *type = nullptr, *identifier = nullptr, *path = nullptr, *name = nullptr, *mount_uri = nullptr;
        int c = 0;

        mounts = g_volume_monitor_get_mounts(monitor);
        for (iter = mounts; iter != NULL; iter = iter->next) {

            mount = G_MOUNT(iter->data);
            if (mount != NULL) {

                if (g_mount_is_shadowed (mount)) {
                    continue;
                }

                volume = g_mount_get_volume (mount);

                root = g_mount_get_default_location (mount);
                path = g_file_get_uri (root);
                name = g_mount_get_name(mount);

                // printf("name: %s, uri: %s  \n", name, path);

                v8::Local<v8::Object> dataObj = Nan::New<v8::Object>();
                Nan::Set(dataObj, Nan::New("name").ToLocalChecked(), Nan::New(name).ToLocalChecked());
                Nan::Set(dataObj, Nan::New("path").ToLocalChecked(), Nan::New(path).ToLocalChecked());

                if (volume != NULL) {
                    type = g_volume_get_identifier(volume, G_VOLUME_IDENTIFIER_KIND_CLASS);

                    // volume_mount = g_volume_get_mount(volume);
                    // volume_root = g_mount_get_root(volume_mount);
                    // mount_uri = g_file_get_uri(volume_root);
                    // Nan::Set(dataObj, Nan::New("mount").ToLocalChecked(), Nan::New(mount_uri).ToLocalChecked());

                }
                if (type == NULL) {
                    type = "network";
                }

                Nan::Set(dataObj, Nan::New("type").ToLocalChecked(), Nan::New(type).ToLocalChecked());
                Nan::Set(resultArray, c, dataObj);
                c++;

            }

        }

        g_list_free_full(mounts, g_object_unref);
        g_object_unref(monitor);

        v8::Local<v8::Value> argv[] = { Nan::Null(), resultArray };
        callback.Call(2, argv);

    }

    NAN_METHOD(get_mounts) {

        Nan::HandleScope scope;

        if (info.Length() < 1 || !info[0]->IsFunction()) {
            return Nan::ThrowError("Wrong arguments. Expected callback function.");
        }

        Nan::Callback callback(info[0].As<v8::Function>());

        v8::Local<v8::Array> resultArray = Nan::New<v8::Array>();

        GError *error = NULL;
        GList *mounts, *iter;
        GList *volumes;
        const char* type = nullptr;
        const char* uuid = nullptr;
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

            if (volume != nullptr) {

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
                    printf("root: %s\n", root);
                    g_object_unref(activation_root);
                }

                // uuid = g_volume_get_identifier(volume, G_VOLUME_IDENTIFIER_KIND_UUID);

                v8::Local<v8::Object> deviceObj = Nan::New<v8::Object>();
                Nan::Set(deviceObj, Nan::New("name").ToLocalChecked(), Nan::New(name).ToLocalChecked());
                Nan::Set(deviceObj, Nan::New("path").ToLocalChecked(), Nan::New(path).ToLocalChecked());
                // Nan::Set(deviceObj, Nan::New("root").ToLocalChecked(), Nan::New(root).ToLocalChecked());

                // if (uuid != NULL) {
                //     Nan::Set(deviceObj, Nan::New("uuid").ToLocalChecked(), Nan::New(uuid).ToLocalChecked());
                // }

                // get type of volume
                type = g_volume_get_identifier(volume, G_VOLUME_IDENTIFIER_KIND_CLASS);
                if (type != NULL) {
                    Nan::Set(deviceObj, Nan::New("type").ToLocalChecked(), Nan::New(type).ToLocalChecked());
                }

                Nan::Set(resultArray, c, deviceObj);
                ++c;

                // Store volume name in hashtable
                g_hash_table_insert(mountHash, (gpointer)name, (gpointer)volume);

            }

        }

        // Iterate over mounts
        for (iter = mounts; iter != NULL; iter = iter->next) {

            GMount* mount = G_MOUNT(iter->data);

            if (g_mount_is_shadowed (mount))
                continue;

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
                    path = g_file_get_path(mount_path);
                }

                if (volume != NULL) {
                    GFile *activation_root = g_volume_get_activation_root(volume);
                    uuid = g_volume_get_identifier(volume, G_VOLUME_IDENTIFIER_KIND_UUID);


                    if (activation_root != NULL) {
                        root = g_file_get_path(activation_root);
                    }

                }

                // If uuid and root = "" then assume its a netowrk mount
                if (uuid == "" && root == "") {

                    v8::Local<v8::Object> deviceObj = Nan::New<v8::Object>();
                    Nan::Set(deviceObj, Nan::New("name").ToLocalChecked(), Nan::New(name).ToLocalChecked());
                    Nan::Set(deviceObj, Nan::New("path").ToLocalChecked(), Nan::New(path).ToLocalChecked());
                    Nan::Set(deviceObj, Nan::New("uuid").ToLocalChecked(), Nan::New(uuid).ToLocalChecked());
                    Nan::Set(deviceObj, Nan::New("root").ToLocalChecked(), Nan::New(root).ToLocalChecked());

                    type = g_volume_get_identifier(volume, G_VOLUME_IDENTIFIER_KIND_CLASS);
                    if (type == nullptr) {
                        type = "network";
                    }
                    Nan::Set(deviceObj, Nan::New("type").ToLocalChecked(), Nan::New(type).ToLocalChecked());
                    Nan::Set(resultArray, c, deviceObj);
                    ++c;
                }

            }

        }

        // Free resources
        g_list_free_full(mounts, g_object_unref);
        g_list_free_full(volumes, g_object_unref);
        g_object_unref(monitor);

        // return callback for results
        v8::Local<v8::Value> argv[] = { Nan::Null(), resultArray };
        callback.Call(2, argv);
        // info.GetReturnValue().Set(resultArray);

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

     // Helper function to get event name
    static const char* get_event_name(GFileMonitorEvent event_type) {
        switch (event_type) {
            case G_FILE_MONITOR_EVENT_CHANGED:
                return "changed";
            case G_FILE_MONITOR_EVENT_CHANGES_DONE_HINT:
                return "changes_done_hint";
            case G_FILE_MONITOR_EVENT_DELETED:
                return "deleted";
            case G_FILE_MONITOR_EVENT_CREATED:
                return "created";
            case G_FILE_MONITOR_EVENT_ATTRIBUTE_CHANGED:
                return "attribute_changed";
            case G_FILE_MONITOR_EVENT_PRE_UNMOUNT:
                return "pre_unmount";
            case G_FILE_MONITOR_EVENT_UNMOUNTED:
                return "unmounted";
            case G_FILE_MONITOR_EVENT_MOVED:
                return "moved";
            case G_FILE_MONITOR_EVENT_RENAMED:
                return "renamed";
            case G_FILE_MONITOR_EVENT_MOVED_IN:
                return "moved_in";
            case G_FILE_MONITOR_EVENT_MOVED_OUT:
                return "moved_out";
            default:
                return "unknown";
        }
    }

    // Callback function for file changes
    static void on_file_changed(GFileMonitor* monitor, GFile* file, GFile* other_file, GFileMonitorEvent event_type, gpointer user_data) {

        Nan::Callback* callback = static_cast<Nan::Callback*>(user_data);

        const char* eventName = get_event_name(event_type);
        char* filename = g_file_get_path(file);

        v8::Local<v8::Object> eventObj = Nan::New<v8::Object>();
        Nan::Set(eventObj, Nan::New("event").ToLocalChecked(), Nan::New(eventName).ToLocalChecked());
        Nan::Set(eventObj, Nan::New("filename").ToLocalChecked(), Nan::New(filename).ToLocalChecked());

        g_free(filename);

        const unsigned argc = 1;
        v8::Local<v8::Value> argv[argc] = { eventObj };
        Nan::AsyncResource async("FileWatcher::OnChanged");
        callback->Call(argc, argv, &async);
    }

    // NAN_METHOD(stop_watch) {
    //     if (info.Length() < 1 || !info[0]->IsExternal()) {
    //         return Nan::ThrowTypeError("Invalid arguments. Expected a monitor handle.");
    //     }

    //     GFileMonitor* monitor = static_cast<GFileMonitor*>(info[0].As<v8::External>()->Value());
    //     g_file_monitor_cancel(monitor);
    //     g_object_unref(monitor);

    //     info.GetReturnValue().SetUndefined();
    // }

    void directory_changed(GFileMonitor* monitor, GFile* file, GFile* other_file, GFileMonitorEvent event_type, gpointer user_data) {
        Nan::HandleScope scope;

        // G_FILE_MONITOR_EVENT_CHANGED, 0
        // G_FILE_MONITOR_EVENT_CHANGES_DONE_HINT, 1
        // G_FILE_MONITOR_EVENT_DELETED, 2
        // G_FILE_MONITOR_EVENT_CREATED, 3
        // G_FILE_MONITOR_EVENT_ATTRIBUTE_CHANGED, 4
        // G_FILE_MONITOR_EVENT_PRE_UNMOUNT, 5
        // G_FILE_MONITOR_EVENT_UNMOUNTED, 6
        // G_FILE_MONITOR_EVENT_MOVED, 7
        // G_FILE_MONITOR_EVENT_RENAMED, 8
        // G_FILE_MONITOR_EVENT_MOVED_IN, 9
        // G_FILE_MONITOR_EVENT_MOVED_OUT 10

        const char* eventName = nullptr;
        if (event_type == G_FILE_MONITOR_EVENT_CREATED) {
            eventName = "created";
        } else if (event_type == G_FILE_MONITOR_EVENT_DELETED) {
            eventName = "deleted";
        } else if (event_type == G_FILE_MONITOR_EVENT_RENAMED) {
            eventName = "renamed";
        } else if (event_type == G_FILE_MONITOR_EVENT_MOVED) {
            eventName = "moved";
        } else if (event_type == G_FILE_MONITOR_EVENT_MOVED_IN) {
            eventName = "moved_in";
        } else if (event_type == G_FILE_MONITOR_EVENT_MOVED_OUT) {
            eventName = "moved_out";
        } else if (event_type == G_FILE_MONITOR_EVENT_ATTRIBUTE_CHANGED) {
            eventName = "attribute_changed";
        } else if (event_type == G_FILE_MONITOR_EVENT_CHANGED) {
            eventName = "changed";
        } else if (event_type == G_FILE_MONITOR_EVENT_CHANGES_DONE_HINT) {
            eventName = "changes_done_hint";
        } else if (event_type == G_FILE_MONITOR_EVENT_PRE_UNMOUNT) {
            eventName = "pre_unmount";
        } else if (event_type == G_FILE_MONITOR_EVENT_UNMOUNTED) {
            eventName = "unmounted";
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

    std::vector<std::pair<std::string, GFileMonitor*>> watchers;
    NAN_METHOD(watch) {
        Nan::HandleScope scope;

        if (info.Length() < 2 || !info[0]->IsString() || !info[1]->IsFunction()) {
            Nan::ThrowTypeError("Invalid arguments. Expected a directory path as a string and a watcher object.");
            return;
        }

        v8::Local<v8::String> sourceString = Nan::To<v8::String>(info[0]).ToLocalChecked();
        Nan::Utf8String utf8Str(sourceString);
        std::string watchPath(*utf8Str);

        // Check if we're already watching this directory
        auto it = std::find_if(watchers.begin(), watchers.end(),
                            [&watchPath](const auto& pair) { return pair.first == watchPath; });

        // If we're already watching this directory, cancel the old monitor and remove it from the vector
        if (it != watchers.end()) {
            g_file_monitor_cancel(it->second);
            g_object_unref(it->second);
            watchers.erase(it);
        }

        GFile* src = g_file_new_for_path(watchPath.c_str());
        const char* src_scheme = g_uri_parse_scheme(watchPath.c_str());

        if (src_scheme != NULL) {
            src = g_file_new_for_uri(watchPath.c_str());
        }

        Nan::Callback* callback = new Nan::Callback(info[1].As<v8::Function>());
        GFileMonitor* fileMonitor = g_file_monitor_directory(src,
                                                            G_FILE_MONITOR_NONE,
                                                            NULL,
                                                            NULL);

        if (fileMonitor == NULL) {
            Nan::ThrowError("Failed to create file monitor for the directory.");
            g_object_unref(src);
            return;
        }

        gboolean connectResult = g_signal_connect(fileMonitor,
                                                "changed",
                                                G_CALLBACK(directory_changed),
                                                callback);

        if (connectResult == 0) {
            Nan::ThrowError("Failed to connect to the 'changed' signal.");
            g_object_unref(fileMonitor);
            g_object_unref(src);
            delete callback;
            return;
        }

        // Add the new watcher to the vector
        watchers.emplace_back(watchPath, fileMonitor);


        g_object_unref(src);
        info.GetReturnValue().SetUndefined();
        // info.GetReturnValue().Set(Nan::New<v8::External>(fileMonitor));
    }

    // stop monitoring directory
    NAN_METHOD(stop_watch) {

        if (info.Length() < 1 || !info[0]->IsString()) {
            return Nan::ThrowTypeError("Invalid arguments. Expected a directory path as a string.");
        }

        Nan::Utf8String utf8Str(info[0]);
        std::string watchPath(*utf8Str);

        // Find the monitor for this path
        auto it = std::find_if(watchers.begin(), watchers.end(),
            [&watchPath](const auto& pair) { return pair.first == watchPath; });

        if (it != watchers.end()) {
            // Cancel and unref the monitor
            g_file_monitor_cancel(it->second);
            g_object_unref(it->second);
            // Remove from vector
            watchers.erase(it);
        } else {
            // Optionally, you can throw or just do nothing if not found
            Nan::ThrowError("No monitor found for the specified directory.");
        }

        info.GetReturnValue().SetUndefined();
    }

    // std::vector<std::string> watcher_dir;
    // GFileMonitor* fileMonitor0 = NULL;
    // NAN_METHOD(watch) {

    //     Nan::HandleScope scope;

    //     if (info.Length() < 2 || !info[0]->IsString() || !info[1]->IsFunction()) {
    //         Nan::ThrowTypeError("Invalid arguments. Expected a directory path as a string and a watcher object.");
    //         return;
    //     }

    //     v8::Local<v8::String> sourceString = Nan::To<v8::String>(info[0]).ToLocalChecked();
    //     Nan::Utf8String utf8Str(sourceString);
    //     const char* cstring = *utf8Str;

    //     v8::Isolate* isolate = info.GetIsolate();
    //     v8::Local<v8::Context> context = isolate->GetCurrentContext();
    //     v8::String::Utf8Value sourceFile(context->GetIsolate(), sourceString);

    //     GFile* src = g_file_new_for_path(*sourceFile);
    //     const char *src_scheme = g_uri_parse_scheme(*sourceFile);

    //     if (src_scheme != NULL) {
    //         src = g_file_new_for_uri(*sourceFile);
    //     }

    //     Nan::Callback* callback = new Nan::Callback(info[1].As<v8::Function>());
    //     GFileMonitor* fileMonitor = g_file_monitor_directory(src,
    //                                                         G_FILE_MONITOR_NONE,
    //                                                         NULL,
    //                                                         NULL);

    //     if (fileMonitor0 != NULL) {
    //         g_file_monitor_cancel(fileMonitor0);
    //     }
    //     fileMonitor0 = fileMonitor;

    //     if (fileMonitor == NULL) {
    //         // Nan::ThrowError("Failed to create file monitor for the directory.");
    //         return;
    //     }

    //     gboolean connectResult = g_signal_connect(fileMonitor,
    //                                             "changed",
    //                                             G_CALLBACK(directory_changed),
    //                                             new Nan::Callback(info[1].As<v8::Function>()));

    //     if (connectResult == 0) {
    //         Nan::ThrowError("Failed to connect to the 'changed' signal.");
    //         g_object_unref(fileMonitor);
    //         return;
    //     }

    //     if (src != nullptr) {
    //         g_object_unref(src);
    //     }


    //     info.GetReturnValue().SetUndefined();

    // }

    // This handles mtp connections
    void on_mount_added(GVolumeMonitor* monitor, GMount* mount, gpointer user_data) {
        // Call your Nan module's function here
        Nan::HandleScope scope;
        Nan::Callback* callback = static_cast<Nan::Callback*>(user_data);
        const char* deviceName = g_mount_get_name(mount);
        v8::Local<v8::Value> argv[1] = { Nan::New(deviceName).ToLocalChecked() };
        callback->Call(1, argv);
        // Nan::HandleScope scope;
        // const char* mountName = g_mount_get_name(mount);
        // v8::Local<v8::String> v8MountName = Nan::New<v8::String>(mountName).ToLocalChecked();
        // Nan::Callback* callback = static_cast<Nan::Callback*>(user_data);
        // Nan::TryCatch tryCatch;
        // const unsigned argc = 1;
        // v8::Local<v8::Value> argv[argc] = { v8MountName };
        // callback->Call(argc, argv);
        // if (tryCatch.HasCaught()) {
        //     Nan::FatalException(tryCatch); // Handle the exception if occurred
        // }
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

        if (file_info == NULL) {
            g_object_unref(src);
            info.GetReturnValue().Set(Nan::Null());
            return;
        }


        // if (file_info) {
        //     const gchar *icon_name = g_file_info_get_attribute_string(file_info, G_FILE_ATTRIBUTE_STANDARD_ICON);
        //     g_object_unref(file_info);

        //     // Print the filename of the icon
        //     printf("%s\n", icon_name);

        // }
        GIcon *icon = g_file_info_get_icon(file_info);
        gchar *icon_name = icon ? g_icon_to_string(icon) : NULL;

        if (icon_name != NULL) {
            info.GetReturnValue().Set(Nan::New(icon_name).ToLocalChecked());
            g_free(icon_name);
        } else {
            info.GetReturnValue().Set(Nan::Null());
        }

        g_object_unref(file_info);
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

    class CopyWorker : public Nan::AsyncWorker {

        public:
            CopyWorker(Nan::Callback *callback, const char* sourceFile, const char* destFile)
                : Nan::AsyncWorker(callback), sourceFile(sourceFile), destFile(destFile) {}

            ~CopyWorker() {}

            void Execute() {

                // Nan:: HandleScope scope;

                // if (info.Length() < 2) {
                //     return Nan::ThrowError("Wrong number of arguments");
                // }

                // Nan::Callback* callback = new Nan::Callback(info[2].As<v8::Function>());

                // v8::Local<v8::String> sourceString = Nan::To<v8::String>(info[0]).ToLocalChecked();
                // v8::Local<v8::String> destString = Nan::To<v8::String>(info[1]).ToLocalChecked();

                // v8::Isolate* isolate = info.GetIsolate();
                // v8::String::Utf8Value sourceFile(isolate, sourceString);
                // v8::String::Utf8Value destFile(isolate, destString);

                printf("Source exec: %s\n", sourceFile);
                printf("Destination: %s\n", destFile);

                GFile* src = g_file_new_for_path(sourceFile);
                GFile* dest = g_file_new_for_path(destFile);



                const char *src_scheme = g_uri_parse_scheme(sourceFile);
                const char *dest_scheme = g_uri_parse_scheme(destFile);
                if (src_scheme != NULL) {
                    src = g_file_new_for_uri(sourceFile);
                }
                if (dest_scheme != NULL) {
                    dest = g_file_new_for_uri(destFile);
                }

                GError* error = nullptr;
                GFileInputStream* input_stream = g_file_read(src, nullptr, &error);
                if (error) {
                    // return Nan::ThrowError(error->message);
                }

                GFileOutputStream* output_stream = g_file_replace(dest, nullptr, FALSE, G_FILE_CREATE_NONE, nullptr, &error);
                if (error) {
                    // return Nan::ThrowError(error->message);
                }

                int64_t bytes_read = 0;
                char buffer[4096];

                while ((bytes_read = g_input_stream_read(G_INPUT_STREAM(input_stream), buffer, sizeof(buffer), nullptr, &error)) > 0) {

                    g_output_stream_write(G_OUTPUT_STREAM(output_stream), buffer, bytes_read, nullptr, &error);

                    if (error) {
                        // return Nan::ThrowError(error->message);
                    }

                    printf("Bytes read: %ld\n", bytes_read);

                    v8::Local<v8::Object> resultObj = Nan::New<v8::Object>();
                    Nan::Set(resultObj, Nan::New("bytes_read").ToLocalChecked(), Nan::New<v8::Number>(bytes_read));
                    v8::Local<v8::Value> argv[] = { Nan::Null(), resultObj };
                    callback->Call(2, argv);

                }

                if (error) {
                    // return Nan::ThrowError(error->message);
                }

                g_object_unref(input_stream);
                g_object_unref(output_stream);
                g_object_unref(src);
                g_object_unref(dest);

            }

            void HandleOKCallback() {
                Nan::HandleScope scope;
                v8::Local<v8::Value> argv[] = {
                    Nan::Null(),  // no error
                    Nan::New("File copied successfully").ToLocalChecked()
                };

                callback->Call(2, argv);
            }

        private:
            const char* sourceFile;
            const char* destFile;
    };

    NAN_METHOD(cp_stream) {
        Nan::HandleScope scope;

        if (info.Length() < 2 || !info[0]->IsString() || !info[1]->IsString() || !info[2]->IsFunction()) {
            return Nan::ThrowError("Wrong arguments");
        }

        Nan::Callback* callback = new Nan::Callback(info[2].As<v8::Function>());

        v8::Local<v8::String> sourceString = Nan::To<v8::String>(info[0]).ToLocalChecked();
        v8::Local<v8::String> destString = Nan::To<v8::String>(info[1]).ToLocalChecked();

        v8::Isolate* isolate = info.GetIsolate();
        v8::String::Utf8Value sourceFile(isolate, sourceString);
        v8::String::Utf8Value destFile(isolate, destString);

        printf("Source: %s\n", *sourceFile);
        printf("Destination: %s\n", *destFile);

        Nan::AsyncQueueWorker(new CopyWorker(callback, *sourceFile, *destFile));

        info.GetReturnValue().Set(Nan::Undefined());
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

        if (error) {
            return Nan::ThrowError(error->message);
        }

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

    // // Function to create a ZIP archive
    // void create_zip(const std::string& zip_filename, const std::vector<std::string>& files) {
    //     struct archive *a;
    //     struct archive_entry *entry;
    //     int r;

    //     // Open the archive
    //     a = archive_write_new();

    //     // archive_write_add_filter_zip(a);  // Use ZIP compression
    //     archive_write_set_format_zip(a);  // Set the format to ZIP

    //     // Set the archive file to write to
    //     archive_write_open_filename(a, zip_filename.c_str());

    //     // Add files to the archive
    //     for (const auto& file : files) {
    //         entry = archive_entry_new();
    //         archive_entry_set_pathname(entry, file.c_str());
    //         archive_entry_set_filetype(entry, AE_IFREG);
    //         archive_entry_set_perm(entry, 0644); // Permissions
    //         archive_entry_set_size(entry, file.size()); // Set file size (adjust as needed)

    //         // Write the header for the file entry
    //         archive_write_header(a, entry);

    //         // Write file data
    //         archive_write_data(a, file.data(), file.size());

    //         // Free entry memory
    //         archive_entry_free(entry);
    //     }

    //     // Close the archive
    //     archive_write_close(a);
    //     archive_write_free(a);
    // }

    // // Nan method for createZip function
    // NAN_METHOD(CreateZip) {

    //     if (info.Length() != 2 || !info[0]->IsString() || !info[1]->IsArray()) {
    //         return Nan::ThrowTypeError("Invalid arguments. Expected: (string, array)");
    //     }

    //     // Extract arguments
    //     std::string zip_filename(*Nan::Utf8String(info[0]));
    //     Local<v8::Array> filesArray = Local<v8::Array>::Cast(info[1]);
    //     std::vector<std::string> filenames;

    //     // Convert v8::Array to std::vector<std::string>
    //     uint32_t length = filesArray->Length();
    //     for (uint32_t i = 0; i < length; i++) {
    //         Local<v8::Value> elem = filesArray->Get(Nan::New<v8::Integer>(i));
    //         // v8::String::Utf8Value elemStr(elem);
    //         // std::string filename(*elemStr);
    //         // filenames.push_back(filename);
    //     }

    //     // Call create_zip function
    //     create_zip(zip_filename, filenames);

    //     info.GetReturnValue().Set(Nan::Undefined());
    // }

    NAN_MODULE_INIT(init) {
        Nan::Export(target, "on_theme_change", on_theme_change);
        Nan::Export(target, "is_dir", is_dir);
        Nan::Export(target, "get_icon", icon);
        Nan::Export(target, "set_execute", gio::set_execute);
        Nan::Export(target, "clear_execute", gio::clear_execute);
        Nan::Export(target, "thumbnail", gio::thumbnail);
        Nan::Export(target, "open_with", open_with);
        Nan::Export(target, "du", du);
        Nan::Export(target, "count", count);
        Nan::Export(target, "exists", exists);
        Nan::Export(target, "get_file", gio::get_file);
        Nan::Export(target, "ls", gio::ls);
        Nan::Export(target, "mkdir", gio::mkdir);
        Nan::Export(target, "cp", cp);
        Nan::Export(target, "cp_arr", gio::cp_arr);
        Nan::Export(target, "cp_stream", cp_stream);
        Nan::Export(target, "cp_async", gio::cp_async);
        Nan::Export(target, "cp_cancel", gio::cp_cancel);
        Nan::Export(target, "mv", gio::mv);
        Nan::Export(target, "rm", rm);
        Nan::Export(target, "is_writable", is_writable);
        Nan::Export(target, "monitor", monitor);
        Nan::Export(target, "watch", watch);
        Nan::Export(target, "stop_watch", stop_watch);
        Nan::Export(target, "get_mounts", get_mounts);
        Nan::Export(target, "get_drives", get_drives);
        Nan::Export(target, "connect_network_drive", gio::connect_network_drive);
        Nan::Export(target, "exec", gio::exec);
        Nan::Export(target, "open", gio::open);
    }

    NAN_MODULE_WORKER_ENABLED(gio, init)
    NODE_MODULE(gio, init)


}

