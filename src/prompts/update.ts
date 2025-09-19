const update = (
  article: string,
  correctionsOrValidationText:
    | Array<{
        fact: string;
        issue: string;
        correction: string;
      }>
    | string,
  settings?: {
    toneOfVoice?: string;
    articleStructure?: string;
    maxWords?: number;
  },
) => {
  const currentDate = new Date().toISOString().split("T")[0];

  const toneOfVoice = settings?.toneOfVoice ?? "professional and informative";
  const articleStructure =
    settings?.articleStructure ?? "standard blog structure";
  const maxWords = settings?.maxWords ?? 600;

  const isValidationText = typeof correctionsOrValidationText === "string";

  return `
  <role>
  You are a senior content editor and fact-checker. Update the provided article with factual corrections while maintaining the original quality and structure.
  </role>
  
  <guidelines>
  - Maintain the exact structure: ${articleStructure}
  - Preserve tone of voice: ${toneOfVoice}
  - Keep length around: ${maxWords} words
  - Date: ${currentDate}
  - Make ONLY the necessary factual corrections
  - Do not change writing style, paragraph structure, or add new content sections
  - Do not introduce any new external links; preserve the original link set unless a link is explicitly flagged as broken in validation results
  - Do not invent new data (stats, names, prices, dates). Only modify claims directly supported by validation results
  </guidelines>
  
  <seo_preservation>
  - Maintain all SEO elements (meta title, description, slug)
  - Keep keyword density and placement intact
  - Preserve heading structure and hierarchy
  - Maintain internal linking strategy
  - Keep FAQPage schema structure if present
  </seo_preservation>
  
  <conflict_resolution>
  If corrections conflict with each other:
  1. Prioritize factual accuracy over style
  2. Maintain logical flow over exact word preservation
  3. Document any unresolvable conflicts in output
  </conflict_resolution>

  <word_count_handling>
  If corrections require exceeding word count by >50 words:
  - Prioritize accuracy over length
  - Note the variance in a comment
  - Suggest areas for potential condensation
  </word_count_handling>
  
  <original_article>
  ${article}
  </original_article>
  
  ${
    isValidationText
      ? `
  <validation_results>
  ${correctionsOrValidationText}
  </validation_results>
  
  <update_instructions>
  1. Review the validation results above
  2. If "No factual issues identified", return the article unchanged
  3. For each issue type, apply appropriate fixes:
  
  FACTUAL CORRECTIONS:
  - For each CLAIM with STATUS: UNVERIFIED or CONTRADICTED:
    - Locate the incorrect fact in the original article
    - Apply the correct information based strictly on the provided REASON and linked sources
    - Ensure corrections flow naturally with existing content
    - Maintain the same sentence structure and writing style
    - If a correction requires a source link, use an existing external link already present in the article or provided in the validation results; do not add new external URLs
  
  QUALITY CONTROL FIXES:
  - Address tone of voice inconsistencies by adjusting language and style
  - Fix structural problems while maintaining overall article flow
  - Improve keyword integration and density as needed
  - Enhance readability and engagement based on feedback
  
  TEMPLATE COMPLIANCE FIXES:
  - If Template Compliance Issues are present, prioritize fixing structural violations:
    - Add missing required sections (TL;DR, FAQ, etc.)
    - Ensure proper heading hierarchy (single H1, appropriate H2s)
    - Meet minimum word count requirements for sections
    - Add required number of TL;DR bullets and FAQ items
    - Include video/table sections if required by template
  - Follow the Template Requirements section exactly as specified
  - Maintain the exact section order and structure outlined in the template
  
  4. Preserve all other content exactly as written
  5. Keep the same word count (±50 words maximum variance) unless template compliance requires expansion
  6. Ensure all JSON schema fields remain properly formatted
  7. PRIORITY ORDER: Template structure compliance > Factual accuracy > Quality improvements > SEO preservation
  </update_instructions>
  `
      : `
  <corrections_required>
  Apply these specific factual corrections:
  ${(
    correctionsOrValidationText as Array<{
      fact: string;
      issue: string;
      correction: string;
    }>
  )
    .map(
      (c, index) => `
  CORRECTION ${index + 1}:
  - Original claim: "${c.fact}"
  - Issue identified: ${c.issue}
  - Correct information: "${c.correction}"
  `,
    )
    .join("")}
  </corrections_required>
  
  <update_instructions>
  1. Locate each incorrect fact in the original article
  2. Replace with the correct information seamlessly
  3. Ensure corrections flow naturally with existing content
  4. Maintain the same sentence structure and writing style
  5. Preserve all other content exactly as written
  6. Keep the same word count (±50 words maximum variance)
  7. Ensure all JSON schema fields remain properly formatted
  </update_instructions>
  `
  }
  
  <quality_control>
  Before finalizing, verify:
  ✅ All corrections have been applied accurately
  ✅ Writing style and tone remain unchanged
  ✅ Article structure is preserved
  ✅ Word count stays within target range
  ✅ SEO elements are maintained
  ✅ JSON schema compliance is preserved
  ✅ No new content sections added
  ✅ No new external links were introduced; broken links flagged by validation were removed or replaced only with provided links
  ✅ Factual accuracy is improved
  </quality_control>
  
  <output_format>
  Return EXACT JSON complying with blogPostSchema (id, title, slug, excerpt, metaDescription, introParagraph, readingTime, content, author, date, coverImage, imageCaption, tags, relatedPosts).
  </output_format>
  
  <final_reminder>
  Focus solely on factual corrections. Do not rewrite, restructure, or add new information. Maintain the article's original voice and flow. Do not invent any new facts, links, or schema fields.
  </final_reminder>
      `;
};

export default update;