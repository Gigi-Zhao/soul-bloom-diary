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
 */
export function formatAIText(text: string): string {
  if (!text) return text;
  
  // 中文字符、中文标点、数字、emoji的Unicode范围
  const cjkPattern = /[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef0-9\u{1F300}-\u{1F9FF}]/u;
  const cjkPunctuation = /[，。！？；：、""''（）【】《》]/;
  
  let result = text
    // 先去除首尾空白
    .trim();
  
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
  
  return result
    // 合并多个连续空格为单个空格（但保留换行符）
    .replace(/[ \t]+/g, ' ')
    // 去除行首行尾空格（但保留换行符）
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    // 去除超过两个的连续换行符（保留段落分隔）
    .replace(/\n{3,}/g, '\n\n')
    // 最后再次去除首尾空白
    .trim();
}