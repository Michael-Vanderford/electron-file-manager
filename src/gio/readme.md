<h1>node-gio</h1>

<p>
    Node-gio is a c++ node nan module that implements some of the libgio calls for use with Electron.
    Note: This is written specifically for use in Electron but it should also work in a node application.
</p>

<h2>Preamble</h2>
<p>
    This module will only work on linux. It is built using the libgio header library that is part of the Gnome Desktop.

    Please know what you are doing as this library works with your file system. If you delete your files there is no safety net for recovery.
</p>

<h2>Installation</h2>
<p>
    npm i --save node-gio
</p>

<h2>Current Functions</h2>

<p>
    thumbnail - create a thumbnail of a image file<br>
    open_with - returns a list of application associated with a file.<br>
    exists - checks if a file exists<br>
    get_file - returns a javascript object of attributes associated with a file<br>
    ls - returns a javascript array of Directories and files and their attributes<br>
    mkdir - creates a new directory<br>
    cp - copies a file<br>
    mv - moves a file<br>
    rm - deletes a file<br>
    is_writable - return a boolean value indicating if the directory is writable<br>
    monitor - monitors for connected devices and new mounts<br>
    get_mounts - return a javascript array of mounted devices an mounts<br>
</p>

