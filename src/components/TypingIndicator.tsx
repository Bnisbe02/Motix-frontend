export default function TypingIndicator() {
  return (
    <div className="flex justify-start mb-4">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 bg-[#191715] rounded-full flex items-center justify-center flex-shrink-0">
          <span className="text-white text-xs font-black">M</span>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
          <div className="flex items-center gap-1">
            <span
              className="w-2 h-2 bg-gray-400 rounded-full inline-block animate-bounce"
              style={{ animationDelay: '0ms' }}
            ></span>
            <span
              className="w-2 h-2 bg-gray-400 rounded-full inline-block animate-bounce"
              style={{ animationDelay: '75ms' }}
            ></span>
            <span
              className="w-2 h-2 bg-gray-400 rounded-full inline-block animate-bounce"
              style={{ animationDelay: '150ms' }}
            ></span>
          </div>
        </div>
      </div>
    </div>
  );
}
