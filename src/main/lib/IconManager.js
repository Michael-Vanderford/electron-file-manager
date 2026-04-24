// getSymlinkIcon.js
const fs = require('fs');
const path = require('path');
const { execSync, execFileSync, spawn } = require('child_process');

class IconManager {

    constructor() {

        this.home = require('os').homedir();
        this.icon_theme = this.get_icon_theme();
        this.theme_root = this.get_theme_root();
        this.theme_path = this.get_theme_path();
        this.theme_watcher = null;
        this.theme_watcher_buffer = '';
        this.theme_change_timer = null;
        this.file_icon_cache = new Map();

    }

    get_icon_theme() {
        return execSync('gsettings get org.gnome.desktop.interface icon-theme').toString().replace(/'/g, '').trim();
    }

    get_symlink_icon() {

        try {

            let icon_path = path.join(this.theme_path, 'emblem-symbolic-link.svg');
            if (!fs.existsSync(icon_path)) {
                icon_path = path.join(process.cwd(), 'src', 'assets', 'icons', 'emblem-symbolic-link.svg');
            }

            return icon_path;

        } catch (err) {

            console.error('Error in symlink_icon:', err);
            return path.join(__dirname, 'assets/icons/emblem-symbolic-link.svg');

        }

    }

    get_readonly_icon() {

        try {

            let icon_path = path.join(this.theme_path, 'emblem-readonly.svg');
            if (!fs.existsSync(icon_path)) {
                icon_path = path.join(process.cwd(), 'src', 'assets', 'icons', 'emblem-readonly.svg');
            }

            return icon_path;

        } catch (err) {
            console.log(err);
        }
    }

    get_theme_path() {

        let icon_dir = this.theme_root || path.join(__dirname, 'assets', 'icons');
        let theme_path = '';

        try {
            if (!icon_dir || !fs.existsSync(icon_dir)) {
                icon_dir = path.join(__dirname, 'assets', 'icons', 'kora');
            }

            const icon_dirs = [
                'scalable/places/',
                'places@2x/48/',
                '32x32/places/',
                '64x64/places/',
                'places/scalable/',
                'scalable@2x/places/',
                'places/32/',
                'places/48/',
                'places/64/',
                'places/128/',
                'places/symbolic/',
                'scalable/'
            ].map(dir => path.join(icon_dir, dir));

            // Find the first existing icon directory
            theme_path = icon_dirs.find(dir => fs.existsSync(dir));

            // If no theme path found, use the fallback
            if (!theme_path) {
                theme_path = path.join(__dirname, 'assets/icons/');
            }

            // console.log('Using icon theme path:', theme_path);

            return theme_path;

        } catch (error) {
            console.error('Error in getIconThemePath:', error);
            return path.join(__dirname, 'assets/icons/');
        }
    }

    get_theme_root() {
        const search_paths = [
            path.join(this.home, '.local/share/icons'),
            path.join(this.home, '.icons'),
            '/usr/share/icons'
        ];

        const found_path = search_paths.find((icon_path) => {
            const candidate = path.join(icon_path, this.icon_theme);
            return fs.existsSync(candidate);
        });

        if (found_path) {
            return path.join(found_path, this.icon_theme);
        }

        return path.join(__dirname, 'assets', 'icons', 'kora');
    }

    get_theme_inherits(theme_root) {
        if (!theme_root) {
            return [];
        }

        const index_file = path.join(theme_root, 'index.theme');
        if (!fs.existsSync(index_file)) {
            return [];
        }

        try {
            const content = fs.readFileSync(index_file, 'utf8');
            const inherits_line = content
                .split('\n')
                .map((line) => line.trim())
                .find((line) => line.startsWith('Inherits='));

            if (!inherits_line) {
                return [];
            }

            return inherits_line
                .replace('Inherits=', '')
                .split(',')
                .map((theme_name) => theme_name.trim())
                .filter(Boolean);
        } catch (err) {
            return [];
        }
    }

    get_theme_root_by_name(theme_name) {
        if (!theme_name) {
            return null;
        }

        const search_paths = [
            path.join(this.home, '.local/share/icons'),
            path.join(this.home, '.icons'),
            '/usr/share/icons'
        ];

        for (const base_path of search_paths) {
            const candidate = path.join(base_path, theme_name);
            if (fs.existsSync(candidate)) {
                return candidate;
            }
        }

        return null;
    }

    get_theme_search_roots() {
        const roots = [];
        const queue = [this.theme_root];
        const visited = new Set();

        while (queue.length > 0) {
            const root = queue.shift();
            if (!root || visited.has(root)) {
                continue;
            }

            visited.add(root);
            roots.push(root);

            this.get_theme_inherits(root).forEach((theme_name) => {
                const inherited_root = this.get_theme_root_by_name(theme_name);
                if (inherited_root && !visited.has(inherited_root)) {
                    queue.push(inherited_root);
                }
            });
        }

        roots.push('/usr/share/icons/hicolor');
        return Array.from(new Set(roots.filter(Boolean)));
    }

    get_gio_icon_names(href) {
        try {
            const output = execFileSync('gio', ['info', '-a', 'standard::icon', href], { encoding: 'utf8' });
            const line = output.split('\n').find((entry) => entry.toLowerCase().includes('standard::icon:'));
            if (!line) {
                return [];
            }

            const match = line.match(/standard::icon:\s*(.*)$/i);
            const raw_names = match ? match[1].trim() : '';
            if (!raw_names) {
                return [];
            }

            return raw_names
                .split(',')
                .map((icon_name) => icon_name.trim())
                .filter(Boolean);
        } catch (err) {
            return [];
        }
    }

    resolve_themed_icon(icon_name) {
        if (!icon_name) {
            return null;
        }

        const cache_key = `${this.icon_theme}:${icon_name}`;
        if (this.file_icon_cache.has(cache_key)) {
            return this.file_icon_cache.get(cache_key);
        }

        const subdirs = [
            'mimetypes',
            'apps',
            'scalable/mimetypes',
            'scalable/apps',
            'symbolic/mimetypes',
            'symbolic/apps',
            'mimetypes/scalable',
            '64x64/mimetypes',
            '48x48/mimetypes',
            '32x32/mimetypes',
            '24x24/mimetypes',
            '16x16/mimetypes',
            '64x64/apps',
            '48x48/apps',
            '32x32/apps',
            '24x24/apps',
            '16x16/apps'
        ];
        const exts = ['.svg', '.png', '.xpm'];

        for (const root of this.get_theme_search_roots()) {
            const dynamic_subdirs = new Set(subdirs);

            ['mimetypes', 'apps'].forEach((section) => {
                const section_dir = path.join(root, section);
                if (!fs.existsSync(section_dir)) {
                    return;
                }

                try {
                    const entries = fs.readdirSync(section_dir, { withFileTypes: true });
                    entries.forEach((entry) => {
                        if (entry.isDirectory()) {
                            dynamic_subdirs.add(`${section}/${entry.name}`);
                        }
                    });
                } catch (err) {
                }
            });

            for (const subdir of dynamic_subdirs) {
                for (const ext of exts) {
                    const candidate = path.join(root, subdir, `${icon_name}${ext}`);
                    if (fs.existsSync(candidate)) {
                        this.file_icon_cache.set(cache_key, candidate);
                        return candidate;
                    }
                }
            }
        }

        this.file_icon_cache.set(cache_key, null);
        return null;
    }

    get_file_icon(href) {
        const icon_names = this.get_gio_icon_names(href);
        for (const icon_name of icon_names) {
            const resolved_icon = this.resolve_themed_icon(icon_name);
            if (resolved_icon) {
                return resolved_icon;
            }
        }

        return null;
    }

    refresh_theme() {

        try {
            const next_theme = this.get_icon_theme();

            if (!next_theme || next_theme === this.icon_theme) {
                return false;
            }

            this.icon_theme = next_theme;
            this.theme_root = this.get_theme_root();
            this.theme_path = this.get_theme_path();
            this.file_icon_cache.clear();
            return true;

        } catch (err) {
            console.error('Error refreshing icon theme:', err);
            return false;
        }
    }

    start_theme_watcher(on_change) {

        this.stop_theme_watcher();

        try {
            this.theme_watcher = spawn('gsettings', ['monitor', 'org.gnome.desktop.interface', 'icon-theme'], {
                stdio: ['ignore', 'pipe', 'ignore']
            });

            this.theme_watcher.stdout.on('data', (chunk) => {
                this.theme_watcher_buffer += chunk.toString();

                if (this.theme_change_timer) {
                    clearTimeout(this.theme_change_timer);
                }

                this.theme_change_timer = setTimeout(() => {
                    this.theme_watcher_buffer = '';
                    this.theme_change_timer = null;

                    const changed = this.refresh_theme();
                    if (changed && typeof on_change === 'function') {
                        on_change(this.icon_theme, this.theme_path);
                    }
                }, 100);
            });

            this.theme_watcher.on('error', (err) => {
                console.error('Error starting icon theme watcher:', err);
            });

            this.theme_watcher.on('exit', () => {
                this.theme_watcher = null;
            });

        } catch (err) {
            console.error('Unable to start icon theme watcher:', err);
            this.theme_watcher = null;
        }
    }

    stop_theme_watcher() {

        if (this.theme_change_timer) {
            clearTimeout(this.theme_change_timer);
            this.theme_change_timer = null;
        }

        if (this.theme_watcher) {
            this.theme_watcher.kill();
            this.theme_watcher = null;
        }

        this.theme_watcher_buffer = '';
    }

    // get folder icon
    get_folder_icon(e, href) {

        try {

            const baseName = path.basename(href);

            const specialFolders = {
                'Documents': ['folder-documents', 'folder-document'],
                'Music': ['folder-music'],
                'Pictures': ['folder-pictures', 'folder-image'],
                'Videos': ['folder-videos', 'folder-video'],
                'Downloads': ['folder-downloads', 'folder-download'],
                'Desktop': ['folder-desktop']
            };

            const folderType = specialFolders[baseName] || ['folder', 'default-folder'];
            const extensions = ['.svg', '.png'];

            // Try to find a special folder icon first
            let final_icon = null;
            for (const type of folderType) {
                for (const ext of extensions) {
                    const iconPath = path.join(this.theme_path, `${type}${ext}`);
                    if (fs.existsSync(iconPath)) {
                        final_icon = iconPath;
                        break;
                    }
                }
                if (final_icon) break;
            }

            // If no special icon found, fall back to generic folder icons
            if (!final_icon) {
                const folder_icons = [
                    'folder.svg',
                    'folder.png',
                    'default-folder.svg',
                    'default-folder.png'
                ];

                final_icon = folder_icons.reduce((found, icon) => {
                    if (found) return found;
                    const icon_path = path.join(this.theme_path, icon);
                    return fs.existsSync(icon_path) ? icon_path : null;
                }, null);
            }

            // If still no icon found, use the ultimate fallback
            final_icon = final_icon || path.join(process.cwd(), 'src', 'assets', 'icons', 'folder.svg');

            return final_icon;
            // e.sender.send('set_folder_icon', href, final_icon);

        } catch (err) {
            console.error('Error in folder icon selection:', err);
            // e.sender.send('set_folder_icon', href, path.join(__dirname, '../assets/icons/folder.svg'));
            return path.join(__dirname, '../assets/icons/folder.svg');
        }

    }

}

module.exports = new IconManager();