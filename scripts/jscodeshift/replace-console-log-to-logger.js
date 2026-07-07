/**
 * jscodeshift transform: replace `console.log/info/debug` calls with `logger.debug`
 * Usage (install jscodeshift first):
 *   npx jscodeshift -t scripts/jscodeshift/replace-console-log-to-logger.js <path> --extensions=js,jsx,ts,tsx
 * Example (preview, dry-run):
 *   npx jscodeshift -t scripts/jscodeshift/replace-console-log-to-logger.js src --extensions=js,ts --dry
 */

module.exports = function(fileInfo, api) {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);

  const calls = root.find(j.CallExpression).filter(path => {
    const callee = path.node.callee;
    if (!callee || callee.type !== 'MemberExpression') return false;
    const obj = callee.object;
    const prop = callee.property;
    const isConsole = obj && obj.type === 'Identifier' && obj.name === 'console';
    const name = prop && (prop.type === 'Identifier' ? prop.name : prop.value);
    return isConsole && ['log','info','debug'].includes(name);
  });

  calls.forEach(path => {
    const call = path.node;
    // Replace `console` with `logger` and property with `debug`
    call.callee.object = j.identifier('logger');
    call.callee.property = j.identifier('debug');
  });

  return root.toSource({ quote: 'single' });
};
