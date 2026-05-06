export function buildBeItiePrompt(item: {
  title: string;
  author: string;
  dynasty: string;
  style: string;
  yearLabel?: string | null;
  summary?: string | null;
}) {
  return `你是一位精通中國書法史的學者，請針對以下碑帖撰寫六段中文解析內容。

碑帖資料：
- 名稱：${item.title}
- 作者：${item.author}
- 朝代：${item.dynasty}
- 書體：${item.style}${item.yearLabel ? `\n- 年代：${item.yearLabel}` : ""}${item.summary ? `\n- 簡介：${item.summary}` : ""}

請嚴格按照以下 JSON 格式輸出，不要輸出任何其他文字：

{
  "history": "歷史背景內容（200-300字）",
  "biography": "作者生平內容（200-300字）",
  "style": "書法風格分析（200-300字）",
  "influence": "影響傳承內容（200-300字）",
  "stories": "趣事典故內容（100-200字）",
  "practice": "臨摹建議（200-300字）"
}

每段可用 **粗體** 標記關鍵詞，段落之間用空行分隔（\\n\\n）。`;
}
