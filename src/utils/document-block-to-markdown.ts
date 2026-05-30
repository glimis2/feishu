
function getTextFromElements(elements?: Array<{ text_run?: { content?: string } }>): string {
  return elements?.map(el => el.text_run?.content || '').join('') || '';
}

/**
 * 将飞书文档转换为 markdown格式
 * 大概有40+ 的if判断，有对应的sdk
 */
export function blocksToMarkdown(blocks): string {
  return blocks.map(block => {
    switch (block.block_type) {
      case 3:
        return `# ${getTextFromElements(block.heading1?.elements)}`;
      case 2:
        return getTextFromElements(block.text?.elements);
      case 4:
        return `## ${getTextFromElements(block.heading2?.elements)}`;
      case 5:
        return `### ${getTextFromElements(block.heading3?.elements)}`;
      case 6:
        return `#### ${getTextFromElements(block.heading4?.elements)}`;
      case 7:
        return `##### ${getTextFromElements(block.heading5?.elements)}`;
      case 8:
        return `###### ${getTextFromElements(block.heading6?.elements)}`;
      case 11:
        return `- ${getTextFromElements(block.bullet?.elements)}`;
      case 12:
        return `1. ${getTextFromElements(block.bullet?.elements)}`;
      case 14:
        const code = getTextFromElements(block.code?.elements);
        const language = block.code?.style?.language || '';
        return `\`\`\`${language}\n${code}\n\`\`\``;
      case 15:
        return `> ${getTextFromElements(block.quote?.elements)}`;
      default:
        return '';
    }
  }).filter(line => line !== '').join('\n\n');
}
