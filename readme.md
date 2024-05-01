
## SFM (String File Manager)

# Linux File Manager - Built with Electron

### Install

    git clone https://github.com/Michael-Vanderford/electron-file-manager.git
    cd electron-file-manager
    npm i --save-dev
    npm start

### Grid View
![Screenshot 1](assets/screenshots/Grid1.png?raw=true)
### Properties
![Screenshot 2](assets/screenshots/Properties1.png?raw=true)
### Merge
![Screenshot 3](assets/screenshots/Merge1.png?raw=true)
<!-- ![Screenshot 2](/screenshots/screenshot_2.png?raw=true)

![Screenshot 3](/screenshots/screenshot_3.png?raw=true) -->

## Changelog

### Version 1.075 (2024-04-30)
- Show progress based on bytes copied instead of counts for copy and move
- Removed the need for ctrl+f for type ahead
- Fixed file type not displaying in list view
- Added "npm run build" script to run electron-builder for deb package


### Version 1.0.74 (2024-03-17)
- Added keyboard navigation / select for cards
- Added Location history per tab
- Removed persistent location history
- Collapse workspace
- Added visual for disk size on devices
- Updated screen shots


### Version 1.0.73 (2024-02-25)
- Videos now have a thumbnail
- Retain location history
- Added a global action dropdown for merge files
- Speed improvement for content count in properties view
- Various properties view fixes

### Version 1.0.72 (2024-02-19)
- Added sshfs option for network
- Removed smb option from network
- Updated find to work on root directories

### Version 1.0.71 (2024-02-11)
- Re worked location autocomplete
- Updated css for buttons to show activity
- Fixed issues with left and right navigation buttons not traversing the stack properly
- Added right click dropdown for the left navigation to show previous locations
- Fixed issue with the merge feature breaking on read only files
- Added a few icons to the electron menus

### Version 1.0.7 (2024-02-03)
- Edit mode for new folder creation
- Error handle merge files
- Fixed column header formatting when switching views
- Edit workspace names
- Updated light color scheme

### Version 1.0.6 (2024-01-02)
- Multithreading for copying separate directories
- Multithreading for deleting separate directories
- Multithreading for compressing multiple tar files
- Multithreading for extracting multiple tar files
- Updated progress bar to handle multiple operations


## Features

* Tab completion in the location bar
* QuickSearch search (ctrl+f)
* Collapsible sidebar (ctrl+b)
* Icon scaling
* Tabbed Views
* Audio or Video to Audio conversion - Requires ffmpeg
* Templates Folder for new file creation
* Native icon support
* Merge Files


## Keyboard Shortcuts

* Go Back: Backspace
* ShowSidebar: Ctrl+B
* Find: Ctrl+Shift+F
* Rename: F2
* Cut: Ctrl+X
* Copy: Ctrl+C
* Paste: Ctrl+V
* SelectAll: Ctrl+A
* Delete: Del
* Compress: Shift+C
* Extract: Shift+E
* Properties: Ctrl+I
* NewFolder: Ctrl+Shift+N
* AddWorkspace: Ctrl+D


<!-- Stack
<ul>
    <li><a href="https://nodejs.org/en/">nodejs</a></li>
    <li><a href="https://github.com/electron/electron">electron</li>
    <li><a href="https://semantic-ui.com">semantic-ui</a></li>
    <li><a href="https://www.chartjs.org/">chartjs</a></li>
    <li><a href="https://dragselect.com/">dragselect</a></li>
    <li><a href="https://craig.is/killing/mice">mousetrap</a></li>
    <li><a href="https://www.npmjs.com/package/open">open</a></li>
    <li><a href="https://www.npmjs.com/package/mime-types">mime-types</a></li>
    <li><a href="https://webpack.js.org/">webpack</a></li>
    <li><a href="https://icons.getbootstrap.com/">bootstrap-icons</a></li>
    <li><a href="https://getbootstrap.com/">bootstrap</a></li>
    <li><a href="https://jquery.com/">jquery - legacy</a></li>
</ul> -->


