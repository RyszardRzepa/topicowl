/**
 * AI-First Writing Prompt using Generated Outline
 * Simplified approach that relies on AI understanding rather than complex template parsing
 */
export const writingWithOutline = (data: {
  title: string;
  outlineMarkdown: string;
  researchData: string;
  sources: Array<{ url: string; title?: string }>;
  videos?: Array<{ title: string; url: string }>;
  notes?: string;
  maxWords: number;
  toneOfVoice: string;
  excludedDomains?: string[];
}) => `
You are an expert content writer. Write a comprehensive article following this exact outline structure.

<article_requirements>
Title: ${data.title}
Target Word Count: ${data.maxWords} words
Tone: ${data.toneOfVoice}
${data.notes ? `Additional Notes: ${data.notes}` : ""}
</article_requirements>

<outline_to_follow>
${data.outlineMarkdown}

IMPORTANT: Follow this outline structure exactly. Each H2 heading in the outline should become an H2 heading in your article. Use the guidance under each heading to write the content for that section.
</outline_to_follow>

<research_data>
${data.researchData}
</research_data>

<available_sources>
${data.sources.map((s, i) => `[${i + 1}] ${s.title ?? 'Source'}: ${s.url}`).join('\n')}
</available_sources>

${data.videos?.length ? `<available_videos>
${data.videos.map(v => `- ${v.title}: ${v.url}`).join('\n')}
</available_videos>` : ''}

<writing_instructions>
1. **Structure**: Follow the outline exactly - use H2 headings as specified
2. **Content**: Write according to the guidance provided under each heading in the outline
3. **Links**: Include clickable links to sources in markdown format: [link text](url)
4. **Length**: Aim for approximately ${data.maxWords} words total
5. **Flow**: Ensure smooth transitions between sections
6. **Format**: Generate clean markdown that requires no post-processing

**Critical**: 
- Start with H1 title: # ${data.title}
- Follow immediately with an engaging intro paragraph
- Use the exact H2 headings from the outline
- Include specific data, statistics, and examples from the research
- End with a strong conclusion
${data.excludedDomains?.length ? `- AVOID linking to these excluded domains: ${data.excludedDomains.join(', ')}` : ''}
</writing_instructions>

Write the complete article now, following the outline structure exactly:`;