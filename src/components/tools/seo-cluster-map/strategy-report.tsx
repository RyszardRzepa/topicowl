"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  ChevronRight,
  Target,
  Layers,
  Link,
  TrendingUp,
  FileText,
} from "lucide-react";
import { StrategyExport } from "./strategy-export";

interface StrategyReportProps {
  strategy: string;
  sources?: Array<{
    id: string;
    url: string;
    title?: string;
  }>;
  websiteUrl?: string;
}

interface ParsedStrategy {
  pillarTopic: {
    title: string;
    keyword: string;
    description: string;
  };
  clusterCategories: Array<{
    category: string;
    topics: Array<{
      title: string;
      keyword: string;
    }>;
  }>;
  linkingStrategy: string[];
  strategicValue: string[];
}

export function StrategyReport({
  strategy,
  sources,
  websiteUrl,
}: StrategyReportProps) {
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({
    pillar: true,
    clusters: true,
    linking: false,
    value: false,
    full: false,
  });

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const parseStrategy = (strategyText: string): ParsedStrategy => {
    const lines = strategyText.split("\n");

    const parsed: ParsedStrategy = {
      pillarTopic: {
        title: "",
        keyword: "",
        description: "",
      },
      clusterCategories: [],
      linkingStrategy: [],
      strategicValue: [],
    };

    let currentSection = "";
    let currentCategory = "";
    let currentCategoryTopics: Array<{ title: string; keyword: string }> = [];
    let pillarContent: string[] = [];
    let linkingContent: string[] = [];
    let valueContent: string[] = [];

    for (const currentLine of lines) {
      const line = currentLine ?? "";
      const trimmedLine = line.trim();

      // Skip empty lines
      if (!trimmedLine) continue;

      // Detect main sections (more flexible matching)
      if (/🎯.*PILLAR|PILLAR.*TOPIC/i.exec(trimmedLine)) {
        currentSection = "pillar";
        pillarContent = [];
        continue;
      }
      if (/🗂.*CLUSTER|CLUSTER.*ARTICLES/i.exec(trimmedLine)) {
        currentSection = "clusters";
        // Process collected pillar content
        if (pillarContent.length > 0) {
          const pillarText = pillarContent.join("\n");
          // Extract title from quotes or bold text
          const titleMatch = /"([^"]+)"|'([^']+)'|\*\*([^*]+)\*\*/.exec(
            pillarText,
          );
          if (titleMatch) {
            parsed.pillarTopic.title =
              titleMatch[1] ?? titleMatch[2] ?? titleMatch[3] ?? "";
          }
          // Extract keyword
          const keywordMatch = /keyword[:\s]*([^\n]+)/i.exec(pillarText);
          if (keywordMatch) {
            parsed.pillarTopic.keyword = keywordMatch[1]?.trim() ?? "";
          }
          parsed.pillarTopic.description = pillarText;
        }
        continue;
      }
      if (/🔗.*LINKING|LINKING.*STRUCTURE/i.exec(trimmedLine)) {
        currentSection = "linking";
        linkingContent = [];
        continue;
      }
      if (/📈.*STRATEGIC|STRATEGIC.*VALUE/i.exec(trimmedLine)) {
        currentSection = "value";
        valueContent = [];
        continue;
      }

      // Collect content based on current section
      if (currentSection === "pillar") {
        pillarContent.push(line);
      } else if (currentSection === "clusters") {
        // Look for category headers (lines with colons)
        if (/^[-*]\s*([^:]+):\s*(\d+[-–]\d+|$)/.exec(trimmedLine)) {
          // Save previous category
          if (currentCategory && currentCategoryTopics.length > 0) {
            parsed.clusterCategories.push({
              category: currentCategory,
              topics: [...currentCategoryTopics],
            });
          }
          // Start new category
          const categoryMatch = /^[-*]\s*([^:]+):/.exec(trimmedLine);
          currentCategory = categoryMatch?.[1]?.trim() ?? "";
          currentCategoryTopics = [];
        }
        // Look for cluster topics (indented items)
        else if (/^\s+[-*]\s+(.+)/.exec(trimmedLine)) {
          const topicMatch = /^\s+[-*]\s+(.+)/.exec(trimmedLine);
          if (topicMatch?.[1]) {
            const topicText = topicMatch[1].trim();
            currentCategoryTopics.push({
              title: topicText,
              keyword: topicText.toLowerCase(),
            });
          }
        }
        // Also catch direct bullet points that might be cluster topics
        else if (
          /^[-*]\s+(.+)/.exec(trimmedLine) &&
          !trimmedLine.includes(":")
        ) {
          const topicMatch = /^[-*]\s+(.+)/.exec(trimmedLine);
          if (topicMatch?.[1] && !currentCategory) {
            // If no category set, create a default one
            if (!currentCategory) {
              currentCategory = "Cluster Topics";
            }
            const topicText = topicMatch[1].trim();
            currentCategoryTopics.push({
              title: topicText,
              keyword: topicText.toLowerCase(),
            });
          }
        }
      } else if (currentSection === "linking") {
        linkingContent.push(line);
        if (trimmedLine.startsWith("-") || trimmedLine.startsWith("*")) {
          parsed.linkingStrategy.push(trimmedLine.replace(/^[-*]\s*/, ""));
        }
      } else if (currentSection === "value") {
        valueContent.push(line);
        if (trimmedLine.startsWith("-") || trimmedLine.startsWith("*")) {
          parsed.strategicValue.push(trimmedLine.replace(/^[-*]\s*/, ""));
        }
      }
    }

    // Don't forget the last category
    if (currentCategory && currentCategoryTopics.length > 0) {
      parsed.clusterCategories.push({
        category: currentCategory,
        topics: [...currentCategoryTopics],
      });
    }

    // If no structured parsing worked, try to extract cluster count from the raw text
    if (parsed.clusterCategories.length === 0) {
      // Look for numbered lists or bullet points that might be cluster topics
      const clusterMatches = strategyText.match(/[-*]\s+[^:\n]+(?:\n|$)/g);
      if (clusterMatches && clusterMatches.length > 3) {
        // Create a single category with all found topics
        const topics = clusterMatches.map((match) => {
          const text = match.replace(/^[-*]\s+/, "").trim();
          return { title: text, keyword: text.toLowerCase() };
        });
        parsed.clusterCategories.push({
          category: "Cluster Topics",
          topics: topics,
        });
      }
    }

    return parsed;
  };

  const parsedStrategy = parseStrategy(strategy);

  const highlightKeywords = (text: string) => {
    // Simple keyword highlighting - look for quoted text or capitalized phrases
    return text.replace(
      /["']([^"']+)["']/g,
      '<mark class="bg-yellow-200 px-1 rounded">$1</mark>',
    );
  };

  return (
    <div className="space-y-6">
      {/* Pillar Topic Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-xl">Pillar Topic Strategy</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleSection("pillar")}
            >
              {expandedSections.pillar ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardHeader>
        {expandedSections.pillar && (
          <CardContent className="space-y-4">
            {parsedStrategy.pillarTopic.title && (
              <div>
                <h4 className="mb-2 text-lg font-semibold">
                  Recommended Pillar Article
                </h4>
                <p
                  className="text-lg font-medium text-blue-700"
                  dangerouslySetInnerHTML={{
                    __html: highlightKeywords(parsedStrategy.pillarTopic.title),
                  }}
                />
              </div>
            )}
            {parsedStrategy.pillarTopic.keyword && (
              <div>
                <h4 className="mb-2 font-semibold">Target Keyword</h4>
                <Badge variant="secondary" className="text-sm">
                  {parsedStrategy.pillarTopic.keyword}
                </Badge>
              </div>
            )}
            {parsedStrategy.pillarTopic.description && (
              <div>
                <h4 className="mb-2 font-semibold">Strategy Overview</h4>
                <p
                  className="text-gray-700"
                  dangerouslySetInnerHTML={{
                    __html: highlightKeywords(
                      parsedStrategy.pillarTopic.description.trim(),
                    ),
                  }}
                />
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Cluster Topics Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-green-600" />
              <CardTitle className="text-xl">Cluster Articles</CardTitle>
              <Badge variant="outline">
                {parsedStrategy.clusterCategories.reduce(
                  (acc, cat) => acc + cat.topics.length,
                  0,
                )}{" "}
                topics
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleSection("clusters")}
            >
              {expandedSections.clusters ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardHeader>
        {expandedSections.clusters && (
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
              {parsedStrategy.clusterCategories.map((category, index) => (
                <div key={index} className="space-y-3">
                  <h4 className="border-b border-green-200 pb-1 text-lg font-semibold text-green-700">
                    {category.category}
                  </h4>
                  <ul className="space-y-2">
                    {category.topics.map((topic, topicIndex) => (
                      <li key={topicIndex} className="flex items-start gap-2">
                        <div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-green-500" />
                        <span
                          className="text-gray-700"
                          dangerouslySetInnerHTML={{
                            __html: highlightKeywords(topic.title),
                          }}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Linking Strategy Section */}
      {parsedStrategy.linkingStrategy.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Link className="h-5 w-5 text-purple-600" />
                <CardTitle className="text-xl">Linking Strategy</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleSection("linking")}
              >
                {expandedSections.linking ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardHeader>
          {expandedSections.linking && (
            <CardContent>
              <ul className="space-y-3">
                {parsedStrategy.linkingStrategy.map((item, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-purple-500" />
                    <span
                      className="text-gray-700"
                      dangerouslySetInnerHTML={{
                        __html: highlightKeywords(item),
                      }}
                    />
                  </li>
                ))}
              </ul>
            </CardContent>
          )}
        </Card>
      )}

      {/* Strategic Value Section */}
      {parsedStrategy.strategicValue.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-orange-600" />
                <CardTitle className="text-xl">Strategic Value</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleSection("value")}
              >
                {expandedSections.value ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardHeader>
          {expandedSections.value && (
            <CardContent>
              <ul className="space-y-3">
                {parsedStrategy.strategicValue.map((item, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-orange-500" />
                    <span
                      className="text-gray-700"
                      dangerouslySetInnerHTML={{
                        __html: highlightKeywords(item),
                      }}
                    />
                  </li>
                ))}
              </ul>
            </CardContent>
          )}
        </Card>
      )}

      {/* Sources Section */}
      {sources && sources.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Sources Analyzed</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {sources.map((source, index) => (
                <li key={index} className="flex items-center gap-2">
                  <div className="h-2 w-2 flex-shrink-0 rounded-full bg-gray-400" />
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate text-sm text-blue-600 hover:underline"
                  >
                    {source.title ?? source.url}
                  </a>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Export Section */}
      <StrategyExport strategy={strategy} websiteUrl={websiteUrl} />

      {/* Full Strategy as Markdown */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-gray-600" />
              <CardTitle className="text-xl">
                Complete Strategy Report
              </CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleSection("full")}
            >
              {expandedSections.full ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardHeader>
        {expandedSections.full && (
          <CardContent>
            <div className="prose prose-sm prose-headings:text-gray-900 prose-p:text-gray-700 prose-li:text-gray-700 prose-strong:text-gray-900 max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkBreaks]}
                components={{
                  // Custom styling for markdown elements
                  h1: ({ children }) => (
                    <h1 className="mb-4 text-2xl font-bold text-gray-900">
                      {children}
                    </h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="mt-6 mb-3 text-xl font-semibold text-gray-900">
                      {children}
                    </h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="mt-4 mb-2 text-lg font-semibold text-gray-900">
                      {children}
                    </h3>
                  ),
                  ul: ({ children }) => (
                    <ul className="mb-4 list-inside list-disc space-y-1">
                      {children}
                    </ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="mb-4 list-inside list-decimal space-y-1">
                      {children}
                    </ol>
                  ),
                  li: ({ children }) => (
                    <li className="text-gray-700">{children}</li>
                  ),
                  p: ({ children }) => (
                    <p className="mb-3 text-gray-700">{children}</p>
                  ),
                  strong: ({ children }) => (
                    <strong className="font-semibold text-gray-900">
                      {children}
                    </strong>
                  ),
                  em: ({ children }) => (
                    <em className="text-gray-700 italic">{children}</em>
                  ),
                  code: ({ children }) => (
                    <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-sm">
                      {children}
                    </code>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote className="my-4 border-l-4 border-blue-200 pl-4 text-gray-600 italic">
                      {children}
                    </blockquote>
                  ),
                }}
              >
                {strategy}
              </ReactMarkdown>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
