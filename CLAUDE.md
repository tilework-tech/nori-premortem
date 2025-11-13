# Style guide.

## Functions and named parameters.

All functions except class functions should be arrow functions. All of them
should use named args, even if there is a single parameter. Follow this
pattern throughout:

```ts
const foo = (args: { bar: string; baz: number }) => {
  const { bar, baz } = args;
};
```

To set defaults, use the 'withDefaults' helper found in server/src/utils/defaults.ts or
ui/src/utils/defaults.ts:

```ts
import { withDefaults } from '@/utils/defaults';

const foo = (args: { bar?: string; baz?: number }) => {
  const { bar, baz } = withDefaults(args, { bar: 'hello', baz: 10 });
};
```

## @ Imports.

Always import files from the package root. For example, instead of `../foo/bar`
import using `@/foo/bar`.

## Singleton classes.

Private constructors are fine, but do not have empty private constructors.
Empty constructors should just be deleted.

## Null vs optional types and parameters.

All optional types should also be able to be set to null. Never do:

```
const foo = (args: { bar?: string }) => {}
```

Always do:

```
const foo = (args: { bar?: string | null }) => {}
```

## Null checks.

Always use `if (foo == null)` instead of `if (foo === undefined)` or `if (!foo)`.

## try catch error handling.

Only use try/catch on system boundaries. Allow failures to bubble up in
intermediate calls. Do not have try catch handlers for every function, as this
masks the stack trace where the try catch originates.

## Run `npm run format` and `npm run lint`

After ANY changes to the codebase, ALWAYS run `npm run format` and `npm run lint` to catch and fix lint errors.

<system-reminder>ALWAYS fix failing tests, even if they aren't caused by you</system-reminder>
