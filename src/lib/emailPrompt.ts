import type { Product } from '@/lib/supabase';

// Minimal shape needed by the prompt builder so it can be reused outside the Todo page.
export type EmailPromptContact = {
  name: string;
  role: string | null;
  notes: string | null;
  health_system: {
    name: string;
  };
  opportunity: {
    product: string;
  };
};

// Detailed product context used to inform LLM email prompts.
// These strings are intentionally rich so the LLM can compress them into concise copy.
export const PRODUCT_EMAIL_CONTEXT: Record<Product, string> = {
  Core:
    "Core is IMO Health's robust problem list management solution for health systems. It provides problem categorization, cleanup of noisy and outdated problem lists, surfacing of problem-related medications and labs, and stronger HCC management at the point of care. Major health systems buy Core because it ensures better clinical data beginning at the encounter, which leads to higher overall data quality and more accurate risk adjustment. That in turn supports higher reimbursement, primarily through better HCC capture, and reduces downstream rework for coding and revenue integrity teams. Clinicians also have a better experience when the problem list is accurate, de-duplicated, and easy to scan in busy workflows.",
  "Coding Intelligence":
    "Coding Intelligence is focused on encounter-level coding accuracy, especially around the primary diagnosis and laterality. It continuously flags encounters with incorrect or suboptimal primary codes, or where laterality is missing or inconsistent with the clinical documentation, before those encounters are billed. Health systems buy Coding Intelligence because they know insurers are always looking for reasons to deny or delay claims, and incorrect primary codes or missing laterality are common, expensive errors. With Coding Intelligence in place, customers have prevented denials that would otherwise have been almost certain and have recovered millions of dollars in revenue that would have been written off or required large amounts of manual follow-up. It also reduces the manual review burden on coding teams by automatically surfacing the riskiest encounters.",
  Discovery:
    "Discovery is an IMO Health solution used by health systems to improve visibility into revenue, coding, and operational performance opportunities across large datasets. It helps revenue integrity, finance, and operational leaders identify patterns of leakage or variation that would be hard to see in traditional reports and ad hoc queries. (Detailed Discovery positioning can be expanded here later; for now, focus on how it helps leaders systematically find and act on missed financial and operational opportunities at scale.)",
  Periop:
    "Periop is IMO Health's perioperative solution that maps CPT and HCPCS codes to the surgical scheduling dictionary system-wide. It ensures that scheduled cases are consistently and accurately coded up front, rather than relying on manual mappings in siloed OR scheduling systems. Health systems buy Periop because it leads to fewer inpatient-only denials, improves case duration accuracy for staffing and room utilization, and prevents denials caused by incorrect or incomplete HCPCS codes associated with surgeries. The ROI for Periop is highly measurable: customers can tie avoided denials, recovered revenue, and more accurate block utilization directly back to better code-to-schedule alignment.",
  Procedure:
    "Procedure is an IMO Health solution focused on procedure-level data quality and revenue integrity. It helps health systems ensure that procedure coding, documentation, and related attributes are complete and consistent across systems, reducing avoidable denials and rework. (Detailed product-specific positioning can be refined later; until then, emphasize that it protects procedural revenue and reduces manual validation for coding and revenue integrity teams.)",
  "Medical Necessity":
    "Medical Necessity is an IMO Health solution that helps health systems ensure that ordered services and procedures meet payer medical necessity requirements before they are performed. It is typically used by utilization management, revenue cycle, and access teams to prevent denials and delays tied to insufficient documentation or inappropriate orders. (More detailed, product-specific positioning can be added later; focus on reducing medical necessity denials and protecting both patient access and hospital revenue.)",
  "Precision Sets":
    "Precision Sets is an IMO Health solution that provides carefully curated, clinically informed groupers and value sets to support decision support, analytics, and workflow automation. Health systems use it to standardize how conditions, procedures, and services are grouped and analyzed across multiple systems. (Detailed positioning can be expanded later; until then, highlight that it improves consistency, reduces custom one-off logic, and makes it easier for clinical and revenue teams to work from the same definitions.)",
  Normalize:
    "Normalize is an IMO Health solution that focuses on standardizing and normalizing disparate clinical and financial data across sources so downstream analytics, coding, and operational tools can trust the inputs. It is typically used by data, analytics, and IT teams to reduce the amount of custom mapping and cleanup they have to maintain. (Detailed product positioning can be refined later; for now, emphasize that it improves data consistency, lowers maintenance overhead, and enables more reliable analytics and automation on top of normalized data.)",
};

export function buildLlmPromptForContact(contact: EmailPromptContact): string {
  const product = contact.opportunity.product as Product;
  const detailedProductInfo = PRODUCT_EMAIL_CONTEXT[product];
  const roleClause = contact.role ? `, ${contact.role}` : '';
  const internalNotes = (contact.notes?.trim() || 'No additional internal notes.').slice(0, 500);

  return `You are an expert B2B sales email writer.

Generate a concise, friendly, relatively formal outreach email.
The email is to ${contact.name}${roleClause} at ${contact.health_system.name}.
I want to introduce them for the first time to our ${product} solution.

Here is detailed product and positioning information for ${product}. Use this to inform the email, but do not repeat it verbatim:
${detailedProductInfo}

Here are internal notes about this contact and account. Use them only as context and do not repeat them verbatim:
${internalNotes}

First, generate a concise, professional subject line that does not exceed 50 characters.
Then generate the email body.

Write the body in 4–6 sentences, no more and no fewer.
Within those sentences, briefly explain what ${product} does and why it matters for someone in this role at a health system.
The final sentence should offer a 30-minute introductory call, but do not suggest specific times or dates.
End the email with exactly "Thank you." as the closing line (no signature block needed).

Format your response like this exactly:

Subject: <subject line>
<email body here>

Thank you.`;
}
