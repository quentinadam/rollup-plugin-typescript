import * as ts from 'typescript';
import * as rollup from 'rollup';
import * as path from 'path';

class DiagnosticsChecker {
  constructor(private message: string) {}

  private getErrorMessage(diagnostic: ts.Diagnostic) {
    if (diagnostic.file) {
      let { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start!);
      let message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
      return `${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`;
    } else {
      return ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
    }
  }

  check(diagnostics: readonly ts.Diagnostic[]) {
    if (diagnostics.length > 0) {
      const errorMessages = diagnostics.map((diagnostic) => this.getErrorMessage(diagnostic));
      throw new Error(`${this.message}:\n${errorMessages.join('\n')}`);
    }
  }
}

class Resolver {
  private readonly options: ts.CompilerOptions;
  private readonly host: ts.CompilerHost;

  constructor(options: ts.CompilerOptions) {
    this.options = Object.assign({}, options, {
      moduleResolution: ts.ModuleResolutionKind.Classic,
    });
    this.host = ts.createCompilerHost(this.options);
  }

  resolve(moduleName: string, containingFile: string) {
    const result = ts.resolveModuleName(moduleName, containingFile, this.options, this.host);
    if (result.resolvedModule === undefined) {
      return undefined;
    }
    return result.resolvedModule.resolvedFileName;
  }
}

class Compiler {
  private readonly options: ts.CompilerOptions;
  private readonly files = new Map<string, string>();
  private diagnosticsChecker = new DiagnosticsChecker('Could not compile TypeScript files');

  constructor(fileName: string, options: ts.CompilerOptions) {
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

  getFile(fileName: string) {
    return this.files.get(fileName);
  }
}

class ConfigFileParser {
  private diagnosticsChecker = new DiagnosticsChecker('Could not parse config file');

  parseConfigFile(overriddenOptions: ts.CompilerOptions = {}) {
    const diagnostics: ts.Diagnostic[] = [];
    const host: ts.ParseConfigFileHost = {
      useCaseSensitiveFileNames: ts.sys.useCaseSensitiveFileNames,
      getCurrentDirectory: ts.sys.getCurrentDirectory,
      readDirectory: ts.sys.readDirectory,
      fileExists: ts.sys.fileExists,
      readFile: ts.sys.readFile,
      onUnRecoverableConfigFileDiagnostic(diagnostic: ts.Diagnostic) {
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

export default function () {
  let compiler: Compiler;
  let resolver: Resolver;

  return <Partial<rollup.PluginHooks>>{
    name: 'typescript',
    buildStart(options: rollup.InputOptions) {
      const parser = new ConfigFileParser();
      const compilerOptions = parser.parseConfigFile({
        module: ts.ModuleKind.ES2015,
        composite: false,
        noEmitOnError: true,
        outDir: undefined,
        outFile: undefined,
      });
      let input: string;
      if (typeof options.input === 'string') {
        input = options.input;
      } else if (
        typeof options.input === 'object' &&
        options.input instanceof Array &&
        options.input.length === 1 &&
        typeof options.input[0] === 'string'
      ) {
        input = options.input[0];
      } else {
        throw new Error('Only single string input supported');
      }
      compiler = new Compiler(input, compilerOptions);
      resolver = new Resolver(compilerOptions);
    },
    resolveId(source: string, importer: string | undefined) {
      if (importer === undefined) {
        const resolved = path.resolve(process.cwd(), source);
        return resolved;
      } else {
        const resolved = resolver.resolve(source, importer);
        if (resolved === undefined) {
          return null;
        }
        return resolved;
      }
    },
    load(id: string) {
      const replacedId = id.replace(/\.ts$/, '.js');
      const file = compiler.getFile(replacedId);
      if (file === undefined) {
        throw new Error('No such file in compiled files map');
      }
      return file;
    },
  };
}
