# Live streaming setup (YouTube + OBS)

How it fits together:

```
Cameras + mics ──► OBS (on the church laptop) ──RTMPS──► YouTube
                     ▲   captures the presenter screen
                     │   window and the cameras
   Our console ──────┘  remote-controls OBS (scenes, mics, start/stop)
        └─────────────► YouTube API: creates the broadcast, goes live, ends, adds chapters
```

There are three one-time steps. Part A is done once by whoever manages the app's hosting. Parts B and C are done once on each computer that runs OBS.

---

## A. Google Cloud: let the app talk to YouTube (once, ~15 minutes)

Do this with the Google account that **owns or manages the church YouTube channel**.

1. Open **https://console.cloud.google.com** → project menu → **New project** → name it `Divine Church App` → **Create**.
2. **APIs & Services → Library** → search **YouTube Data API v3** → **Enable**.
3. **APIs & Services → OAuth consent screen** (also called "Google Auth Platform"; direct link https://console.cloud.google.com/auth/audience):
   - User type: **External** → Create.
   - **Branding**: App name `Divine Church`; user support email and developer contact: your email;
     home page `https://church-management-xi.vercel.app`; privacy policy `https://church-management-xi.vercel.app/privacy`;
     terms `https://church-management-xi.vercel.app/terms`; authorized domain `church-management-xi.vercel.app`.
     **Leave the logo empty.** A logo triggers Google's brand verification, which takes weeks.
     The **Publish app** button stays disabled until these are filled in.
   - **Scopes**: add `https://www.googleapis.com/auth/youtube`.
   - **Test users**: add the Google account that manages the channel.
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**.
   - **Authorized redirect URIs**: `https://church-management-xi.vercel.app/api/youtube/callback`
     (add `http://localhost:3000/api/youtube/callback` too if you also run it locally).
   - Create, then copy the **Client ID** and **Client secret**.
5. **Vercel → church-management → Settings → Environment Variables**, add (Production, Sensitive):
   - `GOOGLE_CLIENT_ID` = the client ID
   - `GOOGLE_CLIENT_SECRET` = the client secret

   Then redeploy (Deployments → ⋯ → Redeploy).
6. **Important: publish the app.** On the OAuth consent screen click **Publish app → In production**.
   - While the app is in **Testing**, Google disconnects it every **7 days**.
   - After publishing, Google shows a one-time **"Google hasn't verified this app"** warning when you connect. Click **Advanced → Go to Divine Church (unsafe)**. That warning only means Google hasn't reviewed *our* app; you are granting access to your own app.
   - A full Google verification (privacy policy, demo video) is only needed if many other churches will use the app.
7. In the app: **Settings → Live streaming → Connect YouTube**. Sign in with the channel's account. If the account manages several channels (e.g. a Brand Account), pick the church channel.

> The channel must have live streaming enabled: YouTube Studio → **Create → Go live**. The first time, YouTube can take up to 24 hours after phone verification.

---

## B. OBS on the church laptop (Windows), once

1. Install **OBS Studio** (version 30 or newer) from https://obsproject.com.
2. **Enable remote control:** in OBS, **Tools → WebSocket Server Settings** → tick **Enable WebSocket server** → **Show Connect Info** → copy the **Server Password**.
3. In our app (on the same laptop, in Chrome): **Settings → Live streaming → OBS on this computer**:
   - Address `ws://127.0.0.1:4455`, paste the password → **Save & test**.
   - Click **Send YouTube key to OBS**. OBS now streams to the church channel; you never need to copy the key by hand.
   - If Chrome asks to allow the site to access devices on your local network, click **Allow**. This is how the app reaches OBS on the same laptop.
4. **Scenes:** each scene becomes a button in the console. In OBS's Scenes box, click **+** and create:

   | Scene | Sources to add (Sources box → **+**) |
   |---|---|
   | `Screen + Pulpit` | **Video Capture Device** (pulpit camera), then **Window Capture** (the Chrome screen window *Church Management — display*) on top. Resize the screen to a corner, or use full size with the camera small |
   | `Pulpit cam` | Video Capture Device → pulpit camera |
   | `Wide cam` | Video Capture Device → second camera |
   | `Screen only` | **Display Capture** of the projector monitor (or Window Capture of the screen window) |

   - **Same picture as the projector:** use **Display Capture** of the projector monitor. Online viewers then see exactly what the hall sees.
   - **Separate cameras on Windows:** a camera can usually be opened by only one program. Let **OBS own the cameras**. To show the camera on the church projector as well ("verses over camera"), start **OBS → Start Virtual Camera**, set it to output only the camera scene, and pick **OBS Virtual Camera** in the console's Camera panel.
5. **Audio (mics):**
   - **Mixer:** with a sound mixer, connect its USB or line output to the laptop and add it in OBS as **Audio Input Capture**. One input carries all the mics, in sync.
   - **USB mics:** add each as its own **Audio Input Capture**.
   - **Video sound:** for videos played from the app, add **Application Audio Capture → chrome.exe**.
   - Every audio input appears in the console with a level meter and a mute button.
6. **Output settings** (Settings → Output, Simple mode):
   - Video bitrate **4500 Kbps** for 1080p, or **2500** for 720p.
   - Encoder: **Hardware (NVENC / QuickSync / AMF)** if available.
   - Run a speed test at church: you need at least **6 Mbps upload** for 1080p, or 3 Mbps for 720p.

## C. OBS on a Mac (Apple Silicon), for testing at home

Same as B, with these differences:
- Install the Apple Silicon build of OBS.
- macOS asks for **Camera**, **Microphone** and **Screen Recording** permission for OBS: System Settings → Privacy & Security.
- Use **macOS Screen Capture** (window or display) for the presenter screen, and **Video Capture Device** for cameras.
- A Mac lets Chrome and OBS use the same camera, so the virtual-camera step isn't needed.

---

## On Sunday

1. Open OBS on the laptop and leave it minimised. It doesn't need to be touched.
2. Open the sermon in the app → **Save & Start now** → **Open screen window**.
3. The console's **Live stream** panel shows OBS (green dot), the scenes and the mic meters.
4. Press **Go live**. The app then:
   - loads the key into OBS;
   - starts OBS streaming;
   - waits until YouTube is receiving video;
   - takes the broadcast live.

   Each press of Go live after a stream has ended creates a **new** YouTube broadcast (YouTube can't restart an ended one).

   If **"Go live automatically"** is on in Settings, YouTube goes live by itself once video arrives.
5. During the service, switch cameras with the scene buttons and mute or unmute mics from the console.
6. **End sermon** asks whether to end the stream too, or press **End stream**. YouTube ends the broadcast, OBS stops, and **chapters** (Welcome, each verse, prayer, videos) are added to the video description automatically.

### Troubleshooting

| Message | Fix |
|---|---|
| "Can't reach OBS" | OBS is closed, or WebSocket server isn't enabled (B2), or Chrome's local-network prompt was blocked (site settings → allow) |
| "Wrong OBS password" | Copy the password again from OBS → Tools → WebSocket Server Settings |
| "Waiting for video. OBS isn't connected to the console" | Press **Connect OBS** in the Live stream panel (OBS must be open on the same computer), or click **Start Streaming** in OBS yourself. Go live continues as soon as video arrives |
| "No video reached YouTube in 2 minutes" | Check OBS shows *LIVE* at the bottom; check the internet; press **Send YouTube key to OBS** again |
| "Live streaming isn't enabled" | YouTube Studio → Create → Go live (wait up to 24 h the first time) |
| YouTube shows a **black picture** but audio works | OBS is sending an empty or blocked picture. Check the console's **"What YouTube sees · OBS"** preview, then see *Black picture on YouTube* below |
| "YouTube sign-in expired" | Settings → Live streaming → Disconnect → Connect YouTube. Make sure step A6 (publish) was done |

### Black picture on YouTube (audio works)

YouTube shows exactly what OBS's **Program** shows. The church presentation screen is a separate Chrome window; OBS must **capture** it.

1. **Look at OBS's main preview.** If it's black there, it's black on YouTube. The console's *"What YouTube sees · OBS"* thumbnail shows the same.
2. **Mac: allow OBS** in **System Settings → Privacy & Security**:
   - **Camera** → turn on **OBS**
   - **Screen & System Audio Recording** → turn on **OBS**

   Then **quit and reopen OBS**. Without these, video sources show black while microphones still work.
3. **Add sources to the scene that is live** (the scene highlighted red in the console). In OBS, click that scene, then under **Sources** click **+**:
   - **Video Capture Device** → choose your camera.
   - **macOS Screen Capture** (Mac) or **Window Capture** (Windows) → Method/Type **Window** → choose the Chrome window **"Presentation Screen — Divine Church"**.
     - If you use the camera too, drag the screen capture above the camera and resize it.
     - Or use **Display Capture** of the projector monitor to send exactly what the hall sees.
   **Mac: macOS Screen Capture shows grey** for the Chrome window:
   - The window must not be in full screen (macOS puts full-screen windows on their own Space and OBS then sees grey). In the presentation window press **F** to leave full screen. Don't minimise it either.
   - In System Settings → Privacy & Security → **Screen & System Audio Recording**, select OBS, remove it with **–**, add it again with **+**, then **quit and reopen OBS** (a permission granted while OBS was open often shows grey until the restart).
   - In the source, set **Method: Window Capture** and pick the window again from the list after restarting. If it's still grey, try **Method: Display Capture** to confirm the permission works.
   - Chrome → Settings → System → **Use graphics acceleration** on (the default). Then restart Chrome.
4. Switch scenes from the console and watch the thumbnail change. When it isn't black, YouTube isn't either (YouTube runs about 10–20 seconds behind).
