import { ReactNode } from 'react';
import FAQItem from './FAQItem';

interface FAQQuestion {
  question: string;
  answer: ReactNode;
}

interface FAQCategoryProps {
  title: string;
  questions: FAQQuestion[];
}

export default function FAQCategory({ title, questions }: FAQCategoryProps) {
  return (
    <div className="mb-16">
      <div className="mb-8">
        <h2 className="text-2xl font-black text-[#191715] mb-2">{title}</h2>
        <div className="h-0.5 bg-gradient-to-r from-[#4131e0] to-transparent w-24"></div>
      </div>
      <div className="space-y-4">
        {questions.map((item) => (
          <FAQItem key={item.question} question={item.question} answer={item.answer} />
        ))}
      </div>
    </div>
  );
}
