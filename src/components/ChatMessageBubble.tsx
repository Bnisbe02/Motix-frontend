import { ChatMessage } from '../types/chat';
import DetectionCard from './DetectionCard';

interface ChatMessageBubbleProps {
  message: ChatMessage;
}

export default function ChatMessageBubble({ message }: ChatMessageBubbleProps) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[75%] bg-[#4131e0] text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start mb-4">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 bg-[#191715] rounded-full flex items-center justify-center flex-shrink-0">
          <span className="text-white text-xs font-black">M</span>
        </div>
        <div className="flex flex-col">
          <div
            className={`max-w-[75%] rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed shadow-sm ${
              message.isError
                ? 'bg-red-50 border border-red-200 text-red-700'
                : 'bg-white border border-gray-200 text-gray-800'
            }`}
          >
            {message.content}
          </div>
          {message.detections && message.detections.length > 0 && (
            <DetectionCard detections={message.detections} />
          )}
        </div>
      </div>
    </div>
  );
}
