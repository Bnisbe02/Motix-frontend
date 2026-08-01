import { ReactNode, useState, FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

interface LayoutProps {
  children: ReactNode;
}

interface ContactFormData {
  name: string;
  email: string;
  company: string;
  message: string;
}

export default function Layout({ children }: LayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [formData, setFormData] = useState<ContactFormData>({
    name: '',
    email: '',
    company: '',
    message: '',
  });
  const [formStatus, setFormStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const location = useLocation();
  const { addToast } = useToast();

  const isActive = (path: string): boolean => location.pathname === path;

  const handleFieldChange = (field: keyof ContactFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
      setFormData(prev => ({ ...prev, [field]: e.target.value }));
    };

  const handleOpenMobileMenu = (): void => setMobileMenuOpen(true);
  const handleCloseMobileMenu = (): void => setMobileMenuOpen(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormStatus('submitting');
    setErrorMessage('');

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/contact`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to submit form');
      }

      setFormStatus('success');
      setFormData({ name: '', email: '', company: '', message: '' });
      addToast('success', "Thanks for reaching out - we'll be in touch soon.");
      setTimeout(() => setFormStatus('idle'), 5000);
    } catch (error) {
      setFormStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'An error occurred');
      addToast('error', 'Failed to send. Please check your connection and try again.');
    }
  };

  const navLinks = [
    { path: '/', label: 'Home' },
    { path: '/overview', label: 'Overview' },
    { path: '/faq', label: 'FAQ' },
    { path: '/stack', label: 'Stack' },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* NAVBAR */}
      <nav className="sticky top-0 bg-white border-b border-gray-200 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Left: Logo */}
            <Link to="/" className="flex flex-col">
              <span className="font-black text-2xl text-green">MOTIX</span>
              <span className="text-dark text-[9px] uppercase tracking-widest -mt-1">
                WE HEARD THAT
              </span>
            </Link>

            {/* Center: Nav Links (hidden on mobile) */}
            <div className="hidden md:flex items-center space-x-8">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`text-sm font-medium transition-colors pb-1 ${
                    isActive(link.path)
                      ? 'text-primary border-b-2 border-primary'
                      : 'text-dark hover:text-primary'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <a
                href="#contact"
                className="text-sm font-medium text-dark hover:text-primary transition-colors"
              >
                Contact
              </a>
            </div>

            {/* Right: Login Button + Hamburger */}
            <div className="flex items-center gap-4">
              <Link
                to="/app"
                className="bg-primary text-white px-6 py-2 rounded-lg text-sm font-semibold hover:brightness-95 interactive-base"
              >
                LOGIN
              </Link>
              <button
                onClick={handleOpenMobileMenu}
                className="md:hidden text-dark"
                aria-label="Open menu"
              >
                <Menu size={24} />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* MOBILE MENU */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-white z-50 md:hidden">
          <div className="flex flex-col h-full">
            {/* Close Button */}
            <div className="flex justify-end p-4">
              <button
                onClick={handleCloseMobileMenu}
                className="text-dark"
                aria-label="Close menu"
              >
                <X size={24} />
              </button>
            </div>

            {/* Nav Links */}
            <div className="flex-1 flex flex-col items-center justify-center space-y-8">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={handleCloseMobileMenu}
                  className={`text-2xl font-medium transition-colors ${
                    isActive(link.path)
                      ? 'text-primary'
                      : 'text-dark hover:text-primary'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <a
                href="#contact"
                onClick={handleCloseMobileMenu}
                className="text-2xl font-medium text-dark hover:text-primary transition-colors"
              >
                Contact
              </a>
            </div>

            {/* Login Button */}
            <div className="p-8">
              <Link
                to="/app"
                onClick={handleCloseMobileMenu}
                className="block w-full bg-primary text-white px-6 py-3 rounded-lg text-center text-sm font-semibold hover:brightness-95 interactive-base"
              >
                LOGIN
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* MAIN CONTENT */}
      <main className="flex-1">{children}</main>

      {/* FOOTER */}
      <footer id="contact" className="bg-dark text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Contact Form Section */}
          <div className="mb-12 max-w-3xl mx-auto">
            <h2 className="text-3xl font-black mb-6">Request Early Access</h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Name and Email Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    required
                    value={formData.name}
                    onChange={handleFieldChange('name')}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    required
                    value={formData.email}
                    onChange={handleFieldChange('email')}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="your@email.com"
                  />
                </div>
              </div>

              {/* Company/Organisation */}
              <div>
                <label htmlFor="company" className="block text-sm font-medium mb-2">
                  Company/Organisation
                </label>
                <input
                  type="text"
                  id="company"
                  required
                  value={formData.company}
                  onChange={handleFieldChange('company')}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Your company"
                />
              </div>

              {/* Message */}
              <div>
                <label htmlFor="message" className="block text-sm font-medium mb-2">
                  Message
                </label>
                <textarea
                  id="message"
                  required
                  rows={4}
                  value={formData.message}
                  onChange={handleFieldChange('message')}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                  placeholder="Tell us about your needs..."
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={formStatus === 'submitting'}
                className="w-full bg-primary text-white px-8 py-4 rounded-lg font-semibold hover:brightness-95 interactive-base disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {formStatus === 'submitting' ? 'Submitting...' : 'Submit Request'}
              </button>
            </form>
          </div>

          {/* 4-Column Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
            {/* MOTIX Brand Column */}
            <div>
              <div className="flex flex-col mb-4">
                <span className="font-black text-2xl text-green">MOTIX</span>
                <span className="text-[9px] uppercase tracking-widest -mt-1">
                  WE HEARD THAT
                </span>
              </div>
              <p className="text-gray-400 text-sm">
                Real-time radio ad verification for Australian media.
              </p>
            </div>

            {/* Product Links */}
            <div>
              <h3 className="font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link to="/overview" className="text-gray-400 hover:text-green transition-colors">
                    Overview
                  </Link>
                </li>
                <li>
                  <Link to="/stack" className="text-gray-400 hover:text-green transition-colors">
                    Stack
                  </Link>
                </li>
                <li>
                  <Link to="/faq" className="text-gray-400 hover:text-green transition-colors">
                    FAQ
                  </Link>
                </li>
              </ul>
            </div>

            {/* Company Links */}
            <div>
              <h3 className="font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="#contact" className="text-gray-400 hover:text-green transition-colors">
                    About
                  </a>
                </li>
                <li>
                  <a href="#contact" className="text-gray-400 hover:text-green transition-colors">
                    Contact
                  </a>
                </li>
              </ul>
            </div>

            {/* Legal Links */}
            <div>
              <h3 className="font-semibold mb-4">Legal</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link to="/privacy" className="text-gray-400 hover:text-green transition-colors">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <a href="#" className="text-gray-400 hover:text-green transition-colors">
                    Terms of Service
                  </a>
                </li>
                <li>
                  <a href="#" className="text-gray-400 hover:text-green transition-colors">
                    Cookie Policy
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Copyright Bar */}
          <div className="border-t border-gray-800 pt-8">
            <p className="text-center text-gray-400 text-sm">
              © {new Date().getFullYear()} MOTIX. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
