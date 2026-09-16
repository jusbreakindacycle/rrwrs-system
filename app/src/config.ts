// Demo data never enters the default operational database, even in a demo build.
export const demoMode = import.meta.env.MODE === 'demo'
export const databaseName = demoMode ? 'RRWRS-Demo' : 'LocalFirstBusinessManager'

