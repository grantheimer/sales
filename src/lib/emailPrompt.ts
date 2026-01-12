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
    "Coding Intelligence is an IMO Health solution focused on encounter-level coding accuracy, especially around the primary diagnosis and laterality. At its core is a curated grouper of unacceptable primary diagnosis (UPD) codes and other codes that should not be billed as the primary diagnosis. The solution continuously flags encounters where unspecified, non-primary, or otherwise unacceptable codes have been documented as the primary diagnosis, which would typically lead to rework, denials, and write-offs if left uncorrected. Coding Intelligence fires real-time alerts when a UPD code is entered in the primary diagnosis field, giving coders and clinicians the chance to correct it before the claim goes out the door. It also detects conflicting diagnosis combinations and Excludes 1 errors—which for many customers occur as frequently as, or more frequently than, unspecified laterality or non-primary code issues—and surfaces them for correction. Health systems use Coding Intelligence because payers are always looking for reasons to deny or delay claims, and incorrect primary codes, unspecified codes, and Excludes 1 conflicts are common, expensive errors. With Coding Intelligence in place, customers have prevented denials that would have been almost certain, reduced manual chart review and rebill work, and recovered revenue that would otherwise have been written off, leading to substantial, clearly measurable ROI.",
  Discovery:
    "Discovery is an IMO Health solution used by health systems to improve visibility into revenue, coding, and operational performance opportunities across large datasets. It helps revenue integrity, finance, and operational leaders identify patterns of leakage or variation that would be hard to see in traditional reports and ad hoc queries, and then turn those insights into prioritized, actionable worklists. For HCC and value-based care programs, Discovery brings together three major sources of opportunity: structured data from prior inpatient, ambulatory, and specialty encounters; unstructured clinical notes analyzed with IMO clinical AI to surface conditions that are not reliably represented on the problem list; and external payer data, where claims feeds are ingested so payer HCC suggestions and supporting documentation can be reviewed in the same workflow. These signals are compiled and presented to providers, often in the context of primary care visits, so they can confirm, update, or close gaps during the encounter instead of after the fact. Health systems looking to improve value-based care performance use Discovery to capture appropriate HCCs more consistently, strengthen documentation and data quality, and support patient safety and financial outcomes by reducing missed risk and avoidable variation.",
  Periop:
    "Periop is IMO Health's perioperative solution that maps CPT and HCPCS codes to the surgical scheduling dictionary system-wide. It ensures that scheduled cases are consistently and accurately coded up front, rather than relying on manual mappings in siloed OR scheduling systems. Health systems buy Periop because it leads to fewer inpatient-only denials, improves case duration accuracy for staffing and room utilization, and prevents denials caused by incorrect or incomplete HCPCS codes associated with surgeries. The ROI for Periop is highly measurable: customers can tie avoided denials, recovered revenue, and more accurate block utilization directly back to better code-to-schedule alignment.",
  Procedure:
    "Procedure is an IMO Health solution that maintains comprehensive, performable care services terms and code mappings in EHR dictionaries, supporting consistent clinician documentation and ensuring more detailed and accurate data. Customers gain complete coverage of performable care services, including mappings that connect procedure data, lab results, and organisms to applicable code sets such as CPT, ICD-10, LOINC, HCPCS, and SNOMED. Procedure ensures accurate billing and consistent clinical terminology across the EHR, aligns with USCDI V3 and V4 data element requirements, and helps enhance tracking of patient safety measures for improved outcomes and reimbursement in value-based purchasing and HEDIS. It is especially valuable for organizations that need greater accuracy in LOINC mapping and is one of the strongest solutions available on the market for this need. Outdated and incorrectly mapped codes increase rework, drive up denials, and delay reimbursements for health systems, which impacts cash flow and creates financial risk across revenue cycle operations. Constant code changes, thousands of chargeable services, and complex mappings frequently lead to vague terms and missing information; Procedure reduces this burden by providing curated mappings so organizations avoid poor documentation, patient safety issues, redundant lab testing, system integration issues, and imprecise eCQM and HEDIS reporting.",
  "Medical Necessity":
    "Medical Necessity is an IMO Health solution that helps health systems ensure that ordered services and procedures meet payer medical necessity requirements before they are performed, preventing avoidable denials and rework. It surfaces real-time alerts when an order is placed without sufficient clinical relevance for coverage, prompting providers to review and adjust the diagnosis. Using IMO Health–enabled search, clinicians can quickly resolve notices of non-coverage by selecting a clinically appropriate, covered diagnosis that aligns with payer medical necessity criteria. This keeps documentation, diagnosis selection, and medical necessity rules in sync so that the right services are supported up front rather than being questioned after the fact. Health systems use Medical Necessity to protect revenue, reduce downstream manual follow-up, and improve the patient experience by minimizing delays and surprise denials. For many customers, the solution delivers strong, directly attributable ROI because it measurably reduces medical necessity-related denials and associated write-offs.",
  "Precision Sets":
    "Precision Sets is an IMO Health solution that provides carefully curated, clinically informed value sets to support accurate patient cohorting, decision support, analytics, and workflow automation. It includes a large library of out-of-the-box, industry-standard value sets and also gives customers the ability to create and refine their own custom value sets using the embedded Value Set Editor, all within a single tool. IMO maintains and updates the standard value sets over time so they stay aligned with evolving clinical practice and code set changes, reducing the burden on local teams to keep content current. Health systems use Precision Sets when they need reliable cohort definitions for clinical trials, population health initiatives, research, quality measurement, and downstream data analysis—any situation where getting the 'right' group of patients is critical. By centralizing and governing value sets in one solution, organizations reduce one-off logic, improve consistency across reports and applications, and make it easier for clinical, analytics, and informatics teams to work from the same definitions.",
  Normalize:
    "Normalize is an IMO Health solution that standardizes and normalizes disparate clinical and financial data so downstream analytics, coding, and operational tools can trust the inputs. Built on award‑winning NLP that efficiently extracts clinical concepts from free text using named entity recognition, Normalize can detect clinical entities in unstructured notes, understand whether those concepts are present, absent, or possible, uncover relationships between them, recognize time-related details, and identify sections within clinical narratives to add structure and context. It then comprehensively maps these concepts to IMO Health terms and all relevant standard code sets across problem, procedure, medication, and lab domains (including ICD‑10‑CM, SNOMED CT, CPT, HCPCS, RxNorm, LOINC, and others), creating more accurate, complete, and reusable data. Health systems use Normalize whenever they need to merge or compare disparate datasets into a single view, reduce manual mapping and cleanup, and drive more reliable analytics and automation at scale. The solution can be deployed as SaaS or integrated into local or cloud environments via API to extract and standardize clinical data at high volume.",
};

export function buildLlmPromptForContact(contact: EmailPromptContact): string {
  const product = contact.opportunity.product as Product;
  const detailedProductInfo = PRODUCT_EMAIL_CONTEXT[product];
  const roleClause = contact.role ? `, ${contact.role}` : '';
  const internalNotes = (contact.notes?.trim() || 'No additional internal notes.').slice(0, 500);

  return `You are an expert B2B sales writer with years of successful enterprise sales experience. You also have a decade of experience in the clinical coding space, giving you a deep understanding of the issues which IMO Health's solutions are able to solve. Your task is to generate a concise, friendly, and relatively formal email.
The email is to ${contact.name}${roleClause} at ${contact.health_system.name}.
I want to introduce them for the first time to our ${product} solution.

Here is detailed product and positioning information for ${product}. Use this to inform the email, but do not repeat it verbatim:
${detailedProductInfo}

Here are internal notes about this contact and account. Use them only as context and do not repeat them verbatim:
${internalNotes}

First, generate a concise, professional subject line that does not exceed 50 characters.
Then generate the email body.

The greeting must be: "Hi [first name]," OR "Hi Dr. [last name]," if the contact appears to be a physician (MD, DO, or a clinical title like Chief Medical Officer). Use just the first name for non-physicians.

The first line after the greeting must be exactly: "Hope your year has been off to a great start."

Then write a 4–5 sentence body. Vary the sentence lengths so they flow in an incredibly smooth, natural cadence—mix shorter punchy sentences with longer ones. Within those sentences, briefly explain what ${product} does and why it matters for someone in this role at a health system.
The final sentence of the body must be a clear call-to-action question inviting them to a 30-minute introductory call (for example, asking if you could meet sometime in the next two weeks for a 30-minute intro), and it must be phrased as a question.
End the email with exactly "Thank you." as the closing line (no signature block needed).

Format your response like this exactly:

Subject: <subject line>

Hi [name],

Hope your year has been off to a great start.

<body here>

Thank you.`;
}
