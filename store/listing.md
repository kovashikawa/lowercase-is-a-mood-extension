# Chrome Web Store listing: Lowercase Is a Mood v0.1.0

Paste each block into the matching field of the developer dashboard.

## Store listing tab

**Name**
Lowercase Is a Mood

**Summary** (manifest description, 46 of 132 characters)
A display-only lowercase switch for each site.

**Category**
Fun

**Language**
English

**Description**
I made this because some pages shout. Titles, buttons and menus in capitals pull your eye before you have read a word. Lowercase Is a Mood puts a single a/A switch in your toolbar. Click it and the current site renders in lowercase. Click again and the original case is back.

How it works
- Open the popup and click a/A. The bold letter is the active mode: a for lowercase, A for original case.
- The choice is saved per site, so that site stays lowercase on reload and in new tabs, and other sites are untouched.
- It changes how text is displayed with one CSS rule. It does not rewrite page text, form values, or page source.

Privacy
- No network requests, no analytics, no accounts, no remote code.
- The only thing stored is one on/off value per site, in your browser's local storage on your device.
- The code is public and small, and every release is built in public CI with a signed build provenance attestation: https://github.com/kovashikawa/lowercase-is-a-mood-extension

Good to know
- It lowercases everything on the page, including code and acronyms. That is the mood.
- Chrome does not let extensions change its internal pages or the Web Store, and some embedded or shadow DOM content cannot be changed.
- Pages that were open before you installed it need one reload.

Support: dev@kovashikawa.com

**Screenshot**
`screenshot-1280x800.png` (1280x800, 24-bit PNG, no alpha). It shows the same page in original case and in lowercase, with the popup in each state.

**Homepage URL**
https://github.com/kovashikawa/lowercase-is-a-mood-extension

**Support URL**
https://github.com/kovashikawa/lowercase-is-a-mood-extension/issues

## Privacy practices tab

**Single purpose**
Lets the user switch the text of the current website between lowercase and its original case, as a display-only change, and remembers the choice per site.

**Permission justification: storage**
Saves one on/off value per site origin in chrome.storage.local, so a site the user switched to lowercase stays lowercase on reload and in new tabs. Nothing else is stored, and it never leaves the device.

**Host permission justification (content script on all sites)**
The toggle has to work on whatever site the user is reading, so the content script matches all URLs. It does one thing: it adds or removes a single class on the page's root element, and a CSS rule on that class sets text-transform to lowercase. It runs at document start so a site the user already chose to see in lowercase never flashes in its original case. It does not read page content, collect data, or make network requests.

**Remote code**
No, I am not using remote code. All JavaScript and CSS ships inside the extension package.

**Data usage**
Collects none of the listed data types. Leave every box unchecked.

Certify all three statements:
- I do not sell or transfer user data to third parties, outside of the approved use cases.
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

**Privacy policy URL**
https://github.com/kovashikawa/lowercase-is-a-mood-extension/blob/main/PRIVACY.md
(live now: the repo is public and PRIVACY.md is on main)

## Distribution tab

**Visibility**
Public. Unlisted is the option if you want a link-only first release.

**Upload**
Use the zip attached to the v0.1.0 GitHub Release, not a local build, so the store copy traces to the attested build.
