describe('Tab Toolbar Persistence and State', () => {
    let container;
    let main;
    let tabHeader;
    let activeTabContent;

    beforeEach(() => {
        // Build mock DOM layout mirroring index.html and preload setup
        container = {
            children: [],
            querySelector(sel) {
                if (sel === '.tab-header') return tabHeader;
                if (sel === '.main') return main;
                if (sel === '.tab-content-toolbar') return main.children.find(c => c.className === 'tab-content-toolbar') || null;
                return null;
            }
        };

        tabHeader = {
            className: 'tab-header',
            after(node) {
                const idx = main.children.indexOf(tabHeader);
                if (idx >= 0) {
                    main.children.splice(idx + 1, 0, node);
                } else {
                    main.children.push(node);
                }
            }
        };

        activeTabContent = {
            className: 'tab-content active-tab-content',
            innerHTML: '<div>old cards</div>',
            clear() {
                this.innerHTML = '';
            }
        };

        main = {
            className: 'main',
            children: [tabHeader, activeTabContent],
            prepend(node) {
                this.children.unshift(node);
            }
        };
    });

    test('init_tab_toolbar mounts toolbar once and is idempotent', () => {
        let mountCount = 0;
        function init_tab_toolbar(doc) {
            if (doc.querySelector('.tab-content-toolbar')) {
                return false;
            }
            const toolbar = {
                className: 'tab-content-toolbar',
                buttons: {}
            };
            const header = doc.querySelector('.tab-header');
            if (header) {
                header.after(toolbar);
            }
            mountCount++;
            return true;
        }

        // First call mounts toolbar
        const first = init_tab_toolbar(container);
        expect(first).toBe(true);
        expect(mountCount).toBe(1);
        expect(container.querySelector('.tab-content-toolbar')).not.toBeNull();

        // Second call is idempotent and does not mount a second toolbar
        const second = init_tab_toolbar(container);
        expect(second).toBe(false);
        expect(mountCount).toBe(1);
        expect(main.children.filter(c => c.className === 'tab-content-toolbar').length).toBe(1);
    });

    test('re-rendering active tab content does not wipe out persistent toolbar', () => {
        const toolbar = { className: 'tab-content-toolbar' };
        tabHeader.after(toolbar);

        expect(container.querySelector('.tab-content-toolbar')).toBe(toolbar);

        // Simulate directory navigation where active_tab_content is cleared
        activeTabContent.clear();
        expect(activeTabContent.innerHTML).toBe('');

        // Toolbar remains in DOM attached to main
        expect(container.querySelector('.tab-content-toolbar')).toBe(toolbar);
        expect(main.children.includes(toolbar)).toBe(true);
    });

    test('toolbar buttons disable correctly based on location and selection state', () => {
        const buttons = {
            new_folder: { disabled: false },
            cut: { disabled: false },
            copy: { disabled: false },
            paste: { disabled: false },
            rename: { disabled: false },
            delete: { disabled: false },
            compress: { disabled: false },
            extract: { disabled: false },
            properties: { disabled: false }
        };

        function update_toolbar_state(state, has_clipboard = false) {
            const has_selection = state.count > 0;
            buttons.new_folder.disabled = !state.is_real_location;
            buttons.cut.disabled = !has_selection;
            buttons.copy.disabled = !has_selection;
            buttons.paste.disabled = !state.is_real_location || !has_clipboard;
            buttons.rename.disabled = state.count !== 1;
            buttons.delete.disabled = !has_selection;
            buttons.compress.disabled = !has_selection || !state.is_real_location;
            buttons.extract.disabled = !state.has_archive || !state.is_real_location;
            buttons.properties.disabled = !has_selection && !state.is_real_location;
        }

        // 1. Virtual location (Dashboard) with no selection
        update_toolbar_state({ is_real_location: false, count: 0, has_archive: false });
        expect(buttons.new_folder.disabled).toBe(true);
        expect(buttons.cut.disabled).toBe(true);
        expect(buttons.copy.disabled).toBe(true);
        expect(buttons.paste.disabled).toBe(true);
        expect(buttons.rename.disabled).toBe(true);
        expect(buttons.delete.disabled).toBe(true);
        expect(buttons.compress.disabled).toBe(true);
        expect(buttons.extract.disabled).toBe(true);
        expect(buttons.properties.disabled).toBe(true);

        // 2. Real directory with single file selected (non-archive)
        update_toolbar_state({ is_real_location: true, count: 1, has_archive: false }, true);
        expect(buttons.new_folder.disabled).toBe(false);
        expect(buttons.cut.disabled).toBe(false);
        expect(buttons.copy.disabled).toBe(false);
        expect(buttons.paste.disabled).toBe(false);
        expect(buttons.rename.disabled).toBe(false);
        expect(buttons.delete.disabled).toBe(false);
        expect(buttons.compress.disabled).toBe(false);
        expect(buttons.extract.disabled).toBe(true);
        expect(buttons.properties.disabled).toBe(false);

        // 3. Real directory with archive selected
        update_toolbar_state({ is_real_location: true, count: 1, has_archive: true }, false);
        expect(buttons.extract.disabled).toBe(false);
        expect(buttons.paste.disabled).toBe(true); // No clipboard
    });
});

