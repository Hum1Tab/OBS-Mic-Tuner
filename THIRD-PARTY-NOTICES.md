# Third-party software

In the preview ZIP, the license files below are in the licenses/ folder using the same basenames.

## RNNoise WebAssembly wrapper

@shiguredo/rnnoise-wasm 2025.1.5

Copyright 2021-2025, Takeru Ohta (Original Author)
Copyright 2021-2025, Shiguredo Inc.

Apache License 2.0. The unmodified distribution is copied into app/vendor/rnnoise.js.
Full license: app/vendor/LICENSE-rnnoise-wasm.txt.
Source: https://github.com/shiguredo/rnnoise-wasm/tree/2025.1.5

## RNNoise library embedded in WASM

Upstream revision: 70f1d256acd4b34a572f999a05c87bf00b67730d, as pinned by the wrapper build script.

Copyright (c) 2007-2017, 2024 Jean-Marc Valin
Copyright (c) 2023 Amazon
Copyright (c) 2017, Mozilla
Copyright (c) 2005-2017, Xiph.Org Foundation
Copyright (c) 2003-2004, Mark Borgerding

BSD-style license: app/vendor/LICENSE-rnnoise.txt.
Source: https://github.com/xiph/rnnoise/tree/70f1d256acd4b34a572f999a05c87bf00b67730d

## Electron and Chromium

Electron 44.2.0 and its third-party components are included in the executable distribution. Electron's LICENSE.electron.txt and Chromium's LICENSES.chromium.html accompany the distribution in the licenses folder. Development dependency versions are pinned in package-lock.json.

## OBS Studio reference

OBS is not included in the application distribution. The optional native differential test uses the user's separately installed OBS 32.2.2 in an isolated process. The application's numerical dynamics model is an independent implementation of standard signal-processing equations; it does not link to OBS. This product is not affiliated with or endorsed by OBS Project.
