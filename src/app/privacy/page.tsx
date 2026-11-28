import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy · Divine Church" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="28 November 2026">
      <p>
        This app is used by Divine Church (Manikonda, Hyderabad) to plan sermons, present them on the church screen
        and manage the church&apos;s own YouTube live streams. It is operated by the church for its own use and is not
        offered to the public.
      </p>

      <h2>Who uses it</h2>
      <p>Only church administrators who sign in with an admin account. Members of the public do not create accounts.</p>

      <h2>Information the app stores</h2>
      <ul>
        <li>Sermon plans, notes, Bible references, uploaded media and church details. These are stored in the browser of the church computer that uses the app.</li>
        <li>A sign-in session cookie for the administrator.</li>
      </ul>

      <h2>Google and YouTube data</h2>
      <p>
        When an administrator connects the church&apos;s YouTube channel, the app requests the
        <code className="mx-1 rounded bg-stone-100 px-1">https://www.googleapis.com/auth/youtube</code>
        permission. It uses it only to:
      </p>
      <ul>
        <li>read the connected channel&apos;s name and link;</li>
        <li>create, schedule, start and end live broadcasts on that channel, and read their status and live viewer count;</li>
        <li>create a reusable stream key for the church&apos;s streaming software (OBS);</li>
        <li>add chapter timestamps to the description of the church&apos;s own live videos.</li>
      </ul>
      <p>
        Google sign-in tokens are stored encrypted in a secure, http-only cookie on the administrator&apos;s browser.
        They are not stored in any database, not shared with anyone, not sold, and not used for advertising.
        The app&apos;s use of information received from Google APIs adheres to the
        {" "}<a className="text-gold-700 underline" href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</a>, including the Limited Use requirements.
        The app uses YouTube API Services; see also the
        {" "}<a className="text-gold-700 underline" href="https://policies.google.com/privacy">Google Privacy Policy</a>.
      </p>

      <h2>Removing access</h2>
      <p>
        An administrator can disconnect YouTube at any time in Settings → Live streaming, or revoke access at
        {" "}<a className="text-gold-700 underline" href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a>.
        Disconnecting deletes the stored tokens.
      </p>

      <h2>Contact</h2>
      <p>For questions, please contact the Divine Church office.</p>
    </LegalPage>
  );
}
