import { ImageUploadPanel } from "./ImageUploadPanel";

export function HardwareImagePanel({ onUploaded }: { onUploaded: (imageUrl: string) => void }) {
  return (
    <ImageUploadPanel
      title="上传学生试卷"
      description="从本地选择学生作答后的试卷图片。"
      alt="学生试卷图片"
      buttonLabel="选择本地试卷图片"
      emptyLabel="上传学生试卷图片"
      aspectClassName="aspect-[3/4]"
      priority
      onUploaded={onUploaded}
    />
  );
}
