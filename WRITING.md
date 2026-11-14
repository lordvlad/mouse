# Writing books

Books are plain markdown files in `public/books/`. No code changes are needed to add a book or chapter: the app and
the offline cache both follow the links between the files. After editing, run

```bash
bun scripts/check.js
```

It reports broken links, unknown items/stats, missing pictures, unbalanced `{if}`/`{end}`, dead-end scenes and
unreachable scenes, with file and line. CI runs it before every deploy.

## Files

```
public/books/
  library.md              list of books
  mouse/
    book.md               title, cover, stats, items, chapter list
    01-the-cheese.md      a chapter: a set of scenes
    02-sleeping-cats.md
    pics/*.svg            pictures and item icons
```

All paths are relative to the file they appear in. `<!-- comments -->` are ignored everywhere.

### library.md

```markdown
# Library
- [Mouse](mouse/book.md)
```

### book.md

```markdown
---
title: Mouse
cover: pics/pip.svg
---
Pip is a little mouse.            <- blurb, shown on the book page (one line per line)

## Stats
- brave: Brave ![](pics/star.svg) = 1         <- name: Label  icon  = start value

## Items
- sock: Sock ![](pics/sock.svg)                 <- name: Label  icon

## Chapters
1. [The Cheese](01-the-cheese.md)
2. [Sleeping Cats](02-sleeping-cats.md)
```

- **Stats** are numbers (never below 0). The reader sees them as a row of icons at the top.
- **Items** are things the hero carries, shown in the bag. An item can be carried more than once (a count badge appears).
- **Chapters** open one after the other. A chapter starts with the stats, items and flags the previous chapter ended with,
  so things found in chapter 1 can be used in chapter 2. Chapter 1 starts with the stat start values and nothing in the bag.

## Chapters and scenes

A chapter is a list of scenes. A scene starts with `# scene-id` (letters, digits, `-`, `_`). The first scene is where
the chapter starts (or set `start: id` in the front matter).

```markdown
---
title: The Cheese
---

# home
![Pip the mouse](pics/pip.svg)
Hi! I am Pip.
I live in a [hole]{say "Just right for me!"} in the wall.
My tummy says: *grrr*.

[[Peek out of the hole -> peek]]
[[Hide in my bed -> bed]]
```

- Every line is shown as its own line; an empty line adds a little space. Keep lines short for early readers.
- A picture as the first line of a scene goes into the big picture area (beside the text in landscape). Pictures further
  down are shown inline.
- `*word*` is slanted, `**WORD**` is extra bold.
- Any other word can be tapped by the child to mark it yellow (a reading aid; nothing to write).

### Choices

```markdown
[[Label -> target]]
[[Climb up the chair -> chair | if brave >= 2]]     shown greyed with a lock until the condition holds
[[Eat the crumb -> eat | only crumb]]               hidden until the condition holds
```

Targets:

| Target | Goes to |
|---|---|
| `scene-id` | a scene in this chapter |
| `other.md` / `other.md#scene-id` | the start (or a scene) of another chapter of the same book |
| `@end` | finishes the chapter: the "You did it!" page, the next chapter unlocks |

A locked choice shows a lock and the icons of what is missing (`brave >= 2` shows two stars). Tapping it says
"You need:" with those icons. Every scene needs at least one choice (or a `{go}`), otherwise the reader gets stuck.

### Tappable words

`[word]{commands}` makes a glowing word. Tapping it runs the commands once per visit of the scene; a `say` repeats
every tap.

```markdown
Look! A [crumb]{get crumb} on the floor.
Next to it is a little [bell]{get bell; say "Ding, ding!"}.
```

### Commands

Commands go in `{ }`, several separated by `;`. Commands outside a tappable word run when the scene is entered.

| Command | Effect |
|---|---|
| `get sock` / `get crumb 2` | add an item (the child sees "You got the sock!") |
| `lose sock` | remove an item ("Bye, sock!") |
| `brave +1` / `brave -1` / `brave = 3` | change a stat ("+1 Brave!") |
| `set fed_bug` / `unset fed_bug` | set or clear a hidden flag (remembers what happened) |
| `say "Just a mop. Phew!"` | show a speech bubble |
| `go scene-id` | jump straight on to another scene (same targets as choices) |
| `if condition` ... `else` ... `end` | show text, choices and commands only when the condition holds |

`{if}` blocks can span lines and be nested:

```markdown
{if fed_bug}
"Thank you for the crumb!" says Bug.
{else}
"I am so hungry," says Bug.
[[Give Bug the crumb -> give | if crumb]]
{end}
```

### Conditions

Used by `{if ...}`, `| if ...` and `| only ...`.

- A name is its value: a stat's number, an item's count, or 1/0 for a flag. Unknown names are 0.
- Compare with `>= <= > < = !=`, combine with `and`, `or`, `not` and parentheses.

```
crumb                      carrying a crumb
not crumb and not fed_bug
brave >= 2
(bell or sock) and brave > 1
```

## Tips for early readers

- Short lines, one idea per line, mostly short and common words. Repeat sounds ("Tip, tap, tip, tap").
- Put useful things behind tappable words so careful reading pays off, and make sure the story can't get stuck when
  a child misses one (offer another way, or give the item again later, guarded by `{if not item}`).
- Locked choices are a reason to explore; give at least one open choice in every scene.
