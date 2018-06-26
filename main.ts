#!/usr/bin/env node
import * as ts from "typescript";
import * as minimist from "minimist";

const flags = minimist(process.argv.slice(2));

/** A single field of an action. */
interface ActionField {
  name: string;
  type: string;
  optional: boolean;
}

/**
 * An annotation on an action.
 *
 * Annotations are defined as a comment line with a term of the form:
 *
 * @foo {"key1": "blah", "key2": [1,2,3]}
 *
 * i.e. @<IDENT> [<JSON>]
 *
 * If <JSON> is omitted, it defaults to true.
 */
interface Annotation {
  name: string;
  arg: {};
}

/** An action is defined by its name and what fields it has. */
interface ActionDesc {
  name: string;
  annotations: Annotation[];
  fields: ActionField[];
}

/** Converts an interface declaration to an action. */
function interfaceToActionDesc(
  source: ts.SourceFile,
  imp: ts.InterfaceDeclaration,
  checker: ts.TypeChecker
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
  const symbol = checker.getSymbolAtLocation(imp.name);
  const annotations: Annotation[] = symbol.getJsDocTags().map(tag => ({
    name: tag.name,
    arg: tag.text ? JSON.parse(tag.text) : true,
  } as Annotation));
  return { name, fields, annotations };
}

/** Attempts to parse an action from a node, returning null if it fails. */
const parseAction = (
  source: ts.SourceFile,
  node: ts.Node,
  checker: ts.TypeChecker
): ActionDesc | null => {
  const result: ActionDesc[] = [];
  if (node.kind == ts.SyntaxKind.InterfaceDeclaration) {
    const imp = node as ts.InterfaceDeclaration;
    return interfaceToActionDesc(source, imp, checker);
  }
  return null;
};

/** Returns all ActionDescs within a TS source file. */
function extractActionDescs(source: ts.SourceFile, checker: ts.TypeChecker): ActionDesc[] {
  const actions: ActionDesc[] = [];
  source.forEachChild(n => {
    const action = parseAction(source, n, checker);
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

/** Converts from fooBarBaz to foo bar baz. */
function toSentence(str: string): string {
  return toUnixStyle(str).split("_").map(s => s.toLowerCase()).join(" ");
}

/**
 * Get the name of an action's type, e.g. for action FooBar in the baz feature
 * this will be [baz] foo bar.
 */
function getActionTypeValue(action: ActionDesc): string {
  let prefix = "";
  if (flags.feature) {
    prefix = `[${flags.feature}] `;
  }
  return prefix + toSentence(action.name);
}

/** Returns the enum that contains the names of all actions. */
function genActionsEnum(actions: ActionDesc[]): string {
  const result: string[] = [];
  result.push(`export enum Actions {`);
  result.push(
    ...actions.map(a => `  ${toUnixStyle(a.name)} = "${getActionTypeValue(a)}",`)
  );
  result.push(`}`);
  return result.join("\n");
}

/** Generates the metadata table for this file's actions. */
function genMetadata(actions: ActionDesc[]): string {
  const result: string[] = [];
  result.push(`export const metadata = {`);
  
  result.push(
    ...actions.map(a => `  [Actions.${toUnixStyle(a.name)}]: ${JSON.stringify(getMeta(a), null, 2)},`)
  );
  result.push(`};`);
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

function getMeta(action: ActionDesc): {} {
  const obj = action.annotations.reduce((acc, ann) => {
    acc[ann.name] = ann.arg;
    return acc;
  }, {});
  if (flags.feature) {
    obj["feature"] = flags.feature;
  }
  return obj;
}

/** Returns the action creator for the given action. */
function genActionCreator(action: ActionDesc): string {
  const actionType = action.name + "Action";
  const actionEnum = toUnixStyle(action.name);
  const actionCreator = uncapitalise(action.name);

  const meta = getMeta(action);
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
    `    meta: metadata[Actions.${actionEnum}],`,
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
  meta: {};
}`;

function run(filename: string, writer: Writer): void {
  const options: ts.CompilerOptions = {};
  const program = ts.createProgram([filename], options);
  const source = program.getSourceFile(filename);

  const checker = program.getTypeChecker();

  const actions = extractActionDescs(source, checker);
  const imports = extractImports(source);

  writer.write(`import * as redux from "redux"`);
  writer.write(`import * as actions from "./actions";\n`);
  writer.write(imports.join("\n") + "\n");
  writer.write(genActionsEnum(actions));
  writer.write();
  writer.write(genMetadata(actions));
  writer.write();
  writer.write(payloadActionDefinition);
  writer.write(genActionTypes(actions));
  writer.write();
  writer.write(genActionsUnion(actions));
  writer.write();
  writer.write(genActionCreators(actions));
}

const [filename] = flags._;
run(filename, { write: console.log });
