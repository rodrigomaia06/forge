# Forge public website

Static product, privacy and support pages. Assets are self-hosted; the site has no application backend or analytics. The theme control saves only `forge-site-theme` in browser local storage.

Serve locally on port 9021. A basic `python3 -m http.server 9021 --directory website` serves the pages, but video verification needs an HTTP server that supports byte-range requests. Check the landing, privacy and support pages in both themes and configured phone browser profiles. App screenshots are preview captures with fictional data, not native-device evidence.

GitHub Pages publishes the root of the dedicated `gh-pages` branch at https://rodrigomaia06.github.io/forge/. That branch contains only the site's public HTML, CSS, JavaScript, `.nojekyll` and `assets/`. Keep website source changes separate from unfinished app work when publishing. Do not upload this maintenance README or private data to the deployment.

App Store Connect URLs:

- Privacy: https://rodrigomaia06.github.io/forge/privacy.html
- Support: https://rodrigomaia06.github.io/forge/support.html

The hero uses a generated decorative hand-and-phone cutout (`assets/hero-hand.webp`) with a real Forge capture layered inside it. The image was created with the built-in image-generation tool using a front-facing black portrait phone, a natural hand, a blank screen and a transparent background; only its encoding was changed to WebP. The hero includes short H.264 MP4 recordings with VP8 WebM alternatives of actual browser-rendered Forge set entry with fictional sample data, trimmed and encoded without audio. They are not native-device recordings. The still capture remains available if playback fails or reduced motion is requested. The video pauses when out of view or the tab is hidden, and a labelled control allows manual pause/play. The separate hero captures match the screen opening's aspect ratio so the app fills it without stretching.

The static icon sprite copies only the used icons from the installed Tabler package. Its MIT notice is retained in `assets/TABLER-LICENSE.txt`. Gallery images use 1260 × 2736 browser captures with display insets for the camera and lower edge; a high-resolution downloaded iPhone hardware bezel is layered over each screenshot on a raised panel, with a straight centre phone and tilted side phones on desktop and straight mobile previews. The favicon embeds the original 1024-pixel Forge artwork rather than a resized derivative. The screenshot strip supports touch scrolling and arrow keys, with explicit previous/next buttons and native dialog previews. Without JavaScript, screenshots remain directly scrollable.

When publishing CSS or JavaScript changes, update their version query in all three HTML pages together so cached files from older layouts cannot mix with the new markup.

The gallery bezel (`assets/iphone-frame.webp`, 1311 × 2708) comes from [AppLaunchFlow’s blank iPhone frame](https://www.applaunchflow.com/tools/mockup-generator/iphone-16). Its download page permits commercial use without attribution. The source models iPhone 17 Pro Max-style hardware; it is not an official Apple product image or a native-device capture. The file was served as WebP despite its PNG download name and is retained without pixel edits. The app image stays proportionate inside the display opening.
