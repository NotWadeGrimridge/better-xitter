better-xitter is a small, chrome-only extension for a better x/twitter experience, written with deno + typescript.

bundle via `deno task build` from `source/` into `dist/chrome/` (manifest + js + html). chrome extension types come from `npm:@types/chrome`.

never add one-liner or trivial helper funcs. no code abstractions unless it's doing real work and genuinely helps with readability. after making changes, run `./lint.sh`. fix every issue the right way.
