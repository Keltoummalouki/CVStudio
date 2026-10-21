import { getDocumentProxy } from "unpdf";

/**
 * A PDF's text in the order the file stores it, one text line per line: the
 * order copy-paste and most ATS parsers read, whatever the page looks like.
 */
export async function readPdfText(bytes: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  try {
    let text = "";
    for (let number = 1; number <= pdf.numPages; number += 1) {
      const content = await (await pdf.getPage(number)).getTextContent();
      for (const item of content.items) {
        if ("str" in item) text += item.str + (item.hasEOL ? "\n" : "");
      }
      text += "\n";
    }
    return text;
  } finally {
    await pdf.loadingTask.destroy();
  }
}
