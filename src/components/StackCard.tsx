import { ReactNode } from 'react';
import { Video as LucideIcon } from 'lucide-react';

interface StackCardProps {
  icon: LucideIcon;
  iconColor: 'green' | 'purple';
  title: string;
  description: string;
  tags: string[];
}

export default function StackCard({ icon: Icon, iconColor, title, description, tags }: StackCardProps) {
  const iconBgColor = iconColor === 'green' ? 'bg-green/10' : 'bg-primary/10';
  const iconTextColor = iconColor === 'green' ? 'text-green' : 'text-primary';

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
      <div className={`w-16 h-16 ${iconBgColor} rounded-xl flex items-center justify-center mb-6`}>
        <Icon className={`w-8 h-8 ${iconTextColor}`} />
      </div>
      <h3 className="text-2xl font-bold text-dark mb-4">{title}</h3>
      <p className="text-gray-600 mb-6 leading-relaxed">{description}</p>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
