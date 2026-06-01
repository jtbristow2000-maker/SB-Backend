import { redirect } from "next/navigation";

// The clickable Sandbox Console (a dev/test simulator) has been retired now that
// the system is exercised with real phone calls. The app's home is the owner
// dashboard. The Twilio webhook routes it used to drive still exist and are now
// hit by real Twilio traffic.
export default function Home() {
  redirect("/owner/today");
}
