#!/usr/bin/env node
import * as ts from "typescript";

/** A single field of an action. */
interface ActionField {
  name: string;
  type: string;
  optional: boolean;
}

/** An action is defined by its name and what fields it has. */
interface ActionDesc {
  name: string;
  fields: ActionField[];
}

/** Converts an interface declaration to an action. */
function interfaceToActionDesc(
  source: ts.SourceFile,
  imp: ts.InterfaceDeclaration
): ActionDesc {
  const name = imp.name.text;
  const fields: ActionField[] = [];
  imp.forEachChild(n => {
    if (n.kind == ts.SyntaxKind.PropertySignature) {
      const p = n as ts.PropertySignature;
      const optional = !!p.questionToken;
      fields.push({
        name: p.name.getText(source),
        type: p.type.getText(source),
        optional
      });
    }
  });
  return { name, fields };
}

/** Attempts to parse an action from a node, returning null if it fails. */
const parseAction = (
  source: ts.SourceFile,
  node: ts.Node
): ActionDesc | null => {
  const result: ActionDesc[] = [];
  if (node.kind == ts.SyntaxKind.InterfaceDeclaration) {
    const imp = node as ts.InterfaceDeclaration;
    return interfaceToActionDesc(source, imp);
  }
  return null;
};

/** Returns all ActionDescs within a TS source file. */
function extractActionDescs(source: ts.SourceFile): ActionDesc[] {
  const actions: ActionDesc[] = [];
  source.forEachChild(n => {
    const action = parseAction(source, n);
    if (action) {
      actions.push(action);
    }
  });
  return actions;
}

/** Returns all import statements in a TS source file. */
function extractImports(source: ts.SourceFile): string[] {
  const result: string[] = [];
  source.forEachChild(n => {
    if (n.kind == ts.SyntaxKind.ImportDeclaration) {
      result.push(n.getFullText(source));
    }
  });
  return result;
}

/** Converts from fooBar to FOO_BAR. */
function toUnixStyle(str: string): string {
  return str
    .split(/()(?=[A-Z])/g)
    .map(s => s.toUpperCase())
    .filter(s => s)
    .join("_");
}

/** Returns the enum that contains the names of all actions. */
function genActionsEnum(actions: ActionDesc[]): string {
  const result: string[] = [];
  result.push(`export enum Actions {`);
  result.push(
    ...actions.map(a => `  ${toUnixStyle(a.name)} = "${toUnixStyle(a.name)}",`)
  );
  result.push(`}`);
  return result.join("\n");
}

/** Returns the type definition that embodies the given action. */
function genActionType(action: ActionDesc): string {
  const result: string[] = [
    `export interface ${action.name}Action extends PayloadAction<actions.${
      action.name
    }> {`,
    `  type: typeof Actions.${toUnixStyle(action.name)};`,
    `}`
  ];
  return result.join("\n");
}

/** Returns the type that is a union of all the action types. */
function genActionsUnion(actions: ActionDesc[]): string {
  const result: string[] = [];
  return [
    `export type Action = `,
    ...actions.map(a => `  | ${a.name}Action`),
    `  ;`
  ].join("\n");
}

/** Returns the action type definitions as well as their union. */
function genActionTypes(actions: ActionDesc[]): string {
  return actions.map(genActionType).join("\n\n");
}

/** Returns its input with the first letter lowercased. */
function uncapitalise(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/** Returns the action creator for the given action. */
function genActionCreator(action: ActionDesc): string {
  const actionType = action.name + "Action";
  const actionEnum = toUnixStyle(action.name);
  const actionCreator = uncapitalise(action.name);
  return [
    `export function ${actionCreator}(`,
    ...action.fields.map(
      f => `  ${f.name}${f.optional ? "?" : ""}: ${f.type},`
    ),
    `): ${actionType} {`,
    `  return {`,
    `    type: Actions.${actionEnum},`,
    `    payload: {`,
    ...action.fields.map(f => `      ${f.name},`),
    `    },`,
    `  };`,
    `}`
  ].join("\n");
}

/** Returns the action creators for the given actions. */
function genActionCreators(actions: ActionDesc[]): string {
  return actions.map(genActionCreator).join("\n\n");
}

/** Accepts lines of text. */
interface Writer {
  /** Consumes a line of text. */
  write(text?: string): void;
}

const payloadActionDefinition = `
interface PayloadAction<P> extends redux.Action {
  payload: P;
}`;

function run(filename: string, writer: Writer): void {
  const options: ts.CompilerOptions = {};
  const program = ts.createProgram([filename], options);
  const source = program.getSourceFile(filename);

  const actions = extractActionDescs(source);
  const imports = extractImports(source);

  writer.write(`import * as redux from "redux"`);
  writer.write(`import * as actions from "./actions";\n`);
  writer.write(imports.join("\n") + "\n");
  writer.write(genActionsEnum(actions));
  writer.write();
  writer.write(payloadActionDefinition);
  writer.write(genActionTypes(actions));
  writer.write();
  writer.write(genActionsUnion(actions));
  writer.write();
  writer.write(genActionCreators(actions));
}

const [filename] = process.argv.slice(2);
run(filename, { write: console.log });
// console.log(process.argv.slice(2));
