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
        "defines": [
            "NAN_MODULE_WORKER_ENABLED"
        ]
        }
    ]
}

# {
#   'variables': {
#         'pkg-config': 'pkg-config'
#     },
#     "targets": [
#         {
#         "target_name": "node_gio",
#         "builddir": "gio",
#         "sources": [ "src/node_gio.cc" ],
#         "include_dirs": [
#                 "/usr/include/glib-2.0"
#                 # "<!(node -e \"require('napi')\")"
#             ],
#             "libraries": [
#                 "-lgio-2.0",
#                 "-lgobject-2.0",
#                 "-lglib-2.0"
#             ],
#             'cflags': [
#                 '<!@(<(pkg-config) --libs --cflags glib-2.0)',
#             ],
#         "defines": [
#             "NAN_MODULE_WORKER_ENABLED"
#         ]
#         }
#     ]
# }






