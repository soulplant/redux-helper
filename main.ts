import * as ts from "typescript";

const options: ts.CompilerOptions = {};
const program = ts.createProgram(["data/actions.ts"], options);
const source = program.getSourceFile("data/actions.ts");

interface ActionField {
  name: string;
  type: string;
}

interface ActionDesc {
  name: string;
  fields: ActionField[];
}

/** Converts an interface declaration to an action. */
function interfaceToActionDesc(imp: ts.InterfaceDeclaration): ActionDesc {
  const name = imp.name.text;
  const fields: ActionField[] = [];
  imp.forEachChild(n => {
    if (n.kind == ts.SyntaxKind.PropertySignature) {
      const p = n as ts.PropertySignature;
      fields.push({
        name: p.name.getText(source),
        type: p.type.getText(source),
      });
    }
  });
  return { name, fields };
}

/** Attempts to parse an action from a node, returning null if it fails. */
const parseAction = (node: ts.Node): ActionDesc | null => {
  const result: ActionDesc[] = [];
  if (node.kind == ts.SyntaxKind.InterfaceDeclaration) {
    const imp = node as ts.InterfaceDeclaration;
    return interfaceToActionDesc(imp);
  }
  return null;
};

/** Returns all ActionDescs within a TS source file. */
function extractActionDescs(source: ts.SourceFile): ActionDesc[] {
  const actions: ActionDesc[] = [];
  source.forEachChild(n => {
    const action = parseAction(n);
    if (action) {
      actions.push(action);
    }
  });
  return actions;
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
function genEnum(actions: ActionDesc[]): string {
  const result: string[] = [];
  result.push(`export enum Actions {`);
  result.push(
    ...actions.map(a => `  ${toUnixStyle(a.name)} = "${toUnixStyle(a.name)}",`)
  );
  result.push(`};`);
  return result.join("\n");
}

/** Returns the type definition that embodies the given action. */
function genActionType(action: ActionDesc): string {
  const result: string[] = [
    `interface ${action.name}Action extends actions.${
      action.name
    }, redux.Action {`,
    `  kind: typeof Actions.${toUnixStyle(action.name)}`,
    `};`,
  ];
  return result.join("\n");
}

/** Returns the type that is a union of all the action types. */
function genActionsUnion(actions: ActionDesc[]): string {
  const result: string[] = [];
  return [
    `export type Action = `,
    ...actions.map(a => `  | ${a.name}Action`),
  ].join("\n");
}

/** Returns the action type definitions as well as their union. */
function genActionTypes(actions: ActionDesc[]): string {
  const actionTypes = actions.map(genActionType);
  const actionsUnion = genActionsUnion(actions);
  return [...actionTypes, actionsUnion].join("\n\n");
}

/** Returns its input with the first letter lowercased. */
function uncapitalise(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/** Returns the action creator for the given action. */
function genActionCreator(action: ActionDesc): string {
  const actionType = action.name + "Action";
  const actionCreator = uncapitalise(action.name);
  return [
    `function ${actionCreator}(`,
    ...action.fields.map(f => `  ${f.name}: ${f.type},`),
    `): ${actionType} {`,
    `  return {`,
    ...action.fields.map(f => `    ${f.name},`),
    `  };`,
    `}`,
  ].join("\n");
}

/** Returns the action creators for the given actions. */
function genActionCreators(actions: ActionDesc[]): string {
  return actions.map(genActionCreator).join("\n\n");
}

const actions = extractActionDescs(source);

// actions.forEach(a => {
//   console.log(a);
// });
console.log(`import * as redux from "redux"`);
console.log(`import * as actions from "./actions";\n\n`);
console.log(genEnum(actions));
console.log(genActionTypes(actions));
console.log("\n");
console.log(genActionCreators(actions));

// ts.forEachChild(source, explore);
// explore(source);

// ts.forEachChild(source, explore);
// source.forEachChild(n => console.log(n));

// const emitResult = program.emit();
