import { ImageUploadPanel } from "./ImageUploadPanel";

export function AnswerKeyPanel({ onUploaded }: { onUploaded: (imageUrl: string) => void }) {
  return (
    <ImageUploadPanel
      title="上传答案与评分标准"
      description="从本地选择答案、评分细则或评分标准图片。"
      alt="答案与评分标准图片"
      buttonLabel="选择答案与评分标准图片"
      emptyLabel="上传答案与评分标准图片"
      aspectClassName="aspect-[16/23]"
      onUploaded={onUploaded}
    />
  );
}
