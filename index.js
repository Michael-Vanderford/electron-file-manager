
// Initialize Drag Select
document.addEventListener("DOMContentLoaded", (e) => {

    let location = document.querySelector('.location')
    let sidebar = document.querySelector('.sidebar')

    window.api.getShortcuts().then(shortcut => {

        const mt = Mousetrap

        // F5 Reload page
        mt.bind(shortcut.Reload.toLocaleLowerCase(), () => {
            window.api.getView(location.value)
        })

        // Escape (Cancel)
        mt.bind(shortcut.Escape.toLocaleLowerCase(), (e) => {
            // Clear Arrays and selected items
            window.api.clear();
        })

        // Edit
        mt.bind(shortcut.Rename.toLocaleLowerCase(), (e) => {
            window.api.edit();
        })

        // Ctrl+C (Copy)
        mt.bind(shortcut.Copy.toLocaleLowerCase(), (e) => {
            window.api.getSelectedFiles();
        })

        // Cut CTRL+X
        mt.bind(shortcut.Cut.toLocaleLowerCase(), (e) => {
            window.api.cut();
        })

        // Run paste operation
        mt.bind(shortcut.Paste.toLocaleLowerCase(), (e) => {
            window.api.pasteOperation();
        })

        // New Folder
        mt.bind(shortcut.NewFolder.toLocaleLowerCase(), (e) => {
            window.api.newFolder();
        })

        // Show / hide sidebar
        mt.bind(shortcut.ShowSidebar.toLocaleLowerCase(), (e) => {
            if (sidebar.classList.contains('hidden')) {
                sidebar.classList.remove('hidden');
                localStorage.setItem('sidebar', 1);
            } else {
                sidebar.classList.add('hidden');
                localStorage.setItem('sidebar', 0);
            }
        })

        // Find Files
        mt.bind(shortcut.Find.toLocaleLowerCase(), (e) => {
            window.api.find_files();
        })

        // Quick Search
        mt.bind(shortcut.QuickSearch.toLowerCase(), (e) => {
            // window.api.quickSearch(e);
        })

        // New Window
        mt.bind(shortcut.NewWindow.toLocaleLowerCase(), (e) => {
            window.api.newWindow();
        })

        // Show Home View Sidebar
        mt.bind(shortcut.ShowHome.toLocaleLowerCase(), (e) => {
            window.api.clearViews();
            window.api.sidebarHome();
        })

        // Get File Info
        mt.bind(shortcut.Properties.toLocaleLowerCase(), (e) => {
            window.api.fileInfo();
        })

        // Select All Ctrl+A
        mt.bind(shortcut.SelectAll.toLocaleLowerCase(), (e) => {
            e.preventDefault();
            let tab_content = document.querySelector('.active-tab-content');
            let cards = tab_content.querySelectorAll('.card')
            cards.forEach(card => {
                card.classList.add('highlight_select');
            })
            window.api.getSelectedCount();

        })

        // New Tav
        mt.bind(shortcut.NewTab.toLocaleLowerCase(), (e) => {
            window.api.getView(location.value, 1);
        })

        // Show settings
        mt.bind(shortcut.ShowSettings.toLocaleLowerCase(), (e) => {
            window.api.settingsView();
        })

        // Extract Compressed Files
        mt.bind(shortcut.Extract.toLocaleLowerCase(), (e) => {
            window.api.extract();
        })

        // Compress Files
        mt.bind(shortcut.Compress.toLocaleLowerCase(), (e) => {
            window.api.compress();
        })

        // Add to Workspace
        mt.bind(shortcut.AddWorkspace.toLocaleLowerCase(), (e) => {
            window.api.AddWorkspace();
        })

        // // Forward
        // mt.bind(shortcut.Forward.toLocaleLowerCase(), (e) => {
        //     window.api.forward();
        // })

        // Go Back
        mt.bind(shortcut.Backspace.toLocaleLowerCase(), (e) => {
            e.preventDefault();
            window.api.back();
        })

        // Up
        mt.bind(shortcut.Up.toLocaleLowerCase(), (e) => {
            e.preventDefault();
            window.api.up();
        })

        // Shift Up
        mt.bind(`shift+${shortcut.Up.toLocaleLowerCase()}`, (e) => {
            e.preventDefault();
            window.api.up(1);
        })

        // Down
        mt.bind(shortcut.Down.toLocaleLowerCase(), (e) => {
            e.preventDefault();
            window.api.down();
        })

        // Shift Down
        mt.bind(`shift+${shortcut.Down.toLocaleLowerCase()}`, (e) => {
            e.preventDefault();
            window.api.down(1);
        })

        // Right
        mt.bind(shortcut.Right.toLocaleLowerCase(), (e) => {
            e.preventDefault();
            window.api.right();
        })

        // Shift Right
        mt.bind(`shift+${shortcut.Right.toLocaleLowerCase()}`, (e) => {
            e.preventDefault();
            window.api.right(1);
        })

        // Left
        mt.bind(shortcut.Left.toLocaleLowerCase(), (e) => {
            e.preventDefault();
            window.api.left();
        })

        // Shift Left
        mt.bind(`shift+${shortcut.Left.toLocaleLowerCase()}`, (e) => {
            e.preventDefault();
            window.api.left(1);
        })

    })

})