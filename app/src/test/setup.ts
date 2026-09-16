import 'fake-indexeddb/auto'
import { vi } from 'vitest'

vi.mock('../config', () => ({ demoMode: true, databaseName: 'RRWRS-Demo-Test' }))
