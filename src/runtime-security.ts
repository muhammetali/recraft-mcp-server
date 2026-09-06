import { z } from 'zod';

// Run before SDK/schema initialization. Use Zod's interpreter instead of
// generating JavaScript functions from schemas at runtime.
z.config({ jitless: true });
