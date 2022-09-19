function FindIcon(icon, size, scale) {
    filename = FindIconHelper(icon, size, scale, user_selected_theme);
    if (filename != none){
        return filename
    }

    filename = FindIconHelper(icon, size, scale, "hicolor");
    if (filename != none){
        return filename
    }else{
        return LookupFallbackIcon (icon)
    }

}

function FindIconHelper(icon, size, scale, theme) {
    filename = LookupIcon (icon, size, scale, theme)
    if (filename != none){
        return filename
    }


    if (theme_has_parents){
        parents = theme.parents
    }

    for (parent in parents) {
      filename = FindIconHelper (icon, size, scale, parent)
      if (filename != none){
        return filename
      }

    }
    return none
  }

//   With the following helper functions:

  function LookupIcon (iconname, size, scale, theme) {
    for each subdir in $(theme subdir list) {
      for each directory in $(basename list) {
        for extension in ("png", "svg", "xpm") {
          if DirectoryMatchesSize(subdir, size, scale) {
            filename = directory/$(themename)/subdir/iconname.extension
            if exist filename
          return filename
          }
        }
      }
    }
    minimal_size = MAXINT
    for each subdir in $(theme subdir list) {
      for each directory in $(basename list) {
        for extension in ("png", "svg", "xpm") {
          filename = directory/$(themename)/subdir/iconname.extension
          if exist filename and DirectorySizeDistance(subdir, size, scale) < minimal_size {
         closest_filename = filename
         minimal_size = DirectorySizeDistance(subdir, size, scale)
          }
        }
      }
    }
    if closest_filename set
       return closest_filename
    return none
  }

  function LookupFallbackIcon (iconname) {
    for each directory in $(basename list) {
      for extension in ("png", "svg", "xpm") {
        if exists directory/iconname.extension
          return directory/iconname.extension
      }
    }
    return none
  }

  function DirectoryMatchesSize(subdir, iconsize, iconscale) {
    read Type and size data from subdir
    if Scale != iconscale
       return False;
    if Type is Fixed
      return Size == iconsize
    if Type is Scaled
      return MinSize <= iconsize <= MaxSize
    if Type is Threshold
      return Size - Threshold <= iconsize <= Size + Threshold
  }

  function DirectorySizeDistance(subdir, iconsize, iconscale) {
    // read Type and size data from subdir
    if Type is Fixed
      return abs(Size*Scale - iconsize*iconscale)
    if Type is Scaled
      if iconsize*iconscale < MinSize*Scale
          return MinSize*Scale - iconsize*iconscale
      if iconsize*iconscale > MaxSize*Scale
          return iconsize*iconscale - MaxSize*Scale
      return 0
    if Type is Threshold
      if iconsize*iconscale < (Size - Threshold)*Scale
          return MinSize*Scale - iconsize*iconscale
      if iconsize*iconsize > (Size + Threshold)*Scale
          return iconsize*iconsize - MaxSize*Scale
      return 0
  }
  In some cases you don't always want to fall back to an icon in an inherited theme. For instance, sometimes you look for a set of icons, prefering any of them before using an icon from an inherited theme. To support such operations implementations can contain a function that finds the first of a list of icon names in the inheritance hierarchy. I.E. It would look something like this:

  function FindBestIcon(iconList, size, scale) {
    filename = FindBestIconHelper(iconList, size, scale, user selected theme);
    if filename != none
      return filename

    filename = FindBestIconHelper(iconList, size, scale, "hicolor");
    if filename != none
      return filename

    for icon in iconList {
      filename = LookupFallbackIcon (icon)
      if filename != none
        return filename
    }
    return none;
  }
  function FindBestIconHelper(iconList, size, scale, theme) {
    for icon in iconList {
      filename = LookupIcon (icon, size, theme)
      if filename != none
        return filename
    }

    if theme has parents
      parents = theme.parents

    for parent in parents {
      filename = FindBestIconHelper (iconList, size, scale, parent)
      if filename != none
        return filename
    }
    return none
  }