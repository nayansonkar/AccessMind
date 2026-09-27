# AccessMind Chrome Extension

## How to Install and Test

1. Run `npm install` to install dependencies.
2. Run `npm run build` to compile the extension.
3. Open Google Chrome and navigate to `chrome://extensions`.
4. Enable **Developer mode** in the top right corner.
5. Click **Load unpacked** and select the `dist` folder (NOT the `public` folder).

## Troubleshooting

- **Error: The default_popup file in the manifest doesn't exist.**
  - **Cause:** You loaded the `public` folder or the root folder instead of the `dist` folder.
  - **Fix:** Make sure you run `npm run build` first, then select the `dist` folder when clicking "Load unpacked".

- **Error: Could not establish connection. Receiving end does not exist.**
  - **Cause:** You tried to use the extension on a restricted Chrome page (like `chrome://extensions` or a New Tab page) where content scripts are not allowed to run.
  - **Fix:** Navigate to a normal webpage (like wikipedia.org or google.com) and try again.
