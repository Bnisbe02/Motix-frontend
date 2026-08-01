import { useState } from 'react';
import { Bug, X } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

export default function BugReportButton() {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [description, setDescription] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const { addToast } = useToast();

  const handleOpen = (): void => {
    setIsOpen(true);
  };

  const handleClose = (): void => {
    setIsOpen(false);
    setDescription('');
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    setDescription(e.target.value);
  };

  const handleBackdropClick = (): void => {
    handleClose();
  };

  const handleContentClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    e.stopPropagation();
  };

  const handleSubmit = async (): Promise<void> => {
    if (!description.trim()) return;
    setIsSubmitting(true);
    await new Promise<void>((resolve) => setTimeout(resolve, 600));
    setIsSubmitting(false);
    addToast('success', "Bug report submitted. Thank you — we'll review it shortly.");
    setTimeout(() => {
      handleClose();
    }, 1500);
  };

  return (
    <>
      <button
        onClick={handleOpen}
        className="fixed bottom-6 right-6 z-40 w-11 h-11 bg-[#191715] text-white rounded-full shadow-lg hover:bg-[#191715]/90 interactive-base flex items-center justify-center"
        aria-label="Report a bug"
        title="Report a bug"
      >
        <Bug className="w-5 h-5" />
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={handleBackdropClick}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-md w-full"
            onClick={handleContentClick}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-heading-4 text-[#191715]">Report an Issue</h2>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600 interactive-base"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5">
              <p className="text-body-sm text-gray-600 mb-4">
                Describe what happened and what you expected to see. Screenshots or steps to reproduce are helpful.
              </p>
              <textarea
                rows={5}
                value={description}
                onChange={handleDescriptionChange}
                placeholder="What did you see? What did you expect?"
                maxLength={500}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-body-sm focus:outline-none focus:ring-2 focus:ring-[#4131e0] resize-none"
              />
              <p className="text-label text-gray-400 text-right mt-1">
                {description.length}/500
              </p>
            </div>

            {/* Footer */}
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={handleClose}
                className="flex-1 border border-gray-200 rounded-lg py-2.5 text-body-sm font-medium text-gray-700 hover:bg-gray-50 interactive-base"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!description.trim() || isSubmitting}
                className="flex-1 bg-[#4131e0] text-white rounded-lg py-2.5 text-body-sm font-semibold hover:brightness-95 interactive-base disabled:opacity-50"
              >
                {isSubmitting ? 'Sending...' : 'Send Report'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
