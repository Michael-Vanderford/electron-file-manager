"""Read libarchive entries; write only checked regular files/directories.

Links and special files are deliberately rejected rather than delegated to an
extractor that can traverse them. No archive-provided path is passed to a shell.
"""
import ctypes as c
import ctypes.util
import os
from pathlib import Path, PurePosixPath
import re
import sys


def extract(source, destination):
    library = ctypes.util.find_library('archive')
    if not library:
        raise RuntimeError('Safe extraction requires the libarchive runtime library.')
    lib = c.CDLL(library)
    def function(name, result, args):
        f = getattr(lib, name)
        f.restype, f.argtypes = result, args
        return f
    new = function('archive_read_new', c.c_void_p, [])
    readers = [function('archive_read_support_' + name, c.c_int, [c.c_void_p]) for name in ('filter_none', 'filter_gzip', 'filter_bzip2', 'filter_xz', 'format_zip', 'format_tar', 'format_7zip')]
    open_archive = function('archive_read_open_filename', c.c_int, [c.c_void_p, c.c_char_p, c.c_size_t])
    next_entry = function('archive_read_next_header', c.c_int, [c.c_void_p, c.POINTER(c.c_void_p)])
    pathname = function('archive_entry_pathname', c.c_char_p, [c.c_void_p])
    filetype = function('archive_entry_filetype', c.c_uint, [c.c_void_p])
    permissions = function('archive_entry_perm', c.c_uint, [c.c_void_p])
    modified = function('archive_entry_mtime', c.c_longlong, [c.c_void_p])
    hardlink = function('archive_entry_hardlink', c.c_char_p, [c.c_void_p])
    symlink = function('archive_entry_symlink', c.c_char_p, [c.c_void_p])
    read = function('archive_read_data', c.c_ssize_t, [c.c_void_p, c.c_void_p, c.c_size_t])
    error = function('archive_error_string', c.c_char_p, [c.c_void_p])
    free = function('archive_read_free', c.c_int, [c.c_void_p])
    handle = new()
    root = Path(destination).resolve(strict=True)
    directories = []
    def check(code):
        if code < 0:
            raise RuntimeError(os.fsdecode(error(handle) or b'Archive read failed'))
    try:
        for reader in readers:
            check(reader(handle))
        check(open_archive(handle, os.fsencode(source), 65536))
        entry = c.c_void_p()
        buffer = c.create_string_buffer(65536)
        while True:
            status = next_entry(handle, c.byref(entry))
            if status == 1:  # ARCHIVE_EOF
                break
            check(status)
            raw = os.fsdecode(pathname(entry) or b'')
            name = PurePosixPath(raw.replace('\\', '/'))
            if not raw or name.is_absolute() or '..' in name.parts or re.match(r'^[A-Za-z]:', raw):
                raise RuntimeError(f'Unsafe archive path: {raw!r}')
            target = root.joinpath(*name.parts)
            if not target.resolve().is_relative_to(root):
                raise RuntimeError(f'Archive path escapes destination: {raw!r}')
            kind = filetype(entry)
            if hardlink(entry) or symlink(entry) or kind not in (0o040000, 0o100000):
                raise RuntimeError(f'Archive links and special entries are not extracted: {raw!r}')
            if kind == 0o040000:
                target.mkdir(parents=True, exist_ok=True)
                directories.append((target, permissions(entry) & 0o777, modified(entry)))
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            # Duplicate names and pre-existing entries fail closed.
            with target.open('xb') as output:
                while True:
                    count = read(handle, buffer, len(buffer))
                    check(count)
                    if not count:
                        break
                    output.write(buffer.raw[:count])
            os.chmod(target, permissions(entry) & 0o777)
            os.utime(target, (modified(entry), modified(entry)))
        for target, mode, mtime in reversed(directories):
            os.chmod(target, mode)
            os.utime(target, (mtime, mtime))
    finally:
        free(handle)


if __name__ == '__main__':
    try:
        extract(sys.argv[1], sys.argv[2])
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)
