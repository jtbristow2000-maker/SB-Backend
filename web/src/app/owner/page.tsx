import { redirect } from "next/navigation";

// The standalone Callbacks screen was retired — its triage now lives on Today (Needs
// Attention) and the full pipeline lives on Leads. Keep the /owner route working by
// sending it straight to Today. (Restore point: branch `with-callbacks-page`.)
export default function OwnerIndex() {
  redirect("/owner/today");
}
