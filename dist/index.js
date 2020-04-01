"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ts = require("typescript");
const path = require("path");
class DiagnosticsChecker {
    constructor(message) {
        this.message = message;
    }
    getErrorMessage(diagnostic) {
        if (diagnostic.file) {
            let { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
            let message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
            return `${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`;
        }
        else {
            return ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
        }
    }
    check(diagnostics) {
        if (diagnostics.length > 0) {
            const errorMessages = diagnostics.map((diagnostic) => this.getErrorMessage(diagnostic));
            throw new Error(`${this.message}:\n${errorMessages.join('\n')}`);
        }
    }
}
class Resolver {
    constructor(options) {
        this.options = Object.assign({}, options, {
            moduleResolution: ts.ModuleResolutionKind.Classic,
        });
        this.host = ts.createCompilerHost(this.options);
    }
    resolve(moduleName, containingFile) {
        const result = ts.resolveModuleName(moduleName, containingFile, this.options, this.host);
        if (result.resolvedModule === undefined) {
            return undefined;
        }
        return result.resolvedModule.resolvedFileName;
    }
}
class Compiler {
    constructor(fileName, options) {
        this.files = new Map();
        this.diagnosticsChecker = new DiagnosticsChecker('Could not compile TypeScript files');
        this.options = Object.assign({}, options, {
            noEmit: false,
            moduleResolution: ts.ModuleResolutionKind.NodeJs,
        });
        const host = ts.createCompilerHost(this.options);
        host.writeFile = (fileName, content) => {
            this.files.set(path.resolve(process.cwd(), fileName), content);
        };
        const program = ts.createProgram([fileName], this.options, host);
        const preEmitDiagnostics = ts.getPreEmitDiagnostics(program);
        this.diagnosticsChecker.check(preEmitDiagnostics);
        const emitResult = program.emit();
        this.diagnosticsChecker.check(emitResult.diagnostics);
    }
    getFile(fileName) {
        return this.files.get(fileName);
    }
}
class ConfigFileParser {
    constructor() {
        this.diagnosticsChecker = new DiagnosticsChecker('Could not parse config file');
    }
    parseConfigFile(overriddenOptions = {}) {
        const diagnostics = [];
        const host = {
            useCaseSensitiveFileNames: ts.sys.useCaseSensitiveFileNames,
            getCurrentDirectory: ts.sys.getCurrentDirectory,
            readDirectory: ts.sys.readDirectory,
            fileExists: ts.sys.fileExists,
            readFile: ts.sys.readFile,
            onUnRecoverableConfigFileDiagnostic(diagnostic) {
                diagnostics.push(diagnostic);
            },
        };
        const result = ts.getParsedCommandLineOfConfigFile('tsconfig.json', overriddenOptions, host);
        if (result === undefined) {
            this.diagnosticsChecker.check(diagnostics);
            throw new Error('getParsedCommandLineOfConfigFile returned undefined');
        }
        this.diagnosticsChecker.check(result.errors);
        return result.options;
    }
}
function default_1() {
    let compiler;
    let resolver;
    return {
        name: 'typescript',
        buildStart(options) {
            const parser = new ConfigFileParser();
            const compilerOptions = parser.parseConfigFile({
                module: ts.ModuleKind.ES2015,
                composite: false,
                noEmitOnError: true,
                outDir: undefined,
                outFile: undefined,
            });
            if (typeof options.input !== 'string') {
                throw new Error('Only single string input supported');
            }
            compiler = new Compiler(options.input, compilerOptions);
            resolver = new Resolver(compilerOptions);
        },
        resolveId(source, importer) {
            if (importer === undefined) {
                const resolved = path.resolve(process.cwd(), source);
                return resolved;
            }
            else {
                const resolved = resolver.resolve(source, importer);
                if (resolved === undefined) {
                    return null;
                }
                return resolved;
            }
        },
        load(id) {
            const replacedId = id.replace(/\.ts$/, '.js');
            const file = compiler.getFile(replacedId);
            if (file === undefined) {
                throw new Error('No such file in compiled files map');
            }
            return file;
        },
    };
}
exports.default = default_1;
