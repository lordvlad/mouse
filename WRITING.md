# Bücher schreiben

Bücher sind einfache Markdown-Dateien in `public/books/`. Für ein neues Buch oder Kapitel muss kein Code geändert
werden: Die App und der Offline-Speicher folgen den Links zwischen den Dateien. Nach dem Bearbeiten prüfen mit

```bash
bun scripts/check.js
```

Das meldet kaputte Links, unbekannte Dinge und Werte, fehlende Bilder, `{if}` ohne `{end}`, Szenen ohne Ausweg und
unerreichbare Szenen, jeweils mit Datei und Zeile. CI prüft das vor jeder Veröffentlichung.

## Dateien

```
public/books/
  library.md                  Liste der Bücher
  maus/
    book.md                   Titel, Bild, Werte, Dinge, Kapitel
    01-der-kaese.md           ein Kapitel: eine Reihe von Szenen
    02-schlafende-katzen.md
    pics/*.svg                Bilder und Symbole
```

Alle Pfade sind relativ zur Datei, in der sie stehen. `<!-- Kommentare -->` werden überall ignoriert.
Namen (Szenen, Dinge, Werte, Merker) bestehen nur aus `a-z`, Ziffern und `_` (Szenen auch `-`), also ohne Umlaute:
`kruemel`, `grosser_kaese`. Der angezeigte Text darf natürlich Umlaute haben.

### library.md

```markdown
# Bücherei
- [Maus](maus/book.md)
```

### book.md

```markdown
---
titel: Maus
bild: pics/pip.svg
---
Pip ist eine kleine Maus.          <- Klappentext auf der Buchseite (Zeile für Zeile)

## Werte
- mut: Mut ![](pics/star.svg) = 1                 <- name: Anzeige  Symbol  = Startwert

## Dinge
- socke: die Socke ![](pics/sock.svg)             <- name: Anzeige mit Artikel  Symbol

## Kapitel
1. [Der Käse](01-der-kaese.md)
2. [Schlafende Katzen](02-schlafende-katzen.md)
```

- **Werte** sind Zahlen (nie unter 0). Das Kind sieht sie oben als Reihe von Symbolen.
- **Dinge** trägt die Hauptfigur in der Tasche. Ein Ding kann mehrfach da sein (dann erscheint eine Zahl).
  Die Anzeige bekommt den Artikel, denn die App sagt „Gefunden: die Socke!“ und „Weg ist der Krümel!“.
- **Kapitel** öffnen sich nacheinander. Ein Kapitel beginnt mit den Werten, Dingen und Merkern, mit denen das vorige
  geendet hat; was in Kapitel 1 gefunden wurde, hilft also in Kapitel 2. Kapitel 1 beginnt mit den Startwerten und leerer Tasche.
- Statt `titel`/`bild` und `## Werte`/`## Dinge`/`## Kapitel` gehen auch die englischen Namen
  `title`/`cover` und `## Stats`/`## Items`/`## Chapters`.

## Kapitel und Szenen

Ein Kapitel ist eine Liste von Szenen. Eine Szene beginnt mit `# szenen-name`. Die erste Szene ist der Anfang des
Kapitels (oder oben `start: name` angeben).

```markdown
---
titel: Der Käse
---

# zuhause
![Pip, die Maus](pics/pip.svg)
Hallo! Ich bin Pip.
Ich wohne in einem [Loch]{say "Genau richtig für mich!"} in der Wand.
Mein Bauch macht: *grrr*.

[[Aus dem Loch gucken -> gucken]]
[[Im Bett verstecken -> bett]]
```

- Jede Zeile wird als eigene Zeile gezeigt; eine Leerzeile macht etwas Abstand. Für Leseanfänger kurze Zeilen schreiben.
- Ein Bild in der ersten Zeile einer Szene kommt in die große Bildfläche (im Querformat neben dem Text). Weitere Bilder
  stehen im Text.
- `*Wort*` ist schräg, `**WORT**` extra fett.
- Jedes andere Wort kann das Kind antippen, um es gelb zu markieren (eine Lesehilfe; dafür muss man nichts schreiben).

### Auswahl

```markdown
[[Text -> ziel]]
[[Auf den Stuhl klettern -> stuhl | if mut >= 2]]     grau mit Schloss, bis die Bedingung stimmt
[[Den Krümel essen -> essen | only kruemel]]          unsichtbar, bis die Bedingung stimmt
```

Ziele:

| Ziel | Führt zu |
|---|---|
| `szenen-name` | einer Szene in diesem Kapitel |
| `datei.md` / `datei.md#szenen-name` | dem Anfang (oder einer Szene) eines anderen Kapitels im selben Buch |
| `@end` | beendet das Kapitel: „Geschafft!“-Seite, das nächste Kapitel öffnet sich |

Eine verschlossene Auswahl zeigt ein Schloss und die Symbole dessen, was fehlt (`mut >= 2` zeigt zwei Sterne).
Beim Antippen erscheint „Du brauchst:“ mit diesen Symbolen. Jede Szene braucht mindestens eine Auswahl (oder ein
`{go}`), sonst geht es nicht weiter.

### Tipp-Wörter

`[Wort]{Befehle}` macht ein leuchtendes Wort. Beim Antippen laufen die Befehle einmal pro Besuch der Szene; ein `say`
erscheint bei jedem Tippen.

```markdown
Guck mal! Ein [Krümel]{get kruemel} auf dem Boden.
Daneben liegt eine kleine [Glocke]{get glocke; say "Kling, kling!"}.
```

### Befehle

Befehle stehen in `{ }`, mehrere durch `;` getrennt. Befehle außerhalb eines Tipp-Worts laufen, sobald die Szene
betreten wird. Die Befehlswörter sind englisch.

| Befehl | Wirkung |
|---|---|
| `get socke` / `get kruemel 2` | Ding dazu (das Kind sieht „Gefunden: die Socke!“) |
| `lose socke` | Ding weg („Weg ist die Socke!“) |
| `mut +1` / `mut -1` / `mut = 3` | Wert ändern („+1 Mut!“) |
| `set kiki_satt` / `unset kiki_satt` | unsichtbaren Merker setzen oder löschen (merkt sich, was passiert ist) |
| `say "Nur ein alter Besen. Puh!"` | Sprechblase zeigen |
| `go szenen-name` | sofort zu einer anderen Szene springen (Ziele wie bei der Auswahl) |
| `if Bedingung` ... `else` ... `end` | Text, Auswahl und Befehle nur zeigen, wenn die Bedingung stimmt |

`{if}`-Blöcke dürfen über mehrere Zeilen gehen und verschachtelt sein:

```markdown
{if kiki_satt}
„Danke für den Krümel!“, sagt Kiki.
{else}
„Ich habe so großen Hunger“, sagt Kiki.
[[Kiki den Krümel geben -> geben | if kruemel]]
{end}
```

### Bedingungen

Für `{if ...}`, `| if ...` und `| only ...`.

- Ein Name steht für seinen Wert: die Zahl eines Werts, die Anzahl eines Dings oder 1/0 für einen Merker.
  Unbekannte Namen sind 0.
- Vergleichen mit `>= <= > < = !=`, verknüpfen mit `and` (und), `or` (oder), `not` (nicht) und Klammern.

```
kruemel                         hat einen Krümel dabei
not kruemel and not kiki_satt
mut >= 2
(glocke or socke) and mut > 1
```

## Tipps für Leseanfänger

- Kurze Zeilen, ein Gedanke pro Zeile, meist kurze und bekannte Wörter. Klänge wiederholen („Tipp, tapp, tipp, tapp“).
- Nützliches hinter Tipp-Wörtern verstecken, damit genaues Lesen sich lohnt, aber dafür sorgen, dass die Geschichte
  nicht hängen bleibt, wenn ein Kind eins übersieht (einen anderen Weg anbieten oder das Ding später noch einmal geben,
  geschützt mit `{if not ding}`).
- Verschlossene Auswahl macht neugierig; in jeder Szene aber mindestens eine offene Auswahl anbieten.
