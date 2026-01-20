/**
 * ESLint Rule: no-server-module-state
 *
 * Prevents module-scope mutable state in server-side code that can leak
 * data between users when Vercel Fluid Compute reuses runtime instances.
 *
 * This rule catches:
 * 1. `let` declarations at module scope
 * 2. `var` declarations at module scope
 * 3. Mutable `const` declarations (objects, arrays) without `as const`
 * 4. Class instances at module scope (except safe containers like AsyncLocalStorage)
 *
 * Only applies to server-side files:
 * - middleware.ts
 * - app/api/ (star)(star)/route.ts
 * - lib/ (star)(star)/ (star).ts (but not lib/ (star)(star)/ (star).tsx)
 */

module.exports = {
    meta: {
        type: "problem",
        docs: {
            description: "Prevent module-scope mutable state in server code (Fluid Compute safety)",
            category: "Possible Errors",
            recommended: true,
        },
        messages: {
            moduleLet:
                "Avoid 'let' at module scope in server code - use request-scoped state instead (Fluid Compute leak risk)",
            moduleVar:
                "Avoid 'var' at module scope in server code - use request-scoped state instead (Fluid Compute leak risk)",
            moduleMutableConst:
                "Avoid mutable objects/arrays at module scope in server code - use 'as const' or request-scoped state (Fluid Compute leak risk)",
            moduleClassInstance:
                "Avoid class instances at module scope in server code - use request-scoped instances or AsyncLocalStorage (Fluid Compute leak risk)",
        },
        schema: [], // no options
    },

    create(context) {
        const filename = context.getFilename();

        // Only check server-side code
        const isServerSide =
            filename.includes("/middleware.") ||
            filename.includes("/route.") ||
            filename.includes("/api/") ||
            (filename.includes("/lib/") && !filename.endsWith(".tsx"));

        if (!isServerSide) {
            return {}; // Skip client-side code
        }

        return {
            VariableDeclaration(node) {
                // Only check module scope (top level of file)
                if (node.parent.type !== "Program") {
                    return;
                }

                // Check for 'let' at module scope
                if (node.kind === "let") {
                    context.report({
                        node,
                        messageId: "moduleLet",
                    });
                }

                // Check for 'var' at module scope
                if (node.kind === "var") {
                    context.report({
                        node,
                        messageId: "moduleVar",
                    });
                }

                // Check for mutable 'const' declarations
                if (node.kind === "const") {
                    node.declarations.forEach((declarator) => {
                        const init = declarator.init;

                        if (!init) return;

                        // Check for objects without 'as const'
                        if (init.type === "ObjectExpression") {
                            // Check if it has 'as const' assertion
                            const parent = init.parent;
                            const hasAsConst =
                                parent?.type === "TSAsExpression" &&
                                parent.typeAnnotation?.type === "TSTypeReference" &&
                                parent.typeAnnotation.typeName?.name === "const";

                            if (!hasAsConst) {
                                context.report({
                                    node: declarator,
                                    messageId: "moduleMutableConst",
                                });
                            }
                        }

                        // Check for arrays (always mutable unless 'as const')
                        if (init.type === "ArrayExpression") {
                            const parent = init.parent;
                            const hasAsConst =
                                parent?.type === "TSAsExpression" &&
                                parent.typeAnnotation?.type === "TSTypeReference" &&
                                parent.typeAnnotation.typeName?.name === "const";

                            if (!hasAsConst) {
                                context.report({
                                    node: declarator,
                                    messageId: "moduleMutableConst",
                                });
                            }
                        }

                        // Check for class instances
                        if (init.type === "NewExpression") {
                            // Allow AsyncLocalStorage (it's a safe container)
                            const isAsyncLocalStorage = init.callee?.name === "AsyncLocalStorage";

                            // Allow Map and Set if they're clearly intended as containers
                            const isContainer = init.callee?.name === "Map" || init.callee?.name === "Set";

                            if (!isAsyncLocalStorage && !isContainer) {
                                context.report({
                                    node: declarator,
                                    messageId: "moduleClassInstance",
                                });
                            }
                        }
                    });
                }
            },
        };
    },
};
