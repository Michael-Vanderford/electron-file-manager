cmd_Release/obj.target/gio/src/gio.o := g++ -o Release/obj.target/gio/src/gio.o ../src/gio.cc '-DNODE_GYP_MODULE_NAME=gio' '-DUSING_UV_SHARED=1' '-DUSING_V8_SHARED=1' '-DV8_DEPRECATION_WARNINGS=1' '-DV8_DEPRECATION_WARNINGS' '-DV8_IMMINENT_DEPRECATION_WARNINGS' '-D_GLIBCXX_USE_CXX11_ABI=1' '-DELECTRON_ENSURE_CONFIG_GYPI' '-D_LARGEFILE_SOURCE' '-D_FILE_OFFSET_BITS=64' '-DUSING_ELECTRON_CONFIG_GYPI' '-DV8_COMPRESS_POINTERS' '-DV8_COMPRESS_POINTERS_IN_SHARED_CAGE' '-DV8_ENABLE_SANDBOX' '-DV8_31BIT_SMIS_ON_64BIT_ARCH' '-D__STDC_FORMAT_MACROS' '-DOPENSSL_NO_PINSHARED' '-DOPENSSL_THREADS' '-DOPENSSL_NO_ASM' '-DNAN_MODULE_WORKER_ENABLED' '-DBUILDING_NODE_EXTENSION' -I/home/michael/.cache/node-gyp/24.1.3/include/node -I/home/michael/.cache/node-gyp/24.1.3/src -I/home/michael/.cache/node-gyp/24.1.3/deps/openssl/config -I/home/michael/.cache/node-gyp/24.1.3/deps/openssl/openssl/include -I/home/michael/.cache/node-gyp/24.1.3/deps/uv/include -I/home/michael/.cache/node-gyp/24.1.3/deps/zlib -I/home/michael/.cache/node-gyp/24.1.3/deps/v8/include -I/usr/include/glib-2.0 -I/usr/include/gdk-pixbuf-2.0 -I../node_modules/nan  -fPIC -pthread -Wall -Wextra -Wno-unused-parameter -m64 -I/usr/include/glib-2.0 -I/usr/lib/x86_64-linux-gnu/glib-2.0/include -lglib-2.0 -O3 -fno-omit-frame-pointer -fno-rtti -fno-exceptions -std=gnu++17 -MMD -MF ./Release/.deps/Release/obj.target/gio/src/gio.o.d.raw   -c
Release/obj.target/gio/src/gio.o: ../src/gio.cc ../node_modules/nan/nan.h \
 /home/michael/.cache/node-gyp/24.1.3/include/node/node_version.h \
 /home/michael/.cache/node-gyp/24.1.3/include/node/uv.h \
 /home/michael/.cache/node-gyp/24.1.3/include/node/uv/errno.h \
 /home/michael/.cache/node-gyp/24.1.3/include/node/uv/version.h \
 /home/michael/.cache/node-gyp/24.1.3/include/node/uv/unix.h \
 /home/michael/.cache/node-gyp/24.1.3/include/node/uv/threadpool.h \
 /home/michael/.cache/node-gyp/24.1.3/include/node/uv/linux.h \
 /home/michael/.cache/node-gyp/24.1.3/include/node/node.h \
 /home/michael/.cache/node-gyp/24.1.3/include/node/v8.h \
 /home/michael/.cache/node-gyp/24.1.3/include/node/cppgc/common.h \
 /home/michael/.cache/node-gyp/24.1.3/include/node/v8config.h \
 /home/michael/.cache/node-gyp/24.1.3/include/node/v8-array-buffer.h \
 /home/michael/.cache/node-gyp/24.1.3/include/node/v8-local-handle.h \
 /home/michael/.cache/node-gyp/24.1.3/include/node/v8-internal.h \
 /home/michael/.cache/node-gyp/24.1.3/include/node/v8-version.h \
 /home/michael/.cache/node-gyp/24.1.3/include/node/v8config.h \
 /home/michael/.cache/node-gyp/24.1.3/include/node/v8-object.h \
 /home/michael/.cache/node-gyp/24.1.3/include/node/v8-maybe.h \
 /home/michael/.cache/node-gyp/24.1.3/include/node/v8-persistent-handle.h \
 /home/michael/.cache/node-gyp/24.1.3/include/node/v8-weak-callback-info.h \
 /home/michael/.cache/node-gyp/24.1.3/include/node/v8-primitive.h \
 /home/michael/.cache/node-gyp/24.1.3/include/node/v8-data.h \
 /home/michael/.cache/node-gyp/24.1.3/include/node/v8-value.h \
 /home/michael/.cache/node-gyp/24.1.3/include/node/v8-traced-handle.h \
 /home/michael/.cache/node-gyp/24.1.3/include/node/v8-container.h \
 /home/michael/.cache/node-gyp/24.1.3/include/node/v8-context.h \
 /home/michael/.cache/node-gyp/24.1.3/include/node/v8-snapshot.h \
 /home/michael/.cache/node-gyp/24.1.3/include/node/v8-date.h \
 /home/michael/.cache/node-gyp/24.1.3/include/node/v8-debug.h \
 /home/michael/.cache/node-gyp/24.1.3/include/node/v8-script.h \
 /home/michael/.cache/node-gyp/24.1.3/include/node/v8-message.h \
 /home/michael/.cache/node-gyp/24.1.3/include/node/v8-exception.h \
 /home/michael/.cache/node-gyp/24.1.3/include/node/v8-extension.h \
 /home/michael/.cache/node-gyp/24.1.3/include/node/v8-external.h \
 /home/michael/.cache/node-gyp/24.1.3/include/node/v8-function.h \
 /home/michael/.cache/node-gyp/24.1.3/include/node/v8-function-callback.h \
 /home/michael/.cache/node-gyp/24.1.3/include/node/v8-template.h \
 /home/michael/.cache/node-gyp/24.1.3/include/node/v8-memory-span.h \
 /home/michael/.cache/node-gyp/24.1.3/include/node/v8-initialization.h \
 /home/michael/.cache/node-gyp/24.1.3/include/node/v8-callbacks.h \
 /home/michael/.cache/node-gyp/24.1.3/include/node/v8-promise.h \
 /home/michael/.cache/node-gyp/24.1.3/include/node/v8-isolate.h \
 /home/michael/.cache/node-gyp/24.1.3/include/node/v8-embedder-heap.h \
 /home/michael/.cache/node-gyp/24.1.3/include/node/v8-microtask.h \
 /home/michael/.cache/node-gyp/24.1.3/include/node/v8-statistics.h \
 /home/michael/.cache/node-gyp/24.1.3/include/node/v8-unwinder.h \
 /home/michael/.cache/node-gyp/24.1.3/include/node/v8-embedder-state-scope.h \
 /home/michael/.cache/node-gyp/24.1.3/include/node/v8-platform.h \
 /home/michael/.cache/node-gyp/24.1.3/include/node/v8-json.h \
 /home/michael/.cache/node-gyp/24.1.3/include/node/v8-locker.h \
 /home/michael/.cache/node-gyp/24.1.3/include/node/v8-microtask-queue.h \
 /home/michael/.cache/node-gyp/24.1.3/include/node/v8-primitive-object.h \
 /home/michael/.cache/node-gyp/24.1.3/include/node/v8-proxy.h \
 /home/michael/.cache/node-gyp/24.1.3/include/node/v8-regexp.h \
 /home/michael/.cache/node-gyp/24.1.3/include/node/v8-typed-array.h \
 /home/michael/.cache/node-gyp/24.1.3/include/node/v8-value-serializer.h \
 /home/michael/.cache/node-gyp/24.1.3/include/node/v8-wasm.h \
 /home/michael/.cache/node-gyp/24.1.3/include/node/node_version.h \
 /home/michael/.cache/node-gyp/24.1.3/include/node/node_buffer.h \
 /home/michael/.cache/node-gyp/24.1.3/include/node/node.h \
 /home/michael/.cache/node-gyp/24.1.3/include/node/node_object_wrap.h \
 ../node_modules/nan/nan_callbacks.h \
 ../node_modules/nan/nan_callbacks_12_inl.h \
 ../node_modules/nan/nan_maybe_43_inl.h \
 ../node_modules/nan/nan_converters.h \
 ../node_modules/nan/nan_converters_43_inl.h \
 ../node_modules/nan/nan_new.h \
 ../node_modules/nan/nan_implementation_12_inl.h \
 ../node_modules/nan/nan_persistent_12_inl.h \
 ../node_modules/nan/nan_weak.h ../node_modules/nan/nan_object_wrap.h \
 ../node_modules/nan/nan_private.h \
 ../node_modules/nan/nan_typedarray_contents.h \
 ../node_modules/nan/nan_json.h ../node_modules/nan/nan_scriptorigin.h \
 /home/michael/.cache/node-gyp/24.1.3/include/node/node_api.h \
 /home/michael/.cache/node-gyp/24.1.3/include/node/js_native_api.h \
 /home/michael/.cache/node-gyp/24.1.3/include/node/js_native_api_types.h \
 /home/michael/.cache/node-gyp/24.1.3/include/node/node_api_types.h \
 /usr/include/glib-2.0/gio/gio.h /usr/include/glib-2.0/gio/giotypes.h \
 /usr/include/glib-2.0/gio/gioenums.h /usr/include/glib-2.0/glib-object.h \
 /usr/include/glib-2.0/gobject/gbinding.h /usr/include/glib-2.0/glib.h \
 /usr/include/glib-2.0/glib/galloca.h /usr/include/glib-2.0/glib/gtypes.h \
 /usr/lib/x86_64-linux-gnu/glib-2.0/include/glibconfig.h \
 /usr/include/glib-2.0/glib/gmacros.h \
 /usr/include/glib-2.0/glib/gversionmacros.h \
 /usr/include/glib-2.0/glib/glib-visibility.h \
 /usr/include/glib-2.0/glib/garray.h \
 /usr/include/glib-2.0/glib/gasyncqueue.h \
 /usr/include/glib-2.0/glib/gthread.h \
 /usr/include/glib-2.0/glib/gatomic.h \
 /usr/include/glib-2.0/glib/glib-typeof.h \
 /usr/include/glib-2.0/glib/gerror.h /usr/include/glib-2.0/glib/gquark.h \
 /usr/include/glib-2.0/glib/gutils.h \
 /usr/include/glib-2.0/glib/gbacktrace.h \
 /usr/include/glib-2.0/glib/gbase64.h \
 /usr/include/glib-2.0/glib/gbitlock.h \
 /usr/include/glib-2.0/glib/gbookmarkfile.h \
 /usr/include/glib-2.0/glib/gdatetime.h \
 /usr/include/glib-2.0/glib/gtimezone.h \
 /usr/include/glib-2.0/glib/gbytes.h \
 /usr/include/glib-2.0/glib/gcharset.h \
 /usr/include/glib-2.0/glib/gchecksum.h \
 /usr/include/glib-2.0/glib/gconvert.h \
 /usr/include/glib-2.0/glib/gdataset.h /usr/include/glib-2.0/glib/gdate.h \
 /usr/include/glib-2.0/glib/gdir.h /usr/include/glib-2.0/glib/genviron.h \
 /usr/include/glib-2.0/glib/gfileutils.h \
 /usr/include/glib-2.0/glib/ggettext.h /usr/include/glib-2.0/glib/ghash.h \
 /usr/include/glib-2.0/glib/glist.h /usr/include/glib-2.0/glib/gmem.h \
 /usr/include/glib-2.0/glib/gnode.h /usr/include/glib-2.0/glib/ghmac.h \
 /usr/include/glib-2.0/glib/gchecksum.h \
 /usr/include/glib-2.0/glib/ghook.h \
 /usr/include/glib-2.0/glib/ghostutils.h \
 /usr/include/glib-2.0/glib/giochannel.h \
 /usr/include/glib-2.0/glib/gmain.h /usr/include/glib-2.0/glib/gpoll.h \
 /usr/include/glib-2.0/glib/gslist.h /usr/include/glib-2.0/glib/gstring.h \
 /usr/include/glib-2.0/glib/gunicode.h \
 /usr/include/glib-2.0/glib/gstrfuncs.h \
 /usr/include/glib-2.0/glib/gkeyfile.h \
 /usr/include/glib-2.0/glib/gmappedfile.h \
 /usr/include/glib-2.0/glib/gmarkup.h \
 /usr/include/glib-2.0/glib/gmessages.h \
 /usr/include/glib-2.0/glib/gvariant.h \
 /usr/include/glib-2.0/glib/gvarianttype.h \
 /usr/include/glib-2.0/glib/goption.h \
 /usr/include/glib-2.0/glib/gpathbuf.h \
 /usr/include/glib-2.0/glib/gpattern.h \
 /usr/include/glib-2.0/glib/gprimes.h /usr/include/glib-2.0/glib/gqsort.h \
 /usr/include/glib-2.0/glib/gqueue.h /usr/include/glib-2.0/glib/grand.h \
 /usr/include/glib-2.0/glib/grcbox.h \
 /usr/include/glib-2.0/glib/grefcount.h \
 /usr/include/glib-2.0/glib/grefstring.h \
 /usr/include/glib-2.0/glib/gmem.h /usr/include/glib-2.0/glib/gmacros.h \
 /usr/include/glib-2.0/glib/gregex.h \
 /usr/include/glib-2.0/glib/gscanner.h \
 /usr/include/glib-2.0/glib/gsequence.h \
 /usr/include/glib-2.0/glib/gshell.h /usr/include/glib-2.0/glib/gslice.h \
 /usr/include/glib-2.0/glib/gspawn.h \
 /usr/include/glib-2.0/glib/gstringchunk.h \
 /usr/include/glib-2.0/glib/gstrvbuilder.h \
 /usr/include/glib-2.0/glib/gtestutils.h \
 /usr/include/glib-2.0/glib/gthreadpool.h \
 /usr/include/glib-2.0/glib/gtimer.h \
 /usr/include/glib-2.0/glib/gtrashstack.h \
 /usr/include/glib-2.0/glib/gtree.h /usr/include/glib-2.0/glib/guri.h \
 /usr/include/glib-2.0/glib/guuid.h /usr/include/glib-2.0/glib/gversion.h \
 /usr/include/glib-2.0/glib/deprecated/gallocator.h \
 /usr/include/glib-2.0/glib/deprecated/gcache.h \
 /usr/include/glib-2.0/glib/deprecated/gcompletion.h \
 /usr/include/glib-2.0/glib/deprecated/gmain.h \
 /usr/include/glib-2.0/glib/deprecated/grel.h \
 /usr/include/glib-2.0/glib/deprecated/gthread.h \
 /usr/include/glib-2.0/glib/glib-autocleanups.h \
 /usr/include/glib-2.0/gobject/gobject.h \
 /usr/include/glib-2.0/gobject/gtype.h \
 /usr/include/glib-2.0/gobject/gobject-visibility.h \
 /usr/include/glib-2.0/gobject/gvalue.h \
 /usr/include/glib-2.0/gobject/gparam.h \
 /usr/include/glib-2.0/gobject/gclosure.h \
 /usr/include/glib-2.0/gobject/gsignal.h \
 /usr/include/glib-2.0/gobject/gmarshal.h \
 /usr/include/glib-2.0/gobject/gboxed.h \
 /usr/include/glib-2.0/gobject/glib-types.h \
 /usr/include/glib-2.0/gobject/gbindinggroup.h \
 /usr/include/glib-2.0/gobject/genums.h \
 /usr/include/glib-2.0/gobject/glib-enumtypes.h \
 /usr/include/glib-2.0/gobject/gparamspecs.h \
 /usr/include/glib-2.0/gobject/gsignalgroup.h \
 /usr/include/glib-2.0/gobject/gsourceclosure.h \
 /usr/include/glib-2.0/gobject/gtypemodule.h \
 /usr/include/glib-2.0/gobject/gtypeplugin.h \
 /usr/include/glib-2.0/gobject/gvaluearray.h \
 /usr/include/glib-2.0/gobject/gvaluetypes.h \
 /usr/include/glib-2.0/gobject/gobject-autocleanups.h \
 /usr/include/glib-2.0/gio/gio-visibility.h \
 /usr/include/glib-2.0/gio/gaction.h \
 /usr/include/glib-2.0/gio/gactiongroup.h \
 /usr/include/glib-2.0/gio/gactiongroupexporter.h \
 /usr/include/glib-2.0/gio/gactionmap.h \
 /usr/include/glib-2.0/gio/gappinfo.h \
 /usr/include/glib-2.0/gio/gapplication.h \
 /usr/include/glib-2.0/gio/gapplicationcommandline.h \
 /usr/include/glib-2.0/gio/gasyncinitable.h \
 /usr/include/glib-2.0/gio/ginitable.h \
 /usr/include/glib-2.0/gio/gasyncresult.h \
 /usr/include/glib-2.0/gio/gbufferedinputstream.h \
 /usr/include/glib-2.0/gio/gfilterinputstream.h \
 /usr/include/glib-2.0/gio/ginputstream.h \
 /usr/include/glib-2.0/gio/gbufferedoutputstream.h \
 /usr/include/glib-2.0/gio/gfilteroutputstream.h \
 /usr/include/glib-2.0/gio/goutputstream.h \
 /usr/include/glib-2.0/gio/gbytesicon.h \
 /usr/include/glib-2.0/gio/gcancellable.h \
 /usr/include/glib-2.0/gio/gcharsetconverter.h \
 /usr/include/glib-2.0/gio/gconverter.h \
 /usr/include/glib-2.0/gio/gcontenttype.h \
 /usr/include/glib-2.0/gio/gconverterinputstream.h \
 /usr/include/glib-2.0/gio/gconverteroutputstream.h \
 /usr/include/glib-2.0/gio/gcredentials.h \
 /usr/include/glib-2.0/gio/gdatagrambased.h \
 /usr/include/glib-2.0/gio/gdatainputstream.h \
 /usr/include/glib-2.0/gio/gdataoutputstream.h \
 /usr/include/glib-2.0/gio/gdbusactiongroup.h \
 /usr/include/glib-2.0/gio/giotypes.h \
 /usr/include/glib-2.0/gio/gdbusaddress.h \
 /usr/include/glib-2.0/gio/gdbusauthobserver.h \
 /usr/include/glib-2.0/gio/gdbusconnection.h \
 /usr/include/glib-2.0/gio/gdbuserror.h \
 /usr/include/glib-2.0/gio/gdbusinterface.h \
 /usr/include/glib-2.0/gio/gdbusinterfaceskeleton.h \
 /usr/include/glib-2.0/gio/gdbusintrospection.h \
 /usr/include/glib-2.0/gio/gdbusmenumodel.h \
 /usr/include/glib-2.0/gio/gdbusmessage.h \
 /usr/include/glib-2.0/gio/gdbusmethodinvocation.h \
 /usr/include/glib-2.0/gio/gdbusnameowning.h \
 /usr/include/glib-2.0/gio/gdbusnamewatching.h \
 /usr/include/glib-2.0/gio/gdbusobject.h \
 /usr/include/glib-2.0/gio/gdbusobjectmanager.h \
 /usr/include/glib-2.0/gio/gdbusobjectmanagerclient.h \
 /usr/include/glib-2.0/gio/gdbusobjectmanagerserver.h \
 /usr/include/glib-2.0/gio/gdbusobjectproxy.h \
 /usr/include/glib-2.0/gio/gdbusobjectskeleton.h \
 /usr/include/glib-2.0/gio/gdbusproxy.h \
 /usr/include/glib-2.0/gio/gdbusserver.h \
 /usr/include/glib-2.0/gio/gdbusutils.h \
 /usr/include/glib-2.0/gio/gdebugcontroller.h \
 /usr/include/glib-2.0/gio/gdebugcontrollerdbus.h \
 /usr/include/glib-2.0/gio/gdrive.h \
 /usr/include/glib-2.0/gio/gdtlsclientconnection.h \
 /usr/include/glib-2.0/gio/gdtlsconnection.h \
 /usr/include/glib-2.0/gio/gdtlsserverconnection.h \
 /usr/include/glib-2.0/gio/gemblemedicon.h \
 /usr/include/glib-2.0/gio/gicon.h /usr/include/glib-2.0/gio/gemblem.h \
 /usr/include/glib-2.0/gio/gfile.h \
 /usr/include/glib-2.0/gio/gfileattribute.h \
 /usr/include/glib-2.0/gio/gfileenumerator.h \
 /usr/include/glib-2.0/gio/gfileicon.h \
 /usr/include/glib-2.0/gio/gfileinfo.h \
 /usr/include/glib-2.0/gio/gfileinputstream.h \
 /usr/include/glib-2.0/gio/gfileiostream.h \
 /usr/include/glib-2.0/gio/giostream.h \
 /usr/include/glib-2.0/gio/gioerror.h \
 /usr/include/glib-2.0/gio/gfilemonitor.h \
 /usr/include/glib-2.0/gio/gfilenamecompleter.h \
 /usr/include/glib-2.0/gio/gfileoutputstream.h \
 /usr/include/glib-2.0/gio/ginetaddress.h \
 /usr/include/glib-2.0/gio/ginetaddressmask.h \
 /usr/include/glib-2.0/gio/ginetsocketaddress.h \
 /usr/include/glib-2.0/gio/gsocketaddress.h \
 /usr/include/glib-2.0/gio/gioenumtypes.h \
 /usr/include/glib-2.0/gio/giomodule.h /usr/include/glib-2.0/gmodule.h \
 /usr/include/glib-2.0/gmodule/gmodule-visibility.h \
 /usr/include/glib-2.0/gio/gioscheduler.h \
 /usr/include/glib-2.0/gio/glistmodel.h \
 /usr/include/glib-2.0/gio/gliststore.h \
 /usr/include/glib-2.0/gio/gloadableicon.h \
 /usr/include/glib-2.0/gio/gmemoryinputstream.h \
 /usr/include/glib-2.0/gio/gmemorymonitor.h \
 /usr/include/glib-2.0/gio/gmemoryoutputstream.h \
 /usr/include/glib-2.0/gio/gmenu.h /usr/include/glib-2.0/gio/gmenumodel.h \
 /usr/include/glib-2.0/gio/gmenuexporter.h \
 /usr/include/glib-2.0/gio/gmount.h \
 /usr/include/glib-2.0/gio/gmountoperation.h \
 /usr/include/glib-2.0/gio/gnativesocketaddress.h \
 /usr/include/glib-2.0/gio/gnativevolumemonitor.h \
 /usr/include/glib-2.0/gio/gvolumemonitor.h \
 /usr/include/glib-2.0/gio/gnetworkaddress.h \
 /usr/include/glib-2.0/gio/gnetworkmonitor.h \
 /usr/include/glib-2.0/gio/gnetworkservice.h \
 /usr/include/glib-2.0/gio/gnotification.h \
 /usr/include/glib-2.0/gio/gpermission.h \
 /usr/include/glib-2.0/gio/gpollableinputstream.h \
 /usr/include/glib-2.0/gio/gpollableoutputstream.h \
 /usr/include/glib-2.0/gio/gpollableutils.h \
 /usr/include/glib-2.0/gio/gpowerprofilemonitor.h \
 /usr/include/glib-2.0/gio/gpropertyaction.h \
 /usr/include/glib-2.0/gio/gproxy.h \
 /usr/include/glib-2.0/gio/gproxyaddress.h \
 /usr/include/glib-2.0/gio/gproxyaddressenumerator.h \
 /usr/include/glib-2.0/gio/gsocketaddressenumerator.h \
 /usr/include/glib-2.0/gio/gproxyresolver.h \
 /usr/include/glib-2.0/gio/gremoteactiongroup.h \
 /usr/include/glib-2.0/gio/gresolver.h \
 /usr/include/glib-2.0/gio/gresource.h \
 /usr/include/glib-2.0/gio/gseekable.h \
 /usr/include/glib-2.0/gio/gsettings.h \
 /usr/include/glib-2.0/gio/gsettingsschema.h \
 /usr/include/glib-2.0/gio/gsimpleaction.h \
 /usr/include/glib-2.0/gio/gsimpleactiongroup.h \
 /usr/include/glib-2.0/gio/gactiongroup.h \
 /usr/include/glib-2.0/gio/gactionmap.h \
 /usr/include/glib-2.0/gio/gsimpleasyncresult.h \
 /usr/include/glib-2.0/gio/gsimpleiostream.h \
 /usr/include/glib-2.0/gio/gsimplepermission.h \
 /usr/include/glib-2.0/gio/gsimpleproxyresolver.h \
 /usr/include/glib-2.0/gio/gsocket.h \
 /usr/include/glib-2.0/gio/gsocketclient.h \
 /usr/include/glib-2.0/gio/gsocketconnectable.h \
 /usr/include/glib-2.0/gio/gsocketconnection.h \
 /usr/include/glib-2.0/gio/gsocketcontrolmessage.h \
 /usr/include/glib-2.0/gio/gsocketlistener.h \
 /usr/include/glib-2.0/gio/gsocketservice.h \
 /usr/include/glib-2.0/gio/gsrvtarget.h \
 /usr/include/glib-2.0/gio/gsubprocess.h \
 /usr/include/glib-2.0/gio/gsubprocesslauncher.h \
 /usr/include/glib-2.0/gio/gtask.h \
 /usr/include/glib-2.0/gio/gtcpconnection.h \
 /usr/include/glib-2.0/gio/gtcpwrapperconnection.h \
 /usr/include/glib-2.0/gio/gtestdbus.h \
 /usr/include/glib-2.0/gio/gthemedicon.h \
 /usr/include/glib-2.0/gio/gthreadedsocketservice.h \
 /usr/include/glib-2.0/gio/gtlsbackend.h \
 /usr/include/glib-2.0/gio/gtlscertificate.h \
 /usr/include/glib-2.0/gio/gtlsclientconnection.h \
 /usr/include/glib-2.0/gio/gtlsconnection.h \
 /usr/include/glib-2.0/gio/gtlsdatabase.h \
 /usr/include/glib-2.0/gio/gtlsfiledatabase.h \
 /usr/include/glib-2.0/gio/gtlsinteraction.h \
 /usr/include/glib-2.0/gio/gtlspassword.h \
 /usr/include/glib-2.0/gio/gtlsserverconnection.h \
 /usr/include/glib-2.0/gio/gunixconnection.h \
 /usr/include/glib-2.0/gio/gunixcredentialsmessage.h \
 /usr/include/glib-2.0/gio/gunixfdlist.h \
 /usr/include/glib-2.0/gio/gunixsocketaddress.h \
 /usr/include/glib-2.0/gio/gvfs.h /usr/include/glib-2.0/gio/gvolume.h \
 /usr/include/glib-2.0/gio/gzlibcompressor.h \
 /usr/include/glib-2.0/gio/gzlibdecompressor.h \
 /usr/include/glib-2.0/gio/gio-autocleanups.h \
 /usr/include/gdk-pixbuf-2.0/gdk-pixbuf/gdk-pixbuf.h \
 /usr/include/gdk-pixbuf-2.0/gdk-pixbuf/gdk-pixbuf-macros.h \
 /usr/include/gdk-pixbuf-2.0/gdk-pixbuf/gdk-pixbuf-features.h \
 /usr/include/gdk-pixbuf-2.0/gdk-pixbuf/gdk-pixbuf-core.h \
 /usr/include/gdk-pixbuf-2.0/gdk-pixbuf/gdk-pixbuf-transform.h \
 /usr/include/gdk-pixbuf-2.0/gdk-pixbuf/gdk-pixbuf-animation.h \
 /usr/include/gdk-pixbuf-2.0/gdk-pixbuf/gdk-pixbuf-simple-anim.h \
 /usr/include/gdk-pixbuf-2.0/gdk-pixbuf/gdk-pixbuf-io.h \
 /usr/include/gdk-pixbuf-2.0/gdk-pixbuf/gdk-pixbuf-loader.h \
 /usr/include/gdk-pixbuf-2.0/gdk-pixbuf/gdk-pixbuf-enum-types.h \
 /usr/include/gdk-pixbuf-2.0/gdk-pixbuf/gdk-pixbuf-autocleanups.h
../src/gio.cc:
../node_modules/nan/nan.h:
/home/michael/.cache/node-gyp/24.1.3/include/node/node_version.h:
/home/michael/.cache/node-gyp/24.1.3/include/node/uv.h:
/home/michael/.cache/node-gyp/24.1.3/include/node/uv/errno.h:
/home/michael/.cache/node-gyp/24.1.3/include/node/uv/version.h:
/home/michael/.cache/node-gyp/24.1.3/include/node/uv/unix.h:
/home/michael/.cache/node-gyp/24.1.3/include/node/uv/threadpool.h:
/home/michael/.cache/node-gyp/24.1.3/include/node/uv/linux.h:
/home/michael/.cache/node-gyp/24.1.3/include/node/node.h:
/home/michael/.cache/node-gyp/24.1.3/include/node/v8.h:
/home/michael/.cache/node-gyp/24.1.3/include/node/cppgc/common.h:
/home/michael/.cache/node-gyp/24.1.3/include/node/v8config.h:
/home/michael/.cache/node-gyp/24.1.3/include/node/v8-array-buffer.h:
/home/michael/.cache/node-gyp/24.1.3/include/node/v8-local-handle.h:
/home/michael/.cache/node-gyp/24.1.3/include/node/v8-internal.h:
/home/michael/.cache/node-gyp/24.1.3/include/node/v8-version.h:
/home/michael/.cache/node-gyp/24.1.3/include/node/v8config.h:
/home/michael/.cache/node-gyp/24.1.3/include/node/v8-object.h:
/home/michael/.cache/node-gyp/24.1.3/include/node/v8-maybe.h:
/home/michael/.cache/node-gyp/24.1.3/include/node/v8-persistent-handle.h:
/home/michael/.cache/node-gyp/24.1.3/include/node/v8-weak-callback-info.h:
/home/michael/.cache/node-gyp/24.1.3/include/node/v8-primitive.h:
/home/michael/.cache/node-gyp/24.1.3/include/node/v8-data.h:
/home/michael/.cache/node-gyp/24.1.3/include/node/v8-value.h:
/home/michael/.cache/node-gyp/24.1.3/include/node/v8-traced-handle.h:
/home/michael/.cache/node-gyp/24.1.3/include/node/v8-container.h:
/home/michael/.cache/node-gyp/24.1.3/include/node/v8-context.h:
/home/michael/.cache/node-gyp/24.1.3/include/node/v8-snapshot.h:
/home/michael/.cache/node-gyp/24.1.3/include/node/v8-date.h:
/home/michael/.cache/node-gyp/24.1.3/include/node/v8-debug.h:
/home/michael/.cache/node-gyp/24.1.3/include/node/v8-script.h:
/home/michael/.cache/node-gyp/24.1.3/include/node/v8-message.h:
/home/michael/.cache/node-gyp/24.1.3/include/node/v8-exception.h:
/home/michael/.cache/node-gyp/24.1.3/include/node/v8-extension.h:
/home/michael/.cache/node-gyp/24.1.3/include/node/v8-external.h:
/home/michael/.cache/node-gyp/24.1.3/include/node/v8-function.h:
/home/michael/.cache/node-gyp/24.1.3/include/node/v8-function-callback.h:
/home/michael/.cache/node-gyp/24.1.3/include/node/v8-template.h:
/home/michael/.cache/node-gyp/24.1.3/include/node/v8-memory-span.h:
/home/michael/.cache/node-gyp/24.1.3/include/node/v8-initialization.h:
/home/michael/.cache/node-gyp/24.1.3/include/node/v8-callbacks.h:
/home/michael/.cache/node-gyp/24.1.3/include/node/v8-promise.h:
/home/michael/.cache/node-gyp/24.1.3/include/node/v8-isolate.h:
/home/michael/.cache/node-gyp/24.1.3/include/node/v8-embedder-heap.h:
/home/michael/.cache/node-gyp/24.1.3/include/node/v8-microtask.h:
/home/michael/.cache/node-gyp/24.1.3/include/node/v8-statistics.h:
/home/michael/.cache/node-gyp/24.1.3/include/node/v8-unwinder.h:
/home/michael/.cache/node-gyp/24.1.3/include/node/v8-embedder-state-scope.h:
/home/michael/.cache/node-gyp/24.1.3/include/node/v8-platform.h:
/home/michael/.cache/node-gyp/24.1.3/include/node/v8-json.h:
/home/michael/.cache/node-gyp/24.1.3/include/node/v8-locker.h:
/home/michael/.cache/node-gyp/24.1.3/include/node/v8-microtask-queue.h:
/home/michael/.cache/node-gyp/24.1.3/include/node/v8-primitive-object.h:
/home/michael/.cache/node-gyp/24.1.3/include/node/v8-proxy.h:
/home/michael/.cache/node-gyp/24.1.3/include/node/v8-regexp.h:
/home/michael/.cache/node-gyp/24.1.3/include/node/v8-typed-array.h:
/home/michael/.cache/node-gyp/24.1.3/include/node/v8-value-serializer.h:
/home/michael/.cache/node-gyp/24.1.3/include/node/v8-wasm.h:
/home/michael/.cache/node-gyp/24.1.3/include/node/node_version.h:
/home/michael/.cache/node-gyp/24.1.3/include/node/node_buffer.h:
/home/michael/.cache/node-gyp/24.1.3/include/node/node.h:
/home/michael/.cache/node-gyp/24.1.3/include/node/node_object_wrap.h:
../node_modules/nan/nan_callbacks.h:
../node_modules/nan/nan_callbacks_12_inl.h:
../node_modules/nan/nan_maybe_43_inl.h:
../node_modules/nan/nan_converters.h:
../node_modules/nan/nan_converters_43_inl.h:
../node_modules/nan/nan_new.h:
../node_modules/nan/nan_implementation_12_inl.h:
../node_modules/nan/nan_persistent_12_inl.h:
../node_modules/nan/nan_weak.h:
../node_modules/nan/nan_object_wrap.h:
../node_modules/nan/nan_private.h:
../node_modules/nan/nan_typedarray_contents.h:
../node_modules/nan/nan_json.h:
../node_modules/nan/nan_scriptorigin.h:
/home/michael/.cache/node-gyp/24.1.3/include/node/node_api.h:
/home/michael/.cache/node-gyp/24.1.3/include/node/js_native_api.h:
/home/michael/.cache/node-gyp/24.1.3/include/node/js_native_api_types.h:
/home/michael/.cache/node-gyp/24.1.3/include/node/node_api_types.h:
/usr/include/glib-2.0/gio/gio.h:
/usr/include/glib-2.0/gio/giotypes.h:
/usr/include/glib-2.0/gio/gioenums.h:
/usr/include/glib-2.0/glib-object.h:
/usr/include/glib-2.0/gobject/gbinding.h:
/usr/include/glib-2.0/glib.h:
/usr/include/glib-2.0/glib/galloca.h:
/usr/include/glib-2.0/glib/gtypes.h:
/usr/lib/x86_64-linux-gnu/glib-2.0/include/glibconfig.h:
/usr/include/glib-2.0/glib/gmacros.h:
/usr/include/glib-2.0/glib/gversionmacros.h:
/usr/include/glib-2.0/glib/glib-visibility.h:
/usr/include/glib-2.0/glib/garray.h:
/usr/include/glib-2.0/glib/gasyncqueue.h:
/usr/include/glib-2.0/glib/gthread.h:
/usr/include/glib-2.0/glib/gatomic.h:
/usr/include/glib-2.0/glib/glib-typeof.h:
/usr/include/glib-2.0/glib/gerror.h:
/usr/include/glib-2.0/glib/gquark.h:
/usr/include/glib-2.0/glib/gutils.h:
/usr/include/glib-2.0/glib/gbacktrace.h:
/usr/include/glib-2.0/glib/gbase64.h:
/usr/include/glib-2.0/glib/gbitlock.h:
/usr/include/glib-2.0/glib/gbookmarkfile.h:
/usr/include/glib-2.0/glib/gdatetime.h:
/usr/include/glib-2.0/glib/gtimezone.h:
/usr/include/glib-2.0/glib/gbytes.h:
/usr/include/glib-2.0/glib/gcharset.h:
/usr/include/glib-2.0/glib/gchecksum.h:
/usr/include/glib-2.0/glib/gconvert.h:
/usr/include/glib-2.0/glib/gdataset.h:
/usr/include/glib-2.0/glib/gdate.h:
/usr/include/glib-2.0/glib/gdir.h:
/usr/include/glib-2.0/glib/genviron.h:
/usr/include/glib-2.0/glib/gfileutils.h:
/usr/include/glib-2.0/glib/ggettext.h:
/usr/include/glib-2.0/glib/ghash.h:
/usr/include/glib-2.0/glib/glist.h:
/usr/include/glib-2.0/glib/gmem.h:
/usr/include/glib-2.0/glib/gnode.h:
/usr/include/glib-2.0/glib/ghmac.h:
/usr/include/glib-2.0/glib/gchecksum.h:
/usr/include/glib-2.0/glib/ghook.h:
/usr/include/glib-2.0/glib/ghostutils.h:
/usr/include/glib-2.0/glib/giochannel.h:
/usr/include/glib-2.0/glib/gmain.h:
/usr/include/glib-2.0/glib/gpoll.h:
/usr/include/glib-2.0/glib/gslist.h:
/usr/include/glib-2.0/glib/gstring.h:
/usr/include/glib-2.0/glib/gunicode.h:
/usr/include/glib-2.0/glib/gstrfuncs.h:
/usr/include/glib-2.0/glib/gkeyfile.h:
/usr/include/glib-2.0/glib/gmappedfile.h:
/usr/include/glib-2.0/glib/gmarkup.h:
/usr/include/glib-2.0/glib/gmessages.h:
/usr/include/glib-2.0/glib/gvariant.h:
/usr/include/glib-2.0/glib/gvarianttype.h:
/usr/include/glib-2.0/glib/goption.h:
/usr/include/glib-2.0/glib/gpathbuf.h:
/usr/include/glib-2.0/glib/gpattern.h:
/usr/include/glib-2.0/glib/gprimes.h:
/usr/include/glib-2.0/glib/gqsort.h:
/usr/include/glib-2.0/glib/gqueue.h:
/usr/include/glib-2.0/glib/grand.h:
/usr/include/glib-2.0/glib/grcbox.h:
/usr/include/glib-2.0/glib/grefcount.h:
/usr/include/glib-2.0/glib/grefstring.h:
/usr/include/glib-2.0/glib/gmem.h:
/usr/include/glib-2.0/glib/gmacros.h:
/usr/include/glib-2.0/glib/gregex.h:
/usr/include/glib-2.0/glib/gscanner.h:
/usr/include/glib-2.0/glib/gsequence.h:
/usr/include/glib-2.0/glib/gshell.h:
/usr/include/glib-2.0/glib/gslice.h:
/usr/include/glib-2.0/glib/gspawn.h:
/usr/include/glib-2.0/glib/gstringchunk.h:
/usr/include/glib-2.0/glib/gstrvbuilder.h:
/usr/include/glib-2.0/glib/gtestutils.h:
/usr/include/glib-2.0/glib/gthreadpool.h:
/usr/include/glib-2.0/glib/gtimer.h:
/usr/include/glib-2.0/glib/gtrashstack.h:
/usr/include/glib-2.0/glib/gtree.h:
/usr/include/glib-2.0/glib/guri.h:
/usr/include/glib-2.0/glib/guuid.h:
/usr/include/glib-2.0/glib/gversion.h:
/usr/include/glib-2.0/glib/deprecated/gallocator.h:
/usr/include/glib-2.0/glib/deprecated/gcache.h:
/usr/include/glib-2.0/glib/deprecated/gcompletion.h:
/usr/include/glib-2.0/glib/deprecated/gmain.h:
/usr/include/glib-2.0/glib/deprecated/grel.h:
/usr/include/glib-2.0/glib/deprecated/gthread.h:
/usr/include/glib-2.0/glib/glib-autocleanups.h:
/usr/include/glib-2.0/gobject/gobject.h:
/usr/include/glib-2.0/gobject/gtype.h:
/usr/include/glib-2.0/gobject/gobject-visibility.h:
/usr/include/glib-2.0/gobject/gvalue.h:
/usr/include/glib-2.0/gobject/gparam.h:
/usr/include/glib-2.0/gobject/gclosure.h:
/usr/include/glib-2.0/gobject/gsignal.h:
/usr/include/glib-2.0/gobject/gmarshal.h:
/usr/include/glib-2.0/gobject/gboxed.h:
/usr/include/glib-2.0/gobject/glib-types.h:
/usr/include/glib-2.0/gobject/gbindinggroup.h:
/usr/include/glib-2.0/gobject/genums.h:
/usr/include/glib-2.0/gobject/glib-enumtypes.h:
/usr/include/glib-2.0/gobject/gparamspecs.h:
/usr/include/glib-2.0/gobject/gsignalgroup.h:
/usr/include/glib-2.0/gobject/gsourceclosure.h:
/usr/include/glib-2.0/gobject/gtypemodule.h:
/usr/include/glib-2.0/gobject/gtypeplugin.h:
/usr/include/glib-2.0/gobject/gvaluearray.h:
/usr/include/glib-2.0/gobject/gvaluetypes.h:
/usr/include/glib-2.0/gobject/gobject-autocleanups.h:
/usr/include/glib-2.0/gio/gio-visibility.h:
/usr/include/glib-2.0/gio/gaction.h:
/usr/include/glib-2.0/gio/gactiongroup.h:
/usr/include/glib-2.0/gio/gactiongroupexporter.h:
/usr/include/glib-2.0/gio/gactionmap.h:
/usr/include/glib-2.0/gio/gappinfo.h:
/usr/include/glib-2.0/gio/gapplication.h:
/usr/include/glib-2.0/gio/gapplicationcommandline.h:
/usr/include/glib-2.0/gio/gasyncinitable.h:
/usr/include/glib-2.0/gio/ginitable.h:
/usr/include/glib-2.0/gio/gasyncresult.h:
/usr/include/glib-2.0/gio/gbufferedinputstream.h:
/usr/include/glib-2.0/gio/gfilterinputstream.h:
/usr/include/glib-2.0/gio/ginputstream.h:
/usr/include/glib-2.0/gio/gbufferedoutputstream.h:
/usr/include/glib-2.0/gio/gfilteroutputstream.h:
/usr/include/glib-2.0/gio/goutputstream.h:
/usr/include/glib-2.0/gio/gbytesicon.h:
/usr/include/glib-2.0/gio/gcancellable.h:
/usr/include/glib-2.0/gio/gcharsetconverter.h:
/usr/include/glib-2.0/gio/gconverter.h:
/usr/include/glib-2.0/gio/gcontenttype.h:
/usr/include/glib-2.0/gio/gconverterinputstream.h:
/usr/include/glib-2.0/gio/gconverteroutputstream.h:
/usr/include/glib-2.0/gio/gcredentials.h:
/usr/include/glib-2.0/gio/gdatagrambased.h:
/usr/include/glib-2.0/gio/gdatainputstream.h:
/usr/include/glib-2.0/gio/gdataoutputstream.h:
/usr/include/glib-2.0/gio/gdbusactiongroup.h:
/usr/include/glib-2.0/gio/giotypes.h:
/usr/include/glib-2.0/gio/gdbusaddress.h:
/usr/include/glib-2.0/gio/gdbusauthobserver.h:
/usr/include/glib-2.0/gio/gdbusconnection.h:
/usr/include/glib-2.0/gio/gdbuserror.h:
/usr/include/glib-2.0/gio/gdbusinterface.h:
/usr/include/glib-2.0/gio/gdbusinterfaceskeleton.h:
/usr/include/glib-2.0/gio/gdbusintrospection.h:
/usr/include/glib-2.0/gio/gdbusmenumodel.h:
/usr/include/glib-2.0/gio/gdbusmessage.h:
/usr/include/glib-2.0/gio/gdbusmethodinvocation.h:
/usr/include/glib-2.0/gio/gdbusnameowning.h:
/usr/include/glib-2.0/gio/gdbusnamewatching.h:
/usr/include/glib-2.0/gio/gdbusobject.h:
/usr/include/glib-2.0/gio/gdbusobjectmanager.h:
/usr/include/glib-2.0/gio/gdbusobjectmanagerclient.h:
/usr/include/glib-2.0/gio/gdbusobjectmanagerserver.h:
/usr/include/glib-2.0/gio/gdbusobjectproxy.h:
/usr/include/glib-2.0/gio/gdbusobjectskeleton.h:
/usr/include/glib-2.0/gio/gdbusproxy.h:
/usr/include/glib-2.0/gio/gdbusserver.h:
/usr/include/glib-2.0/gio/gdbusutils.h:
/usr/include/glib-2.0/gio/gdebugcontroller.h:
/usr/include/glib-2.0/gio/gdebugcontrollerdbus.h:
/usr/include/glib-2.0/gio/gdrive.h:
/usr/include/glib-2.0/gio/gdtlsclientconnection.h:
/usr/include/glib-2.0/gio/gdtlsconnection.h:
/usr/include/glib-2.0/gio/gdtlsserverconnection.h:
/usr/include/glib-2.0/gio/gemblemedicon.h:
/usr/include/glib-2.0/gio/gicon.h:
/usr/include/glib-2.0/gio/gemblem.h:
/usr/include/glib-2.0/gio/gfile.h:
/usr/include/glib-2.0/gio/gfileattribute.h:
/usr/include/glib-2.0/gio/gfileenumerator.h:
/usr/include/glib-2.0/gio/gfileicon.h:
/usr/include/glib-2.0/gio/gfileinfo.h:
/usr/include/glib-2.0/gio/gfileinputstream.h:
/usr/include/glib-2.0/gio/gfileiostream.h:
/usr/include/glib-2.0/gio/giostream.h:
/usr/include/glib-2.0/gio/gioerror.h:
/usr/include/glib-2.0/gio/gfilemonitor.h:
/usr/include/glib-2.0/gio/gfilenamecompleter.h:
/usr/include/glib-2.0/gio/gfileoutputstream.h:
/usr/include/glib-2.0/gio/ginetaddress.h:
/usr/include/glib-2.0/gio/ginetaddressmask.h:
/usr/include/glib-2.0/gio/ginetsocketaddress.h:
/usr/include/glib-2.0/gio/gsocketaddress.h:
/usr/include/glib-2.0/gio/gioenumtypes.h:
/usr/include/glib-2.0/gio/giomodule.h:
/usr/include/glib-2.0/gmodule.h:
/usr/include/glib-2.0/gmodule/gmodule-visibility.h:
/usr/include/glib-2.0/gio/gioscheduler.h:
/usr/include/glib-2.0/gio/glistmodel.h:
/usr/include/glib-2.0/gio/gliststore.h:
/usr/include/glib-2.0/gio/gloadableicon.h:
/usr/include/glib-2.0/gio/gmemoryinputstream.h:
/usr/include/glib-2.0/gio/gmemorymonitor.h:
/usr/include/glib-2.0/gio/gmemoryoutputstream.h:
/usr/include/glib-2.0/gio/gmenu.h:
/usr/include/glib-2.0/gio/gmenumodel.h:
/usr/include/glib-2.0/gio/gmenuexporter.h:
/usr/include/glib-2.0/gio/gmount.h:
/usr/include/glib-2.0/gio/gmountoperation.h:
/usr/include/glib-2.0/gio/gnativesocketaddress.h:
/usr/include/glib-2.0/gio/gnativevolumemonitor.h:
/usr/include/glib-2.0/gio/gvolumemonitor.h:
/usr/include/glib-2.0/gio/gnetworkaddress.h:
/usr/include/glib-2.0/gio/gnetworkmonitor.h:
/usr/include/glib-2.0/gio/gnetworkservice.h:
/usr/include/glib-2.0/gio/gnotification.h:
/usr/include/glib-2.0/gio/gpermission.h:
/usr/include/glib-2.0/gio/gpollableinputstream.h:
/usr/include/glib-2.0/gio/gpollableoutputstream.h:
/usr/include/glib-2.0/gio/gpollableutils.h:
/usr/include/glib-2.0/gio/gpowerprofilemonitor.h:
/usr/include/glib-2.0/gio/gpropertyaction.h:
/usr/include/glib-2.0/gio/gproxy.h:
/usr/include/glib-2.0/gio/gproxyaddress.h:
/usr/include/glib-2.0/gio/gproxyaddressenumerator.h:
/usr/include/glib-2.0/gio/gsocketaddressenumerator.h:
/usr/include/glib-2.0/gio/gproxyresolver.h:
/usr/include/glib-2.0/gio/gremoteactiongroup.h:
/usr/include/glib-2.0/gio/gresolver.h:
/usr/include/glib-2.0/gio/gresource.h:
/usr/include/glib-2.0/gio/gseekable.h:
/usr/include/glib-2.0/gio/gsettings.h:
/usr/include/glib-2.0/gio/gsettingsschema.h:
/usr/include/glib-2.0/gio/gsimpleaction.h:
/usr/include/glib-2.0/gio/gsimpleactiongroup.h:
/usr/include/glib-2.0/gio/gactiongroup.h:
/usr/include/glib-2.0/gio/gactionmap.h:
/usr/include/glib-2.0/gio/gsimpleasyncresult.h:
/usr/include/glib-2.0/gio/gsimpleiostream.h:
/usr/include/glib-2.0/gio/gsimplepermission.h:
/usr/include/glib-2.0/gio/gsimpleproxyresolver.h:
/usr/include/glib-2.0/gio/gsocket.h:
/usr/include/glib-2.0/gio/gsocketclient.h:
/usr/include/glib-2.0/gio/gsocketconnectable.h:
/usr/include/glib-2.0/gio/gsocketconnection.h:
/usr/include/glib-2.0/gio/gsocketcontrolmessage.h:
/usr/include/glib-2.0/gio/gsocketlistener.h:
/usr/include/glib-2.0/gio/gsocketservice.h:
/usr/include/glib-2.0/gio/gsrvtarget.h:
/usr/include/glib-2.0/gio/gsubprocess.h:
/usr/include/glib-2.0/gio/gsubprocesslauncher.h:
/usr/include/glib-2.0/gio/gtask.h:
/usr/include/glib-2.0/gio/gtcpconnection.h:
/usr/include/glib-2.0/gio/gtcpwrapperconnection.h:
/usr/include/glib-2.0/gio/gtestdbus.h:
/usr/include/glib-2.0/gio/gthemedicon.h:
/usr/include/glib-2.0/gio/gthreadedsocketservice.h:
/usr/include/glib-2.0/gio/gtlsbackend.h:
/usr/include/glib-2.0/gio/gtlscertificate.h:
/usr/include/glib-2.0/gio/gtlsclientconnection.h:
/usr/include/glib-2.0/gio/gtlsconnection.h:
/usr/include/glib-2.0/gio/gtlsdatabase.h:
/usr/include/glib-2.0/gio/gtlsfiledatabase.h:
/usr/include/glib-2.0/gio/gtlsinteraction.h:
/usr/include/glib-2.0/gio/gtlspassword.h:
/usr/include/glib-2.0/gio/gtlsserverconnection.h:
/usr/include/glib-2.0/gio/gunixconnection.h:
/usr/include/glib-2.0/gio/gunixcredentialsmessage.h:
/usr/include/glib-2.0/gio/gunixfdlist.h:
/usr/include/glib-2.0/gio/gunixsocketaddress.h:
/usr/include/glib-2.0/gio/gvfs.h:
/usr/include/glib-2.0/gio/gvolume.h:
/usr/include/glib-2.0/gio/gzlibcompressor.h:
/usr/include/glib-2.0/gio/gzlibdecompressor.h:
/usr/include/glib-2.0/gio/gio-autocleanups.h:
/usr/include/gdk-pixbuf-2.0/gdk-pixbuf/gdk-pixbuf.h:
/usr/include/gdk-pixbuf-2.0/gdk-pixbuf/gdk-pixbuf-macros.h:
/usr/include/gdk-pixbuf-2.0/gdk-pixbuf/gdk-pixbuf-features.h:
/usr/include/gdk-pixbuf-2.0/gdk-pixbuf/gdk-pixbuf-core.h:
/usr/include/gdk-pixbuf-2.0/gdk-pixbuf/gdk-pixbuf-transform.h:
/usr/include/gdk-pixbuf-2.0/gdk-pixbuf/gdk-pixbuf-animation.h:
/usr/include/gdk-pixbuf-2.0/gdk-pixbuf/gdk-pixbuf-simple-anim.h:
/usr/include/gdk-pixbuf-2.0/gdk-pixbuf/gdk-pixbuf-io.h:
/usr/include/gdk-pixbuf-2.0/gdk-pixbuf/gdk-pixbuf-loader.h:
/usr/include/gdk-pixbuf-2.0/gdk-pixbuf/gdk-pixbuf-enum-types.h:
/usr/include/gdk-pixbuf-2.0/gdk-pixbuf/gdk-pixbuf-autocleanups.h:
