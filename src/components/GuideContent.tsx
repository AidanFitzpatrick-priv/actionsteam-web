import Markdown from "react-markdown";

export function GuideContent({ content }: { content: string }) {
  return (
    <div className="guide-content">
      <Markdown>{content}</Markdown>
    </div>
  );
}
