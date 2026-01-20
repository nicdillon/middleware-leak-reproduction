const typescriptParser = require("@typescript-eslint/parser");
const typescriptPlugin = require("@typescript-eslint/eslint-plugin");
const noServerModuleState = require("./eslint-rules/no-server-module-state");

module.exports = [
    {
        // Global ignores
        ignores: [
            "**/node_modules/**",
            "**/.next/**",
            "**/dist/**",
            "**/build/**",
        ],
    },
    {
        // Apply to all JS/TS files
        files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
        languageOptions: {
            parser: typescriptParser,
            parserOptions: {
                ecmaVersion: 2021,
                sourceType: "module",
                ecmaFeatures: {
                    jsx: true,
                },
            },
            globals: {
                // Browser globals
                console: "readonly",
                window: "readonly",
                document: "readonly",
                navigator: "readonly",
                fetch: "readonly",

                // Node globals
                process: "readonly",
                __dirname: "readonly",
                __filename: "readonly",
                require: "readonly",
                module: "readonly",
                exports: "readonly",

                // Next.js specific
                React: "readonly",
            },
        },
        plugins: {
            "@typescript-eslint": typescriptPlugin,
            "custom": {
                rules: {
                    "no-server-module-state": noServerModuleState,
                },
            },
        },
        rules: {
            // Custom rule
            "custom/no-server-module-state": "error",

            // TypeScript rules
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-unused-vars": ["warn", {
                argsIgnorePattern: "^_",
                varsIgnorePattern: "^_",
            }],

            // Disable some rules for the POC
            "no-undef": "off", // TypeScript handles this
        },
    },
];
