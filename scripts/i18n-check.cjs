// Lists the English UI text with no Arabic yet: every tr("…") / phrase("…")
// in src, every labels({ … }) value, and the error messages the pages show
// through tr(error) — `new Error("…")` in the app and `{ error: "…" }` from
// its API. Run: npm run i18n:check  (add --json for a machine-readable list)
const ts = require("typescript");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "src");
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(e.name) && !p.includes(`${path.sep}i18n${path.sep}`)) files.push(p);
  }
})(root);

const keys = new Map(); // text -> first place it's used
const add = (text, file, node, sf) => {
  if (!/[A-Za-z]{2,}/.test(text) || keys.has(text)) return;
  keys.set(text, `${path.relative(path.join(root, ".."), file)}:${sf.getLineAndCharacterOfPosition(node.getStart()).line + 1}`);
};
const literal = (n) => n && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n));

for (const file of files) {
  const src = fs.readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const isApi = file.includes(`${path.sep}api${path.sep}`);
  const visit = (n) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) {
      const name = n.expression.text;
      const arg = n.arguments[0];
      if ((name === "tr" || name === "phrase") && arg) {
        if (literal(arg)) add(arg.text, file, arg, sf);
        // tr(cond ? "a" : "b", …)
        if (ts.isConditionalExpression(arg)) [arg.whenTrue, arg.whenFalse].forEach((x) => literal(x) && add(x.text, file, x, sf));
        // tr(body.error ?? "fallback")
        if (ts.isBinaryExpression(arg) && literal(arg.right)) add(arg.right.text, file, arg.right, sf);
      }
      if (name === "labels" && arg && ts.isObjectLiteralExpression(arg)) {
        for (const p of arg.properties) if (ts.isPropertyAssignment(p) && literal(p.initializer)) add(p.initializer.text, file, p.initializer, sf);
      }
    }
    if (ts.isNewExpression(n) && n.expression.getText() === "Error" && n.arguments?.[0]) {
      const a = n.arguments[0];
      if (literal(a)) add(a.text, file, a, sf);
      if (ts.isBinaryExpression(a) && literal(a.right)) add(a.right.text, file, a.right, sf);
    }
    if (isApi && ts.isPropertyAssignment(n) && n.name.getText() === "error" && literal(n.initializer)) add(n.initializer.text, file, n.initializer, sf);
    // A getter label: get label() { return phrase("…"); } is caught above.
    ts.forEachChild(n, visit);
  };
  visit(sf);
}

// The Arabic dictionary, read as data.
const arSrc = fs.readFileSync(path.join(root, "lib", "i18n", "phrases.ar.ts"), "utf8");
const arSf = ts.createSourceFile("ar.ts", arSrc, ts.ScriptTarget.Latest, true);
const have = new Set();
arSf.forEachChild(function find(n) {
  if (ts.isPropertyAssignment(n) && n.parent && ts.isObjectLiteralExpression(n.parent) && ts.isVariableDeclaration(n.parent.parent)) {
    have.add(ts.isStringLiteral(n.name) || ts.isNoSubstitutionTemplateLiteral(n.name) ? n.name.text : n.name.getText());
  }
  ts.forEachChild(n, find);
});

const missing = [...keys].filter(([k]) => !have.has(k));
const unused = [...have].filter((k) => !keys.has(k));
if (process.argv.includes("--json")) {
  console.log(JSON.stringify(missing.map(([k]) => k), null, 1));
} else {
  for (const [k, where] of missing) console.log(`${where}\t${k}`);
  console.error(`\n${keys.size} phrases, ${missing.length} without Arabic, ${unused.length} Arabic entries not written as literals here (data, labels() or retired).`);
  if (process.argv.includes("--unused")) unused.forEach((k) => console.error(`unused\t${k}`));
}
process.exitCode = missing.length ? 1 : 0;
