# Forge public website

Static product, privacy and support pages. Assets are self-hosted; the site has no application backend or analytics. The theme control saves only `forge-site-theme` in browser local storage.

Serve locally with `python3 -m http.server 9021 --directory website`. Check the landing, privacy and support pages in both themes and configured phone browser profiles. App screenshots are preview captures with fictional data, not native-device evidence.

GitHub Pages publishes the root of the dedicated `gh-pages` branch at https://rodrigomaia06.github.io/forge/. That branch contains only the site's public HTML, CSS, JavaScript, `.nojekyll` and `assets/`. Keep website source changes separate from unfinished app work when publishing. Do not upload this maintenance README or private data to the deployment.

App Store Connect URLs:

- Privacy: https://rodrigomaia06.github.io/forge/privacy.html
- Support: https://rodrigomaia06.github.io/forge/support.html

The hero uses a generated decorative hand-and-phone cutout (`assets/hero-hand.webp`) with a real Forge capture layered inside it. The image was created with the built-in image-generation tool using a front-facing black portrait phone, a natural hand, a blank screen and a transparent background; only its encoding was changed to WebP. The separate hero captures match the screen opening's aspect ratio so the app fills it without stretching. No third-party mockup asset or code is bundled.

The static icon sprite copies only the used icons from the installed Tabler package. Its MIT notice is retained in `assets/TABLER-LICENSE.txt`. The screenshot strip supports touch scrolling and arrow keys, with explicit previous/next buttons and native dialog previews. Without JavaScript, screenshots remain directly scrollable.

When publishing CSS or JavaScript changes, update their version query in all three HTML pages together so cached files from older layouts cannot mix with the new markup.
