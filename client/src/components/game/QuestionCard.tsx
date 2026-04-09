interface QuestionCardProps {
  text: string;
}

export default function QuestionCard({ text }: QuestionCardProps) {
  return (
    <div className="question-card" id="question-card">
      <div className="question-diamond question-diamond--tl" />
      <div className="question-diamond question-diamond--tr" />
      <div className="question-diamond question-diamond--bl" />
      <div className="question-diamond question-diamond--br" />
      <h2 className="question-text">{text}</h2>
    </div>
  );
}
