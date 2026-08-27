# The Goldilocks Principle of Learning Rates

An interactive, presentation-style visualization of how learning rate changes gradient descent. Choose **Too low**, **Too large**, or **Just right**, then watch the same optimization problem unfold with a distinct trajectory and loss curve.

## Live demos

- [GitHub Pages](https://csprofkgd.github.io/goldilocks-learning-rates/)
- [ChatGPT Sites](https://goldilocks-learning-rates.csprofkgd.chatgpt.site/)

## Highlights

- Smooth 3D paraboloid rendered with WebGL depth testing
- Deterministic gradient-descent paths derived from the actual update rule
- Animated camera transition, surface contours, ball entrance, trail, and loss plot
- Responsive desktop and mobile layouts
- Reduced-motion support
- Three fixed learning-rate presets that demonstrate slow progress, convergence, and divergence

## Development

Requires Node.js 22.13 or newer.

```bash
pnpm install
pnpm run dev
```

Production checks:

```bash
pnpm run build
pnpm run build:pages
node --test tests/rendered-html.test.mjs
```

The regular build targets the Vinext/Cloudflare deployment. The Pages build creates a standalone static version in `dist-pages/`.

## GitHub Pages

The workflow in `.github/workflows/pages.yml` builds and publishes the static experience whenever `main` is updated. It can also be run manually from the Actions tab.
