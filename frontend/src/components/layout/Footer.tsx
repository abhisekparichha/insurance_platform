import { Link } from 'react-router-dom';
import BrandMark from './BrandMark';
import { CATEGORY_TREE } from '../../lib/categoryTree';

const Footer = () => {
  return (
    <footer className="border-t border-paper-strong bg-navy-900 text-ink-on">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand column */}
          <div className="lg:col-span-2">
            <BrandMark tone="light" size="md" />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-onmuted">
              InsureIQ is an IRDAI-registered web aggregator helping Indians compare insurance policies
              with transparent ratings and unbiased analysis.
            </p>
            <p className="mt-3 text-xs text-ink-onmuted/60">
              Web Aggregator License No. XXXXXX &middot; Issued by IRDAI
            </p>
          </div>

          {/* Categories */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-gold">
              Categories
            </h3>
            <ul className="mt-4 space-y-2">
              {CATEGORY_TREE.map((group) => (
                <li key={group.id}>
                  <Link
                    to={`/c/${group.id}`}
                    className="text-sm text-ink-onmuted transition-colors hover:text-ink-on"
                  >
                    {group.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-gold">
              Company
            </h3>
            <ul className="mt-4 space-y-2">
              <li>
                <Link to="/methodology" className="text-sm text-ink-onmuted transition-colors hover:text-ink-on">
                  Rating Methodology
                </Link>
              </li>
              <li>
                <a href="#" className="text-sm text-ink-onmuted transition-colors hover:text-ink-on">
                  About Us
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-ink-onmuted transition-colors hover:text-ink-on">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-ink-onmuted transition-colors hover:text-ink-on">
                  Terms of Use
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-ink-onmuted transition-colors hover:text-ink-on">
                  Grievance Redressal
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 flex flex-col items-start gap-3 border-t border-white/10 pt-8 text-xs text-ink-onmuted/60 sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} InsureIQ Technologies Pvt Ltd. All rights reserved.</p>
          <p className="max-w-lg text-right leading-relaxed">
            Insurance is the subject matter of solicitation. IRDAI Registration Number XXXXXX.
            Please read all policy wordings carefully before purchasing.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
