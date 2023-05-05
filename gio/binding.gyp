{
    'variables': {
        'pkg-config': 'pkg-config'
    },
    "targets": [
        {
        "target_name": "gio",
        # "binary_name": "gio",
        "builddir": "gio",
        "sources": [ "src/gio.cc" ],
        "include_dirs": [
                "/usr/include/glib-2.0",
                "<!(node -e \"require('nan')\")"
            ],
            "libraries": [
                "-lgio-2.0",
                "-lgobject-2.0",
                "-lglib-2.0"
            ],
            'cflags': [
                '<!@(<(pkg-config) --libs --cflags glib-2.0)',
            ],
        }
    ]
}


# {
#   "targets": [
#     {
#       "target_name": "demo",
#       "sources": ["test.cc"],
#       "include_dirs": [
#         "/usr/include/glib-2.0",
#         "<!@(pkg-config --cflags gio-2.0)"
#       ],
#       "libraries": [
#         "-lgio-2.0",
#         "-lgobject-2.0",
#         "-lglib-2.0",
#         "<!@(pkg-config --libs gio-2.0)"
#       ],
#       "conditions": [
#         ["OS == 'linux'", {
#             "cflags":[ "<!@(<(pkg-config) --libs --cflags glib-2.0)"],
#           "cflags!": ["-fno-rtti"],
#           "cflags_cc!": ["-fno-rtti"],
#           "ldflags": ["-Wl,-rpath='$ORIGIN/'"],
#           "defines": ["_GLIBCXX_USE_CXX11_ABI=0"],
#           "link_settings": {
#             "libraries": ["-static-libgcc", "-static-libstdc++"]
#           }
#         }]
#       ]
#     }
#   ]
# }

# {
#     'variables': {
#         'pkg-config': 'pkg-config'
#     },
#   "targets": [
#     {
#       "target_name": "copy-to-gio",
#       "sources": [ "cp_gio.cc" ],
#       "include_dirs": [
#         "/usr/include/glib-2.0",
#         "/usr/lib/x86_64-linux-gnu/glib-2.0/include",
#         "/usr/include/gio-unix-2.0"
#       ],
#       "libraries": [
#         "-lgio-2.0",
#         "-lgobject-2.0",
#         "-lglib-2.0"
#       ],
#       'cflags': [
#             '<!@(<(pkg-config) --libs --cflags glib-2.0)',
#         ],
#     }
#   ]
# }




