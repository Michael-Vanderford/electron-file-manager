{
    'variables': {
        'pkg-config': 'pkg-config'
    },
    "targets": [
        {
        "target_name": "gio",
        "builddir": "gio",
        "sources": [ "src/gio.cc" ],
        "include_dirs": [
                "/usr/include/glib-2.0",
                '/usr/include/gdk-pixbuf-2.0',
                "<!(node -e \"require('nan')\")"
            ],
            "libraries": [
                "-lgio-2.0",
                "-lgobject-2.0",
                "-lglib-2.0",
                "-lgdk_pixbuf-2.0"
            ],
            'cflags': [
                '<!@(<(pkg-config) --libs --cflags glib-2.0)',
            ],
        "defines": [
            "NAN_MODULE_WORKER_ENABLED"
        ],
        "target_defaults": {
            "cflags": [
                "--target=25.6.0",
                "--dist-url=https://electronjs.org/header"
            ]
            }
        }
    ]
}

