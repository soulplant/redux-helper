import * as ts from "typescript";

const options: ts.CompilerOptions = {};
const program = ts.createProgram(["main.ts"], options);

const source = program.getSourceFile("main.ts");

class Logger {
  prefix: string = "";
  indent() {
    this.prefix += "  ";
  }
  outdent() {
    this.prefix = this.prefix.slice(0, this.prefix.length - 2);
  }
  log(msg: string) {
    console.log(this.prefix + msg);
  }
}
const log = new Logger();
const explore = (node: ts.Node) => {
  if (node.kind == ts.SyntaxKind.ImportDeclaration) {
    const imp = node as ts.ImportDeclaration;
    log.log("import");
    // log.log(imp.getFullText(source));
  }
  if (node.kind == ts.SyntaxKind.IfStatement) {
    const ifs = node as ts.IfStatement;
    log.log("if statement");
  }
  log.log("entering child " + node.kind);
  log.indent();
  ts.forEachChild(node, explore);
  log.outdent();
};
source.forEachChild(explore);
// ts.forEachChild(source, explore);
// explore(source);

// ts.forEachChild(source, explore);
// source.forEachChild(n => console.log(n));

// const emitResult = program.emit();
