# Private Assets

Drop paid source files here before uploading them to private Cloud Storage.

Recommended PDF filename:

```text
Arcade-Earth-Rise-of-Vector.pdf
```

Do not put paid PDFs or videos in `public/`, `src/`, `dist/`, or `assets/`.

The live reader and download buttons use Firebase Functions to create short-lived signed URLs from Cloud Storage. The functions need these environment values:

```text
COMIC_ASSET_BUCKET=<private storage bucket>
COMIC_PDF_OBJECT_PATH=comics/rise-of-vector/Arcade-Earth-Rise-of-Vector.pdf
```

