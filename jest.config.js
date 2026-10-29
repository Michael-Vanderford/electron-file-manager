module.exports = {
    testEnvironment: 'node',
    modulePathIgnorePatterns: ['<rootDir>/dist/'],
    testPathIgnorePatterns: [
        '/node_modules/',
        '/e2e/',
        'autocomplete.test.js',
    ],
};