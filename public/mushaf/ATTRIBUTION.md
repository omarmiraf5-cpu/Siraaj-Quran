# Mushaf Layout Data & Fonts — Attribution

## Layout data (`public/mushaf/*.json`)

Derived from the [`quran-qcf4`](https://github.com/MohamadHajjRabee/quran-qcf4)
dataset, reshaped into compact per-page files. The upstream JSON data is
released under the MIT License:

> MIT License
>
> Copyright (c) 2026 Mohamad Hajj Rabee
>
> Permission is hereby granted, free of charge, to any person obtaining a copy
> of this software and associated documentation files (the "Software"), to deal
> in the Software without restriction, including without limitation the rights
> to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
> copies of the Software, and to permit persons to whom the Software is
> furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all
> copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
> IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
> FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
> AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
> LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
> OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
> SOFTWARE.

### Format

Each `{page}.json` describes one Madinah Mushaf page:

```jsonc
{
  "f": 11,          // QCF4 font number (1–47) used by this page
  "l": [            // lines (15 on most pages, 8 on pages 1–2)
    [               // each line is a list of segments
      [0, "6:111", "…"]   // [kind, key, glyphChars]
    ]
  ]
}
```

`kind`: `0` word · `1` ayah-end marker · `2` surah header · `3` bismillah ·
`4` quarter/hizb marker.
`key`: `"surah:ayah"` for kinds 0/1/4, surah number for kinds 2/3.
Each character in `glyphChars` is one whole word, rendered by that page's font.

## Fonts

The QCF4 fonts are **not** bundled in this repository. They are loaded at
runtime from jsDelivr's CDN copy of the upstream repository.

The fonts reproduce the Madinah Mushaf (1441 AH), calligraphy by **Uthman
Taha**, produced by the **King Fahd Glorious Qur'an Printing Complex**
(مجمع الملك فهد لطباعة المصحف الشريف), Madinah, Saudi Arabia. The WOFF2 build
was prepared by **Ahmad ElGharib**.

Per the upstream terms, these font files are provided **solely for Qur'anic
rendering purposes**; redistribution, modification, or commercial use without
explicit permission from the rights holders is not permitted. This project
renders the Qur'an for non-commercial educational use and does not redistribute
the font files.
