# Read the Windows stock folder icon without executing or opening a user's path.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies ([System.Drawing.Icon].Assembly.Location) -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;

public static class StockFolderIcon {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct StockIconInfo {
        public uint cbSize;
        public IntPtr hIcon;
        public int systemImageIndex;
        public int iconIndex;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)]
        public string path;
    }
    [DllImport("shell32.dll", ExactSpelling = true)]
    private static extern int SHGetStockIconInfo(uint id, uint flags, ref StockIconInfo info);
    [DllImport("user32.dll")]
    private static extern bool DestroyIcon(IntPtr icon);

    public static string Read() {
        StockIconInfo info = new StockIconInfo();
        info.cbSize = (uint)Marshal.SizeOf(typeof(StockIconInfo));
        // SIID_FOLDER = 3; SHGSI_ICON = 0x100; large (32px) is the default.
        int result = SHGetStockIconInfo(3, 0x100, ref info);
        try {
            Marshal.ThrowExceptionForHR(result);
            if (info.hIcon == IntPtr.Zero) throw new InvalidOperationException("No stock folder icon.");
            using (Icon icon = Icon.FromHandle(info.hIcon))
            using (Bitmap bitmap = icon.ToBitmap())
            using (MemoryStream stream = new MemoryStream()) {
                bitmap.Save(stream, ImageFormat.Png);
                return Convert.ToBase64String(stream.ToArray());
            }
        } finally {
            if (info.hIcon != IntPtr.Zero) DestroyIcon(info.hIcon);
        }
    }
}
'@
[StockFolderIcon]::Read()
