# Mäuseabenteuer

Ein Lese-Abenteuer für Erstklässler: Das Kind liest kurze Seiten laut vor, tippt auf Entscheidungen, findet Dinge hinter
leuchtenden Wörtern und wird dabei mutiger. Vorneweg gibt es eine Seite für Eltern (Regeln, Tipps, Schriftgröße, Zurücksetzen).
Erstes Buch: **Maus** (Pip, eine hungrige und nicht sehr mutige Maus) mit den Kapiteln *Der Käse* und *Schlafende Katzen*.

Live: https://lordvlad.github.io/mouse/ (Android-App: `mouse.apk` dort)

Offline-fähige Single-Page-PWA. Statische Dateien in `public/`, kein Build-Schritt.

- **Geschichten:** Markdown in `public/books/` (Bücherei -> Bücher -> Kapitel -> Szenen, mit Dingen, Werten, Merkern,
  Bedingungen und Tipp-Wörtern). Format: [WRITING.md](WRITING.md). Prüfen mit `bun scripts/check.js`.
- **Engine:** `public/story.js` liest und spielt das Format (ohne DOM; der Prüfer nutzt sie auch). Oberfläche und
  gespeicherter Fortschritt (`localStorage`, Schlüssel `mouse-adventures`) stecken in `public/index.html`.
- **Starten:** `bun src/server.ts` (`PORT`, Standard 8790).
- **Offline:** `public/sw.js` speichert die App-Hülle (`ASSETS`) und jede Datei, die von `books/library.md` aus verlinkt
  ist (über Bücher und Kapitel hinweg); neue Geschichten brauchen dort also keine Änderung. CI versieht den Cache-Namen
  mit dem Commit-Hash.
- **Android:** `bun android/build.ts` packt `public/` (mit Geschichten) in eine WebView-App (ohne Gradle; SDK unter
  `$ANDROID_HOME`, Standard `/data/android-sdk`) und schreibt `public/mouse.apk`. Signaturschlüssel:
  `android/mouse-debug.keystore` (in `.gitignore`, wird beim ersten Build erzeugt; Passwort `android`).
- **Spenden:** Das Herz (unten rechts, nur in der Bücherei) öffnet hinter einer Rechenaufgabe einen PayPal-Knopf; in der
  APK öffnet es die PayPal-Seite im System-Browser.

## Veröffentlichen

Push auf `main`; `.github/workflows/pages.yml` prüft die Bücher und veröffentlicht `public/` auf GitHub Pages
(Repo-Einstellungen > Pages > Source: GitHub Actions). CI baut die APK und signiert sie mit dem Secret
`ANDROID_KEYSTORE_B64` (`base64 -w0 android/mouse-debug.keystore`); ohne Secret bekommt jeder Build einen Wegwerf-Schlüssel
und kann eine installierte App nicht aktualisieren. Die Run-Nummer ist der versionCode.
