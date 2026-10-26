# AI Assistant

A beginner-friendly chat app with text, image, voice, and optional web search.
The browser talks to a small Node.js server on this computer; that server sends
AI requests to Google's Gemini API. Ollama is no longer needed to use the app.

## What you need

- Windows
- Node.js 18 or newer and npm
- Internet access
- A Gemini API key created in Google AI Studio

The app uses `gemini-3.1-flash-lite` for text, image understanding, and voice
transcription, and `gemini-nano-banana-2.1` for image generation. Google may
change model availability, pricing, and usage limits.

## Start the app

1. Open PowerShell.
2. Change to this project folder:

   ```powershell
   cd "C:\Users\Srinivas\Documents\local-ai-assistant"
   ```

3. Paste your Gemini key into this secure prompt. The characters you type are
   hidden, and this avoids putting the key directly in your PowerShell command
   history:

   ```powershell
   $secureKey = Read-Host "Paste your Gemini API key" -AsSecureString
   $env:GEMINI_API_KEY = (New-Object System.Net.NetworkCredential("", $secureKey)).Password
   Remove-Variable secureKey
   ```

4. Start the app:

   ```powershell
   npm start
   ```

5. Open <http://127.0.0.1:3000> in your browser. Keep the PowerShell window
   open while using the app. Press **Ctrl+C** there when you are done.

The key exists only in that PowerShell window and the app process. Close the
PowerShell window to clear it. Do not paste your key into chat, browser code,
or project files. Do not enable paid billing unless you deliberately choose a
paid plan.

## Try it

- Ask a question, then ask a follow-up.
- Attach a JPG, PNG, or WebP image (up to 5 MB) and ask Gemini about it. The app
  resizes images to at most 1,280 pixels on their longest side. The latest image
  remains available for follow-up questions; attaching a new one replaces the
  earlier image in the AI context.
- Open the chat and choose the camera button to take a live photo. The browser
  asks for camera permission only after you tap **Start camera**. The photo is
  attached for review and is sent to Gemini only when you send your message.
  Camera access requires `localhost` or HTTPS and a camera-enabled device.
- Click the microphone to record a voice message, then click it again to stop.
  The recording is transcribed by Gemini and appears in the message box for you
  to review before sending. Recordings are limited to 60 seconds.
- Click the headphones button to start hands-free voice chat. Speak, pause, and
  the app transcribes and sends your words, then reads Gemini's reply aloud and
  starts listening again. Click the button again to stop. Spoken replies use a
  voice available in your browser or operating system.
- Choose **Reply language** to have replies follow your message automatically
  or use English, Hindi, Telugu, Tamil, Spanish, French, German, Arabic,
  Japanese, or Chinese.
- Choose **Create image**, describe what you want, and send it to generate an
  image. Use **Download image** under the result to save it.
- Click **Listen** under a reply to hear it with a voice installed in your
  browser or operating system.
- Turn on **Search the web** to search for current information. The query goes
  to Tavily, and its excerpts are sent to Gemini to draft an answer with
  clickable source links. Search is off unless you enable it.
- Use **Shift+Enter** for a new line or **Clear chat** to start over.

## Privacy and free-tier limits

Text, images, and voice recordings are sent to Google's Gemini API for
processing. When web search is enabled, the query is also sent to Tavily. Do
not send passwords, private documents, or other sensitive information.
Image descriptions are sent to Google's image-generation model. Image
generation has separate model availability, quota, and pricing from chat; an
API key working for chat does not guarantee image generation is enabled or free.
The app does not enable paid billing.

Google's free-tier terms may allow submitted content to be used to improve
Google products. The Gemini API free tier has changing rate and usage limits;
requests can stop working temporarily after a limit is reached. Check the
current [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)
before using it heavily. The application does not enable paid billing by
itself.

The AI model runs in Google's cloud, but this current version still runs the
small Node.js web server on your computer. You do not need to run Ollama or a
local speech model. Publishing the web app itself to a cloud host is a separate
step.

Questions asking for the current date, day, or time are answered directly from
your browser's device clock and time zone instead of Gemini, so the model
cannot guess them. Make sure your Windows date, time, and time-zone settings
are correct.

## How it works

1. `public/app.js` sends chat messages, optimized images, or WAV voice
   recordings to this app's local Node.js server.
2. `server.js` keeps the Gemini API key on the server and calls Gemini for chat,
   transcription, and image generation.
3. Gemini streams text replies; the app displays them as they arrive.
4. Optional Tavily search results are passed to Gemini as reference material.

The server listens only on `127.0.0.1`, so it is not available to other
computers on your network. The API key is read from `GEMINI_API_KEY`; it is
never included in browser JavaScript or returned by the status endpoint.

## Project files

- `server.js` serves the page, validates requests, searches Tavily when asked,
  and securely calls Gemini for text, images, and voice transcription.
- `public/index.html` contains the page structure and controls.
- `public/styles.css` controls the layout and appearance.
- `public/app.js` manages chat, image resizing, voice recording, streamed
  answers, and browser speech playback.
- `package.json` defines the Node.js start and development commands.

## Troubleshooting

- **The page does not open:** make sure `npm start` is still running and visit
  <http://127.0.0.1:3000>.
- **The app says `GEMINI_API_KEY` is missing:** set the key in the same
  PowerShell window, then restart the app.
- **Gemini rejects the key:** check that it was copied completely and that
  Gemini API access is enabled for the selected Google AI Studio project.
- **The free quota was reached:** wait for the limit to reset. Do not enable
  billing unless you choose to use paid service.
- **The microphone does not start:** allow microphone access for
  `http://127.0.0.1:3000` in your browser settings, then reload the page.
- **The camera does not start:** allow camera access for
  `http://127.0.0.1:3000` in your browser settings. Camera access requires
  `localhost` or HTTPS; you can attach a saved image if your device has no
  camera or permission is unavailable.
- **Web search reaches its free rate limit:** wait and try again later. Tavily
  keyless search needs no account, payment, or card.

## Development mode

For Node.js changes, this command restarts the server when `server.js` changes:

```powershell
npm run dev
```
