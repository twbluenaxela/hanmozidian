export interface SourceCredit {
  institution: string;
  license: string;
  url: string;
}

export const SOURCE_CREDITS: Record<string, SourceCredit> = {
  npm: {
    institution: "國立故宮博物院，台北",
    license: "CC BY 4.0",
    url: "www.npm.gov.tw",
  },
  "zi.tools": {
    institution: "zi.tools",
    license: "CC BY-SA 4.0",
    url: "zi.tools",
  },
  zhuojg: {
    institution: "書法字跡",
    license: "CC BY-NC-SA 4.0",
    url: "zhuojg.com",
  },
};

export function formatAttribution(
  source: string | null | undefined,
  workName: string | null | undefined
): string | null {
  if (!source) return null;
  const credit = SOURCE_CREDITS[source];
  if (!credit) return null;
  const parts = [workName, credit.institution, `${credit.license} @ ${credit.url}`];
  return parts.filter(Boolean).join("。");
}
