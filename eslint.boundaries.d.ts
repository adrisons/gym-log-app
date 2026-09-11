// Type declarations for eslint.boundaries.js, consumed by
// test/boundaries/edge-set.test.ts. eslint.boundaries.js itself stays plain
// JS with JSDoc (it is loaded directly by eslint.config.js at lint time,
// outside the TS compile), but the test that imports it needs types.

export declare const elements: {
  type: string;
  pattern: string | string[];
  mode?: 'file' | 'folder';
}[];

export declare const allowedImports: Record<string, string[]>;

export declare function forbiddenEdges(): { from: string; to: string }[];

export declare function dependencyPolicies(): {
  from: { element: { type: string } };
  allow: { to: { element: { type: string } } }[];
}[];
