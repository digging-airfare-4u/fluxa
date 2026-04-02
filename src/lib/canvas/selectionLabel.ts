/**
 * Selection label helpers
 * Requirements: Image selection displays custom descriptions when present
 */

export interface SelectionLabelInput {
  type: string;
  label?: string | null;
}

const TYPE_LABELS: Record<string, string> = {
  'i-text': '文本',
  'text': '文本',
  'textbox': '文本',
  'image': '图片',
  'rect': '矩形',
  'circle': '圆形',
  'triangle': '三角形',
  'path': '路径',
  'group': '组合',
};

export function getSelectionDisplayLabel({ type, label }: SelectionLabelInput): string {
  const trimmedLabel = label?.trim();
  if (trimmedLabel) {
    return trimmedLabel;
  }

  return TYPE_LABELS[type] || type;
}
