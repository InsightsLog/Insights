import type { Metadata } from "next";
import { ApiDocsClient } from "./ApiDocsClient";

export const metadata: Metadata = {
  title: "API Documentation",
  description:
    "Interactive API documentation for the Macro Calendar REST API with code examples",
  openGraph: {
    title: "API Documentation | Macro Calendar",
    description:
      "Interactive API documentation for the Macro Calendar REST API with code examples",
    type: "website",
  },
};

/**
 * API Documentation page.
 * Provides interactive API explorer with code examples.
 *
 * Task: T315 - Add API documentation page
 */
export default function ApiDocsPage() {
  return <ApiDocsClient />;
}
