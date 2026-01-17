import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 格式化AI回复文本，去除多余空格，保持自然格式
 * - 去除中文字符之间的空格
 * - 保留英文单词之间的空格
 * - 去除行首行尾空格
 * - 合并多个连续空格为单个空格
 * - 保留段落之间的换行（两个换行符）
 * - 去除超过两个的连续换行符
 * @param text 输入文本
 * @param trimEnd 是否去除末尾空格（流式输出时建议设为false，避免吞掉正在输入的换行符）
 */
export function formatAIText(text: string, trimEnd: boolean = true): string {
  if (!text) return text;
  
  // 中文字符、中文标点、数字、emoji的Unicode范围
  const cjkPattern = /[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef0-9\u{1F300}-\u{1F9FF}]/u;
  const cjkPunctuation = /[，。！？；：、""''（）【】《》]/;
  
  let result = text;
  
  // 只有非流式（最终结果）或者明确要求时才去除首尾
  if (trimEnd) {
    result = result.trim();
  } else {
    // 流式模式下，只去除开头的空白
    result = result.trimStart();
  }
  
  // 循环处理，直到没有更多中文字符之间的空格
  let previousResult = '';
  while (result !== previousResult) {
    previousResult = result;
    // 去除中文字符/数字/emoji之间的单个空格
    result = result.replace(/([\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef0-9\u{1F300}-\u{1F9FF}]) +([\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef0-9\u{1F300}-\u{1F9FF}])/gu, '$1$2');
    // 去除中文字符和中文标点之间的空格
    result = result.replace(/([\u4e00-\u9fa5]) +([，。！？；：、""''（）【】《》])/g, '$1$2');
    result = result.replace(/([，。！？；：、""''（）【】《》]) +([\u4e00-\u9fa5])/g, '$1$2');
    // 去除中文标点之间的空格
    result = result.replace(/([，。！？；：、""''（）【】《》]) +([，。！？；：、""''（）【】《》])/g, '$1$2');
  }
  
  result = result
    // 合并多个连续空格为单个空格（但保留换行符）
    .replace(/[ \t]+/g, ' ')
    // 去除每行首尾空格（但保留换行符）
    .split('\n')
    // 如果是流式且并非最后一行，才trim；或者是最后一行但trimEnd为true，也trim。
    // 但为了简单，每行都trim是没问题的，因为trim()不影响换行符本身，只影响行内的首尾空格
    .map(line => line.trim())
    .join('\n')
    // 去除超过两个的连续换行符（保留段落分隔）
    .replace(/\n{3,}/g, '\n\n');

  // 最后根据配置决定是否去除整体末尾空白
  return trimEnd ? result.trim() : result;
}