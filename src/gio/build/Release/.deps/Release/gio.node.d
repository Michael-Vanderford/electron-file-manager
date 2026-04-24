cmd_Release/gio.node := ln -f "Release/obj.target/gio.node" "Release/gio.node" 2>/dev/null || (rm -rf "Release/gio.node" && cp -af "Release/obj.target/gio.node" "Release/gio.node")
