# LoveFamily API

Cloudflare Worker source for the protected LoveFamily API. It reads and writes the private `zeroheroxij-arch/lovefamily-data` repository through the GitHub Contents API.

## Deploy

1. Install and authenticate Wrangler: `npx wrangler login`.
2. From this directory, create the Worker secrets: `FAMILY_PASSWORD`, `MOM_PASSWORD`, `SESSION_SECRET`, and `GITHUB_DATA_TOKEN`.
3. Use a GitHub fine-grained token restricted to the private `lovefamily-data` repository with **Contents: Read and write** only.
4. Run `npx wrangler deploy` and configure the public site's API base URL to the generated Worker URL.

The browser never receives the GitHub token or the parent password. The default family password is set as a Worker secret, not copied into the website source.
