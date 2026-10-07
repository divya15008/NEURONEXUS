END-TO-END VERIFICATION DATASET
================================

Purpose:
A synthetic benchmark for testing the complete Research Paper Automation & Journal Readiness Platform.

Pipeline:
1. Upload DOCX
2. Parse document
3. Detect metadata/sections/headings
4. Detect tables/figures/equations/captions
5. Extract citations and references
6. Verify citation/reference consistency
7. Apply journal-specific rules
8. Evaluate journal suitability/readiness
9. Repair/normalize formatting
10. Generate publication-ready DOCX
11. Generate PDF
12. Generate submission-readiness report
13. Package submission artifacts

20 test cases are included:
- Clean/pass cases
- Missing sections
- Heading errors
- Missing/uncited/duplicate references
- Caption placement errors
- Equation/reference errors
- Anonymous ACM review case
- Camera-ready workflow case
- Long abstract
- Journal scope mismatch
- Research-quality incompleteness
- Formatting corruption
- Mixed citation styles
- Missing author metadata
- Missing referenced objects
- Word-limit violation
- Full end-to-end noisy manuscript

Ground truth:
test_manifest.json
expected_results.json
golden_output_schema.json
journal_rules.json
verification_rubric.csv

IMPORTANT:
The dataset is synthetic and is intended for automated regression testing.
Official publisher/journal instructions remain the source of truth for actual submission.
