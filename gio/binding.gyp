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
#     'variables': {
#         'pkg-config': 'pkg-config'
#     },
#     "targets": [
#         {
#         "target_name": "hello",
#         # "binary_name": "gio",
#         "builddir": "hello",
#         "sources": [ "src/hello.cc" ],
#         "include_dirs": [
#                 "/usr/include/glib-2.0",
#                 "<!(node -p \"require('node-addon-api').include\")"
#                 # "<!(node -e \"require('nan')\")"
#             ],
#         "dependencies": [
#                 "<!(node -p \"require('node-addon-api').gyp\")"
#             ],
#             "libraries": [
#                 "-lgio-2.0",
#                 "-lgobject-2.0",
#                 "-lglib-2.0"
#             ],
#             'cflags': [
#                 '<!@(<(pkg-config) --libs --cflags glib-2.0)',
#             ],
#         }
#     ]
# }






