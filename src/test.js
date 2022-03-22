// HISTORY OBJECT
exports.history = class history{
    dir
    idx
  }

  // FILE OBJECT
exports.fileinfo = class fileinfo {

    filename
    is_dir
    dir
    extension
    size
    is_hidden
    file_count
    mtime
    ctime

  }

  exports.options = class options {

    folder
    sort
    show

  }