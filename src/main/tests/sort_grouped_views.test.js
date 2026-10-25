const { group_files } = require('../../common/file_groups');

describe('Sort in Grouped Views', () => {

    const createMockUtilities = () => ({
        sort(files_arr, sort_by, sort_direction) {
            const sortFunctions = {
                name: (a, b) => a.name.localeCompare(b.name),
                size: (a, b) => (a.size || 0) - (b.size || 0),
                mtime: (a, b) => (a.mtime || 0) - (b.mtime || 0),
            };

            return files_arr.sort((a, b) => {
                if (a.is_dir !== b.is_dir) {
                    return a.is_dir ? -1 : 1;
                }
                if (a.name.startsWith('.') !== b.name.startsWith('.')) {
                    return a.name.startsWith('.') ? 1 : -1;
                }
                if (sort_by in sortFunctions) {
                    const result = sortFunctions[sort_by](a, b);
                    return sort_direction === 'asc' ? result : -result;
                }
                return 0;
            });
        },
        sortItems(items_arr, sort_by, sort_direction) {
            return items_arr.sort((a, b) => {
                const aName = a.dataset.name || '';
                const bName = b.dataset.name || '';
                const result = aName.localeCompare(bName);
                return sort_direction === 'asc' ? result : -result;
            });
        },
        set_msg: jest.fn()
    });

    describe('Group-by-aware Sorting Logic', () => {
        let utilities;
        let mockFiles;

        beforeEach(() => {
            utilities = createMockUtilities();
            mockFiles = [
                { name: 'zebra.txt', content_type: 'text/plain', size: 500, mtime: 100 },
                { name: 'alpha.txt', content_type: 'text/plain', size: 100, mtime: 300 },
                { name: 'beta.png', content_type: 'image/png', size: 2000, mtime: 200 },
                { name: 'delta.png', content_type: 'image/png', size: 50, mtime: 400 },
                { name: 'gamma_folder', is_dir: true, size: 0, mtime: 500 }
            ];
        });

        test('sorting grouped files by name (asc) maintains group structure and orders files inside groups', () => {
            let file_groups = group_files(mockFiles, 'Type');
            expect(file_groups).not.toBeNull();

            // Sort within each group as get_view does
            file_groups.forEach((group) => {
                group.files = utilities.sort(group.files, 'name', 'asc');
            });
            file_groups = file_groups.filter((group) => group.files.length > 0);

            // Verify no groups are empty
            file_groups.forEach((group) => {
                expect(group.files.length).toBeGreaterThan(0);
            });

            const docGroup = file_groups.find((g) => g.label === 'Documents');
            expect(docGroup).toBeDefined();
            expect(docGroup.files.map((f) => f.name)).toEqual(['alpha.txt', 'zebra.txt']);

            const imgGroup = file_groups.find((g) => g.label === 'Images');
            expect(imgGroup).toBeDefined();
            expect(imgGroup.files.map((f) => f.name)).toEqual(['beta.png', 'delta.png']);

            const folderGroup = file_groups.find((g) => g.label === 'Folders');
            expect(folderGroup).toBeDefined();
            expect(folderGroup.files.map((f) => f.name)).toEqual(['gamma_folder']);
        });

        test('sorting grouped files by size (desc) orders within groups without detaching or emptying groups', () => {
            let file_groups = group_files(mockFiles, 'Type');
            file_groups.forEach((group) => {
                group.files = utilities.sort(group.files, 'size', 'desc');
            });
            file_groups = file_groups.filter((group) => group.files.length > 0);

            const docGroup = file_groups.find((g) => g.label === 'Documents');
            expect(docGroup.files.map((f) => f.name)).toEqual(['zebra.txt', 'alpha.txt']);

            const imgGroup = file_groups.find((g) => g.label === 'Images');
            expect(imgGroup.files.map((f) => f.name)).toEqual(['beta.png', 'delta.png']);
        });

        test('removing a group\'s final file leaves no empty group after re-render', () => {
            const files = mockFiles.filter((file) => file.name !== 'gamma_folder');
            const groups = group_files(files, 'Type');

            expect(groups.find((group) => group.label === 'Folders')).toBeUndefined();
            expect(groups.every((group) => group.files.length > 0)).toBe(true);
        });
    });

    describe('DOM Integrity & Empty Group Regression', () => {
        test('flawed direct DOM appendChild causes empty group sections', () => {
            // Reproduces the exact DOM corruption that happened in the original bug
            const view_container = {
                children: [],
                appendChild(item) {
                    // Detach from current parent
                    if (item.parent && item.parent.children) {
                        const idx = item.parent.children.indexOf(item);
                        if (idx >= 0) item.parent.children.splice(idx, 1);
                    }
                    item.parent = view_container;
                    view_container.children.push(item);
                },
                querySelectorAll(sel) {
                    if (sel === '.card') {
                        const cards = [];
                        view_container.children.forEach(section => {
                            if (section.items_container) {
                                cards.push(...section.items_container.children);
                            }
                        });
                        return cards;
                    }
                    return [];
                }
            };

            const card1 = { className: 'card', dataset: { name: 'file1.txt' }, parent: null };
            const card2 = { className: 'card', dataset: { name: 'file2.txt' }, parent: null };
            const itemsContainer = { className: 'recent_date_items', children: [card1, card2] };
            card1.parent = itemsContainer;
            card2.parent = itemsContainer;

            const groupSection = {
                className: 'recent_date_group',
                items_container: itemsContainer,
                children: [itemsContainer]
            };
            view_container.children.push(groupSection);

            // Before sorting, items are inside group
            expect(itemsContainer.children.length).toBe(2);

            // Buggy legacy behavior: querySelectorAll('.card').forEach(item => view_container.appendChild(item))
            const items = Array.from(view_container.querySelectorAll('.card'));
            items.forEach(item => view_container.appendChild(item));

            // Group section is now left completely EMPTY!
            expect(itemsContainer.children.length).toBe(0);
            // And cards were dumped directly into view_container
            expect(view_container.children.includes(card1)).toBe(true);
            expect(view_container.children.includes(card2)).toBe(true);
        });

        test('re-rendering via get_view preserves cards inside group sections with no empty groups', () => {
            const utilities = createMockUtilities();
            const files = [
                { name: 'b.pdf', content_type: 'application/pdf', size: 200 },
                { name: 'a.pdf', content_type: 'application/pdf', size: 100 },
            ];

            function simulateGetView(files_arr, sort_by, sort_direction, group_by) {
                let file_groups = group_files(files_arr, group_by);
                const view_container = { sections: [] };

                if (file_groups) {
                    file_groups.forEach((group) => {
                        group.files = utilities.sort(group.files, sort_by, sort_direction);
                    });
                    file_groups = file_groups.filter((group) => group.files.length > 0);

                    file_groups.forEach((group) => {
                        const section = {
                            label: group.label,
                            items: group.files.map(f => ({ name: f.name }))
                        };
                        view_container.sections.push(section);
                    });
                }
                return view_container;
            }

            const rendered = simulateGetView(files, 'name', 'asc', 'Type');
            expect(rendered.sections.length).toBe(1);
            expect(rendered.sections[0].label).toBe('Documents');
            expect(rendered.sections[0].items.length).toBe(2);
            expect(rendered.sections[0].items[0].name).toBe('a.pdf');
            expect(rendered.sections[0].items[1].name).toBe('b.pdf');
        });
    });

    describe('FileManager apply_sort Unit Simulation', () => {
        let fileManager;
        let settingsManager;
        let tabManager;
        let activeTabContent;
        let inactiveTabContent;

        beforeEach(() => {
            activeTabContent = {
                dataset: { id: '1' }
            };
            inactiveTabContent = {
                dataset: { id: '2' }
            };

            const storedSettings = {
                sort_by: 'mtime',
                sort_direction: 'desc',
                schema: {
                    properties: {
                        'Default View': {
                            properties: {
                                'Sort By': { default: 'mtime' },
                                'Sort Direction': { default: 'desc' },
                                'Group By': { default: 'Type' }
                            }
                        }
                    }
                }
            };

            settingsManager = {
                get_settings: jest.fn(() => storedSettings),
                update_settings: jest.fn((s) => Object.assign(storedSettings, s))
            };

            const tabData = [
                {
                    tab_id: 1,
                    files_arr: [
                        { name: 'doc2.txt', content_type: 'text/plain' },
                        { name: 'doc1.txt', content_type: 'text/plain' }
                    ]
                },
                {
                    tab_id: 2,
                    files_arr: [
                        { name: 'photo.png', content_type: 'image/png' }
                    ]
                }
            ];

            tabManager = {
                get_active_tab_content: jest.fn(() => activeTabContent),
                get_tab_data_arr: jest.fn((id) => {
                    const found = tabData.find(t => t.tab_id === parseInt(id));
                    return found ? found.files_arr : [];
                })
            };

            fileManager = {
                sort_by: 'mtime',
                sort_direction: 'desc',
                settings: storedSettings,
                recent_files_arr: [],
                virtual_view: null,
                virtual_view_threshold: 100,
                getViewCalledWith: null,

                is_recent_tab_content(tab) {
                    return false;
                },
                get_group_by_setting() {
                    return settingsManager.get_settings()?.schema?.properties?.['Default View']?.properties?.['Group By']?.default || 'None';
                },
                get_view(files) {
                    this.getViewCalledWith = files;
                },

                // Extracted apply_sort method under test
                apply_sort(sort, sort_direction) {
                    if (sort !== undefined && sort !== null && sort !== '') {
                        this.sort_by = sort;
                    }
                    if (sort_direction !== undefined && sort_direction !== null && sort_direction !== '') {
                        this.sort_direction = sort_direction;
                    }

                    const latest_settings = settingsManager.get_settings() || {};
                    if (latest_settings?.schema?.properties?.['Default View']?.properties?.['Sort By']) {
                        latest_settings.schema.properties['Default View'].properties['Sort By'].default = this.sort_by;
                    }
                    if (latest_settings?.schema?.properties?.['Default View']?.properties?.['Sort Direction']) {
                        latest_settings.schema.properties['Default View'].properties['Sort Direction'].default = this.sort_direction;
                    }
                    latest_settings.sort_by = this.sort_by;
                    latest_settings.sort_direction = this.sort_direction;
                    settingsManager.update_settings(latest_settings);
                    this.settings = latest_settings;

                    const active_tab = tabManager.get_active_tab_content();
                    const is_recent = this.is_recent_tab_content(active_tab);
                    const group_by = this.get_group_by_setting();
                    const tab_files = active_tab ? tabManager.get_tab_data_arr(active_tab.dataset.id) : null;
                    const files_arr = is_recent
                        ? this.recent_files_arr
                        : ((Array.isArray(tab_files) && tab_files.length > 0) ? tab_files : this.files_arr);

                    const is_virtual = (this.virtual_view && active_tab && this.virtual_view.active_tab_content === active_tab)
                        || (Array.isArray(files_arr) && files_arr.length >= this.virtual_view_threshold);

                    if (is_recent || group_by !== 'None' || is_virtual) {
                        if (Array.isArray(files_arr)) {
                            this.get_view(files_arr);
                        }
                    }

                    // Invalidate inactive tabs
                    [activeTabContent, inactiveTabContent].forEach((tab_content) => {
                        if (tab_content !== active_tab) {
                            tab_content.dataset.groupingStale = 'true';
                        }
                    });
                }
            };
        });

        test('apply_sort updates settings, invokes get_view with tab files, and marks inactive tabs stale', () => {
            expect(() => {
                fileManager.apply_sort('name', 'asc');
            }).not.toThrow();

            expect(fileManager.sort_by).toBe('name');
            expect(fileManager.sort_direction).toBe('asc');
            expect(settingsManager.update_settings).toHaveBeenCalled();
            expect(fileManager.getViewCalledWith).toHaveLength(2);
            expect(fileManager.getViewCalledWith[0].name).toBe('doc2.txt');

            // Inactive tab is marked groupingStale so it refreshes on tab switch
            expect(inactiveTabContent.dataset.groupingStale).toBe('true');
            expect(activeTabContent.dataset.groupingStale).toBeUndefined();
        });

        test('apply_sort does not throw ReferenceError when item is not defined', () => {
            expect(() => {
                fileManager.apply_sort('size', 'desc');
            }).not.toThrow();
        });

        test('column header click toggles direction on same column and defaults to asc on new column', () => {
            const handleSort = (col, fm) => {
                const next_direction = (fm.sort_by === col.dataset.col_name)
                    ? (fm.sort_direction === 'asc' ? 'desc' : 'asc')
                    : 'asc';
                fm.apply_sort(col.dataset.col_name, next_direction);
            };

            fileManager.sort_by = 'name';
            fileManager.sort_direction = 'asc';

            // Clicking same column toggles to desc
            handleSort({ dataset: { col_name: 'name' } }, fileManager);
            expect(fileManager.sort_by).toBe('name');
            expect(fileManager.sort_direction).toBe('desc');

            // Clicking same column again toggles back to asc
            handleSort({ dataset: { col_name: 'name' } }, fileManager);
            expect(fileManager.sort_by).toBe('name');
            expect(fileManager.sort_direction).toBe('asc');

            // Clicking a new column defaults to asc
            handleSort({ dataset: { col_name: 'size' } }, fileManager);
            expect(fileManager.sort_by).toBe('size');
            expect(fileManager.sort_direction).toBe('asc');
        });
    });
});
