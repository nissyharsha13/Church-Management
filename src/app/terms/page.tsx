import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Terms of Use · Divine Church" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Use" updated="28 November 2026">
      <p>
        This app is an internal tool of Divine Church for planning and presenting sermons and managing the
        church&apos;s live streams. Access is limited to church administrators.
      </p>
      <h2>Use</h2>
      <ul>
        <li>Use the app only for the church&apos;s ministry activities.</li>
        <li>Keep the admin password and YouTube stream key private.</li>
        <li>Only stream and display content the church has the right to use.</li>
      </ul>
      <h2>YouTube</h2>
      <p>
        Live streaming features use YouTube API Services. By connecting a channel you also agree to the
        {" "}<a className="text-gold-700 underline" href="https://www.youtube.com/t/terms">YouTube Terms of Service</a>.
      </p>
      <h2>No warranty</h2>
      <p>The app is provided as-is for the church&apos;s own use.</p>
    </LegalPage>
  );
}
