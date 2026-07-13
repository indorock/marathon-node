module.exports = {
    apps: [{
        name: 'Marathon Tracker',
        // Run the TypeScript entry directly through tsx (handles ESM
        // extensionless imports that raw `node` can't resolve).
        script: './app.ts',
        interpreter: './node_modules/.bin/tsx',
        // fork mode is required — cluster mode ignores `interpreter` and
        // would run raw `node`, which can't resolve the extensionless imports.
        exec_mode: 'fork',
        instances: 1,
        max_memory_restart: '2048M',
        env: {
            PORT: 4000,
            HOST: '127.0.0.1',
            HOSTNAME: '127.0.0.1',
        },
    }],
};