module.exports = [
  { key: 'finance', basePath: '/finance', factory: require('./finance') },
  { key: 'tasks', basePath: '/tasks', factory: require('./tasks') },
  { key: 'notes', basePath: '/notes', factory: require('./notes') },
  { key: 'calendar', basePath: '/calendar', factory: require('./calendar') },
  { key: 'relationships', basePath: '/relationships', factory: require('./relationships') },
  { key: 'automations', basePath: '/automations', factory: require('./automations') },
  { key: 'account', basePath: '/account', factory: require('./account') },
  { key: 'billing', basePath: '/billing', factory: require('./billing') },
  { key: 'timeclock', basePath: '/timeclock', factory: require('./timeclock') },
  { key: 'assistant', basePath: '/assistant', factory: require('./assistant') },
];
