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
COMIC_MOTION_VIDEO_OBJECT_PATH=comics/rise-of-vector/Arcade-Earth-Rise-of-Vector-Motion-Comic-7.1.mp4
```


The motion comic uses a fast-start H.264/AAC MP4 with `video/mp4` content type in the same private bucket. Watch and download permissions share this object. Video URLs expire after four hours; PDF URLs after 15 minutes. Ultimate Bundle bonuses are future access, represented by the existing bonus entitlement marker.
