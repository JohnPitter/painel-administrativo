const moduleRegistry = require('../src/modules');

const failures = [];

moduleRegistry.forEach(({ key, factory, basePath }) => {
  if (typeof factory !== 'function') {
    failures.push(`Module "${key}" did not export a factory function (got ${typeof factory}).`);
    return;
  }
  let router;
  try {
    router = factory();
  } catch (error) {
    failures.push(`Module "${key}" threw when instantiated: ${error.message}`);
    return;
  }
  if (!router || typeof router !== 'function' || typeof router.use !== 'function') {
    failures.push(
      `Module "${key}" returned an invalid router for path "${basePath}" (type ${typeof router}).`
    );
  }
});

if (failures.length > 0) {
  console.error('❌ Module validation failed:');
  failures.forEach(failure => console.error(` - ${failure}`));
  process.exit(1);
}

console.log('✅ All module factories returned valid Express routers.');
