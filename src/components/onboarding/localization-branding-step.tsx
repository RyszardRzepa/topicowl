"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Palette, Loader2 } from "lucide-react";

interface LocalizationBrandingStepProps {
  initialData?: {
    citationRegion: string;
    brandColor?: string;
    languageCode?: string;
    languageName?: string;
  };
  onSubmit: (data: { citationRegion: string; brandColor?: string; languageCode?: string; languageName?: string }) => void;
  isLoading?: boolean;
}

const citationRegionOptions = [
  { value: "worldwide", label: "Worldwide" },
  { value: "us", label: "United States" },
  { value: "uk", label: "United Kingdom" },
  { value: "eu", label: "European Union" },
  { value: "ca", label: "Canada" },
  { value: "au", label: "Australia" },
];

export function LocalizationBrandingStep({ initialData, onSubmit, isLoading = false }: LocalizationBrandingStepProps) {
  const [citationRegion, setCitationRegion] = useState(initialData?.citationRegion ?? "worldwide");
  const [brandColor, setBrandColor] = useState(initialData?.brandColor ?? "#000000");
  const [languageCode, setLanguageCode] = useState(initialData?.languageCode ?? "en");
  const [languageName, setLanguageName] = useState(initialData?.languageName ?? "English");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      citationRegion,
      brandColor: brandColor !== "#000000" ? brandColor : undefined,
      languageCode,
      languageName,
    });
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl md:text-3xl">
          <Palette className="h-5 w-5" />
          Localization & Branding
        </CardTitle>
        <p className="text-sm text-muted-foreground">Choose localization preferences and brand color.</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Language selection - prefilled from website analysis */}
          <div className="space-y-2">
            <Label htmlFor="language">Content Language</Label>
            <p className="text-sm text-muted-foreground">Detected from your website. Choose the language for generated articles.</p>
            <Select
              value={languageCode}
              onValueChange={(val) => {
                setLanguageCode(val);
                // Best-effort mapping to human-readable name
                const map: Record<string, string> = {
                  en: "English",
                  "en-US": "English (US)",
                  "en-GB": "English (UK)",
                  es: "Spanish",
                  "es-ES": "Spanish (Spain)",
                  "es-MX": "Spanish (Mexico)",
                  pt: "Portuguese",
                  "pt-BR": "Portuguese (Brazil)",
                  fr: "French",
                  de: "German",
                  it: "Italian",
                  nl: "Dutch",
                  pl: "Polish",
                  sv: "Swedish",
                  no: "Norwegian",
                  da: "Danish",
                  fi: "Finnish",
                  cs: "Czech",
                  sk: "Slovak",
                  sl: "Slovenian",
                  hr: "Croatian",
                  sr: "Serbian",
                  ro: "Romanian",
                  bg: "Bulgarian",
                  hu: "Hungarian",
                  el: "Greek",
                  tr: "Turkish",
                  ru: "Russian",
                  uk: "Ukrainian",
                  he: "Hebrew",
                  ar: "Arabic",
                  fa: "Persian (Farsi)",
                  hi: "Hindi",
                  bn: "Bengali",
                  ur: "Urdu",
                  ta: "Tamil",
                  te: "Telugu",
                  ml: "Malayalam",
                  mr: "Marathi",
                  gu: "Gujarati",
                  pa: "Punjabi",
                  kn: "Kannada",
                  zh: "Chinese",
                  "zh-CN": "Chinese (Simplified)",
                  "zh-TW": "Chinese (Traditional)",
                  ja: "Japanese",
                  ko: "Korean",
                  th: "Thai",
                  vi: "Vietnamese",
                  id: "Indonesian",
                  ms: "Malay",
                  fil: "Filipino (Tagalog)",
                  sw: "Swahili",
                  am: "Amharic",
                };
                setLanguageName(map[val] ?? languageName);
              }}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder={languageName} />
              </SelectTrigger>
              <SelectContent position="popper" sideOffset={8} className="max-h-80 overflow-auto">
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="en-US">English (US)</SelectItem>
                <SelectItem value="en-GB">English (UK)</SelectItem>
                <SelectItem value="es">Spanish</SelectItem>
                <SelectItem value="es-ES">Spanish (Spain)</SelectItem>
                <SelectItem value="es-MX">Spanish (Mexico)</SelectItem>
                <SelectItem value="pt">Portuguese</SelectItem>
                <SelectItem value="pt-BR">Portuguese (Brazil)</SelectItem>
                <SelectItem value="fr">French</SelectItem>
                <SelectItem value="de">German</SelectItem>
                <SelectItem value="it">Italian</SelectItem>
                <SelectItem value="nl">Dutch</SelectItem>
                <SelectItem value="pl">Polish</SelectItem>
                <SelectItem value="sv">Swedish</SelectItem>
                <SelectItem value="no">Norwegian</SelectItem>
                <SelectItem value="da">Danish</SelectItem>
                <SelectItem value="fi">Finnish</SelectItem>
                <SelectItem value="cs">Czech</SelectItem>
                <SelectItem value="sk">Slovak</SelectItem>
                <SelectItem value="sl">Slovenian</SelectItem>
                <SelectItem value="hr">Croatian</SelectItem>
                <SelectItem value="sr">Serbian</SelectItem>
                <SelectItem value="ro">Romanian</SelectItem>
                <SelectItem value="bg">Bulgarian</SelectItem>
                <SelectItem value="hu">Hungarian</SelectItem>
                <SelectItem value="el">Greek</SelectItem>
                <SelectItem value="tr">Turkish</SelectItem>
                <SelectItem value="ru">Russian</SelectItem>
                <SelectItem value="uk">Ukrainian</SelectItem>
                <SelectItem value="he">Hebrew</SelectItem>
                <SelectItem value="ar">Arabic</SelectItem>
                <SelectItem value="fa">Persian (Farsi)</SelectItem>
                <SelectItem value="hi">Hindi</SelectItem>
                <SelectItem value="bn">Bengali</SelectItem>
                <SelectItem value="ur">Urdu</SelectItem>
                <SelectItem value="ta">Tamil</SelectItem>
                <SelectItem value="te">Telugu</SelectItem>
                <SelectItem value="ml">Malayalam</SelectItem>
                <SelectItem value="mr">Marathi</SelectItem>
                <SelectItem value="gu">Gujarati</SelectItem>
                <SelectItem value="pa">Punjabi</SelectItem>
                <SelectItem value="kn">Kannada</SelectItem>
                <SelectItem value="zh">Chinese</SelectItem>
                <SelectItem value="zh-CN">Chinese (Simplified)</SelectItem>
                <SelectItem value="zh-TW">Chinese (Traditional)</SelectItem>
                <SelectItem value="ja">Japanese</SelectItem>
                <SelectItem value="ko">Korean</SelectItem>
                <SelectItem value="th">Thai</SelectItem>
                <SelectItem value="vi">Vietnamese</SelectItem>
                <SelectItem value="id">Indonesian</SelectItem>
                <SelectItem value="ms">Malay</SelectItem>
                <SelectItem value="fil">Filipino (Tagalog)</SelectItem>
                <SelectItem value="sw">Swahili</SelectItem>
                <SelectItem value="am">Amharic</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="citationRegion">Citation Region</Label>
              <p className="text-sm text-muted-foreground">Preferred region for source citations</p>
              <Select value={citationRegion} onValueChange={setCitationRegion} disabled={isLoading}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={8} className="max-h-80 overflow-auto">
                  {citationRegionOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="brandColor">Brand Color</Label>
              <p className="text-sm text-muted-foreground">Primary color for styling elements</p>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  id="brandColor"
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  className="h-10 w-16 rounded border border-input bg-background"
                  disabled={isLoading}
                />
                <span className="text-sm font-mono">{brandColor}</span>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Continue
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default LocalizationBrandingStep;
