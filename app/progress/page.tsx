import type { Metadata } from "next";
import { ProgressView } from "./ProgressView";

export const metadata: Metadata = { title: "your progress" };

// Logged-out visitors are sent to /login by the proxy before this page loads
export default function ProgressPage() {
  return <ProgressView />;
}
