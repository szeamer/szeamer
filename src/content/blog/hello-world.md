---
title: Hello world
date: 2026-09-19
description: The first post — what this site is and how it is put together.
---

This is a sample post. Delete it, or edit it into something of your own.

## Writing a new post

Add a markdown file to `src/content/blog/`. The filename becomes the URL, so
`first-frost.md` is served at `/blog/first-frost/`. Every post needs this block
at the top:

```yaml
---
title: First frost
date: 2026-11-02
description: Optional. Used for previews and the RSS feed.
draft: false # optional; drafts are visible locally but skipped on build
---
```

Everything under that is ordinary markdown — **bold**, *italic*, [links](https://astro.build),
lists, quotes and fenced code blocks all work.

> Posts appear on the front page automatically, newest first.
